import {
  measureGlyph,
  runs,
  unsupported,
  type Glyph,
  type Span,
  type Staff,
} from "./geometry";

import type { WrittenEvent } from "./reading";
type PrintedDuration = WrittenEvent["type"];
const durations = { whole: 4, half: 2, quarter: 1, eighth: 0.5 };
function event(type: PrintedDuration, positions: number[] = []): WrittenEvent {
  return { type, beats: durations[type], positions, dotted: false };
}

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

function staffPosition(headY: number, staff: Staff) {
  const position = (2 * (staff.bottom - headY)) / staff.gap;
  const snapped = Math.round(position);
  if (Math.abs(position - snapped) > 0.34 || snapped < -2 || snapped > 10)
    unsupported();
  return snapped === 0 ? 0 : snapped;
}
function ordinaryNote(
  ink: Uint8Array,
  width: number,
  span: Span,
  first: number,
  glyph: Glyph,
  staff: Staff,
  beamed = false,
): WrittenEvent {
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
    return event("whole", [staffPosition(y, staff)]);
  }
  if (
    glyphWidth < gap * 0.8 ||
    glyphWidth > gap * 1.85 ||
    glyphHeight < gap * 2.45 ||
    glyphHeight > gap * (beamed ? 10 : 5.1)
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
  return event(fill === "hollow" ? "half" : "quarter", [
    staffPosition(headY, staff),
  ]);
}

// Rest and flag outlines measured on independently engraved examples. Each
// hex row is a 12-column silhouette. Normalization keeps point size and
// removed staff strokes out of the comparison.
const patterns = {
  quarterRest:
    "0380300c01c00007c0fe0ff07fc3fe1fe07e07c0700600c61ff3fff0f00e00e00c008008",
  eighthRest:
    "83ec3fe3ff7f7ff7ff7fe73c3000000001801801801c01c00e00e00e0070070070030030",
  sixteenthUp:
    "0400400c00c01c01c03406c04c0dc09c0f40640440c40840840840c7c4fe07f07f03f00e",
  sixteenthDown:
    "7f0ffcffe7ff3ff0ff1033033033031831c317333f10f1870c306303f01f007003003003",
  eighthUp:
    "0400400c00c00c01c03c0340640440c40840840840c40c4044004007c0fe07f07f03f00e",
  eighthDown:
    "ff8ffeffe7ff3ff0ff0030831833033033033033031831e307303f00f00f003003003003",
} as const;

function sampleOutline(
  ink: Uint8Array,
  width: number,
  span: Span,
  glyph: Glyph,
  staff: Staff,
) {
  const counts = new Uint16Array(288),
    sums = new Uint16Array(288);
  const w = span.end - span.start + 1,
    h = glyph.bottom - glyph.top + 1;
  for (let y = glyph.top; y <= glyph.bottom; y++) {
    if (staff.lines.some((l) => y >= l.start && y <= l.end)) continue;
    const row = Math.floor(((y - glyph.top) * 24) / h);
    for (let x = span.start; x <= span.end; x++) {
      const i = row * 12 + Math.floor(((x - span.start) * 12) / w);
      counts[i]++;
      sums[i] += ink[y * width + x];
    }
  }
  return Int8Array.from(sums, (black, i) =>
    counts[i] ? Number(black > counts[i] * 0.45) : -1,
  );
}
function likeness(outline: Int8Array, pattern: string) {
  let both = 0,
    total = 0;
  for (let row = 0; row < 24; row++) {
    const bits = parseInt(pattern.slice(row * 3, row * 3 + 3), 16);
    for (let col = 0; col < 12; col++) {
      const i = row * 12 + col;
      const present = outline[i];
      if (present < 0) continue;
      const expected = (bits >> col) & 1;
      total += present + expected;
      both += present * expected;
    }
  }
  return total ? (2 * both) / total : 0;
}

