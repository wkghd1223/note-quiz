import { midiToNote, noteToMidi } from "./utils";

export const INTERVALS = {
  P1: { number: 1, semitones: 0 },
  m2: { number: 2, semitones: 1 },
  M2: { number: 2, semitones: 2 },
  m3: { number: 3, semitones: 3 },
  M3: { number: 3, semitones: 4 },
  P4: { number: 4, semitones: 5 },
  TT: { number: 4, semitones: 6 },
  A4: { number: 4, semitones: 6 },
  d5: { number: 5, semitones: 6 },
  P5: { number: 5, semitones: 7 },
  m6: { number: 6, semitones: 8 },
  M6: { number: 6, semitones: 9 },
  m7: { number: 7, semitones: 10 },
  M7: { number: 7, semitones: 11 },
  P8: { number: 8, semitones: 12 },
} as const;
export type IntervalId = keyof typeof INTERVALS;
export const AUDIO_INTERVAL_IDS: IntervalId[] = [
  "P1",
  "m2",
  "M2",
  "m3",
  "M3",
  "P4",
  "TT",
  "P5",
  "m6",
  "M6",
  "m7",
  "M7",
  "P8",
];
export const VISUAL_INTERVAL_IDS: IntervalId[] = [
  "P1",
  "m2",
  "M2",
  "m3",
  "M3",
  "P4",
  "A4",
  "d5",
  "P5",
  "m6",
  "M6",
  "m7",
  "M7",
  "P8",
];
export const CHORDS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  maj7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  halfDim7: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
} as const;
export type ChordQuality = keyof typeof CHORDS;
export const CHORD_IDS = Object.keys(CHORDS) as ChordQuality[];
export type ProgressionDegree = "I" | "IV" | "V" | "vi";
export const PROGRESSIONS: ProgressionDegree[][] = [
  ["I", "IV", "V", "I"],
  ["I", "vi", "IV", "V"],
  ["I", "V", "vi", "IV"],
  ["I", "IV", "vi", "V"],
];
export type TheoryTask =
  | "direction"
  | "interval"
  | "quality"
  | "inversion"
  | "progression";
export type TheoryDirection = "ascending" | "descending" | "simultaneous";
export interface TheorySettings {
  kind: "interval" | "chord";
  task: TheoryTask;
  difficulty: "beginner" | "basic" | "advanced" | "custom";
  presentation: "audio" | "visual";
  direction: TheoryDirection;
  intervals?: IntervalId[];
  chords?: ChordQuality[];
  inversions?: number[];
  focus?: string;
}
export interface TheoryQuestion {
  id: string;
  kind: "interval" | "chord";
  task: TheoryTask;
  presentation: "audio" | "visual";
  direction: TheoryDirection;
  notes: Note[];
  groups: Note[][];
  answer: string;
  options: string[];
  type: string;
  root: Note;
  tonic?: Note;
  degreeSequence?: ProgressionDegree[];
  interval?: IntervalId;
  chordQuality?: ChordQuality;
  inversion?: number;
}

const LETTERS: NoteName[] = ["C", "D", "E", "F", "G", "A", "B"];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const pick = <T>(values: readonly T[], rng: () => number): T =>
  values[
    Math.min(values.length - 1, Math.max(0, Math.floor(rng() * values.length)))
  ];
const unique = <T>(values: T[]) => Array.from(new Set(values));
const cloneNote = (note: Note): Note => ({ ...note });

/** Spelling uses letter distance as well as pitch, so C–F# and C–Gb differ. */
export function intervalBetween(first: Note, second: Note) {
  const firstPosition = first.octave * 7 + LETTERS.indexOf(first.name);
  const secondPosition = second.octave * 7 + LETTERS.indexOf(second.name);
  const number = Math.abs(secondPosition - firstPosition) + 1;
  const semitones = Math.abs(noteToMidi(second) - noteToMidi(first));
  const simple = (number - 1) % 7;
  const baseline = MAJOR_STEPS[simple] + Math.floor((number - 1) / 7) * 12;
  const difference = semitones - baseline;
  const perfect = [0, 3, 4].includes(simple);
  const quality = perfect
    ? difference === 0
      ? "P"
      : difference === 1
        ? "A"
        : difference === -1
          ? "d"
          : null
    : difference === 0
      ? "M"
      : difference === -1
        ? "m"
        : difference === 1
          ? "A"
          : difference === -2
            ? "d"
            : null;
  return {
    number,
    semitones,
    quality,
    id: quality ? `${quality}${number}` : null,
  };
}

