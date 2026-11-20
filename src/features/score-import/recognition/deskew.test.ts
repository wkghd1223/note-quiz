import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";
import { straightenStaff } from "./deskew";
import { recognizeStaff } from "./engine";

// ABCJS-engraved pages rotated by libvips with white background before export.
// Fixed raster inputs exercise interpolation independently of the implementation.
function readFixture(name: string) {
  const data = gunzipSync(
    readFileSync(new URL(`./fixtures/${name}.pgm.gz`, import.meta.url)),
  );
  const header = /^P5\n(\d+) (\d+)\n255\n/.exec(data.toString("ascii", 0, 40))!;
  return {
    gray: data.subarray(header[0].length),
    width: Number(header[1]),
    height: Number(header[2]),
  };
}
function straightenFixture(name: string) {
  const { gray, width, height } = readFixture(name);
  const corrected = straightenStaff(gray, width, height);
  expect(corrected).toBeTruthy();
  return corrected!;
}

it.each([
  ["rotate-mixed", "E4:2 F4:1 G4:1 | C5:1 A4:2 B4:1 | D4:4"],
  ["rotate-ledger", "C4:1 E4:1 G4:1 B4:1 | D5:1 F4:1 A4:1 C5:1"],
])("recovers the pitches and rhythm of %s", (name, expected) => {
  const { pixels, width, height } = straightenFixture(name);
  const { bars } = recognizeStaff(pixels, width, height, { deskewed: true });
  expect(
    bars
      .map((b) => b.map((n) => `${n.step}${n.octave}:${n.beats}`).join(" "))
      .join(" | "),
  ).toBe(expected);
});

it("continues to reject unsupported rests after straightening", () => {
  const { pixels, width, height } = straightenFixture("rotate-rest");
  expect(() =>
    recognizeStaff(pixels, width, height, { deskewed: true }),
  ).toThrow("unsupportedNotation");
});

it("leaves a horizontal engraving alone", () => {
  const { gray, width, height } = readFixture("mixed");
  expect(straightenStaff(gray, width, height)).toBeNull();
});
