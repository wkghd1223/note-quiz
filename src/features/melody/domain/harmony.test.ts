import { describe, expect, it } from "vitest";
import { noteToMidi } from "@/lib/music/utils";
import { beatsPerMeasure } from "@/features/challenge/domain/stage";
import {
  melodyTonalities,
  patternsForTonality,
  patternHarmony,
  chordPitches,
  progressionLabel,
  type PatternId,
} from "./harmony";
import { createMelody, generateMelody } from "./generator";
import {
  defaultMelodySettings,
  changeMelodyTonality,
  sanitizeMelodySettings,
  serializeMelodySettings,
  validateMelodySettings,
} from "./settings";
import { exerciseScore } from "./notation";

const expectedLabels: Record<PatternId, string[]> = {
  "major-basic": ["C", "F", "G", "C", "C", "F", "G", "C"],
  "major-cycle": ["C", "Am", "F", "G", "C", "F", "G", "C"],
  "major-two-five": ["C", "Am", "Dm", "G", "C", "F", "G", "C"],
  "major-contrast": ["C", "G", "Am", "F", "Dm", "G", "C", "C"],
  "major-descending": ["C", "G", "F", "Em", "Dm", "G", "C", "C"],
  "minor-basic": ["Am", "Dm", "E", "Am", "Am", "Dm", "E", "Am"],
  "minor-cycle": ["Am", "F", "Dm", "E", "Am", "Dm", "E", "Am"],
  "minor-fifths": ["Am", "Dm", "G", "C", "F", "Bdim", "E", "Am"],
  "minor-contrast": ["Am", "F", "C", "G", "Dm", "F", "E", "Am"],
};
const pitchClass = (midi: number) => ((midi % 12) + 12) % 12;
describe("melody harmony catalog and generation", () => {
  it("keeps exactly the reviewed eight-bar patterns", () => {
    for (const tonalityId of ["C-major", "A-minor"] as const) {
      const tonality = melodyTonalities.find((item) => item.id === tonalityId)!;
      for (const pattern of patternsForTonality(tonalityId)) {
        expect(
          patternHarmony(tonality, pattern).map((bar) => bar.label),
        ).toEqual(expectedLabels[pattern.id]);
        expect(progressionLabel(pattern).split(" / ")).toHaveLength(2);
      }
    }
  });
  it.each(melodyTonalities)(
    "generates every compatible pattern in $id with spelled chord tones",
    (tonality) => {
      expect(melodyTonalities).toHaveLength(27);
      for (const pattern of patternsForTonality(tonality.id)) {
        for (const rhythm of [
          {
            durations: [1, 2],
            dotted: false,
            triplets: false,
            timeSignature: [4, 4] as [number, number],
          },
          {
            durations: [0.5],
            dotted: true,
            triplets: true,
            timeSignature: [6, 8] as [number, number],
          },
        ]) {
          const settings = {
            ...defaultMelodySettings,
            ...rhythm,
            tonalityId: tonality.id,
            progressionId: pattern.id,
            minMidi: 48,
            maxMidi: 84,
          };
          const exercise = generateMelody(settings, 19);
          expect(exercise).toEqual(generateMelody(settings, 19));
          expect(exercise.keySignature).toBe(tonality.keySignature);
          const bars = exercise.harmony!.bars;
          expect(bars).toHaveLength(8);
          expect(bars[7].degree).toBe(1);
          const barBeats = beatsPerMeasure(exercise);
          const totals = Array(8).fill(0);
          for (const event of exercise.events) {
            const bar = Math.floor((event.startBeat + 1e-9) / barBeats);
            totals[bar] += event.durationBeats;
            if (event.kind === "rest") {
              expect(event.writtenSpelling).toBeUndefined();
              continue;
            }
            const pitches = chordPitches(bars[bar].tones, 48, 84);
            expect(pitches).toContainEqual({
              midi: event.writtenMidi,
              spelling: event.writtenSpelling,
            });
            expect(
              bars[bar].tones.map((note) => pitchClass(noteToMidi(note))),
            ).toContain(pitchClass(event.writtenMidi!));
          }
          for (const total of totals) expect(total).toBeCloseTo(barBeats, 10);
          for (const bar of bars) {
            const root = noteToMidi(bar.tones[0]);
            const tonic = noteToMidi({
              name: tonality.tonic[0] as NoteName,
              octave: 4,
              accidental: tonality.tonic.includes("#")
                ? "sharp"
                : tonality.tonic.includes("b")
                  ? "flat"
                  : "natural",
            });
            const steps =
              tonality.mode === "major"
                ? [0, 2, 4, 5, 7, 9, 11]
                : [0, 2, 3, 5, 7, 8, 10];
            expect(pitchClass(root - tonic)).toBe(steps[bar.degree - 1]);
            const letters = ["C", "D", "E", "F", "G", "A", "B"];
            const rootLetter =
              (letters.indexOf(tonality.tonic[0]) + bar.degree - 1) % 7;
            expect(bar.tones.map((tone) => tone.name)).toEqual(
              [0, 2, 4].map((step) => letters[(rootLetter + step) % 7]),
            );
            expect(bar.tones.map((tone) => noteToMidi(tone) - root)).toEqual(
              bar.quality === "major"
                ? [0, 4, 7]
                : bar.quality === "minor"
                  ? [0, 3, 7]
                  : [0, 3, 6],
            );
          }
        }
      }
    },
  );
  it.each([
    ["A-minor", "E", "G#"],
    ["C-minor", "G", "B"],
    ["C#-minor", "G#", "B#"],
  ] as const)(
    "uses the major dominant in %s including its raised third",
    (tonalityId, root, third) => {
      const exercise = generateMelody(
        {
          ...defaultMelodySettings,
          tonalityId,
          progressionId: "minor-basic",
          minMidi: 48,
          maxMidi: 84,
          durations: [0.5],
        },
        7,
      );
      const dominant = exercise.harmony!.bars[2];
      expect(dominant.label).toBe(root);
      expect(
        chordPitches(dominant.tones, 48, 84).some(
          (pitch) =>
            pitch.spelling.startsWith(third) &&
            /^\d+$/.test(pitch.spelling.slice(third.length)),
        ),
      ).toBe(true);
      const notes = exercise.events.filter(
        (event) =>
          event.startBeat >= 8 && event.startBeat < 12 && event.kind === "note",
      );
      expect(
        notes.some(
          (event) =>
            event.writtenSpelling!.startsWith(third) &&
            /^\d+$/.test(event.writtenSpelling!.slice(third.length)),
        ),
      ).toBe(true);
    },
  );
  it("preserves raised minor accidentals and letter octaves in notation", () => {
    const exercise = generateMelody(
      {
        ...defaultMelodySettings,
        tonalityId: "C-minor",
        progressionId: "minor-basic",
        minMidi: 48,
        maxMidi: 84,
        durations: [0.5],
      },
      7,
    );
    const score = exerciseScore(exercise);
    expect(
      score.events.some(
        (event) =>
          event.barIndex === 2 &&
          event.notes.some((note) => note.step === "B" && note.alter === 0),
      ),
    ).toBe(true);
    const cSharp = melodyTonalities.find((item) => item.id === "C#-minor")!;
    expect(
      chordPitches(
        patternHarmony(cSharp, patternsForTonality(cSharp.id)[0])[2].tones,
        60,
        60,
      ),
    ).toEqual([{ midi: 60, spelling: "B#3" }]);
    const cFlat = melodyTonalities.find((item) => item.id === "Cb-major")!;
    expect(
      chordPitches(
        patternHarmony(cFlat, patternsForTonality(cFlat.id)[0])[0].tones,
        59,
        59,
      ),
    ).toEqual([{ midi: 59, spelling: "Cb4" }]);
  });
  it("accepts the zero-candidate iii full-rest bar and repeats one valid tone elsewhere", () => {
    const result = createMelody(
      {
        ...defaultMelodySettings,
        maxMidi: 62,
        durations: [4],
        progressionId: "major-descending",
      },
      3,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exercise.events[3]).toMatchObject({
      kind: "rest",
      startBeat: 12,
      durationBeats: 4,
    });
    expect(result.exercise.harmony!.bars[3].label).toBe("Em");
    expect(
      result.exercise.events
        .filter((event) => event.kind === "note")
        .map((event) => event.writtenMidi),
    ).toEqual([60, 62, 60, 62, 62, 60, 60]);
    expect(result.availability.every((entry) => entry.available)).toBe(true);
    const impossible = createMelody(
      {
        ...defaultMelodySettings,
        maxMidi: 62,
        durations: [1],
        progressionId: "major-descending",
      },
      3,
    );
    expect(impossible).toMatchObject({
      ok: false,
      issue: { code: "missingChord", chord: "Em" },
    });
  });
  it("does not reject harmonic inputs through the natural-minor pitch list", () => {
    const settings = {
      ...defaultMelodySettings,
      tonalityId: "C-minor",
      minMidi: 71,
      maxMidi: 71,
    };
    expect(validateMelodySettings(settings)).toMatchObject({
      valid: false,
      errors: ["noAvailablePitch"],
    });
    expect(
      validateMelodySettings({ ...settings, progressionId: "random" }),
    ).toMatchObject({ valid: true });
    expect(
      createMelody({ ...settings, progressionId: "minor-basic" }, 1),
    ).toMatchObject({
      ok: false,
      issue: { code: "missingChord", chord: "Cm" },
    });
  });
  it("filters random once and reports an actionable issue without outside tones", () => {
    const result = createMelody(
      {
        ...defaultMelodySettings,
        minMidi: 61,
        maxMidi: 61,
        progressionId: "random",
      },
      1,
    );
    expect(result).toMatchObject({
      ok: false,
      issue: { code: "noAvailableProgression" },
    });
    // C4 alone is absent from G, so a free-mode C4 succeeds but harmony cannot.
    expect(
      createMelody(
        { ...defaultMelodySettings, maxMidi: 60, progressionId: "major-basic" },
        1,
      ),
    ).toMatchObject({ ok: false, issue: { chord: "G" } });
    const settings = {
      ...defaultMelodySettings,
      maxMidi: 62,
      progressionId: "random",
    };
    const seeds = Array.from({ length: 20 }, (_, i) =>
      createMelody(settings, i),
    );
    for (const result of seeds) {
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.exercise.harmony!.patternId).not.toBe("major-descending");
      expect(result.settings.progressionId).toBe("random");
    }
  });
  it("keeps random requests, distinct identities and fixed patterns across rerolls", () => {
    const settings = { ...defaultMelodySettings, progressionId: "random" };
    const first = generateMelody(settings, 4);
    expect(generateMelody(settings, 4)).toEqual(first);
    const fixed = { ...settings, progressionId: first.harmony!.patternId };
    expect(generateMelody(fixed, 4).id).not.toBe(first.id);
    expect(generateMelody(fixed, 5).harmony!.patternId).toBe(
      first.harmony!.patternId,
    );
    expect(
      new Set(
        Array.from(
          { length: 20 },
          (_, seed) => generateMelody(settings, seed).harmony!.patternId,
        ),
      ).size,
    ).toBeGreaterThan(1);
    expect(
      generateMelody({ ...defaultMelodySettings, tonalityId: "A-minor" }, 4).id,
    ).not.toBe(generateMelody(defaultMelodySettings, 4).id);
  });
  it("keeps natural minor free generation and exact legacy interleaved seed 298", () => {
    const notes = generateMelody(
      {
        ...defaultMelodySettings,
        tonalityId: "A-minor",
        minMidi: 69,
        maxMidi: 81,
        durations: [0.5],
      },
      1,
    ).events.filter((event) => event.kind === "note");
    expect(notes.every((event) => !event.writtenSpelling!.includes("#"))).toBe(
      true,
    );
    const legacy = {
      clef: "treble",
      keySignature: "C",
      minMidi: 60,
      maxMidi: 64,
      durations: [0.5, 2],
      bpm: 60,
    };
    expect(
      generateMelody(legacy, 298)
        .events.slice(0, 3)
        .map((event) => [
          event.writtenSpelling,
          event.startBeat,
          event.startBeat + event.durationBeats,
        ]),
    ).toEqual([
      ["D4", 0, 0.5],
      ["E4", 0.5, 1],
      ["C4", 1, 3],
    ]);
  });
  it("migrates major storage centrally and persists only authoritative selections", () => {
    const old = {
      clef: "bass",
      keySignature: "Eb",
      minMidi: 48,
      maxMidi: 62,
      durations: [0.5, 2],
    };
    const migrated = sanitizeMelodySettings(old);
    expect(migrated).toMatchObject({
      tonalityId: "Eb-major",
      progressionId: "none",
      bpm: 60,
    });
    expect(migrated).not.toHaveProperty("keySignature");
    const random = { ...migrated, progressionId: "random" as const };
    const serialized = serializeMelodySettings(random);
    expect(sanitizeMelodySettings(JSON.parse(serialized))).toEqual(random);
    expect(JSON.parse(serialized)).toEqual({ version: 2, settings: random });
    const fixed = {
      ...defaultMelodySettings,
      progressionId: "major-cycle" as const,
    };
    expect(changeMelodyTonality(fixed, "G-major").progressionId).toBe(
      "major-cycle",
    );
    expect(changeMelodyTonality(fixed, "A-minor").progressionId).toBe("random");
  });
});