/** Return null instead of silently replacing a required double accidental. */
function spellDistance(
  root: Note,
  diatonicSteps: number,
  semitones: number,
): Note | null {
  const position = root.octave * 7 + LETTERS.indexOf(root.name) + diatonicSteps;
  const octave = Math.floor(position / 7);
  if (octave < 0 || octave > 8) return null;
  const name = LETTERS[((position % 7) + 7) % 7];
  const natural: Note = {
    name,
    octave: octave as Octave,
    accidental: "natural",
  };
  const alteration = noteToMidi(root) + semitones - noteToMidi(natural);
  if (Math.abs(alteration) > 1) return null;
  return {
    ...natural,
    accidental:
      alteration === -1 ? "flat" : alteration === 1 ? "sharp" : "natural",
  };
}

export function buildChord(
  root: Note,
  quality: ChordQuality,
  inversion = 0,
): Note[] {
  const pattern = CHORDS[quality];
  if (
    !pattern ||
    !Number.isInteger(inversion) ||
    inversion < 0 ||
    inversion >= pattern.length
  )
    throw new RangeError("Invalid chord or inversion");
  const notes = pattern.map((semitones, index) =>
    spellDistance(root, index * 2, semitones),
  );
  if (notes.some((note) => !note))
    throw new RangeError(
      "Chord spelling needs unsupported accidentals or octaves",
    );
  const voiced = notes as Note[];
  for (let index = 0; index < inversion; index++) {
    const note = voiced.shift()!;
    if (note.octave >= 8)
      throw new RangeError("Inversion exceeds supported octave range");
    voiced.push({ ...note, octave: (note.octave + 1) as Octave });
  }
  return voiced;
}

export function generateProgression(
  tonic: Note,
  degrees: ProgressionDegree[],
): Note[][] {
  if (
    !degrees.length ||
    degrees.length > 8 ||
    degrees.some((degree) => !["I", "IV", "V", "vi"].includes(degree))
  )
    throw new RangeError("Unsupported progression");
  const offsets = { I: [0, 0], IV: [3, 5], V: [4, 7], vi: [5, 9] } as const;
  return degrees.map((degree) => {
    const [steps, semitones] = offsets[degree];
    const root = spellDistance(tonic, steps, semitones);
    if (!root) throw new RangeError("Unsupported tonic spelling");
    return buildChord(root, degree === "vi" ? "minor" : "major");
  });
}

export const INVERSION_IDS = ["root", "first", "second", "third"] as const;