function readRest(
  ink: Uint8Array,
  width: number,
  span: Span,
  glyph: Glyph,
  staff: Staff,
): WrittenEvent | null {
  const { gap, top } = staff;
  const w = glyph.columns.length / gap,
    h = (glyph.bottom - glyph.top + 1) / gap;
  const midpoint = (glyph.top + glyph.bottom) / 2;
  if (Math.abs(midpoint - (top + 2 * gap)) > gap * 0.9) return null;
  if (w >= 0.75 && w <= 1.85 && h >= 0.24 && h <= 0.7) {
    const fraction =
      glyph.columns.reduce((a, b) => a + b, 0) /
      (glyph.columns.length * (glyph.bottom - glyph.top + 1));
    if (fraction > 0.82) {
      if (Math.abs(glyph.top - (top + gap)) < gap * 0.24) return event("whole");
      if (Math.abs(glyph.bottom - (top + 2 * gap)) < gap * 0.24)
        return event("half");
    }
  }
  if (w > 0.6 && w < 1.65) {
    if (
      h > 2.25 &&
      h < 3.45 &&
      likeness(
        sampleOutline(ink, width, span, glyph, staff),
        patterns.quarterRest,
      ) > 0.68
    )
      return event("quarter");
    if (
      h > 1.4 &&
      h < 2.3 &&
      likeness(
        sampleOutline(ink, width, span, glyph, staff),
        patterns.eighthRest,
      ) > 0.72
    )
      return event("eighth");
  }
  return null;
}

function flaggedNote(
  ink: Uint8Array,
  width: number,
  span: Span,
  glyph: Glyph,
  staff: Staff,
): WrittenEvent | null {
  const { gap } = staff;
  const w = glyph.columns.length / gap,
    h = (glyph.bottom - glyph.top + 1) / gap;
  if (h < 3.15 || h > 5.35 || w < 0.85 || w > 2.5) return null;
  const outline = sampleOutline(ink, width, span, glyph, staff);
  const up = likeness(outline, patterns.eighthUp);
  const down = likeness(outline, patterns.eighthDown);
  if (Math.max(up, down) < 0.78) return null;
  const doubleFlag = up > down ? patterns.sixteenthUp : patterns.sixteenthDown;
  if (Math.max(up, down) - likeness(outline, doubleFlag) < 0.025) return null;
  const headY = up > down ? glyph.bottom - gap * 0.46 : glyph.top + gap * 0.46;
  const position = staffPosition(headY, staff);
  const note = event("eighth", [position]);
  if (up > down) {
    // The flag can overhang the augmentation dot, so both project into the
    // same column span. A plain flag tip is narrow at the height of the dot.
    const dotY =
      staff.bottom - (gap * position) / 2 - (position % 2 === 0 ? gap / 2 : 0);
    const left = span.start + Math.ceil(gap * 1.42);
    let wideRows = 0;
    for (let y = Math.round(dotY - gap * 0.18); y <= dotY + gap * 0.2; y++) {
      let count = 0;
      for (let x = left; x <= span.end; x++) count += ink[y * width + x];
      if (count >= Math.max(2, gap * 0.32)) wideRows++;
    }
    if (wideRows >= Math.max(2, gap * 0.15)) {
      note.dotted = true;
      note.beats *= 1.5;
    }
  }
  return note;
}

