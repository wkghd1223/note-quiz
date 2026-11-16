"use client";

import { useEffect, useMemo, useRef } from "react";
import { trackLearningEvent, trackMelodyPreviewStarted } from "@/lib/analytics";
import {
  captureAnalyticsPageContext,
  type AnalyticsPageContext,
} from "@/lib/analytics-runtime";
import type { ChallengePhase } from "@/features/challenge/store/challengeStore";
import type { AttemptResult } from "@/features/challenge/domain/performance";
import { createMelodyAnalyticsObserver } from "./melody-analytics";

interface ObservedSession {
  state: {
    phase: ChallengePhase;
    attemptToken: number;
    elapsedSec: number;
    result: Pick<AttemptResult, "notes"> | null;
  };
  elapsed: number;
  previewing: boolean;
}

export function useMelodyAnalytics(
  ready: boolean,
  exercise: object,
  session: ObservedSession,
) {
  const origin = useRef<AnalyticsPageContext | undefined>(undefined);
  const observer = useRef<ReturnType<
    typeof createMelodyAnalyticsObserver
  > | null>(null);
  if (!observer.current)
    observer.current = createMelodyAnalyticsObserver({
      learning: (event, details) =>
        trackLearningEvent(
          event,
          details,
          event === "completed" ? origin.current : undefined,
        ),
      preview: trackMelodyPreviewStarted,
    });
  const {
    phase,
    attemptToken,
    result: finalResult,
    elapsedSec,
  } = session.state;
  const result = useMemo(
    () =>
      phase === "result" && finalResult
        ? {
            total: finalResult.notes.length,
            correct: finalResult.notes.filter(
              (note) => note.status === "passed",
            ).length,
            elapsedSec,
          }
        : null,
    [phase, finalResult, elapsedSec],
  );

  useEffect(() => {
    if (!ready) return;
    // Refresh metadata at milestones, never from deferred unmount cleanup.
    const current = captureAnalyticsPageContext();
    if (!origin.current || current?.page_path === origin.current.page_path)
      origin.current = current;
  }, [ready, exercise, attemptToken, phase]);

  useEffect(() => {
    observer.current!.observe({
      ready,
      exercise,
      phase,
      attemptToken,
      result,
      elapsedSec: session.elapsed,
      previewing: session.previewing,
    });
  }, [
    ready,
    exercise,
    phase,
    attemptToken,
    result,
    session.elapsed,
    session.previewing,
  ]);

  const lifetime = useRef({ generation: 0 });
  useEffect(() => {
    const instance = lifetime.current;
    const currentObserver = observer.current!;
    const mounted = ++instance.generation;
    return () => {
      // StrictMode immediately sets up the same mounted instance again. Defer
      // only this exit, so its test cleanup cannot manufacture an interruption.
      queueMicrotask(() => {
        if (instance.generation === mounted) currentObserver.exit();
      });
    };
  }, []);
}
