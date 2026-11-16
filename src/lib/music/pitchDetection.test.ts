import { describe, expect, it } from "vitest";
import { detectPitch, frequencyToNote } from "./pitchDetection";

const tone = (hz: number, rate: number, amplitude: number) =>
  Float32Array.from(
    { length: rate >= 88200 ? 4096 : 2048 },
    (_, index) => amplitude * Math.sin((2 * Math.PI * hz * index) / rate),
  );

describe("basic microphone pitch detection", () => {
  it.each([44100, 48000, 96000])(
    "recognizes quiet sustained notes without volume-dependent early peaks at %iHz",
    (rate) => {
      for (const amplitude of [0.03, 0.05, 0.1, 0.3, 0.6]) {
        for (const hz of [65.406, 82.407, 220, 440, 880, 1046.502]) {
          const detected = detectPitch(tone(hz, rate, amplitude), rate);
          expect(detected, `${hz}Hz at amplitude ${amplitude}`).not.toBeNull();
          expect(Math.abs(1200 * Math.log2(detected! / hz))).toBeLessThan(10);
          expect(frequencyToNote(detected!)).toEqual(frequencyToNote(hz));
        }
      }
    },
  );

  it("keeps the basic input noise gate and frequency bounds", () => {
    expect(detectPitch(tone(440, 48000, 0.01), 48000)).toBeNull();
    expect(detectPitch(new Float32Array(2048), 48000)).toBeNull();
    for (const hz of [50, 60, 1200, 1800])
      expect(detectPitch(tone(hz, 48000, 0.3), 48000)).toBeNull();
    expect(detectPitch(tone(440, 48000, 0.3), NaN)).toBeNull();
    const invalid = tone(440, 48000, 0.3);
    invalid[8] = NaN;
    expect(detectPitch(invalid, 48000)).toBeNull();
  });
});
