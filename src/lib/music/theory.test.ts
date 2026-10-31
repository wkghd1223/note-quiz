import { describe, expect, it } from "vitest";
import {
  AUDIO_INTERVAL_IDS,
  CHORDS,
  CHORD_IDS,
  INTERVALS,
  PROGRESSIONS,
  VISUAL_INTERVAL_IDS,
  buildChord,
  generateProgression,
  generateTheoryQuestion,
  getTheoryOptions,
  intervalBetween,
  isTheoryAnswerCorrect,
  normalizeTheorySettings,
  regenerateTheoryQuestion,
  type TheorySettings,
} from "./theory";
import { noteToMidi, stringToNote } from "./utils";
const note = (value: string) => stringToNote(value)!;
const settings: TheorySettings = {
  kind: "interval",
  task: "interval",
  difficulty: "advanced",
  presentation: "audio",
  direction: "ascending",
};
function seeded(seed = 1) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

describe("spelled and heard intervals", () => {
  it("distinguishes augmented fourth, diminished fifth and enharmonic second", () => {
    expect(intervalBetween(note("C4"), note("F#4"))).toMatchObject({
      number: 4,
      semitones: 6,
      id: "A4",
    });
    expect(intervalBetween(note("C4"), note("Gb4"))).toMatchObject({
      number: 5,
      semitones: 6,
      id: "d5",
    });
    expect(intervalBetween(note("C#4"), note("Db4"))).toMatchObject({
      number: 2,
      semitones: 0,
      id: "d2",
    });
    expect(intervalBetween(note("C5"), note("D4"))).toMatchObject({
      number: 7,
      semitones: 10,
      id: "m7",
    });
  });
  it("has one audio choice per semitone and separate visual tritones", () => {
    expect(
      new Set(AUDIO_INTERVAL_IDS.map((id) => INTERVALS[id].semitones)).size,
    ).toBe(AUDIO_INTERVAL_IDS.length);
    expect(
      getTheoryOptions({
        ...settings,
        difficulty: "custom",
        intervals: ["TT", "A4", "d5", "P5", "P5"],
      }),
    ).toEqual(["TT", "P5"]);
    expect(getTheoryOptions({ ...settings, presentation: "visual" })).toEqual(
      VISUAL_INTERVAL_IDS,
    );
  });
  it.each(["ascending", "descending", "simultaneous"] as const)(
    "generates and grades %s intervals with consistent spelling",
    (direction) => {
      const rng = seeded(76);
      for (let index = 0; index < 200; index++) {
        const question = generateTheoryQuestion(
          { ...settings, direction, presentation: "visual" },
          rng,
        );
        expect(intervalBetween(question.notes[0], question.notes[1]).id).toBe(
          question.answer,
        );
        expect(question.options).toContain(question.answer);
        expect(isTheoryAnswerCorrect(question, question.answer)).toBe(true);
        expect(isTheoryAnswerCorrect(question, "nonsense")).toBe(false);
        expect(question.groups.length).toBe(
          direction === "simultaneous" ? 1 : 2,
        );
      }
    },
  );
  it("covers higher, lower and same beginner questions", () => {
    const rng = seeded();
    const found = new Set();
    for (let index = 0; index < 60; index++) {
      const question = generateTheoryQuestion(
        { ...settings, task: "direction", difficulty: "beginner" },
        rng,
      );
      const distance =
        noteToMidi(question.notes[1]) - noteToMidi(question.notes[0]);
      expect(question.answer).toBe(
        distance > 0 ? "higher" : distance < 0 ? "lower" : "same",
      );
      found.add(question.answer);
    }
    expect(found.size).toBe(3);
  });
});

