import { describe, expect, it } from "vitest";
import { exerciseScore } from "./notation";
import { generateMelody } from "./generator";
import { defaultMelodySettings } from "./settings";

describe("melody engraving preserves generated written music", () => {
  it.each([
    ["C#", 60, "B", 3, 1, 7],
    ["Cb", 59, "C", 4, -1, -7],
  ] as const)(
    "engraves %s with the written octave and inherited key accidental",
    (keySignature, midi, step, octave, alter, fifths) => {
      const exercise = generateMelody(
        {
          ...defaultMelodySettings,
          keySignature,
          minMidi: midi,
          maxMidi: midi,
          durations: [0.5],
          bpm: 60,
        },
        7,
      );
      const score = exerciseScore(exercise);
      expect(score.keySignature).toBe(fifths);
      expect(
        score.events
          .filter((event) => event.notes.length)
          .every((event) => event.duration === 8),
      ).toBe(true);
      for (const event of score.events.filter((event) => event.notes.length)) {
        expect(event.notes).toEqual([
          { step, octave, alter, midi, explicitAccidental: null },
        ]);
      }
      expect(score.bars).toHaveLength(8);
      expect(score.events.at(-1)?.barIndex).toBe(7);
    },
  );
});
