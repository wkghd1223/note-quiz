import { describe, expect, it } from "vitest";
import { createPitchAnalyzer, estimatePitch } from "./estimatePitch";

const tone = (hz: number, rate: number, length: number, amplitude = 0.1) =>
  Float32Array.from(
    { length },
    (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / rate),
  );
const expectPitch = (actual: number | null, hz: number) => {
  expect(actual).not.toBeNull();
  expect(Math.abs(1200 * Math.log2(actual! / hz))).toBeLessThan(8);
};

describe("capture-owned YIN inference and original PCM observations", () => {
  it("clears decimation scratch between alternating notes, silence and a weak fundamental", () => {
    const analyzer = createPitchAnalyzer(48000, 2048);
    for (let repeat = 0; repeat < 3; repeat++) {
      expectPitch(analyzer.analyze(tone(440, 48000, 2048)).hz, 440);
      expect(analyzer.analyze(new Float32Array(2048))).toEqual({
        hz: null,
        confidence: 0,
        rms: 0,
        peak: 0,
        clippingRatio: 0,
      });
      const weak = Float32Array.from(
        { length: 2048 },
        (_, i) =>
          0.012 * Math.sin((2 * Math.PI * 220 * i) / 48000) +
          0.15 * Math.sin((4 * Math.PI * 220 * i) / 48000),
      );
      expectPitch(analyzer.analyze(weak).hz, 220);
      expectPitch(analyzer.analyze(tone(880, 48000, 2048)).hz, 880);
    }
  });

  it("reconfigures both scratch arrays when sample rate or window length changes", () => {
    const analyzer = createPitchAnalyzer(48000, 2048);
    for (const [rate, size] of [
      [44100, 2048],
      [96000, 4096],
      [64000, 2048],
      [32000, 1024],
      [48000, 2048],
      [88200, 4096],
      [44100, 2048],
    ]) {
      expectPitch(analyzer.analyze(tone(440, rate, size), rate).hz, 440);
    }
    // The optional override does not replace the capture's default rate.
    expectPitch(analyzer.analyze(tone(220, 48000, 2048)).hz, 220);
  });

  it("owns independent capture workspaces and leaves PCM and prior results unchanged", () => {
    const first = createPitchAnalyzer(48000, 2048),
      second = createPitchAnalyzer(44100, 2048);
    const pcm = tone(220, 48000, 2048),
      original = pcm.slice();
    const result = first.analyze(pcm),
      snapshot = { ...result };
    expectPitch(result.hz, 220);
    expectPitch(second.analyze(tone(880, 44100, 2048)).hz, 880);
    first.analyze(tone(440, 96000, 4096), 96000);
    first.analyze(new Float32Array(4096), 96000);
    expect(pcm).toEqual(original);
    expect(result).toEqual(snapshot);
    expect(first.analyze(pcm)).not.toBe(result);
  });

  it("observes original full-scale occupancy before any decimation", () => {
    const pcm = tone(440, 96000, 4096);
    pcm[1] = 1;
    pcm[2] = -0.99;
    pcm[3] = 0.98;
    const result = estimatePitch(pcm, 96000);
    expect(result.peak).toBe(1);
    expect(result.clippingRatio).toBe(3 / pcm.length);
    expect(result.rms).toBe(
      Math.sqrt(
        pcm.reduce((sum, value) => sum + value * value, 0) / pcm.length,
      ),
    );
  });

  it("retains quiet-input observations while rejecting pitch below the original RMS gate", () => {
    const pcm = tone(440, 48000, 2048, 0.001),
      result = estimatePitch(pcm, 48000);
    expect(result.hz).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.rms).toBeGreaterThan(0);
    expect(result.peak).toBeCloseTo(0.001, 6);
    expect(result.clippingRatio).toBe(0);
  });

  it("rejects invalid input without stale observations and recovers from invalid initial configuration", () => {
    const analyzer = createPitchAnalyzer(NaN, 0),
      pcm = tone(440, 48000, 2048);
    expectPitch(analyzer.analyze(pcm, 48000).hz, 440);
    const invalid = pcm.slice();
    invalid[50] = Infinity;
    const empty = {
      hz: null,
      confidence: 0,
      rms: 0,
      peak: 0,
      clippingRatio: 0,
    };
    expect(analyzer.analyze(invalid, 48000)).toEqual(empty);
    expect(analyzer.analyze(pcm, NaN)).toEqual(empty);
    expect(analyzer.analyze(new Float32Array(255), 48000)).toEqual(empty);
    expectPitch(analyzer.analyze(pcm, 48000).hz, 440);
  });
});
