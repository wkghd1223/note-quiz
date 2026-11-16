"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaListOl, FaMicrophone, FaMusic } from "react-icons/fa";
import PracticeController from "@/components/practice/PracticeController";
import PracticeMetrics from "@/components/practice/PracticeMetrics";
import PracticeResultSurface, {
  usePracticeResultSurface,
} from "@/components/practice/PracticeResultSurface";
import Header from "@/components/layouts/header";
import Footer from "@/components/layouts/footer";
import AdLayoutObserver from "@/components/practice/AdLayoutObserver";
import SettingsSurface from "@/components/practice/SettingsSurface";
import { useTranslation } from "@/hooks/useTranslation";
import MicrophoneSignalDisplay from "@/components/game/MicrophoneSignal";
import { beatsPerMeasure } from "@/features/challenge/domain/stage";
import { useChallengeSession } from "@/features/challenge/hooks/useChallengeSession";
import { buildPlaybackTimeline } from "@/features/challenge/domain/score-timeline";
import {
  getInstrumentProfile,
  getScoringProfile,
} from "@/features/challenge/domain/instrument-profile";
import { useLiveResult } from "../hooks/useLiveResult";
import { useLivePitchFeedback } from "../hooks/useLivePitchFeedback";
import { useMelodyAnalytics } from "../hooks/useMelodyAnalytics";
import { challengeCopy } from "@/features/challenge/i18n";
import ScoreViewport from "@/features/challenge/components/ScoreViewport";
import { secondaryButton } from "@/features/challenge/components/ChallengeShell";
import { generateMelody } from "../domain/generator";
import {
  defaultMelodySettings,
  sanitizeMelodySettings,
  validateMelodySettings,
  type MelodySettings,
} from "../domain/settings";
import { melodyCopy } from "../i18n";
import MelodySettingsPanel, { pitchName } from "./MelodySettingsPanel";

