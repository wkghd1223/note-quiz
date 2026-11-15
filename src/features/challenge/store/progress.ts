import { getStage } from "../data/stages";
import {
  getInstrumentProfile,
  supportsStage,
} from "../domain/instrument-profile";
import type { AttemptResult, InputMethod } from "../domain/performance";
export const PROGRESS_KEY = "note-quiz-challenge-v1";
export type StorageWarning = "unavailable" | "corrupt" | "version";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}
export interface StageRecord {
  stageId: string;
  scoringVersion: 1;
  inputProfileId: string;
  inputMethod: InputMethod;
  bestScore: number;
  bestStars: 0 | 1 | 2 | 3;
  attempts: number;
  lastCompletedAt: string | null;
}
export interface ChallengeProgressV1 {
  version: 1;
  selectedInstrumentProfileId: string;
  settings: {
    reducedMotion: boolean;
    metronomeEnabled: boolean;
    inputOffsetMs: number;
  };
  records: Record<string, StageRecord>;
}
export const emptyProgress = (): ChallengeProgressV1 => ({
  version: 1,
  selectedInstrumentProfileId: "touch-keyboard",
  settings: { reducedMotion: false, metronomeEnabled: false, inputOffsetMs: 0 },
  records: {},
});
export const recordKey = (
  stageId: string,
  profileId: string,
  inputMethod: InputMethod,
  version = 1,
) => `${stageId}:${profileId}:${inputMethod}:v${version}`;
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
function validProgress(value: unknown): value is ChallengeProgressV1 {
  if (
    !object(value) ||
    value.version !== 1 ||
    typeof value.selectedInstrumentProfileId !== "string" ||
    !getInstrumentProfile(value.selectedInstrumentProfileId) ||
    !object(value.settings) ||
    !object(value.records)
  )
    return false;
  const s = value.settings;
  if (
    typeof s.reducedMotion !== "boolean" ||
    typeof s.metronomeEnabled !== "boolean" ||
    typeof s.inputOffsetMs !== "number" ||
    !Number.isFinite(s.inputOffsetMs) ||
    Math.abs(s.inputOffsetMs) > 250
  )
    return false;
  return Object.entries(value.records).every(([key, r]) => {
    if (
      !object(r) ||
      typeof r.stageId !== "string" ||
      typeof r.inputProfileId !== "string" ||
      !["microphone", "touch", "midi"].includes(r.inputMethod as string)
    )
      return false;
    const stage = getStage(r.stageId),
      profile = getInstrumentProfile(r.inputProfileId);
    return (
      Boolean(
        stage &&
          profile &&
          supportsStage(stage, profile, r.inputMethod as InputMethod),
      ) &&
      r.scoringVersion === 1 &&
      key ===
        recordKey(r.stageId, r.inputProfileId, r.inputMethod as InputMethod) &&
      typeof r.bestScore === "number" &&
      Number.isFinite(r.bestScore) &&
      r.bestScore >= 0 &&
      r.bestScore <= 100 &&
      Number.isInteger(r.bestStars) &&
      (r.bestStars as number) >= 0 &&
      (r.bestStars as number) <= 3 &&
      Number.isSafeInteger(r.attempts) &&
      (r.attempts as number) > 0 &&
      (r.lastCompletedAt === null ||
        (typeof r.lastCompletedAt === "string" &&
          Number.isFinite(Date.parse(r.lastCompletedAt))))
    );
  });
}
function browserStorage(): StorageLike | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
export function readProgress(
  storage: StorageLike | undefined = browserStorage(),
): { progress: ChallengeProgressV1; warning: StorageWarning | null } {
  if (!storage) return { progress: emptyProgress(), warning: "unavailable" };
  try {
    const raw = storage.getItem(PROGRESS_KEY);
    if (raw === null) return { progress: emptyProgress(), warning: null };
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return { progress: emptyProgress(), warning: "corrupt" };
    }
    if (object(value) && value.version !== 1)
      return { progress: emptyProgress(), warning: "version" };
    return validProgress(value)
      ? { progress: value, warning: null }
      : { progress: emptyProgress(), warning: "corrupt" };
  } catch {
    return { progress: emptyProgress(), warning: "unavailable" };
  }
}
// Existing unreadable data is never replaced without an explicit reset decision.
export function saveProgress(
  progress: ChallengeProgressV1,
  storage: StorageLike | undefined = browserStorage(),
  allowOverwrite = false,
): StorageWarning | null {
  if (!storage) return "unavailable";
  if (!validProgress(progress)) return "corrupt";
  const existing = readProgress(storage);
  if (existing.warning && !allowOverwrite) return existing.warning;
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    return null;
  } catch {
    return "unavailable";
  }
}
export function recordAttempt(
  progress: ChallengeProgressV1,
  attempt: {
    stageId: string;
    profileId: string;
    inputMethod: InputMethod;
    mode: "challenge" | "rehearsal";
    result: AttemptResult;
    completedAt: string;
  },
): ChallengeProgressV1 {
  const { stageId, profileId, inputMethod, mode, result, completedAt } =
    attempt;
  const stage = getStage(stageId),
    profile = getInstrumentProfile(profileId);
  if (
    mode !== "challenge" ||
    result.unscorable ||
    !stage ||
    !profile ||
    !supportsStage(stage, profile, inputMethod) ||
    result.scoringVersion !== stage.scoring.version ||
    !Number.isFinite(result.score) ||
    result.score < 0 ||
    result.score > 100 ||
    !Number.isInteger(result.stars) ||
    result.stars < 0 ||
    result.stars > 3 ||
    result.cleared !== result.stars > 0 ||
    !Number.isFinite(Date.parse(completedAt))
  )
    return progress;
  const key = recordKey(stageId, profileId, inputMethod, result.scoringVersion),
    previous = progress.records[key];
  return {
    ...progress,
    records: {
      ...progress.records,
      [key]: {
        stageId,
        scoringVersion: 1,
        inputProfileId: profileId,
        inputMethod,
        bestScore: Math.max(previous?.bestScore ?? 0, result.score),
        bestStars: Math.max(
          previous?.bestStars ?? 0,
          result.stars,
        ) as StageRecord["bestStars"],
        attempts: (previous?.attempts ?? 0) + 1,
        lastCompletedAt: completedAt,
      },
    },
  };
}
// Accessibility policy: ANY official profile clear unlocks the common learning
// path. Best records remain isolated by stage × instrument × input × version.
export function isStageUnlocked(
  stageId: string,
  progress: ChallengeProgressV1,
  _profileId?: string,
  _inputMethod?: InputMethod,
): boolean {
  // Unlocks intentionally do not depend on the currently selected input.
  void _profileId;
  void _inputMethod;
  const stage = getStage(stageId);
  return Boolean(
    stage &&
      stage.prerequisites.every((id) =>
        Object.values(progress.records).some(
          (r) => r.stageId === id && r.scoringVersion === 1 && r.bestStars > 0,
        ),
      ),
  );
}
