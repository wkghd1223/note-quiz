export interface Span {
  start: number;
  end: number;
}

export interface Staff {
  top: number;
  bottom: number;
  gap: number;
  lines: Span[];
}

export function unsupported(): never {
  throw new Error("unsupportedNotation");
}

export function runs(
  count: number,
  active: (index: number) => boolean,
): Span[] {
  const spans: Span[] = [];
  for (let i = 0; i < count; i++) {
    if (!active(i)) continue;
    const start = i;
    while (i + 1 < count && active(i + 1)) i++;
    spans.push({ start, end: i });
  }
  return spans;
}

export interface Glyph {
  rows: Uint32Array;
  columns: Uint32Array;
  top: number;
  bottom: number;
}

export function measureGlyph(
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
