import { CLEFS, KEY_SIGNATURES, NOTE_NAMES } from "@/lib/music/constants";
import { beatsPerMeasure } from "@/features/challenge/domain/stage";

import {
  getTonality,
  melodyPatterns,
  type TonalityId,
  type ProgressionChoice,
} from "./harmony";

export const melodyTimeSignatures: readonly (readonly [number, number])[] = [
  [2, 4],
  [3, 4],
  [4, 4],
  [6, 8],
];

export interface MelodySettings {
  clef: ClefType;
  tonalityId: TonalityId;
  progressionId: ProgressionChoice;
  minMidi: number;
  maxMidi: number;
  /** Allowed undotted base note lengths in quarter-note beats. */
  durations: number[];
  /** Quarter-note beats per minute, including in 6/8. */
  bpm: number;
  timeSignature: [number, number];
  dotted: boolean;
  triplets: boolean;
  metronome: boolean;
  barBell: boolean;
}

export const defaultMelodySettings: MelodySettings = {
  clef: "treble",
  tonalityId: "C-major",
  progressionId: "none",
  minMidi: 60,
  maxMidi: 67,
  durations: [1, 2],
  bpm: 72,
  timeSignature: [4, 4],
  dotted: false,
  triplets: false,
  metronome: false,
  barBell: false,
};

