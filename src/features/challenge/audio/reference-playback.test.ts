import { describe, expect, it, vi } from "vitest";
import {
  referencePlayback,
  scheduleReferencePlayback,
} from "./reference-playback";
import type { TargetEvent } from "../domain/performance";
import { createMelody } from "@/features/melody/domain/generator";
import { defaultMelodySettings } from "@/features/melody/domain/settings";
import { buildPlaybackTimeline } from "../domain/score-timeline";
import { getInstrumentProfile } from "../domain/instrument-profile";
import { beatsPerMeasure } from "../domain/stage";
import { pianoNoteKey, preparePianoBuffers } from "./piano";
const target = (
  id: string,
  start: number,
  end: number,
  midi: number | null,
): TargetEvent => ({
  stageEventId: id,
  startAudioSec: start,
  endAudioSec: end,
  kind: midi === null ? "rest" : "note",
  targetConcertMidi: midi,
  requiresDistinctAttack: false,
});
describe("shared target reference scheduling", () => {
  it("keeps leading/trailing rests and only plays the requested bar at timeline tempo", () => {
    const targets = [
      target("prior", 0, 2, 64),
      target("rest", 2, 2.5, null),
      target("a", 2.5, 3, 60),
      target("b", 3, 3.5, 62),
      target("tail", 3.5, 4, null),
      target("next", 4, 5, 65),
    ];
    expect(referencePlayback(targets, 2, 4)).toEqual({
      durationSec: 2,
      tones: [
        { midi: 60, offsetSec: 0.5, durationSec: 0.475 },
        { midi: 62, offsetSec: 1, durationSec: 0.475 },
      ],
    });
    expect(referencePlayback([target("rest", 0, 4, null)], 0, 4)).toEqual({
      durationSec: 4,
      tones: [],
    });
  });
  it("establishes zero after decoding and schedules through the existing piano", async () => {
    const audio = {
      context: { currentTime: 10 } as AudioContext,
      preparePiano: vi.fn(async () => {
        Object.assign(audio.context, { currentTime: 25 });
      }),
      pianoTone: vi.fn(),
    };
    expect(
      await scheduleReferencePlayback(
        audio,
        referencePlayback([target("a", 1, 2, 60)], 0, 4),
        () => true,
      ),
    ).toBe(25.08);
    expect(audio.preparePiano).toHaveBeenCalledWith([
      { midi: 60, durationSec: 0.95 },
    ]);
    expect(audio.pianoTone).toHaveBeenCalledWith(60, 26.08, 0.95);
  });
  it("ignores late preparation after cancellation without scheduling a note", async () => {
    let resolve!: () => void;
    const audio = {
      context: { currentTime: 10 } as AudioContext,
      preparePiano: vi.fn(
        () =>
          new Promise<void>((done) => {
            resolve = done;
          }),
      ),
      pianoTone: vi.fn(),
    };
    let current = true;
    const pending = scheduleReferencePlayback(
      audio,
      referencePlayback([target("a", 0, 1, 60)], 0, 4),
      () => current,
    );
    current = false;
    resolve();
    expect(await pending).toBeNull();
    expect(audio.pianoTone).not.toHaveBeenCalled();
  });
});

describe("reference bar boundary roundoff", () => {
  it.each([1, 0.85, 0.7])(
    "validates every default generated note's bar at tempo scale %s with the real piano contract",
    async (tempoScale) => {
      const generated = createMelody(defaultMelodySettings, 1);
      expect(generated.ok).toBe(true);
      if (!generated.ok) throw new Error("generation");
      const stage = generated.exercise;
      expect(stage.bpm).toBe(72);
      const targets = buildPlaybackTimeline(
        stage,
        getInstrumentProfile("touch-keyboard")!,
        0,
        tempoScale,
      ).targets;
      const barBeats = beatsPerMeasure(stage);
      const quarterSec = 60 / (stage.bpm * tempoScale);
      const context = {
        sampleRate: 48000,
        createBuffer: vi.fn(() => {
          throw new Error("must not synthesize");
        }),
      };
      for (const event of stage.events.filter(
        (event) => event.kind === "note",
      )) {
        const target = targets.find(
          (target) => target.stageEventId === event.id,
        )!;
        // Exact production reviewBar expression, including the reported beat6 case.
        const start =
          target.startAudioSec - (event.startBeat % barBeats) * quarterSec;
        const playback = referencePlayback(
          targets,
          start,
          start + barBeats * quarterSec,
        );
        const barIndex = Math.floor(event.startBeat / barBeats);
        const expected = stage.events.filter(
          (candidate) =>
            candidate.kind === "note" &&
            Math.floor(candidate.startBeat / barBeats) === barIndex,
        );
        expect(playback.tones.map((tone) => tone.midi)).toEqual(
          expected.map((event) => event.writtenMidi),
        );
        expect(playback.durationSec).toBeCloseTo(barBeats * quarterSec, 12);
        for (let index = 0; index < playback.tones.length; index++) {
          const tone = playback.tones[index];
          expect(tone.offsetSec).toBeCloseTo(
            (expected[index].startBeat % barBeats) * quarterSec,
            12,
          );
          expect(tone.durationSec).toBeCloseTo(
            expected[index].durationBeats * quarterSec * 0.95,
            12,
          );
          expect(() => pianoNoteKey(tone)).not.toThrow();
        }
        // Real preparation performs duration/resource validation before cancellation.
        // No mock validator, soundfont fetch, synthesis, AudioContext or output.
        await expect(
          preparePianoBuffers(context, playback.tones, () => false),
        ).resolves.toEqual(new Map());
      }
      expect(context.createBuffer).not.toHaveBeenCalled();
    },
  );
  it("excludes fractional preceding and following overlaps without dropping a short written note", () => {
    const playback = referencePlayback(
      [
        target("prior", 0, 2, 64),
        target("short", 2, 2.025, 60),
        target("rest", 2.025, 4, null),
        target("following", 4, 5, 65),
      ],
      2 - Number.EPSILON * 2,
      4 + Number.EPSILON * 4,
    );
    expect(playback.tones).toHaveLength(1);
    expect(playback.tones[0].midi).toBe(60);
    expect(playback.tones[0].durationSec).toBeCloseTo(0.025 * 0.95, 14);
    expect(() => pianoNoteKey(playback.tones[0])).not.toThrow();
    expect(playback.durationSec).toBeCloseTo(2, 14);
  });
  it("retains meaningful partial notes on both boundaries and unaltered leading/trailing silence", () => {
    const playback = referencePlayback(
      [
        target("crossing-start", 1.98, 2.04, 60),
        target("silence", 2.04, 3.97, null),
        target("crossing-end", 3.97, 4.1, 62),
      ],
      2,
      4,
    );
    expect(playback.tones.map((tone) => tone.midi)).toEqual([60, 62]);
    expect(playback.tones[0].offsetSec).toBe(0);
    expect(playback.tones[0].durationSec).toBeCloseTo(0.04 * 0.95, 14);
    expect(playback.tones[1].offsetSec).toBeCloseTo(1.97, 14);
    expect(playback.tones[1].durationSec).toBeCloseTo(0.03 * 0.95, 14);
    playback.tones.forEach((tone) =>
      expect(() => pianoNoteKey(tone)).not.toThrow(),
    );
    expect(playback.durationSec).toBe(2);
  });
});
