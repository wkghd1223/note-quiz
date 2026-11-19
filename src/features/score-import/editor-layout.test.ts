import { describe, expect, it } from "vitest";
import { layoutScoreLine, lineBarAt, lineCursorX } from "./editor-layout";
import { meterGlyphs } from "@/lib/notation/meter-glyphs";
import type { ImportedBar, ImportedEvent, ImportedLane } from "./types";

const source = {} as Element;
const treble = { sign: "G", line: 2 };
function bar(
  index: number,
  starts: number[],
  changes: Partial<ImportedBar> = {},
): ImportedBar {
  const events: ImportedEvent[] = starts.map((start, i) => ({
    id: index + "." + i,
    source,
    start,
    duration: 1,
    heads: [],
    noteType: "quarter",
    dots: 0,
    divisions: 1,
    fifths: changes.fifths ?? 0,
    clef: changes.clef ?? treble,
  }));
  return {
    index,
    label: String(index + 1),
    source,
    duration: 4,
    divisions: 1,
    meter: { beats: 4, beatType: 4 },
    clef: treble,
    fifths: 0,
    events,
    ...changes,
  };
}
function line(bars: ImportedBar[]) {
  const lane: ImportedLane = {
    id: "P",
    label: "Piano",
    partId: "P",
    staff: "1",
    voice: "1",
    bars,
  };
  return layoutScoreLine(lane, 0, 720);
}

describe("the continuous imported staff", () => {
  it("centers the Bravura meter and reserves space for both digits of 12/8", () => {
    const meter = { beats: 12, beatType: 8 };
    const figure = meterGlyphs(meter, 12);
    expect(figure.rows).toEqual(["\uE081\uE082", "\uE088"]);
    const { bars } = line([bar(0, [0, 1], { meter })]);
    expect(bars[0].meterX! + figure.width).toBeLessThan(
      bars[0].anchors[0] - 14,
    );
  });

  it("shows the changed notation even if a common or additive meter has the same duration", () => {
    const common = { beats: 4, beatType: 4, symbol: "common" as const };
    const additive = { beats: 4, beatType: 4, displayBeats: "2+2" };
    expect(meterGlyphs(common, 12).rows).toEqual(["\uE08A"]);
    expect(meterGlyphs(additive, 12).rows[0]).toBe("\uE082\uE08C\uE082");
    const { bars } = line([
      bar(0, [], { meter: common }),
      bar(1, []),
      bar(2, [], { meter: additive }),
    ]);
    expect(bars.every((item) => item.meterX !== undefined)).toBe(true);
  });

  it("prints opening signatures and their changes with no gap between measures", () => {
    const { bars } = line([
      bar(0, [0, 1], { fifths: 2 }),
      bar(1, [0, 1], { fifths: 2 }),
      bar(2, [0, 1], {
        clef: { sign: "F", line: 4 },
        meter: { beats: 3, beatType: 4 },
      }),
    ]);
    expect(bars[0].meterX).toBeDefined();
    expect(bars[1].meterX).toBeUndefined();
    expect(bars[1].clefX).toBeUndefined();
    expect(bars[1].keyX).toBeUndefined();
    expect(bars[2].cancelledKey).toBe(2);
    expect(bars[2].meterX).toBeDefined();
    expect(bars[2].clefX).toBeDefined();
    expect(bars[1].left).toBe(bars[0].width);
    expect(lineBarAt(bars, bars[1].left - 0.1)).toBe(0);
    expect(lineBarAt(bars, bars[1].left)).toBe(1);
  });

  it("interpolates across held notes, leading silence and printed barlines", () => {
    const first = bar(0, [1, 3]),
      second = bar(1, [0]);
    const {
      bars: [a, b],
    } = line([first, second]);
    expect(lineCursorX(first, a, 0.5, b)).toBe(
      (a.firstNoteX + a.anchors[0]) / 2,
    );
    expect(lineCursorX(first, a, 2, b)).toBe((a.anchors[0] + a.anchors[1]) / 2);
    expect(lineCursorX(first, a, 4, b)).toBe(lineCursorX(second, b, 0));
    expect(lineCursorX(second, b, 4)).toBe(b.left + b.width);
  });
});
