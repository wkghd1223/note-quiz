import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { estimatePitch } from "./pitch";
import { NoteEventDetector } from "./onset-offset";
import { beatCuePcm } from "./microphone";
import type { InputFrame, PerformanceEvent } from "../domain/performance";
import { getStage } from "../data/stages";
import {
  getInstrumentProfile,
  getScoringProfile,
} from "../domain/instrument-profile";
import { buildScoreTimeline } from "../domain/score-timeline";
import { scoreAttempt } from "../domain/scoring";

interface CaptureMessage {
  type: string;
  buffer: ArrayBuffer;
  streamSampleIndex: number;
  audioTimeSec: number;
  pitchAudioTimeSec: number;
  sampleRate: number;
  rms: number;
  droppedHops: number;
}
interface CaptureInstance {
  port: {
    onmessage: (event: {
      data: { type: string; buffer?: ArrayBuffer };
    }) => void;
  };
  process(inputs: Float32Array[][]): boolean;
}
function captureFixture(
  sampleRate: number,
  hzAt: (seconds: number) => number | null,
  duration: number,
  returnBuffers = true,
  amplitudeAt: (seconds: number) => number = () => 0.2,
  sampleAt?: (seconds: number, phase: number) => number,
) {
  const messages: CaptureMessage[] = [];
  const events: PerformanceEvent[] = [];
  const frames: InputFrame[] = [];
  const detector = new NoteEventDetector();
  detector.reset("pcm-fixture", 0.001);
  let Capture: new () => CaptureInstance;
  class Processor {
    port = {
      onmessage: (event: unknown) => {
        void event;
      },
      postMessage: (value: CaptureMessage) => {
        const message = structuredClone(value, { transfer: [value.buffer] });
        messages.push({ ...message, buffer: new ArrayBuffer(0) });
        const estimate = estimatePitch(
          new Float32Array(message.buffer),
          message.sampleRate,
        );
        const inputFrame: InputFrame & { pitchAudioTimeSec: number } = {
          audioTimeSec: message.audioTimeSec,
          pitchAudioTimeSec: message.pitchAudioTimeSec,
          streamSampleIndex: message.streamSampleIndex,
          rms: message.rms,
          detectedHz: estimate.hz,
          confidence: estimate.confidence,
          isVoiced: estimate.hz !== null,
        };
        frames.push(inputFrame);
        events.push(...detector.accept(inputFrame));
        if (returnBuffers)
          this.port.onmessage({
            data: { type: "release", buffer: message.buffer },
          });
      },
    };
  }
  const context = createContext({
    AudioWorkletProcessor: Processor,
    sampleRate,
    currentFrame: 0,
    registerProcessor: (
      _name: string,
      implementation: new () => CaptureInstance,
    ) => {
      Capture = implementation;
    },
  });
  runInContext(
    readFileSync(resolve("public/audio/challenge-capture.js"), "utf8"),
    context,
  );
  const processor = new Capture!();
  // Variable quantum sizes ensure timestamps do not assume 128 forever.
  const quanta = [128, 128, 256, 128];
  let offset = 0,
    block = 0,
    phase = 0;
  while (offset < duration * sampleRate) {
    const size = Math.min(
      quanta[block++ % quanta.length],
      Math.ceil(duration * sampleRate - offset),
    );
    const pcm = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const hz = hzAt((offset + i) / sampleRate);
      if (hz) phase += (2 * Math.PI * hz) / sampleRate;
      const time = (offset + i) / sampleRate;
      pcm[i] = sampleAt
        ? sampleAt(time, phase)
        : hz
          ? amplitudeAt(time) * Math.sin(phase)
          : 0;
    }
    context.currentFrame = offset;
    processor.process([[pcm]]);
    offset += size;
  }
  events.push(...detector.flush(duration));
  return { events, frames, messages, processor };
}

