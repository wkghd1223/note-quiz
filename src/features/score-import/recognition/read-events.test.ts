import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { recognizeStaff } from "./engine";

// Offline ABCJS engravings. The public entry point also exercises removal of
// staff and ledger strokes where they intersect note heads, stems and beams.
function readPrinted(name: string) {
  const file = gunzipSync(
    readFileSync(new URL(`./fixtures/${name}.pgm.gz`, import.meta.url)),
  );
  const header = /^P5\n(\d+) (\d+)\n255\n/.exec(file.toString("ascii", 0, 32));
  if (!header) throw Error("Expected a grayscale PGM");
  return recognizeStaff(
    file.subarray(header[0].length),
    Number(header[1]),
    Number(header[2]),
  ).bars;
}

describe("printed harmonica note groups", () => {
  it("retains the sorted pitches of dyads and triads on quarter, half and whole notes", () => {
    // [EG] [GB] [Bdf] [ce] | [CEG]2 [DFA]2 | [CEG]4 | [EG]3 A
    const bars = readPrinted("chord-durations");
    expect(bars.map((bar) => bar.map((e) => [e.positions, e.type]))).toEqual([
      [
        [[0, 2], "quarter"],
        [[2, 4], "quarter"],
        [[4, 6, 8], "quarter"],
        [[5, 7], "quarter"],
      ],
      [
        [[-2, 0, 2], "half"],
        [[-1, 1, 3], "half"],
      ],
      [[[-2, 0, 2], "whole"]],
      [
        [[0, 2], "half"],
        [[3], "quarter"],
      ],
    ]);
    expect(bars[3][0]).toMatchObject({ dotted: true, beats: 3 });
  });

  it("distinguishes rests, eighth flags in both directions and dotted notes inside a beam", () => {
    // E/ e/ G z B | E2 z2 | E/ z/ GAB | z4 | c3/4d/2e3/4 d2
    // E3/4 F3/4 e3/4 d3/4 C | E/c/d/f/ A2
    const bars = readPrinted("rest-flag-dot");
    expect(bars.map((bar) => bar.map((e) => [e.positions, e.beats]))).toEqual([
      [
        [[0], 0.5],
        [[7], 0.5],
        [[2], 1],
        [[], 1],
        [[4], 1],
      ],
      [
        [[0], 2],
        [[], 2],
      ],
      [
        [[0], 0.5],
        [[], 0.5],
        [[2], 1],
        [[3], 1],
        [[4], 1],
      ],
      [[[], 4]],
      [
        [[5], 0.75],
        [[6], 0.5],
        [[7], 0.75],
        [[6], 2],
      ],
      [
        [[0], 0.75],
        [[1], 0.75],
        [[7], 0.75],
        [[6], 0.75],
        [[-2], 1],
      ],
      [
        [[0], 0.5],
        [[5], 0.5],
        [[6], 0.5],
        [[8], 0.5],
        [[3], 2],
      ],
    ]);
    expect(bars[4].map((e) => e.dotted)).toEqual([true, false, true, false]);
  });

  it.each(["double-beam", "double-flag"])(
    "rejects sixteenths in %s",
    (name) => {
      expect(() => readPrinted(name)).toThrow("unsupportedNotation");
    },
  );
});