/** Normalize imported/shared settings without accepting arbitrary option IDs. */
export function normalizeTheorySettings(
  input: Partial<TheorySettings> = {},
): TheorySettings {
  const kind = input.kind === "chord" ? "chord" : "interval";
  const validTasks: TheoryTask[] =
    kind === "interval"
      ? ["direction", "interval"]
      : ["quality", "inversion", "progression"];
  const normalized: TheorySettings = {
    kind,
    task: validTasks.includes(input.task as TheoryTask)
      ? input.task!
      : kind === "interval"
        ? "interval"
        : "quality",
    difficulty: ["beginner", "basic", "advanced", "custom"].includes(
      input.difficulty ?? "",
    )
      ? input.difficulty!
      : "beginner",
    presentation: input.presentation === "visual" ? "visual" : "audio",
    direction:
      input.direction === "descending" || input.direction === "simultaneous"
        ? input.direction
        : "ascending",
    intervals: Array.isArray(input.intervals)
      ? unique(
          input.intervals.filter((id) =>
            Object.prototype.hasOwnProperty.call(INTERVALS, id),
          ),
        ).slice(0, 15)
      : undefined,
    chords: Array.isArray(input.chords)
      ? unique(
          input.chords.filter((id) =>
            Object.prototype.hasOwnProperty.call(CHORDS, id),
          ),
        ).slice(0, 9)
      : undefined,
    inversions: Array.isArray(input.inversions)
      ? unique(
          input.inversions.filter(
            (index) => Number.isInteger(index) && index >= 0 && index <= 3,
          ),
        ).slice(0, 4)
      : undefined,
  };
  if (normalized.task === "inversion" && normalized.inversions) {
    const maxNotes = Math.max(
      ...chordChoices(normalized).map((quality) => CHORDS[quality].length),
    );
    normalized.inversions = normalized.inversions.filter(
      (index) => index < maxNotes,
    );
  }
  let focus = typeof input.focus === "string" ? input.focus : undefined;
  if (normalized.task === "interval") {
    if (
      normalized.presentation === "audio" &&
      (focus === "A4" || focus === "d5")
    )
      focus = "TT";
    if (normalized.presentation === "visual" && focus === "TT") focus = "A4";
  }
  const allowedFocus: readonly string[] =
    normalized.task === "direction"
      ? ["higher", "lower", "same"]
      : normalized.task === "interval"
        ? normalized.presentation === "audio"
          ? AUDIO_INTERVAL_IDS
          : VISUAL_INTERVAL_IDS
        : normalized.task === "quality"
          ? CHORD_IDS
          : normalized.task === "inversion"
            ? INVERSION_IDS
            : PROGRESSIONS.map((sequence) => sequence.join("-"));
  normalized.focus = focus && allowedFocus.includes(focus) ? focus : undefined;
  return normalized;
}

function chordChoices(settings: TheorySettings): ChordQuality[] {
  const defaults: ChordQuality[] =
    settings.difficulty === "beginner"
      ? ["major", "minor"]
      : settings.difficulty === "basic"
        ? ["major", "minor", "diminished", "augmented"]
        : CHORD_IDS;
  const chosen =
    settings.difficulty === "custom"
      ? unique((settings.chords ?? []).filter((chord) => chord in CHORDS))
      : defaults;
  return chosen.length ? chosen : ["major", "minor"];
}
function intervalChoices(settings: TheorySettings): IntervalId[] {
  const available =
    settings.presentation === "audio"
      ? AUDIO_INTERVAL_IDS
      : VISUAL_INTERVAL_IDS;
  const defaults: IntervalId[] =
    settings.difficulty === "beginner"
      ? ["P1", "M3", "P5"]
      : settings.difficulty === "basic"
        ? ["M2", "M3", "P4", "P5", "P8"]
        : available;
  const chosen =
    settings.difficulty === "custom"
      ? (settings.intervals ?? [])
          .map((id) =>
            settings.presentation === "audio" && ["A4", "d5"].includes(id)
              ? ("TT" as const)
              : settings.presentation === "visual" && id === "TT"
                ? ("A4" as const)
                : id,
          )
          .filter((id) => available.includes(id))
      : defaults;
  return unique(chosen.length ? chosen : defaults);
}
function allowedInversions(
  settings: TheorySettings,
  noteCount: number,
): number[] {
  const defaults =
    settings.difficulty === "beginner"
      ? [0, 1]
      : Array.from({ length: noteCount }, (_, index) => index);
  const chosen =
    settings.difficulty === "custom" && settings.inversions?.length
      ? unique(
          settings.inversions.filter(
            (value) =>
              Number.isInteger(value) && value >= 0 && value < noteCount,
          ),
        )
      : defaults;
  return chosen.length ? chosen : [0];
}
export function getTheoryOptions(settings: TheorySettings): string[] {
  settings = normalizeTheorySettings(settings);
  if (settings.task === "direction") return ["higher", "lower", "same"];
  if (settings.kind === "interval") return intervalChoices(settings);
  if (settings.task === "progression")
    return PROGRESSIONS.map((sequence) => sequence.join("-"));
  if (settings.task === "inversion") {
    const count = Math.max(
      ...chordChoices(settings).map((quality) => CHORDS[quality].length),
    );
    return allowedInversions(settings, count).map(
      (index) => INVERSION_IDS[index],
    );
  }
  return chordChoices(settings);
}

