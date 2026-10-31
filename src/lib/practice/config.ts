import { KEY_SIGNATURES } from "@/lib/music/constants";
import {
  AUDIO_INTERVAL_IDS,
  VISUAL_INTERVAL_IDS,
  CHORD_IDS,
  CHORDS,
  PROGRESSIONS,
  type TheorySettings,
  type IntervalId,
  type ChordQuality,
} from "@/lib/music/theory";
import type { Difficulty, SessionLength, TrainingMode } from "./types";

export interface PracticeConfig extends TheorySettings {
  mode: TrainingMode;
  length: SessionLength;
  timeLimit: number;
  clef: ClefType | "random";
  keySignature: string;
  ledgerAbove: number;
  ledgerBelow: number;
  answerMode: AnswerMode;
  noteSet: EarTrainingNoteSet;
  octaveMin: Octave;
  octaveMax: Octave;
  enableSound: boolean;
  enableAccidentals: boolean;
  accidentalProbability: number;
}
export function defaultConfig(
  mode: TrainingMode = "note",
  difficulty: Difficulty = "beginner",
): PracticeConfig {
  return {
    mode,
    kind: mode === "chord" ? "chord" : "interval",
    difficulty,
    task:
      mode === "chord"
        ? "quality"
        : difficulty === "beginner"
          ? "direction"
          : "interval",
    presentation: "audio",
    direction: "ascending",
    length: "ten",
    timeLimit: 60,
    clef: "treble",
    keySignature: mode === "note" && difficulty === "advanced" ? "random" : "C",
    ledgerAbove:
      mode === "note"
        ? difficulty === "advanced"
          ? 2
          : difficulty === "basic"
            ? 1
            : 0
        : 0,
    ledgerBelow:
      mode === "note"
        ? difficulty === "advanced"
          ? 2
          : difficulty === "basic"
            ? 1
            : 0
        : 0,
    answerMode: "piano",
    noteSet:
      mode === "ear" && difficulty !== "beginner" ? "chromatic" : "natural",
    octaveMin: mode === "ear" && difficulty === "advanced" ? 3 : 4,
    octaveMax: mode === "ear" && difficulty !== "beginner" ? 5 : 4,
    enableSound: true,
    enableAccidentals: mode === "note" && difficulty === "advanced",
    accidentalProbability: 0.3,
  };
}
const oneOf = <T extends string>(
  value: string | null,
  values: readonly T[],
  fallback: T,
): T => (values.includes(value as T) ? (value as T) : fallback);
export function parsePracticeConfig(input: URLSearchParams | string) {
  const query =
    typeof input === "string" ? input.replace(/^\?/, "") : input.toString();
  const oversized = query.length > 1800;
  const params = oversized ? new URLSearchParams() : new URLSearchParams(query);
  const mode = oneOf(
    params.get("mode"),
    ["note", "ear", "interval", "chord"] as const,
    "note",
  );
  const difficulty = oneOf(
    params.get("level"),
    ["beginner", "basic", "advanced", "custom"] as const,
    "beginner",
  );
  const config = defaultConfig(mode, difficulty);
  let invalid = oversized;
  const select = <T extends string>(
    key: string,
    choices: readonly T[],
    fallback: T,
  ) => {
    const raw = params.get(key);
    if (raw !== null && !choices.includes(raw as T)) invalid = true;
    return oneOf(raw, choices, fallback);
  };
  const number = (
    key: string,
    min: number,
    max: number,
    fallback: number,
    integer = true,
  ) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (
      !raw.trim() ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    ) {
      invalid = true;
      return fallback;
    }
    return value;
  };
  select("mode", ["note", "ear", "interval", "chord"] as const, "note");
  select(
    "level",
    ["beginner", "basic", "advanced", "custom"] as const,
    "beginner",
  );
  config.length = select("length", ["ten", "free", "timed"] as const, "ten");
  config.timeLimit = number("seconds", 30, 180, 60);
  if (![30, 60, 180].includes(config.timeLimit)) {
    config.timeLimit = 60;
    invalid = true;
  }
  config.presentation = select("view", ["audio", "visual"] as const, "audio");
  config.direction = select(
    "direction",
    ["ascending", "descending", "simultaneous"] as const,
    "ascending",
  );
  config.task = select(
    "task",
    mode === "chord"
      ? (["quality", "inversion", "progression"] as const)
      : (["direction", "interval"] as const),
    config.task,
  );
  config.clef = select(
    "clef",
    ["treble", "bass", "alto", "tenor", "random"] as const,
    "treble",
  );
  config.keySignature = select(
    "key",
    Object.keys(KEY_SIGNATURES).concat("random"),
    config.keySignature,
  );
  config.ledgerAbove = number("above", 0, 5, config.ledgerAbove);
  config.ledgerBelow = number("below", 0, 5, config.ledgerBelow);
  config.answerMode = select(
    "input",
    ["piano", "solfege", "microphone"] as const,
    "piano",
  );
  if (mode === "ear" && config.answerMode === "microphone") {
    config.answerMode = "piano";
    invalid = true;
  }
  config.noteSet = select(
    "notes",
    ["natural", "chromatic"] as const,
    config.noteSet,
  );
  config.octaveMin = number("min", 0, 8, config.octaveMin) as Octave;
  config.octaveMax = number("max", 0, 8, config.octaveMax) as Octave;
  if (config.octaveMin > config.octaveMax) {
    config.octaveMin = 4;
    config.octaveMax = 4;
    invalid = true;
  }
  config.enableSound = select("sound", ["0", "1"] as const, "1") === "1";
  config.enableAccidentals =
    select(
      "accidentals",
      ["0", "1"] as const,
      config.enableAccidentals ? "1" : "0",
    ) === "1";
  config.accidentalProbability = number("probability", 0, 1, 0.3, false);
  const list = <T extends string>(
    key: string,
    allowed: readonly T[],
  ): T[] | undefined => {
    const raw = params.get(key);
    if (raw === null) return undefined;
    const values = raw.split(",");
    if (
      values.length > 20 ||
      values.some((value) => !allowed.includes(value as T))
    ) {
      invalid = true;
      return undefined;
    }
    return Array.from(new Set(values)) as T[];
  };
  config.intervals = list(
    "intervals",
    config.presentation === "audio" ? AUDIO_INTERVAL_IDS : VISUAL_INTERVAL_IDS,
  ) as IntervalId[] | undefined;
  config.chords = list("chords", CHORD_IDS) as ChordQuality[] | undefined;
  const inversions = list("inversions", ["0", "1", "2", "3"]);
  config.inversions = inversions?.map(Number);
  if (
    mode === "chord" &&
    config.task === "inversion" &&
    config.inversions?.length
  ) {
    const qualities = config.chords?.length
      ? config.chords
      : config.difficulty === "advanced" || config.difficulty === "custom"
        ? CHORD_IDS
        : (["major", "minor", "diminished", "augmented"] as ChordQuality[]);
    const max = Math.max(...qualities.map((quality) => CHORDS[quality].length));
    const filtered = config.inversions.filter((value) => value < max);
    if (filtered.length !== config.inversions.length) {
      invalid = true;
      config.inversions = filtered.length ? filtered : [0, 1];
    }
  }
  const focus = params.get("focus");
  if (focus !== null) {
    const allowed =
      config.task === "direction"
        ? ["higher", "lower", "same"]
        : config.task === "interval"
          ? config.presentation === "audio"
            ? AUDIO_INTERVAL_IDS
            : VISUAL_INTERVAL_IDS
          : config.task === "quality"
            ? CHORD_IDS
            : config.task === "inversion"
              ? ["root", "first", "second", "third"]
              : PROGRESSIONS.map((sequence) => sequence.join("-"));
    let compatible = allowed.includes(focus);
    if (config.difficulty === "custom") {
      if (
        config.task === "interval" &&
        config.intervals?.length &&
        !config.intervals.includes(focus as IntervalId)
      )
        compatible = false;
      if (
        config.task === "quality" &&
        config.chords?.length &&
        !config.chords.includes(focus as ChordQuality)
      )
        compatible = false;
      if (config.task === "inversion") {
        const qualities = config.chords?.length ? config.chords : CHORD_IDS;
        const position = ["root", "first", "second", "third"].indexOf(focus);
        if (
          !qualities.some((quality) => CHORDS[quality].length > position) ||
          (config.inversions?.length && !config.inversions.includes(position))
        )
          compatible = false;
      }
    }
    if (compatible) config.focus = focus;
    else invalid = true;
  }
  const shared = params.has("share");
  if (shared && params.get("share") !== "1") invalid = true;
  return { config, invalid, shared };
}
/** Allow-listed settings only: no answers, identity, completion or run state. */
function encodeConfig(config: PracticeConfig): string {
  const p = new URLSearchParams({
    share: "1",
    mode: config.mode,
    level: config.difficulty,
    length: config.length,
    seconds: String(config.timeLimit),
    view: config.presentation,
    task: config.task,
    direction: config.direction,
  });
  if (config.focus) p.set("focus", config.focus);
  if (config.mode === "note") {
    p.set("clef", config.clef);
    p.set("key", config.keySignature);
    p.set("above", String(config.ledgerAbove));
    p.set("below", String(config.ledgerBelow));
    p.set("input", config.answerMode);
    p.set("sound", config.enableSound ? "1" : "0");
    p.set("accidentals", config.enableAccidentals ? "1" : "0");
    p.set("probability", String(config.accidentalProbability));
  } else if (config.mode === "ear") {
    p.set(
      "input",
      config.answerMode === "microphone" ? "piano" : config.answerMode,
    );
    p.set("notes", config.noteSet);
    p.set("min", String(config.octaveMin));
    p.set("max", String(config.octaveMax));
    p.set("sound", config.enableSound ? "1" : "0");
  } else if (config.difficulty === "custom") {
    if (config.intervals?.length)
      p.set("intervals", config.intervals.join(","));
    if (config.chords?.length) p.set("chords", config.chords.join(","));
    if (config.inversions?.length)
      p.set("inversions", config.inversions.join(","));
  }
  return p.toString();
}
export function serializePracticeConfig(config: PracticeConfig): string {
  return encodeConfig(parsePracticeConfig(encodeConfig(config)).config);
}
export function noteSettings(config: PracticeConfig): Partial<GameSettings> {
  return {
    clef: config.clef,
    keySignature: config.keySignature,
    staffRange: {
      ledgerLinesAbove: config.ledgerAbove,
      ledgerLinesBelow: config.ledgerBelow,
    },
    answerMode: config.answerMode,
    enableSound: config.enableSound,
    enableAccidentals: config.enableAccidentals,
    accidentalProbability: config.accidentalProbability,
    questionLimit: config.length === "ten" ? 10 : null,
    timeLimit: config.length === "timed" ? config.timeLimit : undefined,
  };
}
export function earSettings(
  config: PracticeConfig,
): Partial<EarTrainingSettings> {
  return {
    inputMode: config.answerMode === "microphone" ? "piano" : config.answerMode,
    noteSet: config.noteSet,
    octaveRange: { min: config.octaveMin, max: config.octaveMax },
    enableSound: config.enableSound,
    sessionType: config.length === "timed" ? "timed" : "practice",
    questionLimit: config.length === "ten" ? 10 : null,
    timeLimit: config.length === "timed" ? config.timeLimit : undefined,
  };
}
