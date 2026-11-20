/** An intentionally small OMR vocabulary for reviewing a single printed treble staff. */
export interface RecognizedNote {
  step: "C" | "D" | "E" | "F" | "G" | "A" | "B";
  octave: number;
  beats: 1 | 2 | 4;
}

interface Span {
  start: number;
  end: number;
}

interface Staff {
  top: number;
  bottom: number;
  gap: number;
  lines: Span[];
}

function unsupported(): never {
  throw new Error("unsupportedNotation");
}

function runs(count: number, active: (index: number) => boolean): Span[] {
  const spans: Span[] = [];
  for (let i = 0; i < count; i++) {
    if (!active(i)) continue;
    const start = i;
    while (i + 1 < count && active(i + 1)) i++;
    spans.push({ start, end: i });
  }
  return spans;
}

// Otsu's threshold adapts to dim paper, antialiasing and off-black print.
function inkMask(gray: Uint8Array) {
  const histogram = new Uint32Array(256);
  let total = 0;
  for (const value of gray) {
    histogram[value]++;
    total += value;
  }
  let count = 0,
    sum = 0,
    best = 0,
    threshold = 0;
  for (let i = 0; i < 255; i++) {
    count += histogram[i];
    sum += i * histogram[i];
    const remaining = gray.length - count;
    if (!count || !remaining) continue;
    const separation = sum / count - (total - sum) / remaining;
    const variance = count * remaining * separation ** 2;
    if (variance > best) {
      best = variance;
      threshold = i;
    }
  }
  if (!best) unsupported();
  return gray.map((value) => Number(value <= threshold));
}

function locateStaff(ink: Uint8Array, width: number, height: number): Staff {
  const rows = new Uint32Array(height);
  for (let y = 0; y < height; y++) {
    let run = 0;
    for (let x = 0; x < width; x++) {
      run = ink[y * width + x] ? run + 1 : 0;
      if (run > rows[y]) rows[y] = run;
    }
  }
  const lines = runs(height, (y) => rows[y] >= width * 0.27);
  if (lines.length !== 5) unsupported();
  const centers = lines.map(({ start, end }) => (start + end) / 2);
  const [top, , , , bottom] = centers;
  const gap = (bottom - top) / 4;
  if (gap < 6 || gap > 100) unsupported();
  for (let i = 0; i < 5; i++) {
    if (
      Math.abs(centers[i] - (top + i * gap)) > gap * 0.15 ||
      lines[i].end - lines[i].start + 1 > Math.max(2, gap * 0.33)
    )
      unsupported();
  }
  return { lines, gap, top, bottom };
}

/** Strip known staff lines and short ledger strokes. This separates glyphs in x
 * while keeping the stem and head visible between horizontal strokes. */
function stripLines(
  ink: Uint8Array,
  width: number,
  height: number,
  staff: Staff,
  removeHalo: boolean,
) {
  for (const { start, end } of staff.lines) {
    ink.fill(0, start * width, (end + 1) * width);
    if (!removeHalo) continue;
    // A resampled staff can spill one or two faint rows past its continuous
    // center. Peel off ink with no outward connection to a note or symbol.
    const halo = Math.max(1, Math.floor(staff.gap * 0.18));
    for (const direction of [-1, 1]) {
      const edge = direction < 0 ? start : end;
      for (let offset = halo; offset > 0; offset--) {
        const y = edge + direction * offset,
          outside = y + direction;
        if (outside < 0 || outside >= height) continue;
        for (let x = 0; x < width; x++) {
          if (
            !ink[outside * width + x] &&
            !(x > 0 && ink[outside * width + x - 1]) &&
            !(x + 1 < width && ink[outside * width + x + 1])
          )
            ink[y * width + x] = 0;
        }
      }
    }
  }
  for (const center of [staff.top - staff.gap, staff.bottom + staff.gap]) {
    const margin = Math.max(1, staff.gap * 0.14);
    for (
      let y = Math.max(0, Math.ceil(center - margin));
      y <= Math.min(height - 1, center + margin);
      y++
    ) {
      const strokes = runs(width, (x) => ink[y * width + x] !== 0);
      for (let i = 0; i < strokes.length; i++) {
        const start = strokes[i].start;
        let end = strokes[i].end;
        const next = strokes[i + 1];
        // An engraved ledger can be interrupted by the white center of a half note.
        if (
          next &&
          next.start - end < staff.gap * 0.6 &&
          next.end - start < staff.gap * 3 &&
          next.end - start >= staff.gap * 1.55
        ) {
          end = next.end;
          i++;
        }
        if (end - start + 1 >= staff.gap * 1.55)
          ink.fill(0, y * width + start, y * width + end + 1);
      }
    }
  }
}

