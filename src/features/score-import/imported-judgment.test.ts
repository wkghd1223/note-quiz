import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  pianoNoteKey,
  preparePianoBuffers,
} from "@/features/challenge/audio/piano";
import type { ImportedTarget } from "./types";
import { ImportedJudgment } from "./imported-judgment";

const rate = 48000;
const windowSize = 2048;
const toHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
afterEach(() => vi.unstubAllGlobals());
function target(
  id: string,
  startSec: number,
  endSec: number,
  midis: number[],
): ImportedTarget {
  return { id, eventId: id, barIndex: 0, startSec, endSec, midis };
}
function play(
  judge: ImportedJudgment,
  duration: number,
  pitchesAt: (time: number) => number[],
) {
  const samples = Float32Array.from(
    { length: Math.ceil(rate * duration) },
    (_, i) =>
      pitchesAt(i / rate).reduce(
        (sum, midi) =>
          sum +
          0.11 * Math.sin((2 * Math.PI * toHz(midi) * i) / rate + 0.04 * midi),
        0,
      ),
  );
  for (let end = windowSize; end <= samples.length; end += 512) {
    const pcm = samples.subarray(end - windowSize, end);
    const pitches = pitchesAt((end - windowSize / 2) / rate);
    const rms = Math.sqrt(
      pcm
        .subarray(pcm.length - 512)
        .reduce((sum, sample) => sum + sample * sample, 0) / 512,
    );
    judge.accept(
      pcm,
      rate,
      {
        streamSampleIndex: end,
        audioTimeSec: (end - 256) / rate,
        pitchAudioTimeSec: (end - windowSize / 2) / rate,
        rms,
        confidence: pitches.length === 1 ? 0.99 : 0,
        isVoiced: pitches.length === 1,
        detectedHz: pitches.length === 1 ? toHz(pitches[0]) : null,
      },
      0.009,
      0,
    );
  }
  judge.finish();
  return { ...judge.results };
}
describe("imported score microphone judgments", () => {
  it("distinguishes a complete chord from two keys in the bundled piano samples", async () => {
    const font = readFileSync(
      "node_modules/@coderline/alphatab/dist/soundfont/sonivox.sf2",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(Uint8Array.from(font))),
    );
    const context = {
      sampleRate: rate,
      createBuffer(channels: number, length: number, sampleRate: number) {
        const data = Array.from(
          { length: channels },
          () => new Float32Array(length),
        );
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          duration: length / sampleRate,
          getChannelData: (channel: number) => data[channel],
          copyToChannel: (samples: Float32Array, channel: number) =>
            data[channel].set(samples),
        } as unknown as AudioBuffer;
      },
    };
    const keys = [60, 64, 67];
    const notes = keys.map((midi) => ({ midi, durationSec: 0.6 }));
    const buffers = await preparePianoBuffers(context, notes, () => true);
    for (const played of [keys, [60, 67]]) {
      const judge = new ImportedJudgment([target("chord", 0, 0.6, keys)]);
      const samples = new Float32Array(rate * 0.65);
      for (const midi of played) {
        const voice = buffers
          .get(pianoNoteKey({ midi, durationSec: 0.6 }))!
          .getChannelData(0);
        for (let i = 0; i < voice.length; i++) samples[i] += voice[i];
      }
      for (let i = windowSize; i <= samples.length; i += 512) {
        const pcm = samples.subarray(i - windowSize, i);
        const rms = Math.sqrt(
          pcm.reduce((sum, sample) => sum + sample * sample, 0) / windowSize,
        );
        judge.accept(
          pcm,
          rate,
          {
            streamSampleIndex: i,
            pitchAudioTimeSec: (i - windowSize / 2) / rate,
            audioTimeSec: (i - 256) / rate,
            rms,
            isVoiced: false,
            confidence: 0,
            detectedHz: null,
          },
          0.009,
          0,
        );
      }
      judge.finish();
      expect(judge.results.chord).toBe(played.length === keys.length);
    }
  });
  it("gives separate results to repeated visits and measures lower and closely-spaced chords", () => {
    const targets = [
      target("first", 0, 0.55, [48, 52, 55]),
      target("second", 0.55, 1.15, [60, 61]),
      target("third", 1.15, 1.7, [48, 52, 55]),
      target("silent", 1.7, 2.2, []),
    ];
    const result = play(new ImportedJudgment(targets), 2.3, (time) => {
      if (time < 0.55) return [48, 52, 55];
      if (time < 1.15) return [60, 61];
      if (time < 1.7) return [48, 55];
      return [];
    });
    expect(result).toEqual({
      first: true,
      second: true,
      third: false,
      silent: true,
    });
  });
  it("cannot complete a chord by accumulating partial sets across an arpeggio", () => {
    const result = play(
      new ImportedJudgment([target("triad", 0, 0.75, [60, 64, 67])]),
      0.85,
      (time) => {
        const index = Math.floor(time / 0.1) % 3;
        return [
          [60, 64],
          [64, 67],
          [60, 67],
        ][index];
      },
    );
    expect(result.triad).toBe(false);
  });
  it("rejects alternating low neighbours even when both fall in one long spectral window", () => {
    const low = target("low", 0, 1, [48, 49]);
    expect(play(new ImportedJudgment([low]), 1.1, () => [48, 49]).low).toBe(
      true,
    );
    for (const interval of [0.04, 0.07, 0.12]) {
      const result = play(new ImportedJudgment([low]), 1.1, (time) => [
        Math.floor(time / interval) % 2 ? 49 : 48,
      ]);
      expect(result.low, String(interval)).toBe(false);
    }
  });
  it("judges instrument notes outside the voice estimator's range", () => {
    const targets = [
      target("bass", 0, 0.6, [21]),
      target("treble", 0.6, 1.2, [108]),
      target("wrongBass", 1.2, 1.8, [21]),
    ];
    const result = play(new ImportedJudgment(targets), 1.9, (time) =>
      time < 0.6 ? [21] : time < 1.2 ? [108] : [22],
    );
    expect(result).toEqual({ bass: true, treble: true, wrongBass: false });
  });
  it("requires a new attack for a repeated chord, and sound during a rest is a failure", () => {
    const targets = [
      target("a", 0, 0.45, [60, 64, 67]),
      target("held", 0.45, 0.9, [60, 64, 67]),
      target("newAttack", 0.9, 1.35, [60, 64, 67]),
      target("rest", 1.35, 1.8, []),
    ];
    const result = play(new ImportedJudgment(targets), 1.9, (time) =>
      time > 0.86 && time < 0.93 ? [] : [60, 64, 67],
    );
    expect(result).toEqual({
      a: true,
      held: false,
      newAttack: true,
      rest: false,
    });
  });
  it("never credits an unobserved rest or note", () => {
    const judge = new ImportedJudgment([
      target("rest", 0, 1, []),
      target("note", 1, 2, [60]),
    ]);
    judge.finish();
    expect(judge.results).toEqual({ rest: false, note: false });
  });
  it("keeps the accurate duration of a shorter chord head and then judges its sustained neighbour alone", () => {
    const targets = [
      target("both", 0, 0.45, [60, 64]),
      target("low", 0.45, 1.1, [60]),
    ];
    expect(
      play(new ImportedJudgment(targets), 1.2, (time) =>
        time < 0.45 ? [60, 64] : [60],
      ),
    ).toEqual({ both: true, low: true });
  });
});
