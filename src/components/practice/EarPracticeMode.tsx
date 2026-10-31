"use client";

import React, { useEffect, useRef, useState } from "react";
import { FaPlay, FaStop, FaVolumeUp } from "react-icons/fa";
import EarTrainingSettings from "@/components/ear-training/EarTrainingSettings";
import PianoKeyboard from "@/components/game/PianoKeyboard";
import SolfegeKeyboard from "@/components/game/SolfegeKeyboard";
import { trackEarTrainingReplay } from "@/lib/analytics";
import {
  initializeAudio,
  playPianoNote,
  stopAllNotes,
} from "@/lib/music/audio";
import { noteToString } from "@/lib/music/utils";
import { useEarTrainingStore } from "@/store/earTrainingStore";
import { useTranslation } from "@/hooks/useTranslation";
import PracticeShell from "./PracticeShell";
import ModeSwitcher, { PracticeMode } from "./ModeSwitcher";
import LearningResult from "./LearningResult";

interface EarPracticeModeProps {
  mode: PracticeMode;
  onModeChange: (mode: PracticeMode) => void;
  settingsOpen: boolean;
  onSettingsOpen: () => void;
  onSettingsClose: () => void;
  onLeaderboardOpen: () => void;
  runOptions?: EarSessionOptions;
  onComplete?: (result: EarTrainingResult, kind: PracticeSessionKind) => void;
  onChangePractice?: () => void;
}

