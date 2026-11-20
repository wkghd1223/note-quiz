import { runs, type Span, type Staff } from "./geometry";

// Silhouettes sampled from the bundled Bravura SMuFL glyphs at 12 × 16 pixels.
// Each three hex digits encode one row, starting at the upper left.
// Bravura is distributed under the SIL Open Font License (public/licenses/score-notation.txt).
const silhouettes = {
  "1": "0fc1fc1fc3fc3fc7fc6fccfc8fc0fc0fc0fc0fc0fc0fe3ff",
  "2": "1f861ee1ef8ff8ff9f71f03e0780e01813f17ffffeefec3c",
  "3": "1f073cf1ef9ef9e71e03c1f803e01e71ff8ff9ff1e7be3f8",
  "4": "0f80f00f01ec1cc1dc3bc33c73c63cffffff03c03c07c0fe",
  "5": "7fe7fe7fc7f04004f0ffcc3e01f71ff9ff9ff9ff1e77c3f8",
  "6": "0fc19e39e79e71ef00f30ffcf9ef8ff8ff8f78f78e39e0f8",
  "7": "1e1bf3ffbfffcfe83e80600c01c03c0780f80f81f81f81f0",
  "8": "1f870c606e06f06fc67fc3fe3ff67fc1fc0fc0fc0e71c3f8",
  "9": "1f079c71ef1ef1ff1ff1f79f3ff0cf00f78e79e79c7983f0",
  G: "01803c06404c0780f03e0720cfec93c9320e0081883c81d0",
  F: "3e043083bf38f18f1861b03b0380300700600c0180200800",
  sharp: "00c30c30c30f3ffffef8c30c30d31f7ffffcf0c30c30c300",
  flat: "e00e00e00e00e00e00c00c38ffef0fc0fc0ee3cef0fc0e00",
  natural: "e00e00e00e00fffffffc7e07e07e3fffffffe07007007007",
  C: "0f818438671e71ef1ef1ef00f00f01f01f017033823cc0f8",
  cut: "0400400701c474e75ef5ef4cf40f417417c23cc0f0040040",
} as const;

type SymbolName = keyof typeof silhouettes;
interface Box extends Span {
  top: number;
  bottom: number;
}