// Compare the head silhouette against unions of up to three aligned heads.
// Noteheads on thirds can touch, so connected components alone would identify
// a vertical chord as a single elongated glyph.
function stackedNote(
  ink: Uint8Array,
  width: number,
  span: Span,
  glyph: Glyph,
  staff: Staff,
): WrittenEvent | null {
  const { gap } = staff,
    { top, bottom } = glyph;
  const w = glyph.columns.length;
  const whole = w >= 1.65 * gap && w <= 2.35 * gap;
  if (
    w < 0.8 * gap ||
    w > 2.35 * gap ||
    bottom - top < (whole ? 1.5 : 3) * gap ||
    bottom - top > 10 * gap
  )
    return null;
  const stemHeight = Math.max(...glyph.columns);
  const stem = glyph.columns.indexOf(stemHeight);
  if (
    !whole &&
    (stemHeight < 2.6 * gap || Math.min(stem, w - 1 - stem) > w * 0.25)
  )
    return null;
  // Only the side opposite the stem contains unambiguous head silhouettes.
  const left = span.start + Math.ceil(w * 0.21),
    right = span.end - Math.ceil(w * 0.18);
  let headTop = Infinity,
    headBottom = -Infinity;
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++)
      if (ink[y * width + x]) {
        headTop = Math.min(headTop, y);
        headBottom = Math.max(headBottom, y);
        break;
      }
  }
  if (headBottom - headTop < gap * 1.45) return null;
  const low = staffPosition(headBottom - gap * 0.45, staff);
  const high = staffPosition(headTop + gap * 0.45, staff);
  if (high - low < 2 || high - low > 12) return null;
  const yOf = (p: number) => staff.bottom - (p * gap) / 2;
  // A shared stem can split rows across an upper head. Inspect the center
  // of each head independently of the stem and the adjoining head.
  const fillAt = (pos: number) => {
    let pixels = 0,
      black = 0;
    for (
      let y = Math.ceil(yOf(pos) - gap * 0.13);
      y <= Math.floor(yOf(pos) + gap * 0.13);
      y++
    ) {
      if (staff.lines.some((line) => y >= line.start && y <= line.end))
        continue;
      for (
        let x = Math.ceil(span.start + w * 0.37);
        x <= span.start + w * 0.59;
        x++
      ) {
        pixels++;
        black += ink[y * width + x];
      }
    }
    if (!pixels) return null;
    return black / pixels >= 0.8
      ? "solid"
      : black / pixels <= 0.2
        ? "hollow"
        : null;
  };
  const lowFill = fillAt(low);
  if (!lowFill || (whole && lowFill !== "hollow") || fillAt(high) !== lowFill)
    return null;
  const groups: number[][] = [[low, high]];
  for (let pos = low + 2; pos <= high - 2; pos++) groups.push([low, pos, high]);
  const centerX = (span.start + span.end) / 2;
  let best = 0,
    second = 0,
    winner: number[] = [];
  for (const heads of groups) {
    let intersect = 0,
      total = 0;
    for (let y = headTop; y <= headBottom; y++) {
      if (staff.lines.some((l) => y >= l.start && y <= l.end)) continue;
      for (let x = left; x <= right; x++) {
        const dx = (x - centerX) / w;
        const expected = heads.some((p) => {
          const dy = (y - yOf(p)) / gap;
          const outer =
            (dx / 0.51) ** 2 + ((dy + dx * (whole ? 0 : 0.35)) / 0.5) ** 2;
          if (outer > 1) return false;
          if (lowFill === "solid") return true;
          // Whole heads have a narrow, upright opening. The opening in a
          // half head follows the steep diagonal of the thinner engraved rim.
          return whole
            ? ((dx - dy * 0.13) / 0.22) ** 2 + (dy / 0.45) ** 2 >= 1
            : (dx / 0.34) ** 2 + ((dy + dx * 0.65) / 0.23) ** 2 >= 1;
        });
        const present = ink[y * width + x] === 1;
        total += Number(present) + Number(expected);
        if (present && expected) intersect++;
      }
    }
    const fit = (2 * intersect) / total;
    if (fit > best) {
      second = best;
      best = fit;
      winner = heads;
    } else second = Math.max(second, fit);
  }
  if (best < 0.8 || (second && best - second < 0.025)) return null;
  return event(
    whole ? "whole" : lowFill === "solid" ? "quarter" : "half",
    winner,
  );
}

interface Stem {
  x: number;
  top: number;
  bottom: number;
  start: number;
  end: number;
}