/** Source selections determine what is generated; an answer still needs distractors. */
function questionOptions(
  settings: TheorySettings,
  answer: string,
  chordSize?: number,
): string[] {
  let options = unique([...getTheoryOptions(settings), answer]);
  let candidates: string[];
  if (settings.task === "direction") candidates = ["higher", "lower", "same"];
  else if (settings.task === "interval") {
    const pool =
      settings.presentation === "audio"
        ? AUDIO_INTERVAL_IDS
        : VISUAL_INTERVAL_IDS;
    const distance = INTERVALS[answer as IntervalId].semitones;
    candidates = [...pool].sort(
      (a, b) =>
        Math.abs(INTERVALS[a].semitones - distance) -
        Math.abs(INTERVALS[b].semitones - distance),
    );
  } else if (settings.task === "quality") {
    const size = CHORDS[answer as ChordQuality].length;
    candidates = [...CHORD_IDS].sort(
      (a, b) =>
        Math.abs(CHORDS[a].length - size) - Math.abs(CHORDS[b].length - size),
    );
  } else if (settings.task === "inversion") {
    candidates = INVERSION_IDS.slice(0, chordSize ?? 3);
    options = options.filter((option) => candidates.includes(option));
  } else candidates = PROGRESSIONS.map((sequence) => sequence.join("-"));
  for (const candidate of candidates) {
    if (options.length >= 2) break;
    if (!options.includes(candidate)) options.push(candidate);
  }
  return options;
}

function rootsFor(build: (root: Note) => unknown): Note[] {
  const roots: Note[] = [];
  for (let midi = 48; midi <= 67; midi++) {
    for (const flats of [false, true]) {
      const root = midiToNote(midi, flats);
      try {
        build(root);
        if (
          !roots.some(
            (other) =>
              other.name === root.name &&
              other.accidental === root.accidental &&
              other.octave === root.octave,
          )
        )
          roots.push(root);
      } catch {
        /* Try a spelling representable by our single-accidental Note. */
      }
    }
  }
  return roots;
}

