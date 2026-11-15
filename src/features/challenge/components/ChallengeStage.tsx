"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { localizedHref } from "@/lib/i18n/locale";
import { challengeCopy, type ChallengeCopy } from "../i18n";
import { getStage, stages } from "../data/stages";
import {
  getInstrumentProfile,
  instrumentProfiles,
  supportsStage,
} from "../domain/instrument-profile";
import { buildPlaybackTimeline } from "../domain/score-timeline";
import { scoreAttempt } from "../domain/scoring";
import { getScoringProfile } from "../domain/instrument-profile";
import { isStageUnlocked, recordKey } from "../store/progress";
import { useChallengeProgress } from "../hooks/useChallengeProgress";
import { useChallengeSession } from "../hooks/useChallengeSession";
import ChallengeShell, {
  primaryButton,
  secondaryButton,
} from "./ChallengeShell";
import ScoreViewport from "./ScoreViewport";
import TouchKeyboard, { keyboardNotes } from "./TouchKeyboard";

const profileCopy: Record<string, keyof ChallengeCopy> = {
  "touch-keyboard": "touch",
  voice: "voice",
  flute: "flute",
  "piano-mic": "pianoMic",
  "guitar-mic": "guitarMic",
  "percussion-mic": "percussionMic",
};
const pitchName = (midi: number) =>
  `${["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][midi % 12]}${Math.floor(midi / 12) - 1}`;