// Measure continuous vertical strokes. Counting all black pixels in a column
// would also count separated heads and multiple horizontal beams as a stem.
function beamStems(
  ink: Uint8Array,
  width: number,
  span: Span,
  first: number,
  last: number,
  staff: Staff,
) {
  const { gap } = staff,
    columns: { top: number; bottom: number }[] = [];
  const removed = new Uint8Array(last - first + 1);
  for (let y = first; y <= last; y++) {
    const onLedger =
      Math.min(
        Math.abs(y - (staff.top - gap)),
        Math.abs(y - (staff.bottom + gap)),
      ) <= Math.max(1, gap * 0.14);
    if (
      onLedger ||
      staff.lines.some((line) => y >= line.start && y <= line.end)
    )
      removed[y - first] = 1;
  }
  for (let x = span.start; x <= span.end; x++) {
    let best = { top: 0, bottom: -1 },
      start = first,
      end = first - 1;
    for (let y = first; y <= last; y++) {
      if (ink[y * width + x]) {
        end = y;
        if (end - start > best.bottom - best.top)
          best = { top: start, bottom: end };
      } else if (!removed[y - first]) start = y + 1;
    }
    columns.push(best);
  }
  const stems: Stem[] = [];
  for (const range of runs(
    columns.length,
    (x) => columns[x].bottom - columns[x].top >= 2.5 * gap,
  )) {
    if (range.end - range.start + 1 > Math.max(3, 0.35 * gap)) unsupported();
    let main = range.start;
    for (let x = range.start + 1; x <= range.end; x++)
      if (
        columns[x].bottom - columns[x].top >
        columns[main].bottom - columns[main].top
      )
        main = x;
    stems.push({
      x: span.start + main,
      ...columns[main],
      start: span.start + range.start,
      end: span.start + range.end,
    });
  }
  return stems;
}

function beamNotes(
  ink: Uint8Array,
  width: number,
  span: Span,
  first: number,
  last: number,
  staff: Staff,
): WrittenEvent[] {
  // A beam joining widely separated pitches may extend just beyond the
  // usual staff band. Follow its ink only as far as the first blank row.
  const touches = (y: number) => {
    for (let x = span.start; x <= span.end; x++)
      if (ink[y * width + x]) return true;
    return false;
  };
  const margin = Math.ceil(staff.gap * 2);
  const above = Math.max(0, first - margin),
    below = Math.min(ink.length / width - 1, last + margin);
  while (first > above && touches(first) && touches(first - 1)) first--;
  while (last < below && touches(last) && touches(last + 1)) last++;
  const stems = beamStems(ink, width, span, first, last, staff),
    { gap } = staff;
  if (stems.length < 2) unsupported();
  const stemUp = stems[0].x - span.start > span.end - stems[stems.length - 1].x;
  const tip = (s: Stem) => (stemUp ? s.top : s.bottom);
  // Extract only this glyph into a local mask; lifting its connecting beam
  // leaves individual heads/stems and any augmentation dots between them.
  const localWidth = span.end - span.start + 1,
    height = last - first + 1;
  const mask = new Uint8Array(localWidth * height);
  for (let y = first; y <= last; y++)
    mask.set(
      ink.subarray(y * width + span.start, y * width + span.end + 1),
      (y - first) * localWidth,
    );
  for (let i = 0; i < stems.length - 1; i++) {
    const a = stems[i],
      b = stems[i + 1];
    if (b.x - a.x < 1.5 * gap || Math.abs(tip(b) - tip(a)) > 0.5 * (b.x - a.x))
      unsupported();
    for (let x = a.end + 1; x < b.start; x++) {
      const edge = tip(a) + ((x - a.x) * (tip(b) - tip(a))) / (b.x - a.x);
      const y0 = Math.max(
        first,
        Math.floor(edge - (stemUp ? 0.25 : 0.8) * gap),
      );
      const y1 = Math.min(last, Math.ceil(edge + (stemUp ? 0.8 : 0.25) * gap));
      let black = 0;
      for (let y = y0; y <= y1; y++) {
        black += mask[(y - first) * localWidth + x - span.start];
        mask[(y - first) * localWidth + x - span.start] = 0;
      }
      if (black < gap * 0.1) unsupported();
    }
  }
  const localStaff = {
    ...staff,
    top: staff.top - first,
    bottom: staff.bottom - first,
    lines: staff.lines.map((l) => ({
      start: l.start - first,
      end: l.end - first,
    })),
  };
  const events: WrittenEvent[] = [];
  let lastHeadEnd = -Infinity;
  for (const group of runs(localWidth, (x) => {
    for (let y = 0; y < height; y++) if (mask[y * localWidth + x]) return true;
    return false;
  })) {
    const glyph = measureGlyph(mask, localWidth, group, 0, height - 1);
    const groupedStem = stems.filter(
      (s) => s.x - span.start >= group.start && s.x - span.start <= group.end,
    );
    if (!groupedStem.length) {
      const previous = events.at(-1);
      const y = (glyph.top + glyph.bottom) / 2;
      const near = previous?.positions.some(
        (pos) =>
          Math.abs(y - (localStaff.bottom - (gap * pos) / 2)) <= 0.65 * gap,
      );
      if (
        !previous ||
        previous.dotted ||
        !near ||
        group.start - lastHeadEnd > gap * 1.3 ||
        !isAugmentationDot(glyph, gap)
      )
        unsupported();
      previous.dotted = true;
      previous.beats *= 1.5;
      continue;
    }
    if (groupedStem.length !== 1) unsupported();
    let note: WrittenEvent | null;
    try {
      note = ordinaryNote(mask, localWidth, group, 0, glyph, localStaff, true);
    } catch {
      note = stackedNote(mask, localWidth, group, glyph, localStaff);
    }
    if (note?.type !== "quarter") unsupported();
    events.push(event("eighth", note.positions));
    lastHeadEnd = group.end;
  }
  if (events.length !== stems.length) unsupported();
  return events;
}

