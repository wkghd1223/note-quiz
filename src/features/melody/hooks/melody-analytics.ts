import type { LearningEvent, LearningEventDetails } from "@/lib/analytics";
import type { ChallengePhase } from "@/features/challenge/store/challengeStore";

export interface MelodyAnalyticsSnapshot {
  ready: boolean;
  // Identity and tokens stay inside this observer; neither is an event field.
  exercise: object;
  attemptToken: number;
  phase: ChallengePhase;
  previewing: boolean;
  elapsedSec?: number;
  result: { total: number; correct: number; elapsedSec: number } | null;
}
interface MelodyAnalyticsSink {
  learning: (event: LearningEvent, details: LearningEventDetails) => void;
  preview: () => void;
}
const context = {
  mode: "melody",
  difficulty: "custom",
  presentation: "visual",
  sessionType: "exercise",
  kind: "practice",
} as const;

function validResult(result: MelodyAnalyticsSnapshot["result"]) {
  return (
    result !== null &&
    Number.isInteger(result.total) &&
    result.total > 0 &&
    Number.isInteger(result.correct) &&
    result.correct >= 0 &&
    result.correct <= result.total &&
    Number.isFinite(result.elapsedSec) &&
    result.elapsedSec >= 0
  );
}

/** Observes milestones, never controls the challenge session or scores input. */
export function createMelodyAnalyticsObserver(sink: MelodyAnalyticsSink) {
  let entered = false,
    entryStarted = false,
    closed = false,
    exercise: object | null = null,
    token = -1,
    previewing = false;
  const retired = new WeakSet<object>();
  let attempt: {
    started: boolean;
    ended: boolean;
    elapsedMs?: number;
  } | null = null;

  const interrupt = () => {
    if (!attempt?.started || attempt.ended) return;
    attempt.ended = true;
    sink.learning("completed", {
      ...context,
      completed: false,
      ...(attempt.elapsedMs !== undefined
        ? { elapsedMs: attempt.elapsedMs }
        : {}),
    });
  };

  return {
    observe(snapshot: MelodyAnalyticsSnapshot) {
      if (closed || !snapshot.ready || retired.has(snapshot.exercise)) return;
      if (!entered) {
        entered = true;
        sink.learning("entered", { ...context });
      }
      if (exercise !== snapshot.exercise) {
        interrupt();
        if (exercise) retired.add(exercise);
        exercise = snapshot.exercise;
        token = -1;
        attempt = null;
        previewing = false;
      }
      // Store tokens are monotonic within one exercise. Disposed audio, stale
      // results and old snapshots cannot re-open or end a newer attempt.
      if (snapshot.attemptToken < token) return;
      if (snapshot.attemptToken > token) {
        interrupt();
        token = snapshot.attemptToken;
        attempt = { started: false, ended: false };
      }
      if (snapshot.previewing && !previewing) sink.preview();
      previewing = snapshot.previewing;

      const result =
        snapshot.phase === "result" && validResult(snapshot.result)
          ? snapshot.result
          : null;
      if (
        attempt &&
        !attempt.ended &&
        !attempt.started &&
        !snapshot.previewing &&
        (snapshot.phase === "playing" || result)
      ) {
        attempt.started = true;
        sink.learning("started", { ...context, entryStart: !entryStarted });
        entryStarted = true;
      }
      if (!attempt?.started || attempt.ended) return;

      if (result) {
        attempt.ended = true;
        sink.learning("completed", {
          ...context,
          completed: true,
          total: result.total,
          correct: result.correct,
          hasMistakes: result.correct < result.total,
          elapsedMs: Math.round(result.elapsedSec * 1000),
        });
      } else if (
        ["playing", "paused", "countIn", "evaluating"].includes(snapshot.phase)
      ) {
        if (
          snapshot.elapsedSec !== undefined &&
          Number.isFinite(snapshot.elapsedSec) &&
          snapshot.elapsedSec >= 0
        )
          // Last committed score position, rounded down to 100 ms. Pausing can
          // rewind to a note boundary; this is not wall-clock session duration.
          attempt.elapsedMs = Math.floor(snapshot.elapsedSec * 10) * 100;
      } else {
        interrupt();
      }
    },
    exit() {
      if (closed) return;
      interrupt();
      closed = true;
    },
  };
}
