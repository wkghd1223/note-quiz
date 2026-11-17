import { describe, expect, it } from "vitest";
import {
  LayoutMode,
  Settings,
  StaveProfile,
  model,
  rendering,
} from "@coderline/alphatab";
import { beatsPerMeasure } from "@/features/challenge/domain/stage";
import { stages } from "@/features/challenge/data/stages";
import { generateMelody } from "@/features/melody/domain/generator";
import { exerciseScore } from "@/features/melody/domain/notation";
import {
  defaultMelodySettings,
  melodyTimeSignatures,
} from "@/features/melody/domain/settings";
import { toAlphaTabScore } from "./alphatab-score";
import type { NotationScore } from "./score";

function engrave(input: NotationScore) {
  const built = toAlphaTabScore(input);
  const settings = new Settings();
  settings.core.engine = "svg";
  settings.core.includeNoteBounds = true;
  settings.core.enableLazyLoading = false;
  settings.display.layoutMode = LayoutMode.Horizontal;
  settings.display.staveProfile = StaveProfile.Score;
  const renderer = new rendering.ScoreRenderer(settings);
  renderer.width = 1800;
  const parts: string[] = [];
  renderer.partialRenderFinished.on((event) =>
    parts.push(String(event.renderResult)),
  );
  renderer.error.on((error) => {
    throw error;
  });
  renderer.renderScore(built.score, [0]);
  return { built, renderer, svg: parts.join("") };
}

