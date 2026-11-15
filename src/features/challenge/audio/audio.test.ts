import { describe, expect, it } from "vitest";
import { estimatePitch, frequencyPitch } from "./pitch";
import { NoteEventDetector } from "./onset-offset";
import { clampInputOffset, suggestInputOffset } from "./calibration";
import { TouchKeyboardInput } from "../input/touchKeyboard";
import type { InputFrame, PerformanceEvent } from "../domain/performance";
import { detectPitch } from "@/lib/music/pitchDetection";
import { getStage } from "../data/stages";
import {
  getInstrumentProfile,
  getScoringProfile,
} from "../domain/instrument-profile";
import { buildScoreTimeline } from "../domain/score-timeline";
import { scoreAttempt } from "../domain/scoring";

const sine = (hz: number, rate = 48000, harmonics = false) =>
  Float32Array.from(
    { length: 2048 },
    (_, i) =>
      0.2 * Math.sin((2 * Math.PI * hz * i) / rate) +
      (harmonics ? 0.3 * Math.sin((4 * Math.PI * hz * i) / rate) : 0),
  );
const frame = (
  time: number,
  hz: number | null,
  rms = hz ? 0.1 : 0,
): InputFrame => ({
  audioTimeSec: time,
  streamSampleIndex: Math.round(time * 48000),
  rms,
  detectedHz: hz,
  confidence: hz ? 0.99 : 0,
  isVoiced: hz !== null,
});
function runFrames(hzAt: (time: number) => number | null, end: number) {
  const detector = new NoteEventDetector();
  const events: PerformanceEvent[] = [];
  detector.reset("fixture", 0.001);
  for (let i = 0; i <= end * 100; i++)
    events.push(...detector.accept(frame(i / 100, hzAt(i / 100))));
  return [...events, ...detector.flush(end)];
}

describe("challenge pitch analysis, synthetic PCM (not physical microphones)", () => {
  it.each([220, 261.625565, 329.627557, 391.995436, 523.251131])(
    "detects %sHz within 8 cents",
    (hz) => {
      for (const rate of [44100, 48000, 96000]) {
        const result = estimatePitch(sine(hz, rate), rate);
        expect(result.hz).not.toBeNull();
        expect(Math.abs(1200 * Math.log2(result.hz! / hz))).toBeLessThan(8);
        expect(result.confidence).toBeGreaterThan(0.9);
      }
    },
  );
  it("tracks the fundamental even when the second harmonic is louder", () => {
    expect(
      Math.abs(
        estimatePitch(sine(261.625565, 48000, true), 48000).hz! - 261.625565,
      ),
    ).toBeLessThan(2);
  });
  it.each([44100, 48000, 96000])(
    "resolves a weak fundamental under a dominant second harmonic at %sHz",
    (rate) => {
      for (const midi of [48, 60, 72, 84]) {
        const hz = 440 * 2 ** ((midi - 69) / 12);
        const pcm = Float32Array.from(
          { length: 2048 },
          (_, i) =>
            0.012 * Math.sin((2 * Math.PI * hz * i) / rate) +
            0.15 * Math.sin((4 * Math.PI * hz * i) / rate),
        );
        const result = estimatePitch(pcm, rate);
        expect(result.hz).not.toBeNull();
        expect(Math.abs(1200 * Math.log2(result.hz! / hz))).toBeLessThan(12);
      }
    },
  );
  it("rejects silence, non-finite input, out-of-range and deterministic noise", () => {
    const silence = new Float32Array(2048);
    expect(estimatePitch(silence, 48000).hz).toBeNull();
    silence[3] = NaN;
    expect(estimatePitch(silence, 48000).hz).toBeNull();
    expect(estimatePitch(sine(60), 48000).hz).toBeNull();
    let seed = 19;
    const noise = Float32Array.from({ length: 2048 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed / 0xffffffff - 0.5) * 0.1;
    });
    expect(estimatePitch(noise, 48000).hz).toBeNull();
    expect(estimatePitch(noise, NaN).hz).toBeNull();
  });
  it.each([44100, 48000, 96000])(
    "does not fold high out-of-range tones down into the voice band at %sHz",
    (rate) => {
      for (const hz of [1200, 2000, 2500, 3000]) {
        expect(
          estimatePitch(sine(hz, rate), rate).hz,
          `${rate}/${hz}`,
        ).toBeNull();
      }
    },
  );
  it.each([44100, 48000, 96000])(
    "preserves every chromatic octave and strong harmonic across C3..C6 at %sHz",
    (rate) => {
      for (let midi = 48; midi <= 84; midi++) {
        const hz = 440 * 2 ** ((midi - 69) / 12);
        for (const amplitudes of [
          [1],
          [1, 0.45, 0.25, 0.1],
          [0.08, 1],
          [0.05, 0, 1, 0.2],
        ]) {
          const pcm = Float32Array.from({ length: 2048 }, (_, i) =>
            amplitudes.reduce(
              (sum, amplitude, harmonic) =>
                sum +
                0.12 *
                  amplitude *
                  Math.sin((2 * Math.PI * hz * (harmonic + 1) * i) / rate),
              0,
            ),
          );
          const estimate = estimatePitch(pcm, rate);
          expect(estimate.hz, `${rate}/${midi}/${amplitudes}`).not.toBeNull();
          expect(
            Math.abs(1200 * Math.log2(estimate.hz! / hz)),
            `${rate}/${midi}/${amplitudes}`,
          ).toBeLessThan(8);
        }
      }
    },
  );
  it("preserves octave and cents rather than legacy pitch-class equivalence", () => {
    expect(frequencyPitch(261.625565)?.midi).toBe(60);
    expect(frequencyPitch(523.251131)?.midi).toBe(72);
    expect(frequencyPitch(Infinity)).toBeNull();
    // Baseline detector returns null for this low-amplitude sine (its first
    // short-lag peak is out of range). Keep legacy behavior unchanged; Stage
    // uses its separate detector. This is not real-instrument evidence.
    const pcm = sine(261.625565);
    expect(detectPitch(pcm, 48000)).toBeNull();
    expect(estimatePitch(pcm, 48000).confidence).toBeGreaterThan(0.9);
  });
});