describe("real capture worklet source → PCM YIN → event segmentation → score (synthetic)", () => {
  it.each([44100, 48000, 96000])(
    "timestamps C4 whole note and release at %sHz sample rate",
    (rate) => {
      const { events, messages, processor } = captureFixture(
        rate,
        (t) => (t >= 1 && t < 5 ? 261.625565 : null),
        5.3,
      );
      expect(events).toHaveLength(1);
      expect(Math.abs(events[0].onsetAudioSec - 1)).toBeLessThan(0.025);
      expect(Math.abs(events[0].offsetAudioSec! - 5)).toBeLessThan(0.025);
      expect(events[0].observedMidi).toBe(60);
      expect(messages.every((m) => m.droppedHops === 0)).toBe(true);
      expect(
        messages.every(
          (m) => m.audioTimeSec === (m.streamSampleIndex - 256) / rate,
        ),
      ).toBe(true);
      expect(
        messages.every(
          (message) =>
            message.pitchAudioTimeSec ===
            (message.streamSampleIndex - 1024) / rate,
        ),
      ).toBe(true);
      const stage = getStage("w1-s1")!;
      const result = scoreAttempt(
        events,
        buildScoreTimeline(stage, getInstrumentProfile("voice")!, 1),
        getScoringProfile(stage, "voice"),
      );
      expect(result.cleared).toBe(true);
      expect(result.notes[0].pitchPass && result.notes[0].durationPass).toBe(
        true,
      );
      processor.port.onmessage({ data: { type: "stop" } });
      expect(processor.process([[new Float32Array(128)]])).toBe(false);
    },
  );
  it("splits two real PCM attacks, not one long C4", () => {
    const twice = captureFixture(
      48000,
      (t) => (t >= 1 && t < 3 && !(t >= 1.9 && t < 2.05) ? 261.625565 : null),
      3.3,
    );
    expect(twice.events).toHaveLength(2);
    const long = captureFixture(
      48000,
      (t) => (t >= 1 && t < 3 ? 261.625565 : null),
      3.3,
    );
    expect(long.events).toHaveLength(1);
  });
  it("silence never creates note events", () => {
    expect(captureFixture(48000, () => null, 1).events).toEqual([]);
  });
  it("a brief volume dip does not erase the rest of a continuous held note", () => {
    const { events } = captureFixture(
      48000,
      (t) => (t >= 1 && t < 3 ? 261.625565 : null),
      3.3,
      true,
      (t) => (t < 1.5 ? 0.2 : t < 1.53 ? 0.04 : t < 2 ? 0.1 : 0.2),
    );
    expect(events).toHaveLength(1);
    expect(events[0].offsetAudioSec! - events[0].onsetAudioSec).toBeCloseTo(
      2,
      1,
    );
  });
  it("legato pitch movement is not a distinct attack for repeated-note stages", () => {
    const { events } = captureFixture(
      48000,
      (t) =>
        t < 1 || t >= 3 ? null : t < 2 || t >= 2.1 ? 261.625565 : 293.664768,
      3.3,
    );
    expect(events).toHaveLength(3);
    expect(events[2].attackConfidence).toBe(0);
    const stage = getStage("w4-s2")!;
    const targets = buildScoreTimeline(
      stage,
      getInstrumentProfile("voice")!,
      1,
    );
    const result = scoreAttempt(
      events,
      targets,
      getScoringProfile(stage, "voice"),
    );
    expect(result.notes[1].distinctAttackPass).toBe(false);
    expect(result.stars).toBe(0);
  });
  it("bounds transferable allocation and reports dropped capture blocks", () => {
    const { messages, processor } = captureFixture(
      48000,
      () => 261.625565,
      1,
      false,
    );
    expect(messages).toHaveLength(8);
    processor.port.onmessage({
      data: { type: "release", buffer: new ArrayBuffer(2048 * 4) },
    });
    for (let i = 0; i < 4; i++) processor.process([[new Float32Array(128)]]);
    expect(messages.at(-1)!.droppedHops).toBeGreaterThan(0);
  });
});

function eventSummary(event: PerformanceEvent) {
  const summary = { ...event };
  delete summary.pitchSamples;
  return summary;
}

const voiceMeasurements: unknown[] = [];
const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const spectra = [
  { name: "vowel", amplitudes: [1, 0.45, 0.25, 0.1] },
  { name: "dominant-second", amplitudes: [0.08, 1, 0, 0] },
  { name: "dominant-third", amplitudes: [0.05, 0, 1, 0.2] },
];

