import type { PracticeCompletion, TrainingMode } from "./types";
import { parsePracticeConfig, serializePracticeConfig } from "./config";

export const HISTORY_KEY = "note-quiz-learning-v1";
export const HISTORY_LIMIT = 60;
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export interface HistoryEntry extends PracticeCompletion {
  at: number;
  configuration: string;
}
export interface LearningData {
  version: 1;
  sessions: HistoryEntry[];
  daily: Record<string, boolean>;
}
export interface LearningStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export const emptyLearningData = (): LearningData => ({
  version: 1,
  sessions: [],
  daily: {},
});
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
function sanitizeEntry(value: unknown, now: number): HistoryEntry | null {
  if (
    !object(value) ||
    !["note", "ear", "interval", "chord"].includes(value.mode as string) ||
    !["practice", "review", "daily"].includes(value.kind as string) ||
    !["beginner", "basic", "advanced", "custom"].includes(
      value.difficulty as string,
    )
  )
    return null;
  if (
    !finite(value.at, now - RETENTION_MS, now + 60_000) ||
    !finite(value.total, 0, 150) ||
    !Number.isInteger(value.total) ||
    !finite(value.correct, 0, value.total) ||
    !Number.isInteger(value.correct) ||
    !finite(value.elapsedMs, 0, 86_400_000) ||
    typeof value.completed !== "boolean"
  )
    return null;
  if (
    typeof value.configuration !== "string" ||
    value.configuration.length > 1800
  )
    return null;
  const parsed = parsePracticeConfig(value.configuration);
  if (
    parsed.invalid ||
    parsed.config.mode !== value.mode ||
    parsed.config.difficulty !== value.difficulty
  )
    return null;
  const sessionTotal = value.total,
    sessionCorrect = value.correct;
  const categories = Array.isArray(value.categories)
    ? value.categories
        .filter(object)
        .slice(0, 24)
        .flatMap((category) =>
          typeof category.id === "string" &&
          /^[A-Za-z0-9_:-]{1,48}$/.test(category.id) &&
          finite(category.total, 1, sessionTotal) &&
          Number.isInteger(category.total) &&
          finite(
            category.correct,
            0,
            Math.min(category.total, sessionCorrect),
          ) &&
          Number.isInteger(category.correct)
            ? [
                {
                  id: category.id,
                  correct: category.correct,
                  total: category.total,
                },
              ]
            : [],
        )
    : [];
  return {
    at: value.at,
    mode: value.mode as TrainingMode,
    kind: value.kind as HistoryEntry["kind"],
    difficulty: value.difficulty as string,
    total: value.total,
    correct: value.correct,
    elapsedMs: value.elapsedMs,
    completed: value.completed,
    categories,
    configuration: serializePracticeConfig(parsed.config),
  };
}
export function sanitizeLearningData(
  value: unknown,
  now = Date.now(),
): LearningData {
  if (!object(value) || value.version !== 1) return emptyLearningData();
  const sessions = Array.isArray(value.sessions)
    ? value.sessions
        .slice(-HISTORY_LIMIT * 2)
        .flatMap((entry) => {
          const safe = sanitizeEntry(entry, now);
          return safe ? [safe] : [];
        })
        .sort((a, b) => a.at - b.at)
        .slice(-HISTORY_LIMIT)
    : [];
  const daily: Record<string, boolean> = {};
  if (object(value.daily))
    for (const [key, done] of Object.entries(value.daily).slice(-512)) {
      const day = key.slice(0, 10),
        stamp = Date.parse(day + "T00:00:00Z");
      if (
        Number.isFinite(stamp) &&
        new Date(stamp).toISOString().slice(0, 10) === day &&
        done === true &&
        /^\d{4}-\d{2}-\d{2}:(note|ear|interval|chord):(beginner|basic|advanced|custom)$/.test(
          key,
        ) &&
        finite(stamp, now - RETENTION_MS, now)
      )
        daily[key] = true;
    }
  return { version: 1, sessions, daily };
}
export function browserLearningStorage(): LearningStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
export function readLearningData(
  storage = browserLearningStorage(),
  now = Date.now(),
): { data: LearningData; available: boolean } {
  if (!storage) return { data: emptyLearningData(), available: false };
  try {
    const raw = storage.getItem(HISTORY_KEY);
    if (!raw) return { data: emptyLearningData(), available: true };
    let data = emptyLearningData();
    if (raw.length <= 150_000) {
      try {
        data = sanitizeLearningData(JSON.parse(raw), now);
      } catch {
        /* Discard corrupt owned history, keeping practice available. */
      }
    }
    const clean = JSON.stringify(data);
    if (clean !== raw) {
      try {
        storage.setItem(HISTORY_KEY, clean);
      } catch {
        return { data, available: false };
      }
    }
    return { data, available: true };
  } catch {
    return { data: emptyLearningData(), available: false };
  }
}
export function writeLearningData(
  data: LearningData,
  storage = browserLearningStorage(),
  now = Date.now(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      HISTORY_KEY,
      JSON.stringify(sanitizeLearningData(data, now)),
    );
    return true;
  } catch {
    return false;
  }
}
export function appendHistory(
  data: LearningData,
  entry: HistoryEntry,
  dailyKey?: string,
  now = Date.now(),
): LearningData {
  const safe = sanitizeEntry(entry, now);
  if (!safe) return sanitizeLearningData(data, now);
  // Completing an already completed daily exercise records no second completion/reward.
  if (entry.kind === "daily" && dailyKey && data.daily[dailyKey])
    return sanitizeLearningData(data, now);
  return sanitizeLearningData(
    {
      version: 1,
      sessions: [...data.sessions, safe],
      daily: {
        ...data.daily,
        ...(dailyKey && entry.kind === "daily" && entry.completed
          ? { [dailyKey]: true }
          : {}),
      },
    },
    now,
  );
}
export function weakestAreas(entries: HistoryEntry[]) {
  const groups = new Map<
    string,
    {
      mode: TrainingMode;
      configuration: string;
      id: string;
      correct: number;
      total: number;
    }
  >();
  for (const entry of entries.filter((e) => e.kind === "practice"))
    for (const category of entry.categories) {
      const key = entry.configuration + ":" + category.id;
      const prior = groups.get(key) ?? {
        mode: entry.mode,
        configuration: entry.configuration,
        id: category.id,
        correct: 0,
        total: 0,
      };
      groups.set(key, {
        ...prior,
        correct: prior.correct + category.correct,
        total: prior.total + category.total,
      });
    }
  return [...groups.values()]
    .filter((group) => group.total >= 5 && group.correct / group.total < 0.8)
    .sort((a, b) => a.correct / a.total - b.correct / b.total)
    .slice(0, 3);
}
