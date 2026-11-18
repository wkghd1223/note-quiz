export const CONTINUOUS_NOTE_STABLE_SEC = 0.5;
export const CONTINUOUS_NOTE_QUIET_SEC = 0.12;
const MAX_OBSERVATION_GAP_SEC = 0.1;

export interface ContinuousNoteObservation {
  timeSec: number;
  /** Same actual MIDI + octave identity as hold capture, never a target note. */
  pitchKey: string | null;
  /** Below the owning input path's energy gate, not merely unpitched. */
  quiet: boolean;
  eligible: boolean;
  questionKey?: string;
}

/** Per-capture hands-free submission. No clock, target, callbacks or UI state.
 * Latching precedes the caller's submission. Question/lock changes discard a
 * pending candidate but never rearm a submitted voiced segment. Unknown loud
 * input, invalid frames and missing observations likewise retain that latch.
 */
export function createContinuousNoteGate() {
  let candidate: string | null = null;
  let candidateSince = 0;
  let quietSince: number | null = null;
  let latched: string | null = null;
  let lastTime = -Infinity;
  let lastQuestion: string | undefined;
  let wasEligible = false;
  return {
    observe(frame: ContinuousNoteObservation): boolean {
      const { timeSec, pitchKey, quiet, eligible, questionKey } = frame;
      if (!Number.isFinite(timeSec) || timeSec <= lastTime) {
        candidate = null;
        quietSince = null;
        return false;
      }
      if (timeSec - lastTime > MAX_OBSERVATION_GAP_SEC + 1e-9) {
        candidate = null;
        quietSince = null;
      }
      lastTime = timeSec;
      if (questionKey !== lastQuestion || eligible !== wasEligible)
        candidate = null;
      lastQuestion = questionKey;
      wasEligible = eligible;

      if (quiet) {
        quietSince ??= timeSec;
        candidate = null;
        if (timeSec - quietSince >= CONTINUOUS_NOTE_QUIET_SEC - 1e-9)
          latched = null;
        return false;
      }
      quietSince = null;
      if (!eligible || pitchKey === null || pitchKey === latched) {
        candidate = null;
        return false;
      }
      if (candidate !== pitchKey) {
        candidate = pitchKey;
        candidateSince = timeSec;
        return false;
      }
      if (timeSec - candidateSince < CONTINUOUS_NOTE_STABLE_SEC - 1e-9)
        return false;
      latched = pitchKey;
      candidate = null;
      return true;
    },
  };
}
