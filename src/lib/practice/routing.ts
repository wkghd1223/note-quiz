import {
  parsePracticeConfig,
  serializePracticeConfig,
  type PracticeConfig,
} from "./config";
import type { TrainingMode } from "./types";
import {
  localizedHref,
  localeFromPathname,
  stripLocale,
} from "@/lib/i18n/locale";

export const PRACTICE_MODES = ["note", "ear", "interval", "chord"] as const;
export function isPracticeMode(value: unknown): value is TrainingMode {
  return PRACTICE_MODES.some((mode) => mode === value);
}
export function practiceModeFromPath(pathname: string): TrainingMode | null {
  const path = stripLocale(pathname);
  const mode = path.split("/")[2];
  return path === `/practice/${mode}` && isPracticeMode(mode) ? mode : null;
}
export function practiceModeHref(
  mode: TrainingMode,
  pathname = "/practice",
): string {
  return localizedHref(`/practice/${mode}`, localeFromPathname(pathname));
}
export type PracticeSearchParams = Record<
  string,
  string | string[] | undefined
>;
export function legacyPracticeHref(
  search: PracticeSearchParams,
  locale: Language | null = null,
): string | null {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) value.forEach((item) => p.append(key, item));
    else if (value !== undefined) p.set(key, value);
  }
  const mode = p.get("mode") ?? "note";
  if (!isPracticeMode(mode)) return null;
  const path = localizedHref(`/practice/${mode}`, locale);
  return p.size ? `${path}?${p}` : path;
}
/** Overlay changes must leave both the mode component and its session untouched. */
export function practiceConfigSignature(
  input: string,
  mode: TrainingMode,
): string {
  const p = new URLSearchParams(input);
  p.delete("settings");
  p.delete("leaderboard");
  p.set("mode", mode);
  p.sort();
  return p.toString();
}
export function parseRoutedPracticeConfig(input: string, mode: TrainingMode) {
  const signature = practiceConfigSignature(input, mode);
  // Oversized settings are discarded by the parser; the child route still owns its mode.
  if (signature.length > 1800)
    return { ...parsePracticeConfig(`mode=${mode}`), invalid: true };
  return parsePracticeConfig(signature);
}
export function practiceConfigurationHref(
  config: PracticeConfig,
  pathname: string,
): string {
  return `${practiceModeHref(config.mode, pathname)}?${serializePracticeConfig(config)}`;
}

export function configWithNoteSettings(
  config: PracticeConfig,
  note: GameSettings,
): PracticeConfig {
  return {
    ...config,
    clef: note.clef,
    keySignature: note.keySignature,
    ledgerAbove: note.staffRange.ledgerLinesAbove,
    ledgerBelow: note.staffRange.ledgerLinesBelow,
    answerMode: note.answerMode,
    enableSound: note.enableSound,
    enableAccidentals: note.enableAccidentals,
    accidentalProbability: note.accidentalProbability,
    length: note.questionLimit ? "ten" : note.timeLimit ? "timed" : "free",
    timeLimit: note.timeLimit ?? 60,
  };
}
export function configWithEarSettings(
  config: PracticeConfig,
  ear: EarTrainingSettings,
): PracticeConfig {
  return {
    ...config,
    answerMode: ear.inputMode,
    noteSet: ear.noteSet,
    octaveMin: ear.octaveRange.min,
    octaveMax: ear.octaveRange.max,
    enableSound: ear.enableSound,
    length: ear.questionLimit
      ? "ten"
      : ear.sessionType === "timed"
        ? "timed"
        : "free",
    timeLimit: ear.timeLimit ?? 60,
  };
}