describe("chord voicings and progressions", () => {
  it.each(CHORD_IDS)(
    "spells every %s chord in thirds with its target pitch structure",
    (quality) => {
      const rng = seeded(51);
      for (let iteration = 0; iteration < 20; iteration++) {
        const question = generateTheoryQuestion(
          {
            ...settings,
            kind: "chord",
            task: "quality",
            difficulty: "custom",
            chords: [quality],
          },
          rng,
        );
        expect(
          question.notes.map(
            (value) => noteToMidi(value) - noteToMidi(question.root),
          ),
        ).toEqual([...CHORDS[quality]]);
        expect(
          question.notes.map((value) => "CDEFGAB".indexOf(value.name)),
        ).toEqual(
          question.notes.map(
            (_, index) =>
              ("CDEFGAB".indexOf(question.root.name) + index * 2) % 7,
          ),
        );
      }
    },
  );
  it("raises bass notes for every triad/seventh inversion without changing quality", () => {
    const root = note("D4");
    for (const quality of CHORD_IDS)
      for (let inversion = 0; inversion < CHORDS[quality].length; inversion++) {
        const voiced = buildChord(root, quality, inversion).map(noteToMidi);
        expect(voiced).toEqual([...voiced].sort((a, b) => a - b));
        expect(
          voiced
            .map((value) => (value - noteToMidi(root)) % 12)
            .sort((a, b) => a - b),
        ).toEqual([...CHORDS[quality]].sort((a, b) => a - b));
      }
  });
  it("rejects impossible inversion or unsupported double-accidental spelling", () => {
    expect(() => buildChord(note("C4"), "major", 3)).toThrow(RangeError);
    expect(() => buildChord(note("C4"), "dim7")).toThrow(RangeError);
    expect(() => generateProgression(note("C4"), ["ii" as "I"])).toThrow(
      RangeError,
    );
  });
  it("gives inversion listeners the root reference and no unanswerable option", () => {
    const rng = seeded(34);
    for (let index = 0; index < 80; index++) {
      const question = generateTheoryQuestion(
        { ...settings, kind: "chord", task: "inversion" },
        rng,
      );
      expect(question.groups[0]).toEqual([question.root]);
      expect(question.groups[1]).toEqual(question.notes);
      expect(question.options).toContain(question.answer);
    }
  });
  it("uses tonal context and four unique progression alternatives", () => {
    const question = generateTheoryQuestion(
      { ...settings, kind: "chord", task: "progression" },
      seeded(9),
    );
    expect(question.groups.slice(0, 2)).toEqual([
      [question.tonic],
      buildChord(question.tonic!, "major"),
    ]);
    expect(question.groups.slice(2)).toEqual(
      generateProgression(question.tonic!, question.degreeSequence!),
    );
    expect(new Set(question.options).size).toBe(4);
    expect(question.options).toEqual(
      PROGRESSIONS.map((sequence) => sequence.join("-")),
    );
    expect(
      generateProgression(note("C4"), ["I", "IV", "V", "vi"]).map((group) =>
        group.map(noteToMidi),
      ),
    ).toEqual([
      [60, 64, 67],
      [65, 69, 72],
      [67, 71, 74],
      [69, 72, 76],
    ]);
  });
});

describe("invalid imported theory settings", () => {
  it("limits imported IDs and restores valid task defaults", () => {
    const normalized = normalizeTheorySettings({
      kind: "chord",
      task: "direction",
      difficulty: "custom",
      chords: ["major", "major", "toString" as "major"],
      inversions: [-1, 0, 99],
    });
    expect(normalized.task).toBe("quality");
    expect(normalized.chords).toEqual(["major"]);
    expect(normalized.inversions).toEqual([0]);
    const question = generateTheoryQuestion(normalized, seeded(4));
    expect(question.options).toContain(question.answer);
  });
  it("falls back safely when a custom allowed list is empty", () => {
    const question = generateTheoryQuestion(
      { ...settings, difficulty: "custom", intervals: [] },
      seeded(),
    );
    expect(question.options).toContain(question.answer);
  });
});

describe("reproducible generation and type review", () => {
  it("reproduces whole question sets for the same generator seed", () => {
    const a = seeded(99),
      b = seeded(99);
    expect(
      Array.from({ length: 10 }, () => generateTheoryQuestion(settings, a)),
    ).toEqual(
      Array.from({ length: 10 }, () => generateTheoryQuestion(settings, b)),
    );
  });
  it.each([
    "interval",
    "direction",
    "quality",
    "inversion",
    "progression",
  ] as const)(
    "reviews %s with a different root and the same answer/type",
    (task) => {
      const question = generateTheoryQuestion(
        {
          ...settings,
          kind: ["interval", "direction"].includes(task) ? "interval" : "chord",
          task,
        },
        seeded(90),
      );
      const review = regenerateTheoryQuestion(question, seeded(3));
      expect(noteToMidi(review.root)).not.toBe(noteToMidi(question.root));
      expect(review.answer).toBe(question.answer);
      expect(review.type).toBe(question.type);
      expect(isTheoryAnswerCorrect(review, review.answer)).toBe(true);
    },
  );
});

