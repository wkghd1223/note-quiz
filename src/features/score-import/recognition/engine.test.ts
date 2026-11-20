import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { recognizeStaff } from "./engine";

// Engraved with the bundled Bravura font, including clef, stacked time digits,
// a final double bar, ledger lines and quarter-note glyphs in both directions.
function printedExample(name = "treble", width = 660, height = 165) {
  const file = gunzipSync(
    readFileSync(new URL(`./fixtures/${name}.pgm.gz`, import.meta.url)),
  );
  const header = `P5\n${width} ${height}\n255\n`;
  expect(file.subarray(0, header.length).toString()).toBe(header);
  return new Uint8Array(file.subarray(header.length));
}

describe("printed staff recognition", () => {
  it("reads the printed pitches, durations and bar boundaries", () => {
    const { bars } = recognizeStaff(printedExample(), 660, 165);
    expect(
      bars.map((bar) => bar.map((n) => `${n.step}${n.octave}:${n.beats}`)),
    ).toEqual([
      ["C4:1", "G4:1", "C5:1", "G5:1"],
      ["A5:1", "D5:1", "F4:1", "D4:1"],
    ]);
  });

  // Independent ABCJS engraving of “E2 F G | c A2 B | D4” (L:1/4).
  it("distinguishes mixed quarter, half and whole note durations", () => {
    const { bars } = recognizeStaff(
      printedExample("mixed", 1340, 198),
      1340,
      198,
    );
    expect(
      bars.map((bar) => bar.map((n) => `${n.step}${n.octave}:${n.beats}`)),
    ).toEqual([["E4:2", "F4:1", "G4:1"], ["C5:1", "A4:2", "B4:1"], ["D4:4"]]);
  });

  it("reads a hollow ledger-line note even after image resampling", () => {
    const { bars } = recognizeStaff(
      printedExample("ledger-half", 1280, 186),
      1280,
      186,
    );
    expect(bars[2]).toEqual([
      { step: "C", octave: 4, beats: 2 },
      { step: "F", octave: 5, beats: 1 },
      { step: "F", octave: 4, beats: 1 },
    ]);
  });

  it.each(["rest", "accidental", "eighths"])("rejects a printed %s", (name) => {
    expect(() =>
      recognizeStaff(printedExample(name, 1340, 198), 1340, 198),
    ).toThrow("unsupportedNotation");
  });

  it.each([
    [110, 350, 240],
    [380, 625, 480],
  ])("rejects a full-measure rest at either end", (left, right, center) => {
    const image = printedExample();
    for (let y = 0; y < 165; y++) {
      image.fill(image[y * 660 + 155], y * 660 + left, y * 660 + right);
    }
    // A whole rest is a horizontal block hanging from the fourth line.
    for (let y = 60; y <= 66; y++)
      image.fill(0, y * 660 + center, y * 660 + center + 17);
    expect(() => recognizeStaff(image, 660, 165)).toThrow(
      "unsupportedNotation",
    );
  });

  it("rejects unknown strokes instead of dropping a rest or accidental", () => {
    const image = printedExample();
    for (let y = 70; y < 93; y++) image[y * 660 + 167] = 0;
    expect(() => recognizeStaff(image, 660, 165)).toThrow();
  });

  it("requires a complete measure even if the remaining pitches are legible", () => {
    const image = printedExample();
    for (let y = 0; y < 165; y++) {
      for (let x = 184; x < 210; x++) image[y * 660 + x] = image[y * 660 + 155];
    }
    expect(() => recognizeStaff(image, 660, 165)).toThrow();
  });

  it("rejects blank, malformed and multiple-system images", () => {
    expect(() =>
      recognizeStaff(new Uint8Array(256 * 64).fill(255), 256, 64),
    ).toThrow();
    expect(() => recognizeStaff(new Uint8Array(), 60000, 65536)).toThrow();
    const image = printedExample();
    const doubled = new Uint8Array(image.length * 2);
    doubled.set(image);
    doubled.set(image, image.length);
    expect(() => recognizeStaff(doubled, 660, 330)).toThrow();
  });
});
