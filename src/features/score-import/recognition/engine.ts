import {
  measureGlyph,
  runs,
  unsupported,
  type Glyph,
  type Staff,
} from "./geometry";
import { readSignatures, readPlacedAccidental } from "./signatures";
import { isAugmentationDot, matchesChordDots, readEvents } from "./read-events";
import type { StaffReading, WrittenEvent } from "./reading";

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
  // A short melody may occupy only a small fraction of a scanned page.
  // Scale the continuity requirement to the longest printed horizontal line.
  const longest = rows.reduce((max, length) => Math.max(max, length), 0);
  const minimumRun = Math.max(32, Math.min(width * 0.27, longest * 0.7));
  const lines = runs(height, (y) => rows[y] >= minimumRun);
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
        if (
          end - start + 1 >= staff.gap * 1.55 &&
          end - start + 1 <= staff.gap * 3
        )
          ink.fill(0, y * width + start, y * width + end + 1);
      }
    }
  }
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

// Text outside the staff (chord names or lyrics) is disconnected from the
// notation. Preserve strokes crossing the boundary, including stems and beams.
function clearAnnotations(
  ink: Uint8Array,
  width: number,
  edge: number,
  limit: number,
) {
  const first = Math.min(edge, limit),
    last = Math.max(edge, limit);
  if (first === last) return;
  const queue = new Int32Array((last + 1 - first) * width);
  let start = 0,
    end = 0;
  function visit(pixel: number) {
    if (ink[pixel] === 1) {
      ink[pixel] = 2;
      queue[end++] = pixel;
    }
  }
  for (let x = 0; x < width; x++) visit(edge * width + x);
  while (start < end) {
    const pixel = queue[start++];
    const y = Math.floor(pixel / width),
      x = pixel % width;
    for (let row = Math.max(y - 1, first); row <= Math.min(y + 1, last); row++)
      for (
        let col = Math.max(x - 1, 0);
        col <= Math.min(x + 1, width - 1);
        col++
      )
        visit(row * width + col);
  }
  for (let p = first * width; p < (last + 1) * width; p++)
    ink[p] = Number(ink[p] === 2);
}

function dotMatches(event: WrittenEvent, glyph: Glyph, staff: Staff) {
  const center = (glyph.top + glyph.bottom) / 2;
  // A line-note's dot normally appears in the space immediately above it.
  const positions = event.positions.length ? event.positions : [3, 4, 5];
  return positions.some((position) => {
    const offset =
      (staff.bottom - (position * staff.gap) / 2 - center) / staff.gap;
    return offset >= -0.62 && offset <= 0.62;
  });
}

export function recognizeStaff(
  gray: Uint8Array,
  width: number,
  height: number,
  options: { deskewed?: boolean } = {},
): StaffReading {
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
  const first = Math.max(0, Math.floor(staff.top - staff.gap * 3.5));
  const last = Math.min(height - 1, Math.ceil(staff.bottom + staff.gap * 3.5));
  clearAnnotations(
    ink,
    width,
    Math.max(first, Math.floor(staff.top - staff.gap * 1.5)),
    first,
  );
  clearAnnotations(
    ink,
    width,
    Math.min(last, Math.ceil(staff.bottom + staff.gap * 1.5)),
    last,
  );
  stripLines(ink, width, height, staff, !!options.deskewed);
  const spans = runs(width, (x) => {
    for (let y = first; y <= last; y++) if (ink[y * width + x]) return true;
    return false;
  });
  if (
    spans[0] &&
    isBarline(measureGlyph(ink, width, spans[0], first, last), staff)
  )
    spans.shift();
  const { consumed, clef, fifths, meter } = readSignatures(
    ink,
    width,
    staff,
    spans,
    first,
    last,
  );
  const bars: WrittenEvent[][] = [];
  let bar: WrittenEvent[] = [];
  let accidentals: NonNullable<WrittenEvent["accidentals"]> = [];
  let previousBarline: number | undefined;
  let eventEnd = -Infinity;
  for (const span of spans.slice(consumed)) {
    const glyph = measureGlyph(ink, width, span, first, last);
    if (isBarline(glyph, staff)) {
      if (accidentals.length) unsupported();
      if (bar.length) {
        bars.push(bar);
        bar = [];
      } else if (
        previousBarline === undefined ||
        span.start - previousBarline > staff.gap
      )
        unsupported();
      previousBarline = span.end;
      eventEnd = -Infinity;
      continue;
    }
    const previous = bar[bar.length - 1];
    const chordDots =
      previous?.positions.length > 1 &&
      matchesChordDots(
        ink,
        width,
        span,
        first,
        last,
        staff,
        previous.positions,
      );
    if (chordDots || isAugmentationDot(glyph, staff.gap)) {
      if (
        !previous ||
        previous.dotted ||
        accidentals.length ||
        span.start - eventEnd > staff.gap * 1.35 ||
        (!chordDots && !dotMatches(previous, glyph, staff))
      )
        unsupported();
      previous.dotted = true;
      previous.beats *= 1.5;
      continue;
    }
    const sign = readPlacedAccidental(ink, width, span, staff, first, last);
    if (sign) {
      if (accidentals.some((a) => a.position === sign.position)) unsupported();
      accidentals.push(sign);
      continue;
    }
    const events: WrittenEvent[] = readEvents(
      ink,
      width,
      span,
      first,
      last,
      staff,
    );
    if (accidentals.length) {
      if (
        !accidentals.every((sign) =>
          events[0]?.positions.includes(sign.position),
        )
      )
        unsupported();
      events[0].accidentals = accidentals;
      accidentals = [];
    }
    bar.push(...events);
    eventEnd = span.end;
  }
  if (accidentals.length) unsupported();
  if (bar.length) bars.push(bar);
  if (!bars.length) unsupported();
  return { bars, clef, fifths, meter };
}