export function generateTheoryQuestion(
  settings: TheorySettings,
  rng: () => number = Math.random,
): TheoryQuestion {
  settings = normalizeTheorySettings(settings);
  const options = getTheoryOptions(settings);
  const base = {
    id: `theory_${rng().toString(36).slice(2, 12)}`,
    kind: settings.kind,
    task: settings.task,
    presentation: settings.presentation,
    direction: settings.direction,
    options,
  };
  if (settings.kind === "interval") {
    const directionAnswer =
      settings.task === "direction"
        ? (settings.focus ?? pick(options, rng))
        : null;
    const interval = directionAnswer
      ? directionAnswer === "same"
        ? "P1"
        : pick(["M2", "M3", "P4", "P5", "P8"] as IntervalId[], rng)
      : ((settings.focus as IntervalId | undefined) ??
        pick(intervalChoices(settings), rng));
    const definition = INTERVALS[interval];
    const root = pick(
      rootsFor((candidate) => {
        if (
          !spellDistance(candidate, definition.number - 1, definition.semitones)
        )
          throw new RangeError();
      }),
      rng,
    );
    const partner = spellDistance(
      root,
      definition.number - 1,
      definition.semitones,
    )!;
    const direction = directionAnswer
      ? directionAnswer === "lower"
        ? "descending"
        : "ascending"
      : settings.direction;
    const notes =
      direction === "descending" ? [partner, root] : [root, partner];
    const answer =
      directionAnswer ??
      (settings.presentation === "visual"
        ? intervalBetween(...(notes as [Note, Note])).id!
        : interval);
    return {
      ...base,
      direction,
      notes,
      groups:
        direction === "simultaneous" ? [notes] : notes.map((note) => [note]),
      root,
      interval,
      answer,
      options: questionOptions(settings, answer),
      type: settings.task === "direction" ? answer : interval,
    };
  }
  if (settings.task === "progression") {
    const degreeSequence = settings.focus
      ? (settings.focus.split("-") as ProgressionDegree[])
      : pick(PROGRESSIONS, rng).slice();
    const root = pick(
      rootsFor((candidate) => generateProgression(candidate, degreeSequence)),
      rng,
    );
    const groups = generateProgression(root, degreeSequence);
    return {
      ...base,
      notes: groups.flat(),
      groups: [[cloneNote(root)], buildChord(root, "major"), ...groups],
      root,
      tonic: cloneNote(root),
      degreeSequence,
      answer: degreeSequence.join("-"),
      options: questionOptions(settings, degreeSequence.join("-")),
      type: degreeSequence.join("-"),
    };
  }
  const selectedChords = chordChoices(settings);
  const maxNotes = Math.max(
    ...selectedChords.map((quality) => CHORDS[quality].length),
  );
  const inversion =
    settings.task === "inversion"
      ? settings.focus
        ? INVERSION_IDS.indexOf(
            settings.focus as (typeof INVERSION_IDS)[number],
          )
        : pick(allowedInversions(settings, maxNotes), rng)
      : 0;
  const compatibleChords = selectedChords.filter(
    (quality) => CHORDS[quality].length > inversion,
  );
  const chordQuality =
    settings.task === "quality" && settings.focus
      ? (settings.focus as ChordQuality)
      : pick(
          compatibleChords.length
            ? compatibleChords
            : CHORD_IDS.filter((quality) => CHORDS[quality].length > inversion),
          rng,
        );
  const root = pick(
    rootsFor((candidate) => buildChord(candidate, chordQuality, inversion)),
    rng,
  );
  const notes = buildChord(root, chordQuality, inversion);
  const answer =
    settings.task === "inversion" ? INVERSION_IDS[inversion] : chordQuality;
  return {
    ...base,
    notes,
    groups:
      settings.task === "inversion" ? [[cloneNote(root)], notes] : [notes],
    root,
    chordQuality,
    inversion,
    answer,
    options: questionOptions(settings, answer, notes.length),
    type:
      settings.task === "inversion"
        ? `${chordQuality}:${answer}`
        : chordQuality,
  };
}

/** Review keeps the relationship/type, with a different representable root. */
export function regenerateTheoryQuestion(
  question: TheoryQuestion,
  rng: () => number = Math.random,
): TheoryQuestion {
  const roots = rootsFor((candidate) => {
    if (question.kind === "interval") {
      const definition = INTERVALS[question.interval!];
      if (
        !spellDistance(candidate, definition.number - 1, definition.semitones)
      )
        throw new RangeError();
    } else if (question.degreeSequence)
      generateProgression(candidate, question.degreeSequence);
    else buildChord(candidate, question.chordQuality!, question.inversion);
  }).filter((root) => noteToMidi(root) !== noteToMidi(question.root));
  const root = pick(roots, rng);
  if (question.kind === "interval") {
    const definition = INTERVALS[question.interval!];
    const second = spellDistance(
      root,
      definition.number - 1,
      definition.semitones,
    )!;
    const notes =
      question.direction === "descending" ? [second, root] : [root, second];
    return {
      ...question,
      id: `review_${rng().toString(36).slice(2, 12)}`,
      notes,
      groups:
        question.direction === "simultaneous"
          ? [notes]
          : notes.map((note) => [note]),
      root,
    };
  }
  const notes = question.degreeSequence
    ? generateProgression(root, question.degreeSequence).flat()
    : buildChord(root, question.chordQuality!, question.inversion);
  const groups = question.degreeSequence
    ? [
        [cloneNote(root)],
        buildChord(root, "major"),
        ...generateProgression(root, question.degreeSequence),
      ]
    : question.task === "inversion"
      ? [[cloneNote(root)], notes]
      : [notes];
  return {
    ...question,
    id: `review_${rng().toString(36).slice(2, 12)}`,
    notes,
    groups,
    root,
    ...(question.tonic ? { tonic: cloneNote(root) } : {}),
  };
}

export function isTheoryAnswerCorrect(
  question: TheoryQuestion,
  answer: string,
): boolean {
  return question.options.includes(answer) && answer === question.answer;
}
