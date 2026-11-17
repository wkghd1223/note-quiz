import { create } from "zustand";
import { getStage } from "../data/stages";
import type { ExerciseDefinition } from "../domain/stage";
import {
  getInstrumentProfile,
  getScoringProfile,
  supportsStage,
} from "../domain/instrument-profile";
import {
  buildPlaybackTimeline,
  filterPlaybackInput,
  playbackTransitionAt,
} from "../domain/score-timeline";
import { validatePlaybackNavigation } from "../domain/playback-order";
import { scoreAttempt } from "../domain/scoring";
import { LiveAttemptScorer } from "../domain/live-scoring";
import type {
  AttemptResult,
  InputMethod,
  PerformanceEvent,
} from "../domain/performance";
export type ChallengePhase =
  | "landing"
  | "permission"
  | "calibration"
  | "preview"
  | "countIn"
  | "playing"
  | "paused"
  | "evaluating"
  | "result"
  | "error";
export interface StartAttemptOptions {
  stageId: string;
  profileId: string;
  inputMethod: InputMethod;
  mode: "challenge" | "rehearsal";
  tempoScale?: 0.7 | 0.85 | 1;
  inputOffsetMs?: number;
}
interface ChallengeState {
  phase: ChallengePhase;
  stageId: string | null;
  attemptToken: number;
  segmentToken: number;
  mode: "challenge" | "rehearsal";
  tempoScale: 0.7 | 0.85 | 1;
  profileId: string;
  inputMethod: InputMethod;
  inputOffsetMs: number;
  events: PerformanceEvent[];
  liveResult: AttemptResult | null;
  result: AttemptResult | null;
  error: string | null;
  elapsedSec: number;
  segmentStartAudioSec: number | null;
  selectStage: (id: string) => void;
  setPhase: (phase: "permission" | "calibration" | "preview") => void;
  startAttempt: (options: StartAttemptOptions) => number;
  beginPlaying: (token: number, audioStartSec: number) => boolean;
  addEvent: (
    token: number,
    segmentToken: number,
    event: PerformanceEvent,
  ) => boolean;
  advanceJudgments: (
    token: number,
    segmentToken: number,
    audioNowSec: number,
    finalizedBeforeAudioSec: number,
  ) => void;
  pause: (token: number, audioNowSec: number) => boolean;
  resume: (token: number) => boolean;
  getElapsed: (audioNowSec: number) => number;
  finish: (token: number, audioNowSec?: number) => AttemptResult | null;
  fail: (reason: string) => void;
  reset: () => void;
}
const initial = () => ({
  phase: "landing" as ChallengePhase,
  stageId: null as string | null,
  mode: "challenge" as const,
  tempoScale: 1 as const,
  profileId: "touch-keyboard",
  inputMethod: "touch" as InputMethod,
  inputOffsetMs: 0,
  events: [] as PerformanceEvent[],
  liveResult: null as AttemptResult | null,
  result: null as AttemptResult | null,
  error: null as string | null,
  elapsedSec: 0,
  segmentStartAudioSec: null as number | null,
});
export function createChallengeStore(exercise?: ExerciseDefinition) {
  let liveScorer: LiveAttemptScorer | null = null;
  // An explicit exercise is isolated from the curriculum catalog, even on ID
  // collision. Every lifecycle operation must resolve the same musical data.
  const resolveExercise = (id: string | null) =>
    exercise ? (id === exercise.id ? exercise : undefined) : getStage(id ?? "");
  return create<ChallengeState>((set, get) => ({
    ...initial(),
    attemptToken: 0,
    segmentToken: 0,
    selectStage: (id) => {
      const s = get();
      liveScorer = null;
      set({
        ...initial(),
        stageId: resolveExercise(id) ? id : null,
        attemptToken: s.attemptToken + 1,
        segmentToken: s.segmentToken + 1,
        error: resolveExercise(id) ? null : "invalidStage",
      });
    },
    setPhase: (phase) => {
      if (
        [
          "landing",
          "permission",
          "calibration",
          "preview",
          "error",
          "result",
        ].includes(get().phase)
      )
        set({ phase, error: null });
    },
    startAttempt: (options) => {
      const old = get(),
        token = old.attemptToken + 1,
        stage = resolveExercise(options.stageId),
        profile = getInstrumentProfile(options.profileId);
      const tempo =
        options.mode === "challenge" ? 1 : (options.tempoScale ?? 1);
      const offset = options.inputOffsetMs ?? 0;
      const allowed =
        stage &&
        profile &&
        // Supplied runtime exercises currently belong to voice-only melody
        // practice. Legacy catalog attempts retain their existing profiles.
        (!exercise || profile.id === "voice") &&
        ["challenge", "rehearsal"].includes(options.mode) &&
        [0.7, 0.85, 1].includes(tempo) &&
        Number.isFinite(offset) &&
        Math.abs(offset) <= 250 &&
        supportsStage(stage, profile, options.inputMethod) &&
        validatePlaybackNavigation(stage).length === 0;
      liveScorer =
        allowed && exercise
          ? new LiveAttemptScorer(
              buildPlaybackTimeline(stage, profile, 0, tempo).targets,
              getScoringProfile(stage, options.profileId),
              offset,
            )
          : null;
      set({
        ...initial(),
        ...options,
        tempoScale: tempo,
        inputOffsetMs: offset,
        attemptToken: token,
        segmentToken: old.segmentToken + 1,
        phase: allowed ? "countIn" : "error",
        error: allowed ? null : "unsupportedInput",
      });
      return token;
    },
    beginPlaying: (token, audioStartSec) => {
      const s = get();
      if (
        s.attemptToken !== token ||
        s.phase !== "countIn" ||
        !Number.isFinite(audioStartSec) ||
        audioStartSec < 0
      )
        return false;
      set({ phase: "playing", segmentStartAudioSec: audioStartSec });
      return true;
    },
    addEvent: (token, segmentToken, event) => {
      const s = get();
      if (
        token !== s.attemptToken ||
        segmentToken !== s.segmentToken ||
        s.phase !== "playing" ||
        s.segmentStartAudioSec === null ||
        event.inputMethod !== s.inputMethod ||
        !Number.isFinite(event.onsetAudioSec) ||
        event.onsetAudioSec < s.segmentStartAudioSec - 0.5 ||
        (event.offsetAudioSec !== null &&
          (!Number.isFinite(event.offsetAudioSec) ||
            event.offsetAudioSec <= event.onsetAudioSec))
      )
        return false;
      const shift = s.elapsedSec - s.segmentStartAudioSec;
      const mapped = {
        ...event,
        onsetAudioSec: event.onsetAudioSec + shift,
        offsetAudioSec:
          event.offsetAudioSec === null ? null : event.offsetAudioSec + shift,
        pitchSamples: event.pitchSamples?.map((sample) => ({
          ...sample,
          audioTimeSec: sample.audioTimeSec + shift,
        })),
      };
      const stage = resolveExercise(s.stageId),
        profile = getInstrumentProfile(s.profileId);
      if (!stage || !profile) return false;
      const playback = buildPlaybackTimeline(stage, profile, 0, s.tempoScale);
      if (
        playbackTransitionAt(
          playback.transitions,
          mapped.onsetAudioSec - s.inputOffsetMs / 1000,
        )
      )
        return false;
      // Worklet may update an open event; stable IDs replace rather than duplicate.
      set({
        events: [
          ...s.events.filter((e) => e.eventId !== event.eventId),
          mapped,
        ],
      });
      return true;
    },
    advanceJudgments: (token, segmentToken, audioNowSec, finalizedBefore) => {
      const s = get();
      if (
        !liveScorer ||
        token !== s.attemptToken ||
        segmentToken !== s.segmentToken ||
        s.phase !== "playing" ||
        s.segmentStartAudioSec === null ||
        !Number.isFinite(finalizedBefore)
      )
        return;
      const result = liveScorer.advance(
        s.events,
        finalizedBefore + s.elapsedSec - s.segmentStartAudioSec,
        s.getElapsed(audioNowSec),
      );
      if (result !== s.liveResult) set({ liveResult: result });
    },
    getElapsed: (audioNowSec) => {
      const s = get();
      return s.phase === "playing" &&
        s.segmentStartAudioSec !== null &&
        Number.isFinite(audioNowSec)
        ? s.elapsedSec + Math.max(0, audioNowSec - s.segmentStartAudioSec)
        : s.elapsedSec;
    },
    pause: (token, audioNowSec) => {
      const s = get();
      if (
        token !== s.attemptToken ||
        !["playing", "countIn"].includes(s.phase) ||
        !Number.isFinite(audioNowSec)
      )
        return false;
      const stage = resolveExercise(s.stageId),
        profile = getInstrumentProfile(s.profileId);
      if (!stage || !profile) return false;
      const playback = buildPlaybackTimeline(stage, profile, 0, s.tempoScale),
        timeline = playback.targets,
        elapsed = s.getElapsed(audioNowSec);
      const current = timeline.find((t) => t.endAudioSec > elapsed + 1e-9);
      const transition = playbackTransitionAt(playback.transitions, elapsed);
      const rewind =
        transition?.startAudioSec ??
        current?.startAudioSec ??
        playback.endAudioSec;
      const offsetSec = s.inputOffsetMs / 1000;
      set({
        phase: "paused",
        liveResult: liveScorer?.rewind(rewind) ?? null,
        elapsedSec: rewind,
        segmentStartAudioSec: null,
        segmentToken: s.segmentToken + 1,
        events: s.events.filter(
          (e) =>
            e.offsetAudioSec !== null &&
            e.offsetAudioSec - offsetSec <= rewind + 1e-9 &&
            e.onsetAudioSec - offsetSec < rewind,
        ),
      });
      return true;
    },
    resume: (token) => {
      const s = get();
      if (token !== s.attemptToken || s.phase !== "paused") return false;
      set({ phase: "countIn", segmentToken: s.segmentToken + 1 });
      return true;
    },
    finish: (token, audioNowSec) => {
      const s = get();
      if (token !== s.attemptToken) return null;
      if (s.phase === "result") return s.result;
      if (s.phase !== "playing") return null;
      const stage = resolveExercise(s.stageId),
        profile = getInstrumentProfile(s.profileId);
      if (!stage || !profile) return null;
      const playback = buildPlaybackTimeline(stage, profile, 0, s.tempoScale),
        timeline = playback.targets,
        end = playback.endAudioSec;
      if (
        audioNowSec !== undefined &&
        (!Number.isFinite(audioNowSec) ||
          s.getElapsed(audioNowSec) < end + 0.2 - 1e-9)
      )
        return null;
      set({ phase: "evaluating" });
      const events = filterPlaybackInput(
        s.events,
        playback.transitions,
        s.inputOffsetMs,
      );
      const result = liveScorer
        ? liveScorer.finish(events)
        : scoreAttempt(
            events,
            timeline,
            getScoringProfile(stage, s.profileId),
            s.inputOffsetMs,
          );
      set({
        phase: "result",
        result,
        liveResult: liveScorer ? result : null,
        elapsedSec: end,
        segmentStartAudioSec: null,
        segmentToken: s.segmentToken + 1,
      });
      return result;
    },
    fail: (reason) => {
      const s = get();
      liveScorer = null;
      set({
        phase: "error",
        error: reason,
        segmentStartAudioSec: null,
        attemptToken: s.attemptToken + 1,
        segmentToken: s.segmentToken + 1,
      });
    },
    reset: () => {
      const s = get();
      liveScorer = null;
      set({
        ...initial(),
        attemptToken: s.attemptToken + 1,
        segmentToken: s.segmentToken + 1,
      });
    },
  }));
}
export const useChallengeStore = createChallengeStore();
