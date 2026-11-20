import { describe, expect, it } from "vitest";
import {
  resolveReading,
  type ReadingContext,
  type WrittenEvent,
} from "./reading";

const context: ReadingContext = {
  clef: "G",
  fifths: 1,
  meter: { beats: 3, beatType: 4 },
};
const quarter = (...positions: number[]): WrittenEvent => ({
  positions,
  beats: 1,
  type: "quarter",
  dotted: false,
});
const resolve = (bars: WrittenEvent[][], chosen = context) =>
  resolveReading({ bars, clef: null, fifths: null, meter: null }, chosen);

describe("resolving a staff with the reviewed signatures", () => {
  it("applies naturals only to the marked octave until the next bar", () => {
    const natural = { ...quarter(1), accidentals: [{ position: 1, alter: 0 }] };
    const score = resolve([
      [natural, quarter(1, 8), quarter(2)],
      [quarter(1), quarter(1), quarter(1)],
    ]);
    expect(
      score.bars[0][1].heads.map((h) => [h.step, h.octave, h.alter]),
    ).toEqual([
      ["F", 4, 0],
      ["F", 5, 1],
    ]);
    expect(score.bars[0][0].heads[0].accidental).toBe(0);
    expect(score.bars[1][0].heads[0].alter).toBe(1);
  });

  it("uses the selected bass clef and counts a lone whole rest in 3/4", () => {
    const rest: WrittenEvent = {
      positions: [],
      beats: 4,
      type: "whole",
      dotted: false,
    };
    const score = resolve([[quarter(0), quarter(1), quarter(2)], [rest]], {
      ...context,
      clef: "F",
    });
    expect(score.bars[0][0].heads[0]).toMatchObject({ step: "G", octave: 2 });
    expect(score.bars[1][0]).toMatchObject({ heads: [], beats: 3 });
  });

  it("accepts complementary opening and closing partial bars but catches missing beats", () => {
    const q = quarter(0);
    expect(resolve([[q], [q, q, q], [q, q]]).hasPickup).toBe(true);
    expect(() =>
      resolve([
        [q, q, q],
        [q, q],
      ]),
    ).toThrow("meterMismatch");
    expect(() => resolve([[q], [q], [q, q]])).toThrow("meterMismatch");
    expect(() => resolve([[q, q, q, q]])).toThrow("meterMismatch");
  });
});