const naturalMidi: Record<NoteName, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Written octave belongs to the letter, so B#3 is MIDI 60 and Cb4 is 59. */
export function getMelodyPitches(
  settings: Pick<MelodySettings, "tonalityId" | "minMidi" | "maxMidi">,
): { midi: number; spelling: string }[] {
  const tonality = getTonality(settings.tonalityId);
  if (!tonality) return [];
  const key = KEY_SIGNATURES[tonality.keySignature];
  const pitches: { midi: number; spelling: string }[] = [];
  // Includes enharmonic spellings on both sides of the supported voice range.
  for (let octave = 2; octave <= 7; octave++) {
    for (const letter of NOTE_NAMES) {
      const accidental = key.sharps.includes(letter)
        ? "#"
        : key.flats.includes(letter)
          ? "b"
          : "";
      const midi =
        (octave + 1) * 12 +
        naturalMidi[letter] +
        (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
      if (midi >= settings.minMidi && midi <= settings.maxMidi)
        pitches.push({ midi, spelling: `${letter}${accidental}${octave}` });
    }
  }
  return pitches.sort((a, b) => a.midi - b.midi);
}

export type MelodySettingsValidation =
  | { valid: true; settings: MelodySettings }
  | { valid: false; errors: string[] };

/** Validate untrusted settings before generation or localStorage restoration. */
export function validateMelodySettings(
  value: unknown,
): MelodySettingsValidation {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { valid: false, errors: ["settingsObject"] };
  const input = value as Record<string, unknown>;
  const errors: string[] = [];
  if (!CLEFS.includes(input.clef as ClefType)) errors.push("clef");
  const tonalityId = Object.hasOwn(input, "tonalityId")
    ? input.tonalityId
    : typeof input.keySignature === "string" &&
        Object.hasOwn(KEY_SIGNATURES, input.keySignature)
      ? `${input.keySignature}-major`
      : undefined;
  const tonality = getTonality(tonalityId);
  const progressionId = Object.hasOwn(input, "progressionId")
    ? input.progressionId
    : "none";
  if (!tonality) errors.push("tonalityId");
  if (
    progressionId !== "none" &&
    progressionId !== "random" &&
    !melodyPatterns.some(
      (pattern) =>
        pattern.id === progressionId && pattern.mode === tonality?.mode,
    )
  )
    errors.push("progressionId");
  for (const field of ["minMidi", "maxMidi"] as const) {
    if (
      !Number.isInteger(input[field]) ||
      (input[field] as number) < 48 ||
      (input[field] as number) > 84
    )
      errors.push(field);
  }
  if (
    typeof input.minMidi === "number" &&
    typeof input.maxMidi === "number" &&
    input.minMidi > input.maxMidi
  )
    errors.push("pitchRange");
  if (
    !Array.isArray(input.durations) ||
    input.durations.length === 0 ||
    Array.from(input.durations).some(
      (duration) => ![0.25, 0.5, 1, 2, 4].includes(duration),
    )
  )
    errors.push("durations");
  // Missing fields migrate v1 persisted settings. Explicit malformed values,
  // including undefined/null, must not silently become a different setting.
  const bpm = Object.hasOwn(input, "bpm")
    ? input.bpm
    : Array.isArray(input.durations) && input.durations.includes(0.5)
      ? 60
      : 72;
  const meter = Object.hasOwn(input, "timeSignature")
    ? input.timeSignature
    : [4, 4];
  const dotted = Object.hasOwn(input, "dotted") ? input.dotted : false;
  const triplets = Object.hasOwn(input, "triplets") ? input.triplets : false;
  const metronome = Object.hasOwn(input, "metronome") ? input.metronome : false;
  const barBell = Object.hasOwn(input, "barBell") ? input.barBell : false;
  if (!Number.isInteger(bpm) || (bpm as number) < 40 || (bpm as number) > 180)
    errors.push("bpm");
  if (
    !Array.isArray(meter) ||
    meter.length !== 2 ||
    !melodyTimeSignatures.some(([n, d]) => meter[0] === n && meter[1] === d)
  )
    errors.push("timeSignature");
  if (typeof dotted !== "boolean") errors.push("dotted");
  if (typeof triplets !== "boolean") errors.push("triplets");
  if (typeof metronome !== "boolean") errors.push("metronome");
  if (typeof barBell !== "boolean") errors.push("barBell");
  if (errors.length) return { valid: false, errors };
  const settings: MelodySettings = {
    clef: input.clef as ClefType,
    tonalityId: tonalityId as TonalityId,
    progressionId: progressionId as ProgressionChoice,
    minMidi: input.minMidi as number,
    maxMidi: input.maxMidi as number,
    durations: [...new Set(input.durations as number[])].sort((a, b) => a - b),
    bpm: bpm as number,
    timeSignature: [...(meter as [number, number])],
    dotted: dotted as boolean,
    triplets: triplets as boolean,
    metronome: metronome as boolean,
    barBell: barBell as boolean,
  };
  if (settings.progressionId === "none" && !getMelodyPitches(settings).length)
    return { valid: false, errors: ["noAvailablePitch"] };
  // Bases are powers of two; any fitting base can fill a bar with standard
  // automatic rests. A complete eighth-triplet group independently fits 1 beat.
  if (
    !settings.triplets &&
    !settings.durations.some(
      (duration) => duration <= beatsPerMeasure(settings),
    )
  )
    return { valid: false, errors: ["noFittingNotes"] };
  return { valid: true, settings };
}

/** Invalid persisted payloads restore a fresh default, never a partial exercise. */
export function sanitizeMelodySettings(value: unknown): MelodySettings {
  const payload =
    value && typeof value === "object" && "version" in value
      ? (value as { version: unknown; settings?: unknown }).version === 2
        ? (value as { settings?: unknown }).settings
        : null
      : value;
  const result = validateMelodySettings(payload);
  return result.valid
    ? result.settings
    : {
        ...defaultMelodySettings,
        durations: [...defaultMelodySettings.durations],
        timeSignature: [...defaultMelodySettings.timeSignature],
      };
}

export const melodySettingsStorageKey = "note-quiz-melody-settings-v1";
export function serializeMelodySettings(settings: MelodySettings): string {
  return JSON.stringify({ version: 2, settings });
}
/** A tonic change retains a fixed progression; a mode change shows random. */
export function changeMelodyTonality(
  settings: MelodySettings,
  tonalityId: TonalityId,
): MelodySettings {
  const progressionId = settings.progressionId;
  return {
    ...settings,
    tonalityId,
    progressionId:
      progressionId !== "none" &&
      progressionId !== "random" &&
      !melodyPatterns.some(
        (pattern) =>
          pattern.id === progressionId &&
          pattern.mode === getTonality(tonalityId)?.mode,
      )
        ? "random"
        : progressionId,
  };
}