interface Glyph {
  rows: Uint32Array;
  columns: Uint32Array;
  top: number;
  bottom: number;
}

function measureGlyph(
  ink: Uint8Array,
  width: number,
  span: Span,
  first: number,
  last: number,
): Glyph {
  const rows = new Uint32Array(last - first + 1);
  const columns = new Uint32Array(span.end - span.start + 1);
  let top = last,
    bottom = first;
  for (let y = first; y <= last; y++) {
    for (let x = span.start; x <= span.end; x++) {
      if (ink[y * width + x]) {
        columns[x - span.start]++;
        rows[y - first]++;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return { rows, columns, top, bottom };
}

function isBarline(glyph: Glyph, staff: Staff) {
  const { gap } = staff;
  return (
    glyph.columns.length <= gap * 0.65 &&
    Math.abs(glyph.top - staff.top) <= gap * 0.35 &&
    Math.abs(glyph.bottom - staff.bottom) <= gap * 0.35 &&
    glyph.columns.some((height) => height >= 2.6 * gap)
  );
}

// Only ignore a tall clef at the beginning, or two matching stacked time digits.
// The user confirms treble, no key signature, and 4/4 before accepting this mode.
function isClef(glyph: Glyph, { top, bottom, gap }: Staff) {
  return (
    glyph.top < top - gap * 0.45 &&
    glyph.bottom > bottom + gap * 0.45 &&
    glyph.columns.length >= gap * 1.25 &&
    glyph.columns.length <= gap * 3.4
  );
}

function isStackedTime(glyph: Glyph, first: number, staff: Staff) {
  const { top, bottom, gap } = staff;
  if (
    Math.abs(glyph.top - top) > gap * 0.4 ||
    Math.abs(glyph.bottom - bottom) > gap * 0.4 ||
    glyph.columns.length < gap * 0.6 ||
    glyph.columns.length > gap * 2.3
  )
    return false;
  let difference = 0,
    mass = 0;
  const half = Math.round(gap * 2);
  for (let i = 0; i < half; i++) {
    const row = Math.round(top) - first + i;
    const a = glyph.rows[row] ?? 0,
      b = glyph.rows[row + half] ?? 0;
    difference += Math.abs(a - b);
    mass += Math.max(a, b);
  }
  return mass > 0 && difference < mass * 0.25;
}

const steps = ["C", "D", "E", "F", "G", "A", "B"] as const;

// A hollow head has a gap enclosed by ink on both sides across multiple rows.
// Staff and ledger rows removed during segmentation are excluded from the vote.
function headFill(
  ink: Uint8Array,
  width: number,
  span: Span,
  headY: number,
  gap: number,
): "solid" | "hollow" {
  let examined = 0,
    hollow = 0,
    solid = 0;
  const center = (span.start + span.end) / 2;
  for (
    let y = Math.ceil(headY - gap * 0.29);
    y <= Math.floor(headY + gap * 0.29);
    y++
  ) {
    const strokes = runs(
      span.end - span.start + 1,
      (x) => ink[y * width + span.start + x] === 1,
    );
    if (!strokes.length) continue;
    examined++;
    if (
      strokes.length === 1 &&
      span.start + strokes[0].start < center - gap * 0.19 &&
      span.start + strokes[0].end > center + gap * 0.19
    )
      solid++;
    if (
      strokes.length === 2 &&
      strokes[1].start - strokes[0].end - 1 >= Math.max(1, gap * 0.1) &&
      span.start + strokes[0].end < center + gap * 0.35 &&
      span.start + strokes[1].start > center - gap * 0.35
    )
      hollow++;
  }
  if (examined >= 2 && solid >= examined * 0.85) return "solid";
  if (examined >= 2 && hollow >= examined * 0.6) return "hollow";
  return unsupported();
}

function pitchAt(
  headY: number,
  staff: Staff,
  beats: RecognizedNote["beats"],
): RecognizedNote {
  const position = ((staff.bottom - headY) * 2) / staff.gap;
  const diatonic = Math.round(position);
  if (Math.abs(position - diatonic) > 0.32 || diatonic < -2 || diatonic > 10)
    unsupported();
  const pitch = 4 * 7 + 2 + diatonic; // Bottom line = E4.
  return { step: steps[pitch % 7], octave: Math.floor(pitch / 7), beats };
}

function readNote(
  ink: Uint8Array,
  width: number,
  span: Span,
  first: number,
  glyph: Glyph,
  staff: Staff,
): RecognizedNote {
  const { gap } = staff;
  const glyphWidth = glyph.columns.length;
  const glyphHeight = glyph.bottom - glyph.top + 1;
  if (
    glyphHeight >= gap * 0.7 &&
    glyphHeight <= gap * 1.25 &&
    glyphWidth >= gap * 1.45 &&
    glyphWidth <= gap * 2.35
  ) {
    const y = (glyph.top + glyph.bottom) / 2;
    if (headFill(ink, width, span, y, gap) !== "hollow") unsupported();
    return pitchAt(y, staff, 4);
  }
  if (
    glyphWidth < gap * 0.8 ||
    glyphWidth > gap * 1.85 ||
    glyphHeight < gap * 2.45 ||
    glyphHeight > gap * 5.1
  )
    unsupported();

  // The stem must occupy exactly one narrow strip at the side of the head.
  const stems = runs(glyphWidth, (x) => glyph.columns[x] >= gap * 1.7);
  if (
    stems.length !== 1 ||
    stems[0].end - stems[0].start + 1 > Math.max(2, gap * 0.32)
  )
    unsupported();
  const stem = stems[0];
  const stemX = (stem.start + stem.end) / 2;
  const stemUp = stemX > glyphWidth / 2;
  if ((stemUp ? glyphWidth - 1 - stemX : stemX) > glyphWidth * 0.3)
    unsupported();

  // Wide rows locate one head. Other wide marks away from that head indicate
  // an unsupported chord, flag, or a symbol touching the note.
  let headTop = Infinity,
    headBottom = -Infinity,
    mass = 0,
    moment = 0;
  for (let y = glyph.top; y <= glyph.bottom; y++) {
    const pixels = glyph.rows[y - first];
    if (pixels < gap * 0.4) continue;
    headTop = Math.min(headTop, y);
    headBottom = Math.max(headBottom, y);
    mass += pixels;
    moment += pixels * y;
  }
  if (
    !mass ||
    headBottom - headTop > gap * 1.18 ||
    (stemUp ? glyph.bottom - headBottom : headTop - glyph.top) > gap * 0.21
  )
    unsupported();
  const headY = moment / mass;
  const fill = headFill(ink, width, span, headY, gap);
  return pitchAt(headY, staff, fill === "hollow" ? 2 : 1);
}

export function recognizeStaff(
  gray: Uint8Array,
  width: number,
  height: number,
  options: { deskewed?: boolean } = {},
): { bars: RecognizedNote[][] } {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 32 ||
    height < 24 ||
    width > 8192 ||
    height > 8192 ||
    width * height > 8_000_000 ||
    gray.length !== width * height
  )
    unsupported();
  const ink = inkMask(gray);
  const staff = locateStaff(ink, width, height);
  stripLines(ink, width, height, staff, !!options.deskewed);
  const first = Math.max(0, Math.floor(staff.top - staff.gap * 3.5));
  const last = Math.min(height - 1, Math.ceil(staff.bottom + staff.gap * 3.5));
  const spans = runs(width, (x) => {
    for (let y = first; y <= last; y++) if (ink[y * width + x]) return true;
    return false;
  });
  const bars: RecognizedNote[][] = [];
  let bar: RecognizedNote[] = [];
  let beats = 0;
  let previousBarline: number | undefined;
  let clefSeen = false,
    timeSeen = false;
  for (const [index, span] of spans.entries()) {
    const glyph = measureGlyph(ink, width, span, first, last);
    // Resampling can leave a pixel at the clipped start of a staff line.
    // Only discard this residue before a recognized clef, never between notes.
    if (
      index === 0 &&
      spans[1] &&
      glyph.columns.length <= Math.max(1, staff.gap * 0.15) &&
      glyph.bottom - glyph.top <= Math.max(2, staff.gap * 0.2) &&
      staff.lines.some(
        (line) => glyph.top <= line.end + 1 && glyph.bottom >= line.start - 1,
      ) &&
      isClef(measureGlyph(ink, width, spans[1], first, last), staff)
    )
      continue;
    if (isBarline(glyph, staff)) {
      if (bar.length) {
        if (beats !== 4) unsupported();
        bars.push(bar);
        bar = [];
        beats = 0;
      } else if (
        (previousBarline === undefined && (clefSeen || timeSeen)) ||
        (previousBarline !== undefined &&
          span.start - previousBarline > staff.gap)
      ) {
        unsupported(); // An empty measure, rather than adjacent double-bar strokes.
      }
      previousBarline = span.end;
      continue;
    }
    if (!bars.length && !bar.length) {
      if (!clefSeen && !timeSeen && isClef(glyph, staff)) {
        clefSeen = true;
        continue;
      }
      if (!timeSeen && isStackedTime(glyph, first, staff)) {
        timeSeen = true;
        continue;
      }
    }
    const note = readNote(ink, width, span, first, glyph, staff);
    beats += note.beats;
    if (beats > 4) unsupported();
    bar.push(note);
  }
  if (beats === 4) bars.push(bar);
  else if (bar.length) unsupported();
  if (!bars.length) unsupported();
  return { bars };
}
