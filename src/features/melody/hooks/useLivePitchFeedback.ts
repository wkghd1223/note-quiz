"use client";

import { useEffect, useRef, useState } from "react";
import type { MicrophoneInputQuality } from "@/lib/music/input-quality";
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
      published.current?.direction !== next?.direction
    ) {
      published.current = next;
      setFeedback(next);
    }
  }, [frame, target, profile, elapsedSec, enabled, attemptToken]);

  return feedback;
}

/** Quality comes from the capture's energy/periodicity policy; the UI only expires it. */
export function useFreshInputQuality(
  frame: LivePitchFeedbackInput["frame"],
  elapsedSec: number,
  enabled: boolean,
): MicrophoneInputQuality {
  const clock = useRef<{
    audio: number | null;
    seen: number | null;
    elapsed: number;
  }>({ audio: null, seen: null, elapsed: 0 });
  const [quality, setQuality] = useState<MicrophoneInputQuality>("inactive");
  const publishedQuality = useRef<MicrophoneInputQuality>("inactive");
  useEffect(() => {
    const previous = clock.current;
    const time =
      frame && Number.isFinite(frame.audioTimeSec)
        ? frame.audioTimeSec
        : undefined;
    const fresh =
      time !== undefined &&
      Number.isFinite(time) &&
      (previous.audio === null || time > previous.audio);
    const seen = !enabled ? null : fresh ? elapsedSec : previous.seen;
    const valid =
      enabled &&
      Number.isFinite(elapsedSec) &&
      elapsedSec >= previous.elapsed &&
      time !== undefined &&
      Number.isFinite(time) &&
      (previous.audio === null || time >= previous.audio) &&
      seen !== null &&
      elapsedSec - seen < 0.2;
    clock.current = {
      audio: time ?? previous.audio,
      seen,
      elapsed: elapsedSec,
    };
    const next = valid ? (frame?.inputQuality ?? "uncertain") : "inactive";
    if (publishedQuality.current !== next) {
      publishedQuality.current = next;
      setQuality(next);
    }
  }, [frame, elapsedSec, enabled]);
  return enabled && frame ? quality : "inactive";
}
