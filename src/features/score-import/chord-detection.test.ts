import { describe, expect, it } from "vitest";
import { createChordDetector } from "./chord-detection";

const rate = 48000;
const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);
const signal = (tones: [number, number][], start = 0, size = 2048) =>
  Float32Array.from({ length: size }, (_, i) =>
    tones.reduce(
      (sum, [frequency, gain], n) =>
        sum +
        gain *
          Math.sin((2 * Math.PI * frequency * (i + start)) / rate + n * 0.72),
      0,
    ),
  );

describe("simultaneous microphone pitches", () => {
  it("accepts all chord tones in the same window at unequal levels", () => {
    const matches = createChordDetector();
    for (const start of [0, 512, 2048, 4096]) {
      expect(
        matches(
          signal(
            [
              [hz(60), 0.16],
              [hz(64), 0.08],
              [hz(67), 0.12],
            ],
            start,
          ),
          rate,
          [60, 64, 67],
        ),
      ).toBe(true);
    }
  });
  it("rejects every two-note subset, a wrong semitone, and successive arpeggio windows", () => {
    const matches = createChordDetector();
    for (const pitches of [
      [60, 64],
      [60, 67],
      [64, 67],
      [60, 65, 67],
      [60],
      [64],
      [67],
    ]) {
      expect(
        matches(
          signal(pitches.map((midi) => [hz(midi), 0.13])),
          rate,
          [60, 64, 67],
        ),
        String(pitches),
      ).toBe(false);
    }
  });
  it("does not report the fourth, fifth and sixth partials of a single low C as a C major chord", () => {
    const matches = createChordDetector();
    const root = hz(36);
    const partials = [1, 2, 3, 4, 5, 6, 7, 8].map((h): [number, number] => [
      h * root,
      0.22 / h,
    ]);
    expect(matches(signal(partials), rate, [60, 64, 67])).toBe(false);
    expect(
      matches(
        signal([
          [hz(60), 0.2],
          [hz(72), 0.095],
        ]),
        rate,
        [60, 72],
      ),
    ).toBe(false);
    expect(
      matches(
        signal([
          [hz(60), 0.14],
          [hz(72), 0.16],
        ]),
        rate,
        [60, 72],
      ),
    ).toBe(true);
  });
  it("requires tonal evidence above the noise floor", () => {
    const matches = createChordDetector();
    let seed = 51;
    const noise = Float32Array.from({ length: 2048 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return 0.25 * (seed / 0xffffffff - 0.5);
    });
    expect(matches(noise, rate, [60, 64, 67])).toBe(false);
    expect(matches(new Float32Array(2048), rate, [60, 64, 67])).toBe(false);
  });
});
