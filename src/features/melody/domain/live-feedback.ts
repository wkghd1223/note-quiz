import type { ScoringProfile } from "@/features/challenge/domain/instrument-profile";
import type {
  AttemptResult,
  InputFrame,
  TargetEvent,
} from "@/features/challenge/domain/performance";

/** Pitch guidance only; never an onset/duration judgment or a scored event. */
export interface ProvisionalPitchFeedback {
  stageEventId: string;
  pitchMatches: boolean;
  direction: "match" | "higher" | "lower";
}

export interface LivePitchFeedbackState {
  frameAudioSec: number | null;
  frameSeenElapsedSec: number | null;
  targetId: string | null;
  candidate: ProvisionalPitchFeedback | null;
  feedback: ProvisionalPitchFeedback | null;
}

export const initialLivePitchFeedback: LivePitchFeedbackState = {
  frameAudioSec: null,
  frameSeenElapsedSec: null,
  targetId: null,
  candidate: null,
  feedback: null,
};

export interface LivePitchFeedbackInput {
  frame: InputFrame | null;
  target: TargetEvent | null;
  profile: ScoringProfile;
  elapsedSec: number;
  enabled: boolean;
}

// UI frames arrive roughly every 50 ms. Clear missing input after four frames;
// compare elapsed-clock deltas, never absolute capture and playback clocks.
const staleAfterSec = 0.2;

/** Call on the playback UI tick, with enabled true only during microphone play.
 * Two distinct reliable frames of the same classification confirm a color.
 * Silence/uncertainty clears it immediately, without holding an old green.
 */
export function updateLivePitchFeedback(
  previous: LivePitchFeedbackState,
  { frame, target, profile, elapsedSec, enabled }: LivePitchFeedbackInput,
): LivePitchFeedbackState {
  const frameAudioSec =
    frame && Number.isFinite(frame.audioTimeSec) ? frame.audioTimeSec : null;
  const freshFrame =
    frameAudioSec !== null &&
    (previous.frameAudioSec === null || frameAudioSec > previous.frameAudioSec);
  const sameTarget = previous.targetId === target?.stageEventId;
  const frameSeenElapsedSec = freshFrame
    ? elapsedSec
    : previous.frameSeenElapsedSec;
  const state: LivePitchFeedbackState = {
    frameAudioSec: frameAudioSec ?? previous.frameAudioSec,
    frameSeenElapsedSec,
    targetId: target?.stageEventId ?? null,
    candidate: null,
    feedback: null,
  };
  if (
    !enabled ||
    !Number.isFinite(elapsedSec) ||
    !target ||
    target.kind !== "note" ||
    elapsedSec < target.startAudioSec ||
    elapsedSec >= target.endAudioSec ||
    !profile.supported ||
    profile.inputMethod !== "microphone" ||
    !Number.isFinite(profile.pitchToleranceCents) ||
    profile.pitchToleranceCents <= 0 ||
    !Number.isFinite(profile.confidenceThreshold) ||
    profile.confidenceThreshold < 0 ||
    profile.confidenceThreshold > 1 ||
    !Number.isInteger(target.targetConcertMidi) ||
    target.targetConcertMidi! < 0 ||
    target.targetConcertMidi! > 127 ||
    !frame ||
    !frame.isVoiced ||
    (frame.inputQuality !== undefined && frame.inputQuality !== "stable") ||
    !Number.isFinite(frame.rms) ||
    frame.rms <= 0 ||
    !Number.isFinite(frame.confidence) ||
    frame.confidence < profile.confidenceThreshold ||
    frame.confidence > 1 ||
    frame.detectedHz === null ||
    !Number.isFinite(frame.detectedHz) ||
    frame.detectedHz <= 0 ||
    frameAudioSec === null ||
    frameSeenElapsedSec === null ||
    (previous.frameSeenElapsedSec !== null &&
      elapsedSec < previous.frameSeenElapsedSec) ||
    elapsedSec < frameSeenElapsedSec ||
    elapsedSec - frameSeenElapsedSec >= staleAfterSec ||
    (previous.frameAudioSec !== null && frameAudioSec < previous.frameAudioSec)
  )
    return state;

  // A previous target's held frame must not color the new target.
  if (!freshFrame)
    return sameTarget
      ? { ...state, candidate: previous.candidate, feedback: previous.feedback }
      : state;

  const measuredMidi = 69 + 12 * Math.log2(frame.detectedHz / 440);
  const cents = (measuredMidi - target.targetConcertMidi!) * 100;
  const matches = Math.abs(cents) <= profile.pitchToleranceCents + 1e-9;
  const candidate: ProvisionalPitchFeedback = {
    stageEventId: target.stageEventId,
    pitchMatches: matches,
    direction: matches ? "match" : cents > 0 ? "higher" : "lower",
  };
  return {
    ...state,
    candidate,
    feedback:
      sameTarget &&
      previous.frameSeenElapsedSec !== null &&
      elapsedSec - previous.frameSeenElapsedSec < staleAfterSec &&
      previous.candidate?.direction === candidate.direction
        ? candidate
        : null,
  };
}

/** Resolve occurrence identity and give finalized judgments precedence. */
export function visibleLivePitchFeedback(
  feedback: ProvisionalPitchFeedback | null,
  targets: readonly TargetEvent[],
  result: AttemptResult | null,
  elapsedSec: number,
): (ProvisionalPitchFeedback & { sourceEventId: string }) | null {
  if (!feedback || !Number.isFinite(elapsedSec)) return null;
  const target = targets.find(
    (candidate) => candidate.stageEventId === feedback.stageEventId,
  );
  if (
    !target ||
    target.kind !== "note" ||
    elapsedSec < target.startAudioSec ||
    elapsedSec >= target.endAudioSec ||
    result?.notes.some((note) => note.stageEventId === target.stageEventId)
  )
    return null;
  return {
    ...feedback,
    sourceEventId: target.sourceEventId ?? target.stageEventId,
  };
}
