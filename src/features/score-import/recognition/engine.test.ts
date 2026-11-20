import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { recognizeStaff } from "./engine";
import { resolveReading } from "./reading";

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

function readScore(gray: Uint8Array, width: number, height: number) {
  const reading = recognizeStaff(gray, width, height);
  const { clef, meter, fifths } = reading;
  if (!clef || !meter || fifths == null) throw new Error("missing signature");
  return resolveReading(reading, { clef, meter, fifths }).bars.map((bar) =>
    bar.map((event) => {
      const head = event.heads[0];
      return (
        (head
          ? head.step + (head.alter === 1 ? "#" : "") + head.octave
          : "rest") +
        ":" +
        event.beats
      );
    }),
  );
}

describe("printed staff recognition", () => {
  it("reads the printed pitches, durations and bar boundaries", () => {
    expect(readScore(printedExample(), 660, 165)).toEqual([
      ["C4:1", "G4:1", "C5:1", "G5:1"],
      ["A5:1", "D5:1", "F4:1", "D4:1"],
    ]);
  });

  // Independent ABCJS engraving of “E2 F G | c A2 B | D4” (L:1/4).
  it("distinguishes mixed quarter, half and whole note durations", () => {
    expect(readScore(printedExample("mixed", 1340, 198), 1340, 198)).toEqual([
      ["E4:2", "F4:1", "G4:1"],
      ["C5:1", "A4:2", "B4:1"],
      ["D4:4"],
    ]);
  });

  it("reads a hollow ledger-line note even after image resampling", () => {
    expect(
      readScore(printedExample("ledger-half", 1280, 186), 1280, 186)[2],
    ).toEqual(["C4:2", "F5:1", "F4:1"]);
  });

  it.each([
    ["rest", ["E4:1", "rest:1", "G4:1", "A4:1"]],
    ["accidental", ["E4:1", "F#4:1", "G4:1", "A4:1"]],
    ["eighths", ["E4:0.5", "F4:0.5", "G4:1", "A4:1", "B4:1"]],
  ] as const)("reads the printed %s", (name, firstBar) => {
    expect(readScore(printedExample(name, 1340, 198), 1340, 198)[0]).toEqual(
      firstBar,
    );
  });

  it.each([
    [110, 350, 240],
    [380, 625, 480],
  ])("reads a full-measure rest at either end", (left, right, center) => {
    const image = printedExample();
    for (let y = 0; y < 165; y++) {
      image.fill(image[y * 660 + 155], y * 660 + left, y * 660 + right);
    }
    // A whole rest is a horizontal block hanging from the fourth line.
    for (let y = 60; y <= 66; y++)
      image.fill(0, y * 660 + center, y * 660 + center + 17);
    expect(readScore(image, 660, 165)[left === 110 ? 0 : 1]).toEqual([
      "rest:4",
    ]);
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
    expect(() => readScore(image, 660, 165)).toThrow("meterMismatch");
  });

  it("keeps lyrics below the staff out of the melody", () => {
    // Independent ABCJS engraving of E F G with a syllable below each note.
    expect(readScore(printedExample("lyrics", 1340, 236), 1340, 236)).toEqual([
      ["E4:1", "F4:1", "G4:1"],
    ]);
  });

  it("reads a staff occupying a small part of the page width", () => {
    const image = printedExample();
    const paperWidth = 3000;
    const page = new Uint8Array(paperWidth * 165).fill(255);
    for (let y = 0; y < 165; y++)
      page.set(image.subarray(y * 660, (y + 1) * 660), y * paperWidth + 900);
    expect(readScore(page, paperWidth, 165)).toEqual(
      readScore(image, 660, 165),
    );
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
