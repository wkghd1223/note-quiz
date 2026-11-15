"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChallengeAudioSession,
  type ChallengeAudioError,
} from "../audio/microphone";
import { TouchKeyboardInput } from "../input/touchKeyboard";
import {
  createChallengeStore,
  type StartAttemptOptions,
} from "../store/challengeStore";
import { getInstrumentProfile } from "../domain/instrument-profile";
import {
  buildPlaybackTimeline,
  playbackTransitionAt,
} from "../domain/score-timeline";
import { beatsPerMeasure, type ExerciseDefinition } from "../domain/stage";
import { emptyMicrophoneSignal } from "@/lib/music/microphoneSignal";
import type { ScorePreRoll } from "../components/score-scroll";
import type { InputFrame, PerformanceEvent } from "../domain/performance";
import { beatCues, type BeatCueOptions } from "../audio/beat-cues";
import { playbackAudioTime } from "../audio/playback-clock";

export function useChallengeSession(
  stage: ExerciseDefinition,
  cues: BeatCueOptions = {},
) {
  const { metronome = false, barBell = false } = cues;
  const useStore = useMemo(() => createChallengeStore(stage), [stage]);
  const state = useStore();
  const signal = useRef(emptyMicrophoneSignal());
  const [listening, setListening] = useState(false);
  const [countIn, setCountIn] = useState<{
    pulses: number;
    pulseQuarterBeats: number;
    durationSec: number;
  } | null>(null);
  const audio = useRef<ChallengeAudioSession | null>(null),
    touch = useRef<TouchKeyboardInput | null>(null);
  const raf = useRef(0),
    generation = useRef(0),
    scheduledStart = useRef<number | null>(null);
  const pendingEvents = useRef(new Map<string, PerformanceEvent>());
  const [scorePreRoll, setScorePreRoll] = useState<ScorePreRoll | null>(null);
  const isPreview = useRef(false);
  const presentedTime = useRef(0);
  const presentationTime = useCallback((context: AudioContext) => {
    // Timestamp support can become available just after resume. Never move
    // backwards when switching from the startup fallback to device time.
    presentedTime.current = Math.max(
      presentedTime.current,
      playbackAudioTime(context),
    );
    return presentedTime.current;
  }, []);
  const releaseTone = useRef<(() => void) | null>(null);
  const holdStart = useRef<number | null>(null),
    lastVisualFrame = useRef(-Infinity);
  const [heldDuration, setHeldDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0),
    [count, setCount] = useState<number | null>(null);
  const [frame, setFrame] = useState<InputFrame | null>(null),
    [heldMidi, setHeldMidi] = useState<number | null>(null);
  const [audioError, setAudioError] = useState<ChallengeAudioError | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [micReady, setMicReady] = useState(false),
    [previewing, setPreviewing] = useState(false),
    [previewPreparing, setPreviewPreparing] = useState(false),
    [previewFailed, setPreviewFailed] = useState(false);
  const stop = useCallback(() => {
    generation.current++;
    cancelAnimationFrame(raf.current);
    isPreview.current = false;
    presentedTime.current = 0;
    releaseTone.current?.();
    releaseTone.current = null;
    audio.current?.dispose();
    audio.current = null;
    touch.current?.cancel();
    touch.current = null;
    scheduledStart.current = null;
    pendingEvents.current.clear();
    setScorePreRoll(null);
    setCountIn(null);
    setListening(false);
    signal.current.rms = 0;
    signal.current.frequencyHz = null;
    signal.current.bins.fill(0);
    setHeldMidi(null);
    holdStart.current = null;
    lastVisualFrame.current = -Infinity;
    setHeldDuration(0);
    setFrame(null);
    setCount(null);
    setBusy(false);
    setMicReady(false);
    setPreviewing(false);
    setPreviewPreparing(false);
    setPreviewFailed(false);
  }, []);
  useEffect(() => {
    useStore.getState().selectStage(stage.id);
    return () => {
      stop();
      useStore.getState().reset();
    };
  }, [stage.id, stop, useStore]);
  const pause = useCallback(() => {
    if (isPreview.current) {
      stop();
      setElapsed(0);
      return;
    }
    const s = useStore.getState(),
      a = audio.current;
    if (a && ["playing", "countIn"].includes(s.phase)) {
      a.endCollection(false);
      touch.current?.cancel();
      s.pause(s.attemptToken, presentationTime(a.context));
      const canonical = useStore.getState().elapsedSec;
      stop();
      setElapsed(canonical);
    }
  }, [presentationTime, stop, useStore]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) pause();
    };
    const orientation = window.screen?.orientation;
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", pause);
    window.addEventListener("orientationchange", pause);
    orientation?.addEventListener("change", pause);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", pause);
      window.removeEventListener("orientationchange", pause);
      orientation?.removeEventListener("change", pause);
    };
  }, [pause]);
  const makeAudio = useCallback(
    (token?: number, segment?: number) => {
      const myGeneration = generation.current;
      // Each physical session captures immutable attempt/segment tokens. Late callbacks
      // from disposed sessions cannot be rebound to a newer attempt.
      const emit = (event: PerformanceEvent) => {
        if (
          myGeneration !== generation.current ||
          token === undefined ||
          segment === undefined
        )
          return;
        const live = useStore.getState();
        if (live.attemptToken !== token || live.segmentToken !== segment)
          return;
        const mapped = {
          ...event,
          eventId: `${token}-${segment}:${event.eventId}`,
        };
        // Capture can prepare before zero, but must not score count-in sounds.
        // Retain a complete measured event crossing zero if it arrives before
        // the first animation frame changes the public phase to playing.
        if (live.phase === "countIn") {
          const start = scheduledStart.current;
          if (
            start !== null &&
            (event.offsetAudioSec === null || event.offsetAudioSec > start)
          )
            pendingEvents.current.set(mapped.eventId, mapped);
          return;
        }
        live.addEvent(token, segment, mapped);
      };
      const a = new ChallengeAudioSession({
        signal: signal.current,
        onFrame: (next) => {
          if (myGeneration !== generation.current) return;
          if (next.isVoiced) holdStart.current ??= next.audioTimeSec;
          else holdStart.current = null;
          if (next.audioTimeSec - lastVisualFrame.current >= 0.05) {
            lastVisualFrame.current = next.audioTimeSec;
            setFrame(next);
          }
        },
        onEvent: emit,
        onError: (error) => {
          if (myGeneration !== generation.current) return;
          setAudioError(error);
          const s = useStore.getState();
          if (error === "suspended" && ["countIn", "playing"].includes(s.phase))
            pause();
          else {
            stop();
            s.fail(error);
          }
        },
      });
      audio.current = a;
      touch.current = new TouchKeyboardInput(emit);
      return a;
    },
    [pause, stop, useStore],
  );
  const checkMicrophone = useCallback(async () => {
    stop();
    setBusy(true);
    setAudioError(null);
    useStore.getState().setPhase("permission");
    const request = generation.current;
    try {
      const a = makeAudio();
      if ((await a.connectMicrophone()) && request === generation.current) {
        useStore.getState().setPhase("calibration");
        setMicReady(true);
        setListening(true);
      }
    } catch {
      if (request === generation.current) {
        setAudioError("unsupported");
        useStore.getState().fail("unsupported");
      }
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }, [makeAudio, stop, useStore]);
  const schedule = useCallback(
    async (token: number, segment: number) => {
      const s = useStore.getState(),
        profile = getInstrumentProfile(s.profileId)!;
      const request = generation.current;
      setBusy(true);
      setAudioError(null);
      try {
        const a = makeAudio(token, segment);
        await a.resume();
        if (request !== generation.current) return;
        if (s.inputMethod === "microphone" && !(await a.connectMicrophone()))
          return;
        if (request !== generation.current) return;
        if (s.inputMethod === "microphone") setListening(true);
        const quarterSec = 60 / (stage.bpm * s.tempoScale);
        const compound =
          stage.timeSignature[0] === 6 && stage.timeSignature[1] === 8;
        const pulseQuarterBeats = compound ? 1.5 : 1;
        const pulses = compound ? 2 : beatsPerMeasure(stage);
        const beat = quarterSec * pulseQuarterBeats;
        const durationSec = pulses * beat;
        const start = a.context.currentTime + 0.08 + durationSec;
        setCountIn({ pulses, pulseQuarterBeats, durationSec });
        scheduledStart.current = start;
        const base = s.elapsedSec;
        setCount(pulses);
        setScorePreRoll({
          remainingSec: durationSec,
          durationSec,
          baseElapsedSec: base,
        });
        for (let i = 0; i < pulses; i++)
          a.beatCue(start - (pulses - i) * beat, i === 0 ? "bar" : "beat");
        for (const cue of beatCues(
          stage,
          { metronome, barBell },
          s.tempoScale,
          base,
        ))
          a.beatCue(start + cue.timeSec - base, cue.kind);
        a.beginCollection(`${token}-${segment}`, start - 0.35);
        const playback = buildPlaybackTimeline(stage, profile, 0, s.tempoScale),
          end = playback.endAudioSec;
        const tick = () => {
          if (request !== generation.current) return;
          const now = presentationTime(a.context);
          setHeldDuration(
            holdStart.current === null
              ? 0
              : Math.max(0, now - holdStart.current),
          );
          const live = useStore.getState();
          const left = start - now;
          setCount(left > 0 ? Math.min(pulses, Math.ceil(left / beat)) : null);
          setScorePreRoll(
            left > 0
              ? {
                  remainingSec: Math.min(durationSec, left),
                  durationSec,
                  baseElapsedSec: base,
                }
              : null,
          );
          if (left <= 0) setCountIn(null);
          if (
            left <= 0 &&
            live.phase === "countIn" &&
            live.beginPlaying(token, start)
          ) {
            for (const event of pendingEvents.current.values())
              useStore.getState().addEvent(token, segment, event);
            pendingEvents.current.clear();
          }
          const position = left > 0 ? base : base + (now - start);
          setElapsed(Math.min(end, position));
          if (position >= end + 0.25) {
            touch.current?.release(now);
            setHeldMidi(null);
            a.endCollection(true);
            useStore.getState().finish(token, now);
            stop();
            setElapsed(end);
            return;
          }
          raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      } catch {
        if (request === generation.current) {
          setAudioError("audio-error");
          useStore.getState().fail("audio-error");
          stop();
        }
      } finally {
        if (request === generation.current) setBusy(false);
      }
    },
    [makeAudio, presentationTime, stage, stop, useStore, metronome, barBell],
  );
  const start = useCallback(
    (options: StartAttemptOptions) => {
      stop();
      setElapsed(0);
      setFrame(null);
      const token = useStore.getState().startAttempt(options);
      if (useStore.getState().phase !== "error")
        void schedule(token, useStore.getState().segmentToken);
    },
    [schedule, stop, useStore],
  );
  const resume = useCallback(() => {
    const s = useStore.getState();
    if (s.resume(s.attemptToken))
      void schedule(s.attemptToken, useStore.getState().segmentToken);
  }, [schedule, useStore]);
  const reset = useCallback(() => {
    stop();
    useStore.getState().selectStage(stage.id);
    setElapsed(0);
    setFrame(null);
    setAudioError(null);
  }, [stage.id, stop, useStore]);
  const confirmReady = useCallback(
    () => useStore.getState().setPhase("preview"),
    [useStore],
  );
  const down = useCallback(
    (key: string, midi: number) => {
      const s = useStore.getState(),
        a = audio.current;
      if (
        a &&
        s.phase === "playing" &&
        s.inputMethod === "touch" &&
        !playbackTransitionAt(
          buildPlaybackTimeline(
            stage,
            getInstrumentProfile(s.profileId)!,
            0,
            s.tempoScale,
          ).transitions,
          s.getElapsed(a.context.currentTime),
        ) &&
        touch.current?.down(key, midi, a.context.currentTime)
      ) {
        holdStart.current = a.context.currentTime;
        releaseTone.current = a.holdTone(midi);
        setHeldMidi(midi);
      }
    },
    [stage, useStore],
  );
  const up = useCallback((key: string) => {
    const a = audio.current;
    if (a && touch.current?.up(key, a.context.currentTime)) {
      releaseTone.current?.();
      releaseTone.current = null;
      setHeldMidi(null);
      holdStart.current = null;
      setHeldDuration(0);
    }
  }, []);
  const cancelKey = useCallback(() => {
    touch.current?.cancel();
    setHeldMidi(null);
    pause();
  }, [pause]);
  const example = useCallback(async () => {
    if (isPreview.current) {
      stop();
      setElapsed(0);
      return;
    }
    stop();
    setElapsed(0);
    isPreview.current = true;
    setPreviewPreparing(true);
    setBusy(true);
    setAudioError(null);
    const request = generation.current;
    try {
      const a = makeAudio();
      await a.resume();
      if (request !== generation.current) return;
      const playback = buildPlaybackTimeline(
        stage,
        getInstrumentProfile("touch-keyboard")!,
        0,
      );
      await a.preparePiano(
        playback.targets.flatMap((target) =>
          target.kind === "note"
            ? [
                {
                  midi: target.targetConcertMidi!,
                  durationSec:
                    (target.endAudioSec - target.startAudioSec) * 0.95,
                },
              ]
            : [],
        ),
      );
      if (request !== generation.current) return;
      // Preparation may fetch/decode samples; establish zero only after it ends.
      const start = a.context.currentTime + 0.08;
      for (const target of playback.targets)
        if (target.kind === "note")
          a.pianoTone(
            target.targetConcertMidi!,
            start + target.startAudioSec,
            (target.endAudioSec - target.startAudioSec) * 0.95,
          );
      for (const cue of beatCues(stage, { metronome, barBell }))
        a.beatCue(start + cue.timeSec, cue.kind);
      isPreview.current = true;
      setPreviewing(true);
      const tick = () => {
        if (request !== generation.current) return;
        const elapsed = Math.max(0, presentationTime(a.context) - start);
        setElapsed(Math.min(playback.durationSec, elapsed));
        if (elapsed >= playback.durationSec + 0.2) {
          stop();
          setElapsed(0);
          return;
        }
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    } catch {
      if (request === generation.current) {
        setAudioError("audio-error");
        stop();
        setPreviewFailed(true);
      }
    } finally {
      if (request === generation.current) {
        setBusy(false);
        setPreviewPreparing(false);
      }
    }
  }, [makeAudio, presentationTime, stage, stop, metronome, barBell]);
  return {
    state,
    elapsed,
    count,
    scorePreRoll,
    countIn,
    signal,
    listening,
    frame,
    heldMidi,
    heldDuration,
    audioError,
    busy,
    micReady,
    previewing,
    previewPreparing,
    previewFailed,
    start,
    pause,
    resume,
    reset,
    checkMicrophone,
    confirmReady,
    example,
    down,
    up,
    cancelKey,
  };
}
