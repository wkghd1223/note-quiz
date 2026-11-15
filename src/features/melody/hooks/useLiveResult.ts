"use client";

import { useMemo } from "react";
import type { ScoringProfile } from "@/features/challenge/domain/instrument-profile";
import type {
  PerformanceEvent,
  TargetEvent,
} from "@/features/challenge/domain/performance";
import { scoreAttempt } from "@/features/challenge/domain/scoring";
import { liveResultTiming, visibleLiveResult } from "../domain/live-result";

export function useLiveResult(
  active: boolean,
  events: PerformanceEvent[],
  targets: TargetEvent[],
  profile: ScoringProfile,
  elapsed: number,
  heldDuration: number,
) {
  const evaluated = useMemo(
    () => (active ? scoreAttempt(events, targets, profile, 0) : null),
    [active, events, targets, profile],
  );
  const timing = useMemo(
    () => liveResultTiming(targets, events),
    [targets, events],
  );
  // Only the inexpensive visibility policy follows the animation clock.
  return useMemo(
    () => visibleLiveResult(evaluated, timing, elapsed, heldDuration),
    [evaluated, timing, elapsed, heldDuration],
  );
}
