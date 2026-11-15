import { describe, expect, it } from "vitest";
import {
  emptyMicrophoneSignal,
  updateMicrophoneSignal,
} from "./microphoneSignal";

describe("microphone signal visualization", () => {
  it("stays still for actual silence, regardless of stale frequency magnitudes", () => {
    const signal = emptyMicrophoneSignal();
    updateMicrophoneSignal(
      signal,
      new Float32Array(2048),
      new Float32Array(1024).fill(-20),
      48000,
      null,
    );
    expect(signal.rms).toBe(0);
    expect([...signal.bins]).toEqual(Array(24).fill(0));
  });
  it("shows measured spectral energy only and never changes pitch detection", () => {
    const signal = emptyMicrophoneSignal();
    const spectrum = new Float32Array(1024).fill(-100);
    spectrum[12] = -25;
    updateMicrophoneSignal(
      signal,
      new Float32Array(2048).fill(0.1),
      spectrum,
      48000,
      280,
    );
    expect(signal.rms).toBeCloseTo(0.1);
    expect(signal.frequencyHz).toBe(280);
    expect([...signal.bins].some((value) => value > 0.5)).toBe(true);
    expect([...signal.bins].some((value) => value === 0)).toBe(true);
  });
});