function bounds(
  ink: Uint8Array,
  width: number,
  span: Span,
  first: number,
  last: number,
): Box | null {
  let left = span.end,
    right = span.start,
    top = last + 1,
    bottom = first - 1;
  for (let y = first; y <= last; y++) {
    for (let x = span.start; x <= span.end; x++) {
      if (!ink[y * width + x]) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return bottom >= top ? { start: left, end: right, top, bottom } : null;
}

const templates = Object.fromEntries(
  Object.entries(silhouettes).map(([name, encoded]) => [
    name,
    encoded.match(/.../g)!.map((row) => parseInt(row, 16)),
  ]),
) as Record<SymbolName, number[]>;

// Average distances only on surviving rows. Missing ink on a stripped staff line
// is not evidence of a hole in a digit, a natural sign, or the common-time C.
function match<T extends SymbolName>(
  ink: Uint8Array,
  width: number,
  box: Box,
  staff: Staff,
  names: readonly T[],
  maxError: number,
  separation = 0,
): T | null {
  const errors = names.map(() => 0);
  let cells = 0;
  const w = box.end - box.start + 1,
    h = box.bottom - box.top + 1;
  for (let row = 0; row < 16; row++) {
    const sampleRows: number[] = [];
    for (let dy = 0; dy < 3; dy++) {
      const y = box.top + Math.floor(((row + (dy + 0.5) / 3) * h) / 16);
      if (!staff.lines.some((line) => y >= line.start && y <= line.end))
        sampleRows.push(y);
    }
    if (!sampleRows.length) continue;
    for (let col = 0; col < 12; col++) {
      let sum = 0;
      for (let dx = 0; dx < 3; dx++) {
        const x = box.start + Math.floor(((col + (dx + 0.5) / 3) * w) / 12);
        for (const y of sampleRows) sum += ink[y * width + x];
      }
      const fill = sum / (3 * sampleRows.length);
      names.forEach((name, i) => {
        const bit = (templates[name][row] >> (11 - col)) & 1;
        errors[i] += Math.abs(fill - bit);
      });
      cells++;
    }
  }
  if (!cells) return null;
  const ranking = names
    .map((name, i) => ({ name, error: errors[i] / cells }))
    .sort((a, b) => a.error - b.error);
  const [best, second] = ranking;
  if (
    best.error > maxError ||
    (second && second.error - best.error < separation)
  )
    return null;
  return best.name;
}

const alteration = { flat: -1, natural: 0, sharp: 1 } as const;
function accidental(ink: Uint8Array, width: number, box: Box, staff: Staff) {
  const w = (box.end - box.start + 1) / staff.gap;
  const h = (box.bottom - box.top + 1) / staff.gap;
  if (w < 0.47 || w > 1.25 || h < 2.0 || h > 3.5) return null;
  return match(
    ink,
    width,
    box,
    staff,
    ["sharp", "flat", "natural"],
    0.26,
    0.026,
  );
}

export function readPlacedAccidental(
  ink: Uint8Array,
  width: number,
  span: Span,
  staff: Staff,
  first: number,
  last: number,
) {
  if (span.end - span.start > staff.gap * 1.3) return null;
  const box = bounds(ink, width, span, first, last);
  const symbol = box && accidental(ink, width, box, staff);
  if (!symbol || !box) return null;
  const center = (box.top + box.bottom) / 2;
  const y = center + (symbol === "flat" ? 0.48 * staff.gap : 0);
  const relative = (2 * (staff.bottom - y)) / staff.gap;
  const position = Math.round(relative);
  if (Math.abs(relative - position) > 0.43) return null;
  return { alter: alteration[symbol], position };
}

function openingClef(
  ink: Uint8Array,
  width: number,
  staff: Staff,
  spans: Span[],
  first: number,
  last: number,
) {
  // The two dots of an F clef often form a second x span.
  for (let count = 1; count <= Math.min(2, spans.length); count++) {
    const span = { start: spans[0].start, end: spans[count - 1].end };
    const w = (span.end - span.start + 1) / staff.gap;
    if (w > 3.6) break;
    if (w < 1.4) continue;
    const box = bounds(ink, width, span, first, last);
    if (!box) continue;
    const top = (box.top - staff.top) / staff.gap;
    const bottom = (box.bottom - staff.top) / staff.gap;
    if (
      count === 1 &&
      top > -2.7 &&
      top < -0.6 &&
      bottom > 4.5 &&
      bottom < 6.1 &&
      match(ink, width, box, staff, ["G"], 0.32)
    )
      return { clef: "G" as const, count };
    if (
      Math.abs(top) < 0.4 &&
      bottom > 2.6 &&
      bottom < 3.7 &&
      match(ink, width, box, staff, ["F"], 0.22)
    )
      return { clef: "F" as const, count };
  }
  return null;
}

const digits = ["2", "3", "4", "5", "6", "7", "8", "9"] as const;

function numerator(ink: Uint8Array, width: number, box: Box, staff: Staff) {
  const w = box.end - box.start + 1;
  if (w <= 1.85 * staff.gap)
    return Number(match(ink, width, box, staff, digits, 0.32, 0.03));
  // In 12/8 the lower 8 commonly bridges both upper digits in the x projection.
  const parts = runs(w, (dx) => {
    for (let y = box.top; y <= box.bottom; y++)
      if (ink[y * width + box.start + dx]) return true;
    return false;
  });
  if (parts.length !== 2) return 0;
  const pair = parts.map(
    (part) =>
      bounds(
        ink,
        width,
        {
          start: box.start + part.start,
          end: box.start + part.end,
        },
        box.top,
        box.bottom,
      )!,
  );
  return match(ink, width, pair[0], staff, ["1"], 0.26) &&
    match(ink, width, pair[1], staff, digits, 0.3, 0.025) === "2"
    ? 12
    : 0;
}

function timeSignature(
  ink: Uint8Array,
  width: number,
  staff: Staff,
  span: Span,
  first: number,
  last: number,
) {
  if (span.end - span.start > 3.3 * staff.gap) return null;
  const box = bounds(ink, width, span, first, last);
  if (!box) return null;
  const { top, bottom, gap } = staff;
  const midpoint = Math.floor((top + bottom) / 2);
  if (Math.abs((box.top + box.bottom) / 2 - midpoint) > gap * 0.3) return null;
  const height = (box.bottom - box.top + 1) / gap;
  if (height >= 1.6 && height < 3.55) {
    // The vertical slash extends beyond the C at both ends in cut time.
    const common = match(ink, width, box, staff, ["C", "cut"], 0.28, 0.05);
    if (
      (common === "cut" && height >= 2.4) ||
      (common === "C" && height <= 2.45)
    )
      return common === "C"
        ? { beats: 4, beatType: 4, symbol: "common" as const }
        : { beats: 2, beatType: 2, symbol: "cut" as const };
  }
  if (height < 3.5 || height > 4.5) return null;
  const upper = bounds(ink, width, span, first, midpoint);
  const lower = bounds(ink, width, span, midpoint + 1, last);
  if (!upper || !lower) return null;
  const beats = numerator(ink, width, upper, staff);
  const beatType = match(ink, width, lower, staff, digits, 0.3, 0.025);
  if (!beats || !beatType || !["2", "4", "8"].includes(beatType)) return null;
  return { beats, beatType: Number(beatType) };
}

// Expected symbol centers in staff spaces below the top line, treble clef.
// A flat's bowl sits below its geometric center; the offsets account for that.
const trebleSharps = [0, 1.5, -0.5, 1, 2.5, 0.5, 2];
const trebleFlats = [1.5, 0, 2, 0.5, 2.5, 1, 3];

export function readSignatures(
  ink: Uint8Array,
  width: number,
  staff: Staff,
  spans: Span[],
  first: number,
  last: number,
) {
  // Engravings can start with a thin barline or tiny remnants of the
  // horizontal staff strokes. Skip these only when a clef follows.
  const leading =
    spans[0] && spans[0].end - spans[0].start <= staff.gap * 0.28
      ? bounds(ink, width, spans[0], first, last)
      : null;
  const skip =
    !!leading &&
    leading.top >= staff.top - staff.gap * 0.25 &&
    leading.bottom <= staff.bottom + staff.gap * 0.25;
  const clefMatch = openingClef(
    ink,
    width,
    staff,
    skip ? spans.slice(1, 3) : spans,
    first,
    last,
  );
  const clef = clefMatch?.clef ?? null;
  let consumed = clefMatch ? clefMatch.count + Number(skip) : 0;
  let fifths: number | null = clef ? 0 : null;
  let count = 0;
  let direction = 0;
  if (clef) {
    while (count < 7 && spans[consumed]) {
      const span = spans[consumed];
      // A separate accidental in front of the first note can happen to
      // match the next pitch in the circle of fifths.
      if (count && span.start - spans[consumed - 1].end > staff.gap * 0.95)
        break;
      if (span.end - span.start > staff.gap * 1.3) break;
      const box = bounds(ink, width, span, first, last);
      const sign = box && accidental(ink, width, box, staff);
      if (!box || (sign !== "flat" && sign !== "sharp")) break;
      const value = alteration[sign];
      if (count && direction !== value) break;
      const centers = value === 1 ? trebleSharps : trebleFlats;
      const center = ((box.top + box.bottom) / 2 - staff.top) / staff.gap;
      if (Math.abs(center - centers[count] - (clef === "F" ? 1 : 0)) > 0.34)
        break;
      direction = value;
      consumed++;
      count++;
    }
  }
  const meter = spans[consumed]
    ? timeSignature(ink, width, staff, spans[consumed], first, last)
    : null;
  if (count) {
    if (
      !meter &&
      spans[consumed] &&
      spans[consumed].start - spans[consumed - 1].end < staff.gap * 0.64
    ) {
      // With no meter separating the key and the notes, the symbol printed
      // against the first note is an inline accidental.
      consumed--;
      count--;
    }
    fifths = count ? count * direction : 0;
  }
  if (meter) consumed++;
  return { consumed, clef, fifths, meter };
}