export default function EarPracticeMode({
  mode,
  onModeChange,
  settingsOpen,
  onSettingsOpen,
  onSettingsClose,
  runOptions,
  onComplete,
  onChangePractice,
}: EarPracticeModeProps) {
  const { t } = useTranslation();
  const store = useEarTrainingStore();
  const {
    settings,
    sessionSettings,
    sessionState,
    sessionKind,
    currentQuestion,
    isAdvancingQuestion,
    answers,
    result,
    elapsedTime,
    questionLimit,
  } = store;
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [, refreshClock] = useState(0);
  const audioAttempt = useRef(0);
  const startingRef = useRef(false);
  const mounted = useRef(true);
  const completedSessionId = useRef<string | undefined>(undefined);
  const completionCallback = useRef(onComplete);
  completionCallback.current = onComplete;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopAllNotes();
      useEarTrainingStore.getState().resetSession();
    };
  }, []);
  useEffect(() => {
    if (sessionState !== "playing") return;
    const interval = setInterval(() => {
      useEarTrainingStore.getState().updateTimer(Date.now());
      refreshClock((value) => value + 1);
    }, 50);
    return () => clearInterval(interval);
  }, [sessionState]);
  useEffect(() => {
    if (
      sessionState !== "playing" ||
      !currentQuestion ||
      !sessionSettings.enableSound ||
      !audioReady
    )
      return;
    let active = true;
    playPianoNote(currentQuestion.targetNote, 700).catch(() => {
      if (active) setAudioError(true);
    });
    return () => {
      active = false;
      stopAllNotes();
    };
  }, [sessionState, currentQuestion, sessionSettings.enableSound, audioReady]);
  useEffect(() => {
    if (
      sessionState !== "finished" ||
      !result ||
      completedSessionId.current === result.sessionId
    )
      return;
    completedSessionId.current = result.sessionId;
    completionCallback.current?.(result, sessionKind);
  }, [sessionState, result, sessionKind]);

  const start = async (options: EarSessionOptions | undefined = runOptions) => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    const attempt = ++audioAttempt.current;
    const originalSettings = useEarTrainingStore.getState().settings;
    stopAllNotes();
    setAudioError(false);
    try {
      await initializeAudio();
      if (
        mounted.current &&
        attempt === audioAttempt.current &&
        originalSettings === useEarTrainingStore.getState().settings
      ) {
        setAudioReady(true);
        useEarTrainingStore.getState().startSession(options);
      }
    } catch {
      if (
        mounted.current &&
        attempt === audioAttempt.current &&
        originalSettings === useEarTrainingStore.getState().settings
      )
        setAudioError(true);
    } finally {
      if (mounted.current && attempt === audioAttempt.current) {
        startingRef.current = false;
        setStarting(false);
      }
    }
  };
  const replay = async (note: Note, count = false) => {
    const attempt = ++audioAttempt.current;
    const original = useEarTrainingStore.getState();
    const isCurrent = () => {
      const latest = useEarTrainingStore.getState();
      return (
        mounted.current &&
        attempt === audioAttempt.current &&
        latest.sessionId === original.sessionId &&
        latest.currentQuestion === original.currentQuestion &&
        latest.sessionState === original.sessionState &&
        latest.settings === original.settings
      );
    };
    stopAllNotes();
    try {
      // Start immediately so stopAllNotes also cancels a pending audio resume.
      const playback = playPianoNote(note, 700);
      if (count) {
        useEarTrainingStore.getState().replayCurrentQuestion();
        trackEarTrainingReplay();
      }
      await playback;
      if (isCurrent()) {
        setAudioReady(true);
        setAudioError(false);
      }
    } catch {
      if (isCurrent()) setAudioError(true);
    }
  };
  const changePractice = () => {
    audioAttempt.current++;
    stopAllNotes();
    store.resetSession();
    if (onChangePractice) onChangePractice();
    else onSettingsOpen();
  };
  const currentAccuracy = answers.length
    ? (answers.filter((answer) => answer.isCorrect).length / answers.length) *
      100
    : 0;
  const lastAnswer = answers[answers.length - 1];
  const feedback = isAdvancingQuestion && lastAnswer ? lastAnswer : null;
  const mistakes =
    result?.answers.filter((entry) => !entry.isCorrect && entry.question) ?? [];
  const activeSettings = sessionState === "idle" ? settings : sessionSettings;
  const summary = [
    settings.questionLimit
      ? t.learning.ten
      : settings.sessionType === "timed"
        ? `${settings.timeLimit} ${t.units.seconds}`
        : t.learning.free,
    t.earTraining.noteSet[settings.noteSet],
    t.earTraining.inputMode[settings.inputMode],
  ].join(" / ");

  const stage =
    result && sessionState === "finished" ? (
      <LearningResult
        result={result}
        hasMistakes={mistakes.length > 0}
        onRestart={() => void start()}
        onReview={() =>
          void start({
            kind: "review",
            questions: mistakes.map((entry) => entry.question!),
          })
        }
        onChange={changePractice}
      >
        <p className="text-sm text-slate-600">
          {t.earTraining.result.replayCount}: {result.replayCount}
        </p>
        {sessionKind === "review" && (
          <p className="text-sm text-slate-600">{t.learning.reviewNotice}</p>
        )}
        {mistakes.length > 0 && (
          <details>
            <summary className="min-h-11 cursor-pointer text-sm font-bold text-[#5b21b6]">
              {t.learning.review}
            </summary>
            <ul className="space-y-2">
              {mistakes.map((entry, index) => (
                <li
                  key={`${entry.question!.id}-${index}`}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <p className="text-sm">
                    {t.messages.correctAnswer}:{" "}
                    {noteToString(entry.correctNote)} / {t.messages.yourAnswer}:{" "}
                    {noteToString(entry.note)}
                  </p>
                  <button
                    type="button"
                    onClick={() => void replay(entry.correctNote)}
                    className="mt-2 min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold"
                  >
                    {t.earTraining.replay}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </LearningResult>
    ) : sessionState === "idle" ? (
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        {t.earTraining.description}
      </p>
    ) : (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm leading-5 text-slate-600">
            {t.earTraining.listenPrompt}
          </p>
          <button
            type="button"
            onClick={() =>
              currentQuestion && void replay(currentQuestion.targetNote, true)
            }
            disabled={!currentQuestion}
            className="inline-flex min-h-11 max-w-[50%] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#5b21b6] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed] focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <FaVolumeUp aria-hidden="true" className="shrink-0" />
            {t.earTraining.replay}
          </button>
        </div>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="min-w-0"
          >
            <p
              className={`min-h-5 text-sm font-bold leading-5 ${feedback?.isCorrect ? "text-emerald-700" : feedback ? "text-red-700" : "text-slate-600"}`}
            >
              {feedback
                ? feedback.isCorrect
                  ? t.messages.correct
                  : t.messages.incorrect
                : sessionKind === "review"
                  ? t.learning.review
                  : null}
            </p>
            <p
              aria-hidden={!feedback}
              className={`text-xs leading-5 text-slate-600 ${feedback ? "" : "invisible"}`}
            >
              {t.messages.correctAnswer}:{" "}
              <span className="inline-block w-8 font-semibold">
                {feedback ? noteToString(feedback.correctNote) : "\u00a0"}
              </span>{" "}
              / {t.messages.yourAnswer}:{" "}
              <span className="inline-block w-8 font-semibold">
                {feedback ? noteToString(feedback.note) : "\u00a0"}
              </span>
            </p>
          </div>
          <p className="text-sm font-bold leading-5 tabular-nums text-slate-600">
            {answers.length}
            {questionLimit ? `/${questionLimit}` : ""}
          </p>
        </div>
      </div>
    );
  const input =
    sessionState === "playing" ? (
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-3 text-xs font-bold text-slate-500">
          {t.earTraining.currentTarget}:{" "}
          {t.earTraining.noteSet[activeSettings.noteSet]}
        </p>
        {activeSettings.inputMode === "piano" ? (
          <PianoKeyboard
            onNoteClick={(note) =>
              useEarTrainingStore.getState().submitAnswer(note)
            }
            onAudioError={() => setAudioError(true)}
            disabled={isAdvancingQuestion}
            showAccidentals={activeSettings.noteSet === "chromatic"}
            className="flex max-w-full flex-col items-center overflow-x-auto"
          />
        ) : (
          <SolfegeKeyboard
            onNoteClick={(note) =>
              useEarTrainingStore.getState().submitAnswer(note)
            }
            onAudioError={() => setAudioError(true)}
            disabled={isAdvancingQuestion}
            showAccidentals={activeSettings.noteSet === "chromatic"}
          />
        )}
      </div>
    ) : null;
  const actions =
    sessionState === "finished" ? null : sessionState === "playing" ? (
      <button
        type="button"
        onClick={() => store.endSession()}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-white"
      >
        <FaStop />
        {t.earTraining.stop}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => void start()}
        disabled={starting}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#5b21b6] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        <FaPlay />
        {t.earTraining.start}
      </button>
    );
  return (
    <PracticeShell
      modeSwitcher={<ModeSwitcher mode={mode} onChange={onModeChange} />}
      title={t.earTraining.title}
      kicker={t.earTraining.subtitle}
      status={
        sessionState === "finished" ? null : (
          <div className="grid grid-cols-3 gap-2">
            <StatusTile
              label={t.timer.elapsed}
              value={formatTime(elapsedTime)}
            />
            <StatusTile
              label={t.ui.currentQuestionTime}
              value={formatTime(store.getQuestionElapsedTime())}
            />
            <StatusTile
              label={t.scoreboard.accuracy}
              value={`${currentAccuracy.toFixed(0)}%`}
            />
          </div>
        )
      }
      stage={
        <>
          {audioError && (
            <div
              role="alert"
              className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
            >
              <p>{t.learning.audioError}</p>
              <button
                type="button"
                onClick={() =>
                  currentQuestion
                    ? void replay(currentQuestion.targetNote)
                    : void start()
                }
                className="mt-2 min-h-11 rounded-lg border border-amber-300 px-3 font-bold"
              >
                {t.learning.retryAudio}
              </button>
            </div>
          )}
          {stage}
        </>
      }
      input={input}
      actions={actions}
      settings={
        <EarTrainingSettings
          embedded
          settings={settings}
          onChange={store.updateSettings}
        />
      }
      settingsSummary={summary}
      isIdle={sessionState === "idle"}
      settingsOpen={settingsOpen}
      onSettingsOpen={onSettingsOpen}
      onSettingsClose={onSettingsClose}
    />
  );
}
function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-between rounded-lg border border-slate-200 px-2 py-2">
      <p className="text-xs font-bold text-slate-500 [overflow-wrap:anywhere]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}
function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(
      2,
      "0",
    )}:${(seconds % 60).toString().padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
}
