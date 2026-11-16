"use client";

import { useEffect, useRef, useState } from "react";
import {
  initialLivePitchFeedback,
  updateLivePitchFeedback,
  type LivePitchFeedbackInput,
  type ProvisionalPitchFeedback,
} from "../domain/live-feedback";

/** Track fresh input on the clock, but publish only a change in visible guidance. */
export function useLivePitchFeedback(
  { frame, target, profile, elapsedSec, enabled }: LivePitchFeedbackInput,
  attemptToken: number,
): ProvisionalPitchFeedback | null {
  const machine = useRef(initialLivePitchFeedback);
  const attempt = useRef(attemptToken);
  const published = useRef<ProvisionalPitchFeedback | null>(null);
  const [feedback, setFeedback] = useState<ProvisionalPitchFeedback | null>(
    null,
  );

  useEffect(() => {
    if (attempt.current !== attemptToken) {
      attempt.current = attemptToken;
      machine.current = initialLivePitchFeedback;
    }
    machine.current = updateLivePitchFeedback(machine.current, {
      frame,
      target,
      profile,
      elapsedSec,
      enabled,
    });
    const next = machine.current.feedback;
    if (
      published.current?.stageEventId !== next?.stageEventId ||
      published.current?.pitchMatches !== next?.pitchMatches
    ) {
      published.current = next;
      setFeedback(next);
    }
  }, [frame, target, profile, elapsedSec, enabled, attemptToken]);

  return feedback;
}
