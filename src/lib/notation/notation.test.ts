import { describe, expect, it, vi } from "vitest";
import { model } from "@coderline/alphatab";
import {
  CLEFS,
  DEFAULT_GAME_SETTINGS,
  KEY_SIGNATURES,
  NOTE_NAMES,
} from "@/lib/music/constants";
import {
  applyKeySignature,
  generateQuestion,
  noteToMidi,
  validateAnswer,
} from "@/lib/music/utils";
import { seededRandom } from "@/lib/practice/random";
import { legacyToScore } from "./legacy-to-score";
import { theoryToScore } from "./theory-to-score";
import { toAlphaTabScore } from "./alphatab-score";
import { notationRenderer } from "./score";

it("supports an explicit legacy renderer rollback without changing score data", () => {
  vi.stubEnv("NEXT_PUBLIC_NOTATION_RENDERER", "legacy");
  expect(notationRenderer()).toBe("legacy");
  vi.stubEnv("NEXT_PUBLIC_NOTATION_RENDERER", "alphaTab");
  expect(notationRenderer()).toBe("alphaTab");
  vi.unstubAllEnvs();
});

describe("legacy written music golden semantics", () => {
  it("preserves all four clefs, all 15 keys, seven note letters and octave extremes", () => {
    const clefValues = {
      treble: model.Clef.G2,
      bass: model.Clef.F4,
      alto: model.Clef.C3,
      tenor: model.Clef.C4,
    };
    for (const clef of CLEFS)
      for (const keySignature of Object.values(KEY_SIGNATURES))
        for (const name of NOTE_NAMES)
          for (const octave of [0, 2, 4, 6, 8] as const) {
            const originalNote: Note = { name, octave, accidental: null };
            const note = applyKeySignature(originalNote, keySignature);
            const adapted = legacyToScore({
              clef,
              keySignature,
              note,
              originalNote,
            });
            expect(adapted.events[0].notes[0]).toMatchObject({
              step: name,
              octave,
              explicitAccidental: null,
              midi: noteToMidi(note),
            });
            const built = toAlphaTabScore(adapted);
            expect(built.score.tracks[0].staves[0].bars[0].clef).toBe(
              clefValues[clef],
            );
            expect(built.events[0].beat.notes[0].realValue).toBe(
              noteToMidi(note),
            );
            expect(built.score.tracks[0].staves[0].bars[0].keySignature).toBe(
              keySignature.sharps.length - keySignature.flats.length,
            );
          }
  });

  it.each(["sharp", "flat", "natural", null] as const)(
    "keeps explicit %s distinct from inherited key accidentals",
    (accidental) => {
      const originalNote: Note = { name: "F", octave: 4, accidental };
      const note = applyKeySignature(originalNote, KEY_SIGNATURES.G);
      const written = legacyToScore({
        clef: "treble",
        keySignature: KEY_SIGNATURES.G,
        note,
        originalNote,
      }).events[0].notes[0];
      expect(written.explicitAccidental).toBe(accidental);
      expect(written.alter).toBe(
        accidental === "natural" ? 0 : accidental === "flat" ? -1 : 1,
      );
      expect(written.midi).toBe(
        accidental === "natural" ? 65 : accidental === "flat" ? 64 : 66,
      );
    },
  );

  it("keeps 100 seeded legacy questions and answer semantics unchanged", () => {
    const rng = seededRandom("phase-1-notation-100");
    const settings = {
      ...DEFAULT_GAME_SETTINGS,
      clef: "random" as const,
      keySignature: "random",
      enableAccidentals: true,
      accidentalProbability: 0.7,
      staffRange: { ledgerLinesAbove: 6, ledgerLinesBelow: 6 },
    };
    const questions = Array.from({ length: 100 }, () =>
      generateQuestion(settings, rng),
    );
    const before = JSON.stringify(questions);
    for (const question of questions) {
      const score = legacyToScore({
        ...question,
        note: question.displayNote,
        originalNote: question.note,
      });
      const built = toAlphaTabScore(score);
      expect(built.events[0].beat.notes[0].realValue).toBe(
        noteToMidi(question.displayNote),
      );
      expect(validateAnswer(question, question.displayNote)).toBe(true);
    }
    expect(JSON.stringify(questions)).toBe(before);
    expect(
      questions.map((q) => [q.clef, q.keySignature.key, q.note, q.displayNote]),
    ).toMatchSnapshot();
  });

  it("does not collapse B#, Cb, E# or Fb into another written letter", () => {
    for (const [name, accidental] of [
      ["B", "sharp"],
      ["C", "flat"],
      ["E", "sharp"],
      ["F", "flat"],
    ] as const) {
      const note: Note = { name, accidental, octave: 4 };
      const score = legacyToScore({
        clef: "treble",
        keySignature: KEY_SIGNATURES.C,
        note,
        originalNote: note,
      });
      expect(score.events[0].notes[0]).toMatchObject({ step: name, octave: 4 });
      expect(toAlphaTabScore(score).events[0].beat.notes[0].realValue).toBe(
        noteToMidi(note),
      );
    }
  });
});

describe("theory and stage score grouping", () => {
  const notes: Note[] = [
    { name: "C", accidental: null, octave: 4 },
    { name: "E", accidental: "flat", octave: 4 },
    { name: "G", accidental: null, octave: 4 },
    { name: "B", accidental: "flat", octave: 4 },
  ];
  it("keeps ascending/descending intervals as ordered beats", () => {
    for (const order of [notes.slice(0, 2), notes.slice(0, 2).reverse()]) {
      const { events } = toAlphaTabScore(theoryToScore(order));
      expect(events.map((event) => event.beat.notes[0].realValue)).toEqual(
        order.map(noteToMidi),
      );
    }
  });
  it("renders chords/sevenths/inversions as one beat and progression groups independently", () => {
    const groups = [
      notes.slice(0, 3),
      notes,
      [...notes.slice(1), notes[0]],
      [...notes].reverse(),
    ];
    for (const group of groups) {
      const { events } = toAlphaTabScore(theoryToScore(group, true));
      expect(events).toHaveLength(1);
      expect(events[0].beat.notes.map((n) => n.realValue)).toEqual(
        group.map(noteToMidi),
      );
    }
  });
  it("groups stage bars without changing event IDs and supports rests", () => {
    const score = theoryToScore(notes);
    score.events = [
      ...score.events,
      { id: "rest-next-bar", notes: [], duration: 4, barIndex: 1 },
    ];
    score.timeSignature = { numerator: 4, denominator: 4 };
    const built = toAlphaTabScore(score);
    expect(built.score.masterBars).toHaveLength(2);
    expect(built.events.at(-1)?.id).toBe("rest-next-bar");
    expect(built.events.at(-1)?.beat.isRest).toBe(true);
  });
});
