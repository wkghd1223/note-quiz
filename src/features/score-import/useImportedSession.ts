"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  ChallengeAudioSession,
  type ChallengeAudioError,
} from "@/features/challenge/audio/microphone";
import { playbackAudioTime } from "@/features/challenge/audio/playback-clock";
import { ImportedJudgment } from "./imported-judgment";
import { prepareImportedPiano } from "./imported-piano";
import type { ImportedTimeline } from "./types";

type Phase =
  | "ready"
  | "preparing"
  | "countIn"
  | "playing"
  | "preview"
  | "paused"
  | "result"
  | "error";
interface SessionView {
  phase: Phase;
  elapsed: number;
  count: number | null;
  error: ChallengeAudioError | null;
  results: Readonly<Record<string, boolean>>;
}
const ready = (): SessionView => ({
  phase: "ready",
  elapsed: 0,
  count: null,
  error: null,
  results: {},
});

/** Owns a single imported-score revision. One AudioContext clocks the cues,
 * preview and capture timestamps. Consecutive visits to a bar use separate
 * prepared targets, so stopping or replaying cannot inherit an old result. */
export class ImportedPracticeSession {
  private view = ready();
  private listeners = new Set<() => void>();
  private audio: ChallengeAudioSession | null = null;
  private activeTimeline: ImportedTimeline | null = null;
  private judgment: ImportedJudgment | null = null;
  private generation = 0;
  private animation = 0;
  private zeroAudioSec: number | null = null;
  private baseElapsed = 0;

  constructor(private readonly timeline: ImportedTimeline | null) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.view;
  private update(update: Partial<SessionView>) {
    this.view = { ...this.view, ...update };
    for (const listener of this.listeners) listener();
  }
  private release() {
    this.generation++;
    if (this.animation) cancelAnimationFrame(this.animation);
    this.animation = 0;
    this.audio?.dispose();
    this.audio = null;
    this.activeTimeline = null;
    this.zeroAudioSec = null;
  }
  private position() {
    if (!this.audio || !this.activeTimeline || this.zeroAudioSec === null)
      return this.view.elapsed;
    return Math.min(
      this.activeTimeline.durationSec,
      Math.max(
        this.baseElapsed,
        this.view.elapsed,
        playbackAudioTime(this.audio.context) - this.zeroAudioSec,
      ),
    );
  }
  stop = () => {
    this.release();
    this.judgment = null;
    this.update(ready());
  };
  pause = () => {
    if (this.view.phase !== "playing" && this.view.phase !== "countIn") return;
    const elapsed = this.position();
    this.release();
    this.judgment?.breakCapture();
    this.update({ phase: "paused", elapsed, count: null });
  };
  resume = () => {
    if (this.view.phase === "paused")
      void this.begin("practice", this.view.elapsed, true);
  };
  start = () => {
    if (["ready", "result", "error"].includes(this.view.phase))
      void this.begin("practice", 0, false);
  };
  preview = (override?: ImportedTimeline) => {
    if (
      this.view.phase === "preview" &&
      (!override || override === this.activeTimeline)
    )
      this.stop();
    else if (["ready", "result", "error", "preview"].includes(this.view.phase))
      void this.begin("preview", 0, false, override ?? this.timeline);
  };
  suspend = () => {
    if (this.view.phase === "preview" || this.view.phase === "preparing")
      this.stop();
    else this.pause();
  };