export default function ChallengeStage({ stageId }: { stageId: string }) {
  const stage = getStage(stageId)!;
  const { language, locale } = useTranslation(),
    c = challengeCopy(language),
    router = useRouter();
  const p = useChallengeProgress(),
    session = useChallengeSession(stage),
    s = session.state;
  const { record } = p;
  const {
    start: startSession,
    reset: resetSession,
    down: noteDown,
    up: noteUp,
    pause: pauseSession,
    resume: resumeSession,
  } = session;
  const [mode, setMode] = useState<"challenge" | "rehearsal">("challenge"),
    [scale, setScale] = useState<0.7 | 0.85 | 1>(0.85),
    [notationError, setNotationError] = useState(false),
    [readyStage, setReadyStage] = useState<string | null>(null),
    [notationRevision, setNotationRevision] = useState(0);
  const recorded = useRef<number | null>(null),
    resultHeading = useRef<HTMLHeadingElement>(null);
  const profile =
    getInstrumentProfile(p.progress.selectedInstrumentProfileId) ??
    instrumentProfiles[2];
  const input = profile.recommendedInput,
    supported = supportsStage(stage, profile, input),
    unlocked = isStageUnlocked(stage.id, p.progress);
  const active = ["countIn", "playing", "paused", "evaluating"].includes(
      s.phase,
    ),
    running = ["countIn", "playing"].includes(s.phase);
  const activeScale =
    active || s.phase === "result"
      ? s.tempoScale
      : mode === "challenge"
        ? 1
        : scale;
  const playback = useMemo(
    () => buildPlaybackTimeline(stage, profile, 0, activeScale),
    [stage, profile, activeScale],
  );
  const timeline = playback.targets;
  const rewind = playback.transitions.find(
    (transition) =>
      session.elapsed >= transition.startAudioSec &&
      session.elapsed < transition.endAudioSec,
  );
  const target =
    timeline.find((event) => event.endAudioSec > session.elapsed + 0.0001) ??
    timeline[timeline.length - 1];
  const targetEvent = stage.events.find(
    (event) => event.id === (target.sourceEventId ?? target.stageEventId),
  )!;
  const nextTarget = timeline[timeline.indexOf(target) + 1];
  const next =
    nextTarget &&
    stage.events.find(
      (event) =>
        event.id === (nextTarget.sourceEventId ?? nextTarget.stageEventId),
    );
  const best = p.progress.records[recordKey(stage.id, profile.id, input)];
  const nextStage =
    stages[stages.findIndex((candidate) => candidate.id === stage.id) + 1];
  const detected =
    session.heldMidi ??
    (session.frame?.detectedHz
      ? Math.round(69 + 12 * Math.log2(session.frame.detectedHz / 440))
      : null);
  const liveResult = useMemo(
    () =>
      active
        ? (() => {
            const evaluated = scoreAttempt(
              s.events,
              timeline,
              getScoringProfile(stage, s.profileId),
              s.inputOffsetMs,
            );
            return {
              ...evaluated,
              notes: evaluated.notes.filter((note) => {
                const ended = timeline.find(
                  (event) => event.stageEventId === note.stageEventId,
                )!.endAudioSec;
                // Wait for released input before announcing a judgment. A held
                // microphone event is still collecting its duration samples.
                return (
                  ended <= session.elapsed &&
                  (note.eventId !== null ||
                    (session.heldDuration === 0 &&
                      ended + 0.45 <= session.elapsed) ||
                    s.events.some((event) => event.onsetAudioSec > ended))
                );
              }),
            };
          })()
        : null,
    [
      s.events,
      s.inputOffsetMs,
      s.profileId,
      stage,
      timeline,
      session.elapsed,
      session.heldDuration,
      active,
    ],
  );
  const notationReady = readyStage === stage.id;
  const onNotationReady = useCallback(
    () => setReadyStage(stage.id),
    [stage.id],
  );
  const onNotationError = useCallback(() => {
    setNotationError(true);
    setReadyStage(null);
    pauseSession();
  }, [pauseSession]);
  useEffect(() => {
    if (
      s.phase !== "result" ||
      !s.result ||
      recorded.current === s.attemptToken
    )
      return;
    recorded.current = s.attemptToken;
    record({
      stageId: stage.id,
      profileId: s.profileId,
      inputMethod: s.inputMethod,
      mode: s.mode,
      result: s.result,
      completedAt: new Date().toISOString(),
    });
    resultHeading.current?.focus();
  }, [
    s.phase,
    s.result,
    s.attemptToken,
    s.profileId,
    s.inputMethod,
    s.mode,
    stage.id,
    record,
  ]);
  const begin = useCallback(
    (attemptMode = mode, tempo = scale) => {
      if (
        !p.hydrated ||
        !supported ||
        notationError ||
        !notationReady ||
        (attemptMode === "challenge" && !unlocked)
      )
        return;
      startSession({
        stageId: stage.id,
        profileId: profile.id,
        inputMethod: input,
        mode: attemptMode,
        tempoScale: tempo,
        inputOffsetMs: p.progress.settings.inputOffsetMs,
      });
    },
    [
      mode,
      scale,
      p.hydrated,
      p.progress.settings.inputOffsetMs,
      supported,
      notationError,
      notationReady,
      unlocked,
      startSession,
      stage.id,
      profile.id,
      input,
    ],
  );
  const leave = useCallback(() => {
    if (!active || window.confirm(c.leaveConfirm)) {
      resetSession();
      router.push(localizedHref(`/challenge/world/w${stage.world}`, locale));
    }
  }, [active, c.leaveConfirm, resetSession, router, stage.world, locale]);
  useEffect(() => {
    const form = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.matches("input,select,textarea") || target.isContentEditable);
    const down = (event: KeyboardEvent) => {
      if (
        form(event.target) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat
      )
        return;
      const key = event.key.toLowerCase(),
        note = keyboardNotes.find((n) => n.key === key);
      if (note && input === "touch" && s.phase === "playing") {
        event.preventDefault();
        noteDown(`key-${key}`, note.midi);
      } else if (event.code === "Space" && active) {
        if (
          event.target instanceof HTMLElement &&
          event.target.closest("button,a")
        )
          return;
        event.preventDefault();
        if (s.phase === "paused") resumeSession();
        else pauseSession();
      } else if (key === "r" && active) {
        event.preventDefault();
        begin();
      } else if (key === "escape") {
        event.preventDefault();
        leave();
      }
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (keyboardNotes.some((n) => n.key === key)) noteUp(`key-${key}`);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [
    active,
    s.phase,
    input,
    noteDown,
    noteUp,
    pauseSession,
    resumeSession,
    begin,
    leave,
  ]);
  const errors: Record<string, string> = {
    denied: c.denied,
    "missing-device": c.missingDevice,
    "device-busy": c.deviceBusy,
    unsupported: c.unsupported,
    suspended: c.audioError,
    "audio-error": c.audioError,
  };
  return (
    <ChallengeShell>
      <div
        data-challenge-phase={s.phase}
        data-stage-id={stage.id}
        data-elapsed-seconds={session.elapsed.toFixed(4)}
        data-challenge-mode={s.mode}
        className={`min-w-0 motion-reduce:[&_*]:transition-none ${p.progress.settings.reducedMotion ? "[&_*]:!transition-none" : ""}`}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              onClick={leave}
              className="inline-flex min-h-12 items-center text-sm font-semibold text-violet-800"
            >
              ‹ {c.worldTitles[stage.world - 1]}
            </button>
            <p className="text-sm text-slate-500">
              {stage.world}—{String(stage.sequence).padStart(2, "0")} ·{" "}
              {stage.bpm} BPM · 4/4
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              {c.stagesById[stage.id].title}
            </h1>
          </div>
          <span className="pt-3 text-sm text-slate-600">
            {c.best}{" "}
            <span className="font-semibold text-violet-900">
              {best?.bestScore ?? "—"}
            </span>
            <span
              className="mt-1 block text-lg text-violet-800"
              aria-label={`${best?.bestStars ?? 0}/3`}
            >
              {"★".repeat(best?.bestStars ?? 0)}
              {"☆".repeat(3 - (best?.bestStars ?? 0))}
            </span>
          </span>
        </div>
        {p.warning && (
          <p
            role="status"
            className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
          >
            {c.storageWarning}
          </p>
        )}
        {!active && s.phase !== "result" && (
          <p className="mb-5 max-w-2xl text-slate-600">
            {c.stagesById[stage.id].objective}
          </p>
        )}
        <ScoreViewport
          key={`${stage.id}-${notationRevision}`}
          stage={stage}
          targets={timeline}
          transitions={playback.transitions}
          elapsed={session.elapsed}
          active={active}
          finished={s.phase === "result"}
          reducedMotion={p.progress.settings.reducedMotion}
          result={s.result ?? liveResult}
          c={c}
          onError={onNotationError}
          onReady={onNotationReady}
        />
        {notationError && (
          <div role="alert" className="mt-3 rounded-xl bg-amber-50 p-4">
            <p>{c.loadError}</p>
            <button
              className={`${secondaryButton} mt-3`}
              onClick={() => {
                setNotationError(false);
                setReadyStage(null);
                setNotationRevision((v) => v + 1);
              }}
            >
              {c.retry}
            </button>
          </div>
        )}
        <ol
          className={
            running
              ? "sr-only"
              : "mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600"
          }
          aria-label={c.stages}
        >
          {stage.events.map((event) => (
            <li
              key={event.id}
              data-event-id={event.id}
              data-start-beat={event.startBeat}
              data-duration-beats={event.durationBeats}
              data-midi={event.writtenMidi ?? "rest"}
            >
              {event.writtenSpelling ?? c.rest} · {event.durationBeats} ♩
            </li>
          ))}
        </ol>
        {session.audioError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4"
          >
            <p>{errors[session.audioError]}</p>
            <button
              className={`${secondaryButton} mt-3`}
              onClick={() => {
                session.reset();
                p.update((previous) => ({
                  ...previous,
                  selectedInstrumentProfileId: "touch-keyboard",
                }));
              }}
            >
              {c.touch}
            </button>
          </div>
        )}
        {!active && s.phase !== "result" && (
          <section
            className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
            aria-label={c.input}
          >
            <label className="block font-semibold" htmlFor="challenge-input">
              {c.input}
            </label>
            <select
              id="challenge-input"
              value={profile.id}
              disabled={session.busy}
              className="min-h-12 w-full min-w-0 rounded-lg border border-slate-300 bg-white p-3 text-base"
              onChange={(e) => {
                session.reset();
                p.update((previous) => ({
                  ...previous,
                  selectedInstrumentProfileId: e.target.value,
                }));
              }}
            >
              {instrumentProfiles.map((option) => (
                <option key={option.id} value={option.id}>
                  {c[profileCopy[option.id]] as string}
                </option>
              ))}
            </select>
            {!supported && (
              <p
                role="status"
                className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950"
              >
                {c.unsupportedInput}
              </p>
            )}
            {input === "microphone" && (
              <>
                <p className="text-sm text-slate-600">{c.micNotice}</p>
                <button
                  className={secondaryButton}
                  disabled={!supported || session.busy}
                  onClick={() => void session.checkMicrophone()}
                >
                  {session.busy ? c.permission : c.setup}
                </button>
                {session.micReady && (
                  <div role="status">
                    <p>{c.calibration}</p>
                    <meter
                      className="mt-2 w-full accent-violet-700"
                      aria-label={c.signal}
                      min={0}
                      max={0.1}
                      value={Math.min(0.1, session.frame?.rms ?? 0)}
                    />
                    <p className="mt-1 text-sm text-slate-600">
                      {detected === null
                        ? c.noSignal
                        : `${c.detected}: ${pitchName(detected)}`}
                    </p>
                    <button
                      className={`${secondaryButton} mt-3`}
                      onClick={session.confirmReady}
                    >
                      ✓ {c.microphoneReady}
                    </button>
                  </div>
                )}
              </>
            )}
            <details>
              <summary className="min-h-12 cursor-pointer py-3 font-semibold">
                {c.controls}
              </summary>
              <div className="space-y-4 pt-2">
                <label className="block text-sm font-semibold">
                  {c.offset}
                  <input
                    className="mt-2 block min-h-12 w-full rounded-lg border border-slate-300 p-3 text-base"
                    type="number"
                    min={-250}
                    max={250}
                    step={10}
                    value={p.progress.settings.inputOffsetMs}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (Number.isFinite(value) && Math.abs(value) <= 250)
                        p.update((previous) => ({
                          ...previous,
                          settings: {
                            ...previous.settings,
                            inputOffsetMs: value,
                          },
                        }));
                    }}
                  />
                </label>
                <p className="text-sm text-slate-600">{c.offsetHint}</p>
                <label className="flex min-h-12 items-center gap-3 text-sm">
                  <input
                    className="h-5 w-5 accent-violet-800"
                    type="checkbox"
                    checked={p.progress.settings.reducedMotion}
                    onChange={(e) =>
                      p.update((previous) => ({
                        ...previous,
                        settings: {
                          ...previous.settings,
                          reducedMotion: e.target.checked,
                        },
                      }))
                    }
                  />
                  {c.display}
                </label>
              </div>
            </details>
            <button
              className={secondaryButton}
              onClick={() => void session.example()}
              disabled={
                !supported || session.busy || notationError || !notationReady
              }
            >
              {session.previewing ? c.stopExample : c.preview}
            </button>
            <fieldset className="border-t border-slate-100 pt-4">
              <legend className="sr-only">{c.challenge}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["challenge", "rehearsal"] as const).map((value) => (
                  <label
                    key={value}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 ${mode === value ? "border-violet-700 bg-violet-50" : "border-slate-200"}`}
                  >
                    <input
                      type="radio"
                      name="challenge-mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => setMode(value)}
                      className="h-4 w-4 accent-violet-800"
                    />
                    {c[value]}
                  </label>
                ))}
              </div>
              {mode === "rehearsal" && (
                <>
                  <p className="my-3 text-sm text-slate-600">
                    {c.rehearsalNotice}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {([0.7, 0.85, 1] as const).map((value) => (
                      <button
                        key={value}
                        className={`${secondaryButton} ${scale === value ? "border-violet-700 bg-violet-50" : ""}`}
                        aria-pressed={scale === value}
                        onClick={() => setScale(value)}
                      >
                        {Math.round(value * 100)}%
                      </button>
                    ))}
                  </div>
                </>
              )}
            </fieldset>
            {!unlocked && mode === "challenge" && (
              <p role="status" className="text-sm text-amber-900">
                {c.locked}
              </p>
            )}
            <button
              className={`${primaryButton} w-full`}
              disabled={
                !p.hydrated ||
                !supported ||
                session.busy ||
                notationError ||
                !notationReady ||
                (mode === "challenge" && !unlocked)
              }
              onClick={() => begin()}
            >
              {mode === "challenge" ? c.start : c.startRehearsal}
            </button>
          </section>
        )}
        {active && (
          <section className="mt-4" aria-label={c.current}>
            {session.count !== null || s.phase === "countIn" ? (
              <div
                role="status"
                className="rounded-2xl bg-violet-50 px-5 py-6 text-center text-violet-950"
                data-challenge-count-in
              >
                <p className="text-sm font-semibold">
                  {session.busy ? c.permission : c.countIn}
                </p>
                <p className="mt-2 text-5xl font-bold tabular-nums">
                  {session.count ?? 4}
                </p>
              </div>
            ) : rewind ? (
              <p
                role="status"
                className="rounded-2xl bg-violet-50 p-5 font-semibold text-violet-950"
                data-challenge-rewinding
              >
                {c.rewinding}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm text-slate-500">{c.current}</p>
                    <p className="mt-1 text-2xl font-bold text-violet-900">
                      {targetEvent.writtenSpelling ?? c.rest}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">{c.next}</p>
                    <p className="mt-1 text-lg font-semibold">
                      {next?.writtenSpelling ??
                        (next?.kind === "rest" ? c.rest : "—")}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span>
                    {c.detected}:{" "}
                    <strong>
                      {detected === null ? "—" : pitchName(detected)}
                    </strong>
                  </span>
                  <span>
                    {Math.min(
                      timeline.filter((e) => e.kind === "note").length,
                      s.events.length,
                    )}
                    /{timeline.filter((e) => e.kind === "note").length}
                  </span>
                  <span>
                    {new Intl.NumberFormat(language, {
                      maximumFractionDigits: 1,
                    }).format(stage.bpm * activeScale)}{" "}
                    BPM
                  </span>
                </div>
                <progress
                  aria-label={c.hold}
                  max={target.endAudioSec - target.startAudioSec}
                  value={session.heldDuration}
                  className="mt-3 h-3 w-full accent-violet-700"
                />
                <p className="mt-1 text-sm text-slate-600">
                  {c.hold}: {session.heldDuration.toFixed(1)} /{" "}
                  {(target.endAudioSec - target.startAudioSec).toFixed(1)} s
                </p>
                <label className="mt-3 block text-xs text-slate-500">
                  {c.noteTime}
                  <progress
                    aria-label={c.noteTime}
                    max={target.endAudioSec - target.startAudioSec}
                    value={Math.max(0, session.elapsed - target.startAudioSec)}
                    className="mt-1 block h-1.5 w-full accent-slate-400"
                  />
                </label>
                {detected !== null && target.targetConcertMidi !== null && (
                  <p
                    className={`mt-2 text-sm font-semibold ${detected === target.targetConcertMidi ? "text-green-800" : "text-red-800"}`}
                  >
                    {c.pitch}:{" "}
                    {detected === target.targetConcertMidi
                      ? `✓ ${c.passed}`
                      : c.wrongPitch}
                  </p>
                )}
              </>
            )}
            {s.phase === "paused" && (
              <p
                role="status"
                className="mt-4 rounded-xl bg-violet-50 p-4 font-semibold text-violet-950"
              >
                {c.paused}
              </p>
            )}
            {input === "microphone" && (
              <div
                className="mt-4 rounded-xl border border-slate-200 bg-white p-3"
                aria-label={c.signal}
              >
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-semibold">◉ {c.signal}</span>
                  <span>
                    {session.frame?.isVoiced &&
                    session.frame.detectedHz !== null
                      ? `${session.frame.detectedHz.toFixed(1)} Hz`
                      : c.noSignal}
                  </span>
                </div>
                <meter
                  className="mt-2 block h-3 w-full accent-violet-700"
                  min={0}
                  max={0.1}
                  value={
                    s.phase === "paused"
                      ? 0
                      : Math.min(0.1, session.frame?.rms ?? 0)
                  }
                  aria-label={c.signal}
                />
              </div>
            )}
            {input === "touch" && (
              <TouchKeyboard
                enabled={s.phase === "playing" && !rewind}
                heldMidi={session.heldMidi}
                c={c}
                down={session.down}
                up={session.up}
                cancel={session.cancelKey}
              />
            )}
            <div className="sticky bottom-0 z-20 -mx-3 mt-5 grid grid-cols-2 gap-2 border-t border-slate-200 bg-[#f6f5fa] p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:mx-0 sm:rounded-xl">
              <button
                className={secondaryButton}
                disabled={session.busy || notationError || !notationReady}
                onClick={s.phase === "paused" ? session.resume : session.pause}
              >
                {s.phase === "paused" ? c.resume : c.pause}
              </button>
              <button
                className={secondaryButton}
                onClick={() => begin()}
                disabled={session.busy}
              >
                {c.restart}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">{c.keyboardShortcuts}</p>
          </section>
        )}
        {s.phase === "result" && s.result && (
          <section
            className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"
            data-challenge-stars={s.mode === "challenge" ? s.result.stars : 0}
            data-challenge-score={s.result.score}
          >
            <h2
              tabIndex={-1}
              ref={resultHeading}
              className="text-xl font-bold outline-none"
            >
              {s.mode === "rehearsal"
                ? c.rehearsal
                : s.result.cleared
                  ? c.complete
                  : c.tryAgain}
            </h2>
            {s.mode === "challenge" ? (
              <p
                className="my-3 text-3xl text-violet-800"
                aria-label={`${s.result.stars}/3`}
              >
                {"★".repeat(s.result.stars)}
                {"☆".repeat(3 - s.result.stars)}
              </p>
            ) : (
              <p className="my-3 text-sm text-slate-600">{c.rehearsalNotice}</p>
            )}
            <p className="text-lg">
              {c.score}: <strong>{s.result.score}/100</strong>
            </p>
            <dl className="my-5 grid grid-cols-3 gap-3 border-y border-slate-100 py-4 text-sm">
              {(["pitch", "duration", "onset"] as const).map((key) => (
                <div key={key}>
                  <dt className="text-slate-600">{c[key]}</dt>
                  <dd className="mt-1 text-xl font-semibold">
                    {s.result!.breakdown[key] === null
                      ? "—"
                      : `${s.result!.breakdown[key]}%`}
                  </dd>
                </div>
              ))}
            </dl>
            {s.result.unscorable && (
              <p role="status" className="mb-4 text-amber-900">
                {c.unscorable}
              </p>
            )}
            <ol className="divide-y divide-slate-100 text-sm">
              {s.result.notes.map((note) => {
                const performed = timeline.find(
                  (event) => event.stageEventId === note.stageEventId,
                )!;
                const event = stage.events.find(
                  (e) =>
                    e.id ===
                    (performed.sourceEventId ?? performed.stageEventId),
                )!;
                return (
                  <li
                    key={note.stageEventId}
                    className="flex flex-wrap justify-between gap-2 py-3"
                  >
                    <strong>
                      {event.writtenSpelling}
                      {performed.visit !== undefined && (
                        <span className="ml-2 font-normal text-slate-500">
                          {c.pass.replace("{count}", String(performed.visit))}
                        </span>
                      )}
                    </strong>
                    <span
                      className={
                        note.status === "passed"
                          ? "text-green-800"
                          : "text-red-800"
                      }
                    >
                      {note.status === "passed"
                        ? `✓ ${c.passed}`
                        : note.reasons.map((reason) => c[reason]).join(" · ")}
                    </span>
                  </li>
                );
              })}
              {s.result.restViolations.map((id) => (
                <li key={id} className="py-3 text-red-800">
                  {c.restViolation}
                </li>
              ))}
            </ol>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                className={primaryButton}
                onClick={() => begin(s.mode, s.tempoScale)}
              >
                {c.retry}
              </button>
              <button
                className={secondaryButton}
                onClick={() => {
                  setMode("rehearsal");
                  setScale(0.7);
                  begin("rehearsal", 0.7);
                }}
              >
                {c.weakPart}
              </button>
              {s.mode === "challenge" && s.result.cleared && nextStage && (
                <Link
                  className={`${primaryButton} sm:col-span-2`}
                  href={localizedHref(
                    `/challenge/play/${nextStage.id}`,
                    locale,
                  )}
                >
                  {c.nextStage} →
                </Link>
              )}
              <button
                className={`${secondaryButton} sm:col-span-2`}
                onClick={session.reset}
              >
                {c.input}
              </button>
            </div>
          </section>
        )}
      </div>
    </ChallengeShell>
  );
}