describe("sample timestamp event segmentation", () => {
  it("captures exact onset and release, not a 220ms UI stabilization delay", () => {
    const events = runFrames((t) => (t >= 1 && t < 3 ? 261.625565 : null), 4);
    expect(events).toHaveLength(1);
    expect(events[0].onsetAudioSec).toBe(1);
    expect(events[0].offsetAudioSec).toBe(3);
    expect(events[0].observedMidi).toBe(60);
    expect(events[0].validPitchRatio).toBe(1);
    expect(
      events[0].pitchSamples!.every((sample) => sample.audioTimeSec < 3),
    ).toBe(true);
  });
  it("excludes release silence when stopped before offset hysteresis completes", () => {
    const events = runFrames(
      (t) => (t >= 1 && t < 3 ? 261.625565 : null),
      3.03,
    );
    expect(events).toHaveLength(1);
    expect(events[0].offsetAudioSec).toBe(3);
    expect(events[0].validPitchRatio).toBe(1);
    expect(events[0].pitchSamples).toHaveLength(200);
  });
  it("does not split a short dropout, but detects a repeated attack", () => {
    const gap = runFrames(
      (t) => (t >= 1 && t < 3 && !(t >= 1.8 && t < 1.83) ? 261.625565 : null),
      4,
    );
    expect(gap).toHaveLength(1);
    const repeated = runFrames(
      (t) => (t >= 1 && t < 3 && !(t >= 1.9 && t < 2.05) ? 261.625565 : null),
      4,
    );
    expect(repeated).toHaveLength(2);
    expect(repeated[1].onsetAudioSec).toBe(2.05);
  });
  it("counts internal silence against pitch quality without splitting normal dropouts", () => {
    const stage = getStage("w1-s1")!;
    const targets = buildScoreTimeline(
      stage,
      getInstrumentProfile("voice")!,
      1,
    );
    const profile = getScoringProfile(stage, "voice");
    // Every quiet interval is shorter than offset hysteresis, so the input is
    // one four-second event. It still must not count as four seconds of C4.
    const intermittent = runFrames(
      (t) =>
        t >= 1 && t < 5 && Math.round((t - 1) * 100) % 7 < 2
          ? 261.625565
          : null,
      5.2,
    );
    expect(intermittent).toHaveLength(1);
    expect(intermittent[0].validPitchRatio).toBeCloseTo(0.2875, 4);
    const rejected = scoreAttempt(intermittent, targets, profile);
    expect(rejected.notes[0]).toMatchObject({
      pitchPass: false,
      durationPass: true,
      status: "failed",
    });
    expect(rejected.stars).toBe(0);

    const briefDropout = runFrames(
      (t) => (t >= 1 && t < 5 && !(t >= 1.8 && t < 1.83) ? 261.625565 : null),
      5.2,
    );
    expect(briefDropout).toHaveLength(1);
    expect(briefDropout[0].validPitchRatio).toBeCloseTo(397 / 400, 4);
    const accepted = scoreAttempt(briefDropout, targets, profile);
    expect(accepted.notes[0]).toMatchObject({
      pitchPass: true,
      durationPass: true,
      status: "passed",
    });
    expect(accepted.stars).toBe(3);
  });
  it("separates legato C–D using stable pitch change, preserving timestamps", () => {
    const events = runFrames(
      (t) => (t < 1 || t >= 3 ? null : t < 2 ? 261.625565 : 293.664768),
      4,
    );
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.observedMidi)).toEqual([60, 62]);
    expect(events[0].offsetAudioSec).toBe(2);
    expect(events[1].onsetAudioSec).toBe(2);
  });
  it("preserves a measured attack and release while a brief pitch transient settles", () => {
    const events = runFrames(
      (t) =>
        t < 1 || t >= 2 ? null : t < 1.04 || t >= 1.96 ? 523.25 : 261.625565,
      2.2,
    );
    expect(events).toHaveLength(1);
    expect(events[0].observedMidi).toBe(60);
    expect(events[0].onsetAudioSec).toBe(1);
    expect(events[0].offsetAudioSec).toBe(2);
  });
  it("retains vibrato excursions but separates a sustained chromatic semitone change", () => {
    const vibrato = runFrames(
      (t) =>
        t >= 1 && t < 2
          ? 261.625565 * 2 ** ((60 * Math.sin(2 * Math.PI * 5.3 * t)) / 1200)
          : null,
      2.2,
    );
    expect(vibrato).toHaveLength(1);
    expect(vibrato[0].observedMidi).toBe(60);
    const chromatic = runFrames(
      (t) => (t < 1 || t >= 3 ? null : t < 2 ? 261.625565 : 277.182631),
      3.2,
    );
    expect(chromatic.map((event) => event.observedMidi)).toEqual([60, 61]);
    expect(chromatic[1].onsetAudioSec).toBe(2);
    expect(chromatic[1].attackConfidence).toBe(0);
  });
  it("does not invent pitch from unvoiced energy, and resets stale input", () => {
    const detector = new NoteEventDetector();
    detector.reset("first");
    for (let i = 0; i < 20; i++) detector.accept(frame(i / 100, null, 0.1));
    expect(detector.flush(0.2)[0].confidence).toBe(0);
    detector.accept(frame(0.3, 261));
    detector.reset("second");
    expect(detector.flush(1)).toEqual([]);
    expect(detector.accept(frame(NaN, 261))).toEqual([]);
  });
});