  private async begin(
    mode: "practice" | "preview",
    offset: number,
    resuming: boolean,
    timeline = this.timeline,
  ) {
    if (!timeline?.targets.length || !(timeline.durationSec > 0)) return;
    this.release();
    this.activeTimeline = timeline;
    const token = this.generation;
    const current = () => this.generation === token;
    const fail = (error: ChallengeAudioError) => {
      if (!current()) return;
      const elapsed = this.position();
      this.release();
      this.update({ phase: "error", count: null, elapsed, error });
    };
    this.baseElapsed = offset;
    if (!resuming)
      this.judgment =
        mode === "practice" ? new ImportedJudgment(timeline.targets) : null;
    this.update({
      ...(!resuming && ready()),
      phase: "preparing",
      error: null,
      elapsed: offset,
    });
    if (typeof AudioContext === "undefined") return fail("unsupported");
    try {
      const audio = new ChallengeAudioSession({
        onFrame: () => {},
        onEvent: () => {},
        onSamples: (pcm, rate, frame, gate) => {
          if (!current() || this.zeroAudioSec === null || !this.judgment)
            return;
          this.judgment.accept(pcm, rate, frame, gate, this.zeroAudioSec);
        },
        onError: (error) => {
          if (!current()) return;
          if (
            error === "suspended" &&
            ["playing", "countIn"].includes(this.view.phase)
          )
            this.pause();
          else fail(error);
        },
      });
      this.audio = audio;
      let playPreview: ((through: number) => void) | null = null;
      let start: number;
      if (mode === "preview") {
        await audio.resume();
        if (!current()) return;
        const notes = [...timeline.notes].sort(
          (a, b) => a.startSec - b.startSec,
        );
        const sound = await prepareImportedPiano(audio.context, notes, current);
        if (!current()) return;
        start = audio.context.currentTime + 0.08;
        let index = 0;
        playPreview = (through) => {
          while (
            index < notes.length &&
            start + notes[index].startSec <= through
          ) {
            const note = notes[index++];
            const at = Math.max(
              audio.context.currentTime,
              start + note.startSec,
            );
            const duration = start + note.endSec - at;
            if (duration > 0) sound(note.midi, at, duration);
          }
        };
        this.update({ phase: "preview" });
      } else {
        if (!(await audio.connectMicrophone())) return fail("audio-error");
        if (!current()) return;
        const { pulses, pulseSec } = timeline.countIn;
        const first = audio.context.currentTime + 0.08;
        start = first + pulses * pulseSec;
        for (let beat = 0; beat < pulses; beat++)
          audio.beatCue(first + beat * pulseSec, beat === 0 ? "bar" : "beat");
        audio.beginCollection("import", start);
        this.update({ phase: "countIn", count: pulses });
      }
      this.zeroAudioSec = start - offset;
      let settled = this.judgment?.settledCount ?? 0;
      const cues = timeline.beatCues ?? [];
      let nextCue = cues.findIndex((cue) => cue.timeSec >= offset);
      if (nextCue < 0) nextCue = cues.length;
      const tick = () => {
        if (!current()) return;
        const clock = audio.context.currentTime;
        const presented = playbackAudioTime(audio.context);
        const elapsed = this.position();
        playPreview?.(clock + 0.35);
        while (nextCue < cues.length) {
          const cue = cues[nextCue];
          const when = start + cue.timeSec - offset;
          if (when > clock + 0.35) break;
          // Missed lookahead deadlines must not burst a backlog of clicks.
          if (when >= clock - 0.035)
            audio.beatCue(Math.max(when, clock), cue.kind);
          nextCue++;
        }
        const phase =
          mode === "preview"
            ? "preview"
            : presented < start
              ? "countIn"
              : "playing";
        const count =
          phase === "countIn"
            ? Math.min(
                timeline.countIn.pulses,
                Math.ceil((start - presented) / timeline.countIn.pulseSec),
              )
            : null;
        const end = start + timeline.durationSec - offset;
        if (
          presented >= end &&
          (mode === "preview" || audio.processedThroughAudioSec >= end)
        ) {
          if (this.judgment) {
            this.judgment.finish();
            const results = { ...this.judgment.results };
            this.release();
            this.update({
              phase: "result",
              elapsed: timeline.durationSec,
              count: null,
              results,
            });
          } else this.stop();
          return;
        }
        // A stopped worklet must not leave the page waiting indefinitely or
        // produce silent successful rests without any captured frames.
        if (mode === "practice" && clock > end + 0.75)
          return fail("audio-error");
        const changed = this.judgment && this.judgment.settledCount !== settled;
        if (
          changed ||
          phase !== this.view.phase ||
          count !== this.view.count ||
          elapsed - this.view.elapsed >= 0.025
        ) {
          settled = this.judgment?.settledCount ?? 0;
          this.update({
            phase,
            count,
            elapsed,
            ...(changed && { results: { ...this.judgment!.results } }),
          });
        }
        this.animation = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      fail("audio-error");
    }
  }
}

export function useImportedSession(timeline: ImportedTimeline | null) {
  const session = useMemo(
    () => new ImportedPracticeSession(timeline),
    [timeline],
  );
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) session.suspend();
    };
    document.addEventListener("visibilitychange", hidden);
    const blur = () => {
      if (session.getSnapshot().phase !== "preparing") session.suspend();
    };
    window.addEventListener("blur", blur);
    window.addEventListener("pagehide", session.suspend);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pagehide", session.suspend);
      session.stop();
    };
  }, [session]);
  return {
    ...state,
    start: session.start,
    preview: session.preview,
    pause: session.pause,
    resume: session.resume,
    stop: session.stop,
  };
}