const storageKey = "note-quiz-melody-settings-v1";
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const voice = getInstrumentProfile("voice")!;
export default function MelodyPractice() {
  const { t, language } = useTranslation(),
    c = challengeCopy(language),
    m = melodyCopy(language);
  const [settings, setSettings] = useState<MelodySettings>(
    defaultMelodySettings,
  );
  const [draft, setDraft] = useState<MelodySettings>(defaultMelodySettings);
  const [seed, setSeed] = useState(1),
    [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false),
    [storageWarning, setStorageWarning] = useState(false);
  const [readyId, setReadyId] = useState<string | null>(null),
    [notationError, setNotationError] = useState(false),
    [revision, setRevision] = useState(0);
  const exercise = useMemo(
    () => generateMelody(settings, seed),
    [settings, seed],
  );
  const session = useChallengeSession(exercise, settings),
    s = session.state;
  useMelodyAnalytics(hydrated, exercise, session);
  const resultButton = useRef<HTMLButtonElement>(null);
  const results = usePracticeResultSurface(
    s.phase === "result",
    s.attemptToken,
  );
  const scoringProfile = useMemo(
    () => getScoringProfile(exercise, "voice"),
    [exercise],
  );
  const player = useRef<HTMLElement>(null);
  const running = s.phase === "countIn" || s.phase === "playing";
  const active = running || s.phase === "paused" || s.phase === "evaluating";
  const locked =
    active || session.previewing || session.busy || s.phase === "permission";
  const notationReady = readyId === exercise.id && !notationError;
  const moving = active || session.previewing;
  useEffect(() => {
    if (!moving) return;
    const surface = player.current;
    const available = surface
      ?.closest("[data-practice-scroll]")
      ?.getBoundingClientRect();
    const bounds = surface?.getBoundingClientRect();
    // Keep controls, score and live input together above any reserved ad area.
    // Move once on start; never chase the user as notes or judgments change.
    if (
      surface &&
      available &&
      bounds &&
      (bounds.top < available.top || bounds.bottom > available.bottom)
    )
      surface.scrollIntoView({ block: "start", behavior: "instant" });
  }, [moving]);
  const playback = useMemo(
    () => buildPlaybackTimeline(exercise, voice, 0, 1),
    [exercise],
  );
  const target =
    playback.targets.find(
      (event) => event.endAudioSec > session.elapsed + 1e-7,
    ) ?? playback.targets.at(-1)!;
  const pitchFeedback = useLivePitchFeedback(
    {
      frame: session.frame,
      target,
      profile: scoringProfile,
      elapsedSec: session.elapsed,
      enabled: s.phase === "playing" && !session.previewing,
    },
    s.attemptToken,
  );
  const targetEvent = exercise.events.find(
    (event) => event.id === (target.sourceEventId ?? target.stageEventId),
  );
  const detected =
    session.frame?.isVoiced && session.frame.detectedHz
      ? Math.round(69 + 12 * Math.log2(session.frame.detectedHz / 440))
      : null;
  const liveResult = useLiveResult(
    active,
    s.events,
    playback.targets,
    scoringProfile,
    session.elapsed,
    session.heldDuration,
  );
  useEffect(() => {
    try {
      const restored = sanitizeMelodySettings(
        JSON.parse(localStorage.getItem(storageKey) ?? "null"),
      );
      setSettings(restored);
      setDraft(restored);
    } catch {
      setStorageWarning(true);
    }
    setSeed(newSeed());
    setHydrated(true);
  }, []);
  const onReady = useCallback(() => {
    setReadyId(exercise.id);
    setNotationError(false);
  }, [exercise.id]);
  const pause = session.pause;
  const onError = useCallback(() => {
    setNotationError(true);
    setReadyId(null);
    pause();
  }, [pause]);
  const begin = () => {
    if (!hydrated || readyId !== exercise.id || notationError || session.busy)
      return;
    setSettingsOpen(false);
    session.start({
      stageId: exercise.id,
      profileId: "voice",
      inputMethod: "microphone",
      mode: "challenge",
      tempoScale: 1,
      inputOffsetMs: 0,
    });
  };
  const next = () => {
    session.reset();
    setSeed((previous) => (previous + 1) >>> 0);
  };
  const resetSession = session.reset;
  const apply = useCallback(() => {
    const validation = validateMelodySettings(draft);
    if (!validation.valid || locked) return;
    resetSession();
    setSettings(validation.settings);
    setSeed((previous) => (previous + 1) >>> 0);
    setSettingsOpen(false);
    try {
      localStorage.setItem(storageKey, JSON.stringify(validation.settings));
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
  }, [draft, locked, resetSession]);
  const error = session.audioError;
  const errorText = session.previewFailed
    ? m.previewError
    : error === "denied"
      ? m.denied
      : error === "missing-device"
        ? m.missing
        : error === "unsupported"
          ? m.unsupported
          : m.audioError;
  return (
    <div
      data-practice-scroll
      data-melody-scroll
      data-melody-phase={s.phase}
      className="practice-ad-safe bg-[#f6f7fb] text-slate-950"
    >
      <AdLayoutObserver />
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4">
          <Header variant="compact" />
        </div>
      </div>
      <main className="mx-auto grid w-full min-w-0 max-w-6xl gap-4 px-3 py-4 sm:px-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1
              data-practice-heading
              tabIndex={-1}
              className="text-2xl font-black"
            >
              {m.title}
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">{m.intro}</p>
          </div>
        </div>
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section
            ref={player}
            data-melody-player
            className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 [&_button]:min-h-11 [&_button]:py-2 [&_button]:text-sm"
          >
            <div
              data-practice-dock
              className="sticky top-0 z-10 -mx-3 grid gap-2 border-b border-slate-100 bg-white px-3 py-2 sm:-mx-4 sm:px-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-violet-800">
                  {m.voiceOnly}
                </p>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => setSettingsOpen(true)}
                  aria-expanded={settingsOpen}
                  aria-haspopup="dialog"
                  className={`${secondaryButton} lg:hidden`}
                >
                  {t.settings}
                </button>
              </div>
              <PracticeController
                state={
                  s.phase === "result" ? "result" : active ? "active" : "ready"
                }
                states={{
                  ready: [
                    {
                      id: "start",
                      label:
                        session.busy && !session.previewPreparing
                          ? c.permission
                          : t.startGame,
                      onClick: begin,
                      tone: "primary",
                      disabled: !hydrated || !notationReady || session.busy,
                    },
                    {
                      id: "preview",
                      label:
                        session.previewing || session.previewPreparing
                          ? c.stopExample
                          : c.preview,
                      onClick: () => void session.example(),
                      disabled:
                        !hydrated ||
                        !notationReady ||
                        (session.busy && !session.previewPreparing),
                    },
                  ],
                  active: [
                    {
                      id: "pause",
                      label: s.phase === "paused" ? c.resume : c.pause,
                      onClick:
                        s.phase === "paused"
                          ? () => {
                              if (notationReady) session.resume();
                            }
                          : session.pause,
                      tone: "primary",
                      disabled:
                        session.busy ||
                        (s.phase === "paused" && !notationReady),
                    },
                    {
                      id: "end",
                      label: t.endGame,
                      onClick: session.reset,
                      tone: "danger",
                    },
                  ],
                  result: [
                    {
                      id: "results",
                      label: t.practiceUi.viewResults,
                      onClick: () => results.setOpen(true),
                      tone: "primary",
                      buttonRef: resultButton,
                    },
                    {
                      id: "retry",
                      label: m.retry,
                      onClick: begin,
                      disabled: !hydrated || !notationReady || session.busy,
                    },
                  ],
                }}
              />
              {(active || session.previewing) && (
                <PracticeMetrics
                  items={[
                    {
                      label: c.measure,
                      value: `${Math.min(8, Math.floor((Math.max(0, session.elapsed + 1e-7) * exercise.bpm) / 60 / beatsPerMeasure(exercise)) + 1)} / 8`,
                      icon: <FaListOl />,
                    },
                    {
                      label: c.current,
                      value: targetEvent?.writtenSpelling ?? c.rest,
                      icon: <FaMusic />,
                    },
                    {
                      label: c.detected,
                      value:
                        session.previewing || detected === null
                          ? "—"
                          : pitchName(detected),
                      icon: <FaMicrophone />,
                    },
                  ]}
                />
              )}
            </div>
            {!active && s.phase !== "result" && (
              <p className="text-sm leading-6 text-slate-600">{m.hint}</p>
            )}
            {session.previewPreparing && (
              <p role="status" className="text-xs text-slate-600">
                {m.preparingAudio}
              </p>
            )}
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800"
              >
                <p>{errorText}</p>
                <button
                  type="button"
                  onClick={
                    session.previewFailed ? () => void session.example() : begin
                  }
                  disabled={session.busy || notationError}
                  className="mt-2 min-h-11 rounded-lg border border-red-300 px-3 font-bold"
                >
                  {c.retry}
                </button>
              </div>
            )}
            {notationError ? (
              <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm">
                <p>{c.loadError}</p>
                <button
                  className={secondaryButton}
                  onClick={() => {
                    setNotationError(false);
                    setRevision((value) => value + 1);
                  }}
                >
                  {c.retry}
                </button>
              </div>
            ) : (
              <ScoreViewport
                timeSpacing
                provisionalFeedback={pitchFeedback}
                footerFeedback={
                  (s.phase === "countIn" || s.phase === "paused") && (
                    <p
                      role="status"
                      className="absolute inset-0 flex items-center justify-center px-3 text-sm font-semibold text-violet-900"
                    >
                      {s.phase === "countIn"
                        ? `${c.countIn} ${session.count ?? "…"}`
                        : c.paused}
                    </p>
                  )
                }
                footerFeedbackVisible={
                  s.phase === "countIn" || s.phase === "paused"
                }
                key={`${exercise.id}-${revision}`}
                stage={exercise}
                targets={playback.targets}
                transitions={playback.transitions}
                elapsed={session.elapsed}
                scorePreRoll={session.scorePreRoll}
                active={
                  session.previewing ||
                  (active &&
                    s.phase !== "paused" &&
                    (s.phase !== "countIn" || session.scorePreRoll !== null))
                }
                finished={s.phase === "result"}
                reviewable={
                  !session.previewing &&
                  ["landing", "preview", "paused", "result"].includes(s.phase)
                }
                reducedMotion={false}
                result={session.previewing ? null : (s.result ?? liveResult)}
                c={c}
                onReady={onReady}
                onError={onError}
              />
            )}
            {active && (
              <div
                data-microphone-signal
                className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2"
              >
                <span className="text-xs font-semibold text-slate-600">
                  {t.microphone.signal}
                </span>
                <MicrophoneSignalDisplay
                  signal={session.signal}
                  listening={session.listening}
                  expanded
                />
                <p className="basis-full text-xs leading-5 text-slate-600">
                  {m.livePitchHint}
                </p>
                <div
                  className="basis-full text-xs leading-5 text-slate-600"
                  data-pitch-feedback
                >
                  <span>
                    {detected === null ? m.pitchListening : m.pitchMeasuring}
                  </span>
                  {detected !== null && session.frame?.detectedHz && (
                    <span
                      className="ml-2 font-semibold tabular-nums"
                      title={m.centsHint}
                    >
                      {session.frame.detectedHz.toFixed(1)} Hz ·{" "}
                      {Math.round(
                        1200 *
                          Math.log2(
                            session.frame.detectedHz /
                              (440 * 2 ** ((detected - 69) / 12)),
                          ),
                      ) > 0
                        ? "+"
                        : ""}
                      {Math.round(
                        1200 *
                          Math.log2(
                            session.frame.detectedHz /
                              (440 * 2 ** ((detected - 69) / 12)),
                          ),
                      )}{" "}
                      ¢
                    </span>
                  )}
                </div>
              </div>
            )}
            {s.phase === "result" && s.result && (
              <PracticeResultSurface
                open={results.open}
                onOpenChange={results.setOpen}
                returnFocusRef={resultButton}
              >
                <section
                  aria-label={t.scoreboard.gameResult}
                  className="motion-enter grid gap-3 rounded-xl border border-violet-200 p-4"
                >
                  <h2
                    data-result-heading
                    tabIndex={-1}
                    className="text-lg font-black"
                  >
                    {t.scoreboard.gameResult}
                  </h2>
                  <p className="text-sm">
                    {c.passed}:{" "}
                    <strong>
                      {
                        s.result.notes.filter(
                          (note) => note.status === "passed",
                        ).length
                      }{" "}
                      / {s.result.notes.length}
                    </strong>
                  </p>
                  <dl className="grid grid-cols-3 gap-3">
                    {(["pitch", "duration", "onset"] as const).map((key) => (
                      <div key={key}>
                        <dt className="text-xs text-slate-500">{c[key]}</dt>
                        <dd className="mt-1 font-bold tabular-nums">
                          {s.result!.breakdown[key] === null
                            ? "—"
                            : `${Math.round(s.result!.breakdown[key]!)}%`}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </PracticeResultSurface>
            )}
            {!active && (
              <button
                type="button"
                onClick={next}
                disabled={!hydrated || locked}
                className={secondaryButton}
              >
                {m.next}
              </button>
            )}
            <p className="text-xs leading-5 text-slate-500">
              {m.summary
                .replace("{bpm}", String(exercise.bpm))
                .replace("{meter}", exercise.timeSignature.join("/"))}
            </p>
            <p className="text-xs leading-5 text-slate-500">{m.privacy}</p>
            {storageWarning && (
              <p role="status" className="text-xs text-amber-800">
                {c.storageWarning}
              </p>
            )}
          </section>
          <SettingsSurface
            title={t.settings}
            summary={m.settingsHint}
            isMobileOpen={settingsOpen}
            onMobileClose={() => setSettingsOpen(false)}
          >
            <MelodySettingsPanel
              value={draft}
              onChange={setDraft}
              onApply={apply}
              disabled={locked}
            />
          </SettingsSurface>
        </div>
      </main>
      <Footer />
    </div>
  );
}