describe("touch release and calibration safety", () => {
  it("matches pointer identity, ignores multitouch and records note up duration", () => {
    const events: PerformanceEvent[] = [];
    const input = new TouchKeyboardInput((event) => events.push(event));
    expect(input.down("pointer1", 60, 1)).toBe(true);
    expect(input.down("pointer2", 62, 1.2)).toBe(false);
    expect(input.up("pointer2", 1.3)).toBe(false);
    expect(input.up("pointer1", 3)).toBe(true);
    expect(events[0].offsetAudioSec! - events[0].onsetAudioSec).toBe(2);
    input.down("key", 60, 4);
    input.cancel();
    input.up("key", 5);
    expect(events).toHaveLength(1);
  });
  it("bounds offsets and refuses noisy/sparse calibration recommendations", () => {
    expect(clampInputOffset(300)).toBe(250);
    expect(clampInputOffset(NaN)).toBe(0);
    expect(suggestInputOffset([80, 90, 78, 82, 79, 81, 77, 82])).toEqual({
      offsetMs: 81,
      reliable: true,
    });
    expect(suggestInputOffset([1, 2]).reliable).toBe(false);
    expect(suggestInputOffset([-200, -150, -100, 100, 150, 200]).reliable).toBe(
      false,
    );
  });
});