describe("native alphaTab meter and rhythm semantics", () => {
  it.each(melodyTimeSignatures)(
    "matches written and performed durations over eight %i/%i bars",
    (n, d) => {
      for (const seed of [0, 7, 31]) {
        const exercise = generateMelody(
          {
            ...defaultMelodySettings,
            durations: [0.5, 1, 2, 4],
            dotted: true,
            triplets: true,
            bpm: 40,
            timeSignature: [n, d],
          },
          seed,
        );
        const notation = exerciseScore(exercise);
        expect(notation.timeSignature).toEqual({
          numerator: n,
          denominator: d,
        });
        const built = toAlphaTabScore(notation);
        expect(built.score.masterBars).toHaveLength(8);
        for (const bar of built.score.masterBars) {
          expect(bar.timeSignatureNumerator).toBe(n);
          expect(bar.timeSignatureDenominator).toBe(d);
          expect(bar.calculateDuration()).toBe(beatsPerMeasure(exercise) * 960);
          const voice =
            built.score.tracks[0].staves[0].bars[bar.index].voices[0];
          expect(
            voice.beats.reduce((sum, beat) => sum + beat.playbackDuration, 0),
          ).toBeCloseTo(beatsPerMeasure(exercise) * 960);
        }
        for (const [index, { id, beat }] of built.events.entries()) {
          const event = exercise.events[index];
          expect(id).toBe(event.id);
          expect(beat.playbackDuration).toBeCloseTo(
            event.durationBeats * 960,
            8,
          );
          expect(beat.displayDuration).toBe(beat.playbackDuration);
          expect(beat.duration).toBe(event.noteValue);
          expect(beat.dots).toBe(event.dots);
          expect(beat.notes.map((note) => note.realValue)).toEqual(
            event.kind === "rest" ? [] : [event.writtenMidi],
          );
          if (event.tuplet) {
            expect(beat.duration).toBe(model.Duration.Eighth);
            expect(beat.playbackDuration).toBe(320);
            expect(beat.tupletGroup?.isFull).toBe(true);
            expect(beat.tupletGroup?.beats).toHaveLength(3);
            expect(
              beat.tupletGroup?.beats.every(
                (part) => part.voice === beat.voice,
              ),
            ).toBe(true);
          } else expect(beat.hasTuplet).toBe(false);
        }
      }
    },
  );
  it("engraves native full tuplet groups and beamed eighths with a triplet numeral", () => {
    const exercise = generateMelody(
      {
        ...defaultMelodySettings,
        durations: [4],
        triplets: true,
        bpm: 40,
        timeSignature: [3, 4],
      },
      7,
    );
    const { built, renderer, svg } = engrave(exerciseScore(exercise));
    try {
      expect(svg).toContain("&#59523;"); // alphaTab SMuFL tuplet3 glyph.
      expect(
        built.events
          .filter(({ beat }) => !beat.isRest)
          .every(({ beat }) => beat.hasTuplet),
      ).toBe(true);
      const triplet = built.events.find(({ beat }) => beat.hasTuplet)!.beat
        .tupletGroup!;
      expect(triplet.isFull).toBe(true);
      expect(triplet.beats).toHaveLength(3);
      const bounds = triplet.beats.map(
        (beat) => renderer.boundsLookup!.findBeat(beat)!,
      );
      expect(bounds.every((bound) => bound.notes?.length === 1)).toBe(true);
      expect(bounds[0].onNotesX).toBeLessThan(bounds[1].onNotesX);
      expect(bounds[1].onNotesX).toBeLessThan(bounds[2].onNotesX);
      expect(svg).toContain("<path"); // Engraved stems/beams, not app SVG shapes.
    } finally {
      renderer.destroy();
    }
  });
  it("retains explicit sixteenth/dotted notation without enabling unsupported microphone tempos", () => {
    const score = exerciseScore({
      ...stages[0],
      events: [
        {
          ...stages[0].events[0],
          durationBeats: 0.375,
          noteValue: 16,
          dots: 1,
        },
      ],
    });
    const beat = toAlphaTabScore(score).events[0].beat;
    expect(beat.duration).toBe(model.Duration.Sixteenth);
    expect(beat.dots).toBe(1);
    expect(beat.playbackDuration).toBe(360);
  });
  it("preserves historical dotted values, navigation and event IDs in the pure mapper", () => {
    for (const stage of stages) {
      const score = exerciseScore(stage);
      expect(score.events.map((event) => event.id)).toEqual(
        stage.events.map((event) => event.id),
      );
      for (const [index, event] of score.events.entries()) {
        expect((4 / event.duration) * (event.dots ? 1.5 : 1)).toBe(
          stage.events[index].durationBeats,
        );
        expect(event.barIndex).toBe(
          Math.floor(stage.events[index].startBeat / 4),
        );
      }
    }
    const source = {
      ...stages[0],
      barNavigation: [{ barIndex: 0, repeatStart: true, repeatEnd: true }],
    };
    expect(exerciseScore(source).bars?.[0]).toMatchObject({
      repeatStart: true,
      repeatCount: 2,
    });
    const ambiguous = {
      ...stages[0],
      events: [{ ...stages[0].events[0], durationBeats: 1 / 3 }],
    };
    expect(() => exerciseScore(ambiguous)).toThrow(
      "unsupportedWrittenDuration",
    );
  });
  it.each([
    ["C#", 60, "B", 3, 1],
    ["Cb", 59, "C", 4, -1],
  ] as const)(
    "preserves %s boundary spelling and native sounding pitch",
    (keySignature, midi, step, octave, alter) => {
      const exercise = generateMelody(
        {
          ...defaultMelodySettings,
          tonalityId: `${keySignature}-major`,
          minMidi: midi,
          maxMidi: midi,
          timeSignature: [6, 8],
          dotted: true,
        },
        1,
      );
      const score = exerciseScore(exercise);
      const built = toAlphaTabScore(score);
      for (const event of score.events.filter((event) => event.notes.length))
        expect(event.notes).toEqual([
          { step, octave, alter, explicitAccidental: null, midi },
        ]);
      expect(
        built.events
          .filter(({ beat }) => !beat.isRest)
          .every(({ beat }) => beat.notes[0].realValue === midi),
      ).toBe(true);
    },
  );
});