export function isAugmentationDot(glyph: Glyph, gap: number) {
  const h = glyph.bottom - glyph.top + 1,
    w = glyph.columns.length;
  return (
    w >= gap * 0.18 &&
    w <= gap * 0.63 &&
    h >= gap * 0.18 &&
    h <= gap * 0.63 &&
    Math.min(h, w) > 0.56 * Math.max(h, w) &&
    glyph.columns.reduce((a, b) => a + b, 0) > w * h * 0.53
  );
}

// A dotted chord can print one dot for each head in the same column.
// Match the vertical order as well as the small, roughly round outlines.
export function matchesChordDots(
  ink: Uint8Array,
  width: number,
  span: Span,
  first: number,
  last: number,
  staff: Staff,
  positions: number[],
) {
  if (positions.length < 2 || span.end - span.start + 1 > staff.gap * 0.63)
    return false;
  const dots = runs(last - first + 1, (row) => {
    for (let x = span.start; x <= span.end; x++)
      if (ink[(row + first) * width + x]) return true;
    return false;
  });
  return (
    dots.length === positions.length &&
    dots.every((dot, i) => {
      const start = first + dot.start,
        end = first + dot.end;
      const pitch = positions[positions.length - 1 - i];
      const centerY = staff.bottom - (pitch * staff.gap) / 2;
      return (
        Math.abs((start + end) / 2 - centerY) <= staff.gap * 0.62 &&
        isAugmentationDot(measureGlyph(ink, width, span, start, end), staff.gap)
      );
    })
  );
}

export function readEvents(
  ink: Uint8Array,
  width: number,
  span: Span,
  first: number,
  last: number,
  staff: Staff,
): WrittenEvent[] {
  const glyph = measureGlyph(ink, width, span, first, last);
  if (glyph.columns.length > staff.gap * 2.75)
    return beamNotes(ink, width, span, first, last, staff);
  const rest = readRest(ink, width, span, glyph, staff);
  if (rest) return [rest];
  try {
    return [ordinaryNote(ink, width, span, first, glyph, staff)];
  } catch {
    const note =
      flaggedNote(ink, width, span, glyph, staff) ??
      stackedNote(ink, width, span, glyph, staff);
    if (note) return [note];
    return unsupported();
  }
}
