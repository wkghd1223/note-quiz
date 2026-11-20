import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { runs } from "./geometry";
import { readPlacedAccidental, readSignatures } from "./signatures";

// Crops of ABCJS 6.7.3 engravings after staff removal. These use different
// glyph outlines from the bundled Bravura font used by the matcher.
const samples: Record<
  string,
  { width: number; lines: number[][]; ink: string }
> = JSON.parse(
  gunzipSync(
    readFileSync(new URL("./fixtures/signatures.json.gz", import.meta.url)),
  ).toString(),
);

function sample(name: string) {
  const { width, lines, ink: encoded } = samples[name];
  const ink = Buffer.from(encoded, "base64");
  const height = ink.length / width;
  const top = (lines[0][0] + lines[0][1]) / 2;
  const bottom = (lines[4][0] + lines[4][1]) / 2;
  const staff = {
    top,
    bottom,
    gap: (bottom - top) / 4,
    lines: lines.map(([start, end]) => ({ start, end })),
  };
  const spans = runs(width, (x) => {
    for (let y = 0; y < height; y++) if (ink[y * width + x]) return true;
    return false;
  });
  const result = readSignatures(ink, width, staff, spans, 0, height - 1);
  const signs = spans
    .slice(result.consumed)
    .map((span) =>
      readPlacedAccidental(ink, width, span, staff, 0, height - 1),
    );
  return { result, signs };
}

describe("printed opening signatures", () => {
  it.each([
    ["bass-flats", "F", -3, 6, 8, 6],
    ["bass-sharps", "F", 2, 2, 4, 5],
    ["all-sharps", "G", 7, 2, 2, 9],
    ["five-eight", "G", 0, 5, 8, 2],
    ["seven-eight", "G", 0, 7, 8, 2],
    ["nine-eight", "G", -1, 9, 8, 3],
    ["twelve-eight", "G", 0, 12, 8, 2],
    ["missing-clef", null, null, 3, 4, 1],
  ] as const)(
    "reads the %s engraving",
    (name, clef, fifths, beats, beatType, consumed) => {
      expect(sample(name).result).toEqual({
        clef,
        fifths,
        meter: { beats, beatType },
        consumed,
      });
    },
  );

  it("preserves written common and cut time", () => {
    expect(sample("common").result.meter).toEqual({
      beats: 4,
      beatType: 4,
      symbol: "common",
    });
    expect(sample("cut-no-key").result.meter).toEqual({
      beats: 2,
      beatType: 2,
      symbol: "cut",
    });
    expect(sample("cut-flats").result).toEqual({
      clef: "G",
      fifths: -7,
      meter: { beats: 2, beatType: 2, symbol: "cut" },
      consumed: 9,
    });
  });

  it("leaves an unknown two-digit numerator unread", () => {
    expect(sample("unknown-numerator").result).toEqual({
      clef: "G",
      fifths: 0,
      meter: null,
      consumed: 1,
    });
  });

  it("keeps the first note's F sharp when no time signature is printed", () => {
    const { result, signs } = sample("inline-f-sharp");
    expect(result).toEqual({ clef: "G", fifths: 0, meter: null, consumed: 1 });
    expect(signs).toEqual([{ alter: 1, position: 8 }, null]);
  });

  it("separates a key signature from a following note accidental without a meter", () => {
    const { result, signs } = sample("key-with-inline");
    expect(result).toEqual({ clef: "G", fifths: 2, meter: null, consumed: 3 });
    expect(signs).toEqual([{ alter: 1, position: 9 }, null]);
  });

  it("locates each inline accidental on the note it modifies", () => {
    const { signs } = sample("inline-all");
    expect(signs).toEqual([
      { alter: 1, position: 1 },
      null,
      { alter: -1, position: 2 },
      null,
      { alter: 0, position: 3 },
      null,
    ]);
  });
});
