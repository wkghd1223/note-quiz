import type {
  AttemptResult,
  PerformanceEvent,
  TargetEvent,
} from "@/features/challenge/domain/performance";

/** Index stable input once; the presentation clock does not change judgments. */
export function liveResultTiming(
  targets: readonly TargetEvent[],
  events: readonly PerformanceEvent[],
) {
  return {
    endTimes: new Map(
      targets.map((target) => [target.stageEventId, target.endAudioSec]),
    ),
    latestOnset: events.reduce(
      (latest, event) =>
        event.onsetAudioSec > latest ? event.onsetAudioSec : latest,
      -Infinity,
    ),
  };
}

/** Keep misses pending while a sound is held or its final input may still arrive. */
export function visibleLiveResult(
  evaluated: AttemptResult | null,
  timing: ReturnType<typeof liveResultTiming>,
  elapsed: number,
  heldDuration: number,
): AttemptResult | null {
  if (!evaluated) return null;
  return {
    ...evaluated,
    notes: evaluated.notes.filter((note) => {
      const end = timing.endTimes.get(note.stageEventId)!;
      return (
        end <= elapsed &&
        (note.eventId !== null ||
          (heldDuration === 0 && end + 0.45 <= elapsed) ||
          timing.latestOnset > end)
      );
    }),
  };
}
