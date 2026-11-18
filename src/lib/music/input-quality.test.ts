import { describe, expect, it } from "vitest";
import { createInputQualityObserver } from "./input-quality";
import { estimatePitch } from "./estimatePitch";

const pcm = (amplitude: number) => Float32Array.from({ length: 2048 }, (_, i) => amplitude * Math.sin(2 * Math.PI * 440 * i / 48000));
describe("shared microphone quality from actual PCM", () => {
  it("requires 200ms observed weak input using the owning path's gate", () => {
    const estimate = estimatePitch(pcm(0.01), 48000), observer = createInputQualityObserver();
    expect(observer.observe(estimate, 0, 0.015)).toBe("uncertain");
    expect(observer.observe(estimate, 0.199, 0.015)).toBe("uncertain");
    expect(observer.observe(estimate, 0.2, 0.015)).toBe("weak");
    expect(observer.observe(estimate, 0.21, 0.004)).toBe("stable");
  });
  it("distinguishes energy without periodicity from stable pitch", () => {
    const observer = createInputQualityObserver();
    let seed = 19;
    const noise = Float32Array.from({ length: 2048 }, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return 0.2 * (seed / 0xffffffff - 0.5); });
    expect(observer.observe(estimatePitch(noise, 48000), 0, 0.015)).toBe("uncertain");
    expect(observer.observe(estimatePitch(pcm(0.1), 48000), 0.01, 0.015)).toBe("stable");
  });
  it("requires sustained full-scale occupancy and does not label a single transient clipping", () => {
    const observer = createInputQualityObserver(), input = pcm(1.3);
    for (let i = 0; i < input.length; i++) input[i] = Math.max(-1, Math.min(1, input[i]));
    const estimate = estimatePitch(input, 48000);
    expect(estimate.peak).toBe(1);
    expect(estimate.clippingRatio).toBeGreaterThan(0.01);
    expect(observer.observe(estimate, 0, 0.015)).toBe("stable");
    expect(observer.observe(estimate, 0.199, 0.015)).toBe("stable");
    expect(observer.observe(estimate, 0.2, 0.015)).toBe("clipping");
    const quiet = estimatePitch(pcm(0.1), 48000);
    expect(observer.observe(quiet, 0.21, 0.015)).toBe("stable");
    expect(observer.observe(estimate, 0.22, 0.015)).toBe("stable");
    input.fill(0); input[20] = 1;
    expect(estimatePitch(input, 48000).clippingRatio).toBeLessThan(0.01);
  });
  it("resets inactivity, gaps and repeated observations without inventing sustained evidence", () => {
    const observer = createInputQualityObserver(), silence = estimatePitch(pcm(0), 48000);
    observer.observe(silence, 0, 0.015);
    expect(observer.observe(silence, 1, 0.015)).toBe("uncertain");
    expect(observer.observe(silence, 1.2, 0.015)).toBe("weak");
    expect(observer.observe(silence, 1.21, 0.015, false)).toBe("inactive");
    expect(observer.observe(silence, 1.22, 0.015)).toBe("uncertain");
    expect(observer.observe(silence, 1.22, 0.015)).toBe("uncertain");
  });
});