describe("focused weak-type practice", () => {
  it.each([
    { kind: "interval", task: "direction", focus: "lower" },
    { kind: "interval", task: "interval", focus: "m6" },
    { kind: "chord", task: "quality", focus: "minor" },
    { kind: "chord", task: "progression", focus: "I-vi-IV-V" },
  ] as const)(
    "keeps $task focus as the generated answer with varied roots",
    (selection) => {
      const rng = seeded(71);
      const roots = new Set<number>();
      for (let index = 0; index < 25; index++) {
        const question = generateTheoryQuestion(
          { ...settings, ...selection },
          rng,
        );
        expect(question.answer).toBe(selection.focus);
        expect(question.options).toContain(question.answer);
        expect(question.options.length).toBeGreaterThanOrEqual(2);
        roots.add(noteToMidi(question.root));
        const review = regenerateTheoryQuestion(question, rng);
        expect(review.type).toBe(question.type);
        expect(review.answer).toBe(selection.focus);
        expect(noteToMidi(review.root)).not.toBe(noteToMidi(question.root));
      }
      expect(roots.size).toBeGreaterThan(1);
    },
  );
  it("normalizes tritone focus for audio and notation", () => {
    expect(normalizeTheorySettings({ ...settings, focus: "A4" }).focus).toBe(
      "TT",
    );
    expect(normalizeTheorySettings({ ...settings, focus: "d5" }).focus).toBe(
      "TT",
    );
    expect(
      normalizeTheorySettings({
        ...settings,
        presentation: "visual",
        focus: "TT",
      }).focus,
    ).toBe("A4");
    const question = generateTheoryQuestion(
      { ...settings, focus: "d5" },
      seeded(),
    );
    expect(question.answer).toBe("TT");
    expect(question.options).not.toContain("A4");
    expect(question.options).not.toContain("d5");
  });
  it.each([
    "direction",
    "interval",
    "quality",
    "inversion",
    "progression",
  ] as const)("discards invalid or wrong-task $task focus", (task) => {
    const kind = ["direction", "interval"].includes(task)
      ? "interval"
      : "chord";
    expect(
      normalizeTheorySettings({
        ...settings,
        kind,
        task,
        focus: "private-id-or-unsupported-choice",
      }).focus,
    ).toBeUndefined();
    expect(
      normalizeTheorySettings({
        ...settings,
        kind,
        task,
        focus: task === "quality" ? "P5" : "minor",
      }).focus,
    ).toBeUndefined();
  });
  it("keeps configured source pools separate from answer distractors", () => {
    const config = {
      ...settings,
      difficulty: "custom" as const,
      intervals: ["M3"] as const,
    };
    expect(
      getTheoryOptions({ ...config, intervals: [...config.intervals] }),
    ).toEqual(["M3"]);
    const rng = seeded(78);
    for (let index = 0; index < 20; index++) {
      const question = generateTheoryQuestion(
        { ...config, intervals: [...config.intervals] },
        rng,
      );
      expect(question.answer).toBe("M3");
      expect(question.options.length).toBeGreaterThanOrEqual(2);
      expect(
        new Set(
          question.options.map(
            (id) => INTERVALS[id as keyof typeof INTERVALS].semitones,
          ),
        ).size,
      ).toBe(question.options.length);
    }
  });
  it("adds a meaningful alternate quality for single-quality custom practice", () => {
    const config = {
      ...settings,
      kind: "chord" as const,
      task: "quality" as const,
      difficulty: "custom" as const,
      chords: ["minor"] as const,
    };
    const question = generateTheoryQuestion(
      { ...config, chords: [...config.chords] },
      seeded(9),
    );
    expect(question.answer).toBe("minor");
    expect(question.options).toEqual(["minor", "major"]);
  });
  it("selects a compatible seventh chord before generating a requested third inversion", () => {
    const rng = seeded(156);
    for (let index = 0; index < 25; index++) {
      const question = generateTheoryQuestion(
        {
          ...settings,
          kind: "chord",
          task: "inversion",
          difficulty: "custom",
          chords: ["major", "min7"],
          inversions: [3],
        },
        rng,
      );
      expect(question.answer).toBe("third");
      expect(question.chordQuality).toBe("min7");
      expect(question.inversion).toBe(3);
      expect(question.notes).toHaveLength(4);
      expect(question.options.length).toBeGreaterThanOrEqual(2);
      expect(question.options).toContain("third");
    }
  });
  it("never offers a third-inversion answer for a custom triad", () => {
    const normalized = normalizeTheorySettings({
      ...settings,
      kind: "chord",
      task: "inversion",
      difficulty: "custom",
      chords: ["major"],
      inversions: [3],
    });
    expect(normalized.inversions).toEqual([]);
    const rng = seeded(63);
    for (let index = 0; index < 20; index++) {
      const question = generateTheoryQuestion(normalized, rng);
      expect(question.notes).toHaveLength(3);
      expect(question.options).not.toContain("third");
      expect(question.options).toContain(question.answer);
      expect(question.options.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("promotes third-inversion focus to a seventh source even from a triad-only filter", () => {
    const rng = seeded(2);
    for (let index = 0; index < 20; index++) {
      const question = generateTheoryQuestion(
        {
          ...settings,
          kind: "chord",
          task: "inversion",
          difficulty: "custom",
          chords: ["major"],
          focus: "third",
        },
        rng,
      );
      expect(question.answer).toBe("third");
      expect(question.notes).toHaveLength(4);
      expect(question.options).toContain("third");
      expect(question.options.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("retains a specific seventh inversion relationship across new roots", () => {
    const rng = seeded(74);
    const roots = new Set<number>();
    for (let index = 0; index < 20; index++) {
      const question = generateTheoryQuestion(
        {
          ...settings,
          kind: "chord",
          task: "inversion",
          difficulty: "custom",
          chords: ["min7"],
          focus: "third",
        },
        rng,
      );
      expect(question.type).toBe("min7:third");
      roots.add(noteToMidi(question.root));
      const review = regenerateTheoryQuestion(question, rng);
      expect(review.type).toBe("min7:third");
      expect(review.answer).toBe("third");
      expect(noteToMidi(review.root)).not.toBe(noteToMidi(question.root));
    }
    expect(roots.size).toBeGreaterThan(1);
  });
});