describe("vocal-like PCM through the actual worklet (not physical voice evidence)", () => {
  it.each([44100, 48000, 96000])(
    "keeps C3..C6 harmonic voice, vibrato and envelope events at %sHz",
    (rate) => {
      for (const midi of [48, 60, 72, 84]) {
        for (const { name, amplitudes } of spectra) {
          for (const vibratoCents of [20, 60]) {
            const hz = midiHz(midi);
            const { events, frames } = captureFixture(
              rate,
              (t) =>
                t >= 0.2 && t < 1
                  ? hz *
                    2 **
                      ((vibratoCents * Math.sin(2 * Math.PI * 5.3 * t)) / 1200)
                  : null,
              1.15,
              true,
              () => 0.1,
              (t, phase) => {
                if (t < 0.2 || t >= 1) return 0;
                const envelope = Math.min(1, (t - 0.2) / 0.03, (1 - t) / 0.06);
                return (
                  0.1 *
                  envelope *
                  amplitudes.reduce(
                    (sum, amplitude, harmonic) =>
                      sum + amplitude * Math.sin((harmonic + 1) * phase),
                    0,
                  )
                );
              },
            );
            voiceMeasurements.push({
              type: "voice",
              rate,
              midi,
              spectrum: name,
              vibratoCents,
              events: events.map(eventSummary),
              voicedFrames: frames.filter((frame) => frame.isVoiced).length,
              totalFrames: frames.length,
              ...(events.length !== 1 ? { diagnosticFrames: frames } : {}),
            });
            expect(events, `${rate}/${midi}/${name}`).toHaveLength(1);
            expect(events[0].observedMidi, `${rate}/${midi}/${name}`).toBe(
              midi,
            );
            expect(Math.abs(events[0].medianCents!)).toBeLessThan(12);
            expect(events[0].validPitchRatio).toBeGreaterThan(0.85);
            expect(Math.abs(events[0].onsetAudioSec - 0.2)).toBeLessThan(0.025);
            expect(Math.abs(events[0].offsetAudioSec! - 1)).toBeLessThan(0.025);
          }
        }
      }
    },
  );
  it.each([44100, 48000, 96000])(
    "measures legato boundaries and same-pitch gaps at %sHz",
    (rate) => {
      const legato = captureFixture(
        rate,
        (t) => (t < 0.2 || t >= 1.2 ? null : t < 0.7 ? midiHz(60) : midiHz(62)),
        1.4,
      );
      expect(legato.events.map((event) => event.observedMidi)).toEqual([
        60, 62,
      ]);
      voiceMeasurements.push({
        type: "legato",
        rate,
        boundary: legato.events[1].onsetAudioSec,
        errorMs: (legato.events[1].onsetAudioSec - 0.7) * 1000,
      });
      expect(Math.abs(legato.events[1].onsetAudioSec - 0.7)).toBeLessThan(
        0.025,
      );
      const repeated = captureFixture(
        rate,
        (t) =>
          t < 0.2 || t >= 1.2 || (t >= 0.65 && t < 0.73) ? null : midiHz(60),
        1.4,
      );
      voiceMeasurements.push({
        type: "same-pitch-gap",
        rate,
        events: repeated.events.map(eventSummary),
        frames: repeated.frames.filter(
          (f) => f.audioTimeSec > 0.63 && f.audioTimeSec < 0.77,
        ),
      });
      expect(repeated.events.map((event) => event.observedMidi)).toEqual([
        60, 60,
      ]);
      expect(Math.abs(repeated.events[1].onsetAudioSec - 0.73)).toBeLessThan(
        0.02,
      );
      const dropout = captureFixture(
        rate,
        (t) =>
          t < 0.2 || t >= 1.2 || (t >= 0.65 && t < 0.68) ? null : midiHz(60),
        1.4,
      );
      expect(dropout.events).toHaveLength(1);
      expect(dropout.events[0].validPitchRatio).toBeLessThan(1);
    },
  );
  it.each([44100, 48000, 96000])(
    "rejects quiet/silence pitch and keeps broadband energy unpitched at %sHz",
    (rate) => {
      expect(
        captureFixture(
          rate,
          () => midiHz(60),
          0.5,
          true,
          () => 0.001,
        ).events,
      ).toEqual([]);
      let seed = 42;
      const noise = captureFixture(
        rate,
        () => null,
        0.8,
        true,
        () => 0,
        (t) => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return t >= 0.2 && t < 0.6 ? (seed / 0xffffffff - 0.5) * 0.1 : 0;
        },
      );
      expect(noise.events).toHaveLength(1);
      expect(noise.events[0].observedMidi).toBeNull();
      expect(noise.frames.every((frame) => !frame.isVoiced)).toBe(true);
    },
  );
  it.each([44100, 48000, 96000])(
    "does not turn exact beat/bar cue PCM into notes or erase a simultaneous voice at %sHz",
    (rate) => {
      for (const kind of ["beat", "bar"] as const) {
        const pcm = beatCuePcm(rate, kind);
        const sampleCue = (t: number) => {
          let value = 0;
          for (const start of [0.2, 0.7, 1.2]) {
            const index = Math.round((t - start) * rate);
            if (index >= 0 && index < pcm.length) value += pcm[index];
          }
          return value;
        };
        const cues = captureFixture(
          rate,
          () => null,
          1.5,
          true,
          () => 0,
          sampleCue,
        );
        voiceMeasurements.push({
          type: "cue",
          rate,
          kind,
          voicedFrames: cues.frames.filter((frame) => frame.isVoiced).length,
          events: cues.events.map(eventSummary),
          peak: Math.max(...pcm.map(Math.abs)),
        });
        expect(cues.events).toEqual([]);
        expect(cues.frames.filter((frame) => frame.isVoiced)).toHaveLength(0);
        const mixed = captureFixture(
          rate,
          (t) => (t >= 0.2 && t < 1.3 ? midiHz(60) : null),
          1.5,
          true,
          () => 0.06,
          (t, phase) =>
            sampleCue(t) + (t >= 0.2 && t < 1.3 ? 0.06 * Math.sin(phase) : 0),
        );
        expect(mixed.events).toHaveLength(1);
        expect(mixed.events[0].observedMidi).toBe(60);
        expect(mixed.events[0].validPitchRatio).toBeGreaterThan(0.85);
        expect(Math.abs(mixed.events[0].onsetAudioSec - 0.2)).toBeLessThan(
          0.02,
        );
        voiceMeasurements.push({
          type: "cue-with-voice",
          rate,
          kind,
          events: mixed.events.map(eventSummary),
        });
      }
    },
  );
  it.each([44100, 48000, 96000])(
    "retains a quiet breathy voice with a consonant attack at %sHz",
    (rate) => {
      for (const midi of [48, 60, 72, 84]) {
        let seed = 81;
        const { events } = captureFixture(
          rate,
          (t) => (t >= 0.225 && t < 0.9 ? midiHz(midi) : null),
          1.1,
          true,
          () => 0,
          (t, phase) => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const noise = seed / 0xffffffff - 0.5;
            if (t < 0.2 || t >= 0.9) return noise * 0.001;
            if (t < 0.225) return noise * 0.06;
            return (
              0.025 *
                (Math.sin(phase) +
                  0.4 * Math.sin(2 * phase) +
                  0.2 * Math.sin(3 * phase)) +
              noise * 0.004
            );
          },
        );
        expect(events).toHaveLength(1);
        expect(events[0].observedMidi).toBe(midi);
        expect(events[0].validPitchRatio).toBeGreaterThan(0.85);
        expect(Math.abs(events[0].onsetAudioSec - 0.2)).toBeLessThan(0.02);
        voiceMeasurements.push({
          type: "breathy-consonant",
          rate,
          midi,
          events: events.map(eventSummary),
        });
      }
    },
  );
  it.each([44100, 48000, 96000])(
    "keeps the measured 500ms quiet-voice interval with simultaneous cues at %sHz",
    (rate) => {
      const beat = beatCuePcm(rate, "beat"),
        bar = beatCuePcm(rate, "bar");
      const { events } = captureFixture(
        rate,
        (t) => (t >= 0.2 && t < 0.7 ? midiHz(60) : null),
        0.9,
        true,
        () => 0,
        (t, phase) => {
          const index = Math.round((t - 0.2) * rate);
          const secondIndex = Math.round((t - 0.533333333) * rate);
          return (
            (t >= 0.2 && t < 0.7 ? 0.025 * Math.sin(phase) : 0) +
            (index >= 0 && index < beat.length ? beat[index] : 0) +
            (index >= 0 && index < bar.length ? bar[index] : 0) +
            (secondIndex >= 0 && secondIndex < beat.length
              ? beat[secondIndex]
              : 0)
          );
        },
      );
      expect(events).toHaveLength(1);
      expect(events[0].observedMidi).toBe(60);
      expect(events[0].validPitchRatio).toBeGreaterThan(0.85);
      expect(Math.abs(events[0].onsetAudioSec - 0.2)).toBeLessThan(0.02);
      expect(Math.abs(events[0].offsetAudioSec! - 0.7)).toBeLessThan(0.02);
      voiceMeasurements.push({
        type: "500ms-voice-with-both-cues",
        rate,
        events: events.map(eventSummary),
      });
    },
  );
  it("exports measured fixture evidence only when requested", () => {
    if (process.env.NOTE_QUIZ_VOICE_REPORT)
      writeFileSync(
        process.env.NOTE_QUIZ_VOICE_REPORT,
        JSON.stringify(
          {
            evidence:
              "Actual worklet source executed in Node VM with synthetic vocal-like and exact cue PCM; no physical microphone/speaker claim",
            measurements: voiceMeasurements,
          },
          null,
          2,
        ),
      );
  });
});
