"use client";

import React, { useEffect, useRef, useState } from "react";
import { FaVolumeUp } from "react-icons/fa";
import Staff from "@/components/game/Staff";
import PianoKeyboard from "@/components/game/PianoKeyboard";
import SolfegeKeyboard from "@/components/game/SolfegeKeyboard";
import MicrophoneInput from "@/components/game/MicrophoneInput";
import GameControl from "@/components/game/GameControl";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { noteToString } from "@/lib/music/utils";
import {
  initializeAudio,
  playPianoNote,
  stopAllNotes,
} from "@/lib/music/audio";
import { trackLeaderboardSubmission } from "@/lib/analytics";
import { isScoreEligible, SCORE_VERSION } from "@/lib/leaderboard/validation";
import { submitLeaderboardScore } from "@/services/leaderboard";
import PracticeShell from "./PracticeShell";
import ModeSwitcher, { PracticeMode } from "./ModeSwitcher";
import NoteSettingsPanel from "./NoteSettingsPanel";
import NoteSessionResult, {
  SessionSubmissionUiStatus,
} from "./NoteSessionResult";

interface NotePracticeModeProps {
  mode: PracticeMode;
  onModeChange: (mode: PracticeMode) => void;
  settingsOpen: boolean;
  onSettingsOpen: () => void;
  onSettingsClose: () => void;
  onLeaderboardOpen: () => void;
  runOptions?: NoteSessionOptions;
  onComplete?: (result: GameResult, kind: PracticeSessionKind) => void;
  onChangePractice?: () => void;
}

export default function NotePracticeMode({
  mode,
  onModeChange,
  settingsOpen,
  onSettingsOpen,
  onSettingsClose,
  runOptions,
  onComplete,
  onChangePractice,
}: NotePracticeModeProps) {
  const { t } = useTranslation();
  const store = useGameStore();
  const {
    gameState,
    settings,
    sessionSettings,
    sessionKind,
    answers,
    currentQuestion,
    currentAnswer,
    feedback,
    gameResult,
    elapsedTime,
    isAnswerLocked,
    questionLimit,
  } = store;
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submissionStatus, setSubmissionStatus] =
    useState<SessionSubmissionUiStatus>("idle");
  const [sessionPoints, setSessionPoints] = useState(0);
  const audioAttempt = useRef(0);
  const startingRef = useRef(false);
  const mounted = useRef(true);
  const submittedSessionId = useRef<string | null>(null);
  const completedSessionId = useRef<string | null>(null);
  const completionCallback = useRef(onComplete);
  completionCallback.current = onComplete;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopAllNotes();
      useGameStore.getState().resetGame();
    };
  }, []);

  useEffect(() => {
    if (gameState !== "playing") return;
    const interval = setInterval(
      () => useGameStore.getState().updateTimer(Date.now()),
      50,
    );
    return () => clearInterval(interval);
  }, [gameState]);

  useEffect(() => {
    if (
      gameState !== "playing" ||
      !currentQuestion ||
      !sessionSettings.enableSound ||
      !audioReady
    )
      return;
    let active = true;
    playPianoNote(currentQuestion.displayNote, 700).catch(() => {
      if (active) setAudioError(true);
    });
    return () => {
      active = false;
      stopAllNotes();
    };
  }, [gameState, currentQuestion, sessionSettings.enableSound, audioReady]);

  useEffect(() => {
    if (gameState !== "finished" || !gameResult) return;
    if (completedSessionId.current !== gameResult.sessionId) {
      completedSessionId.current = gameResult.sessionId;
      completionCallback.current?.(gameResult, sessionKind);
    }
    if (submittedSessionId.current === gameResult.sessionId) return;
    submittedSessionId.current = gameResult.sessionId;
    setSessionPoints(gameResult.sessionPoints);
    if (sessionKind !== "practice") {
      setSubmissionStatus("idle");
      return;
    }
    if (!isScoreEligible(gameResult.totalQuestions)) {
      setSubmissionStatus("ineligible");
      trackLeaderboardSubmission({
        status: "ineligible",
        sessionPoints: gameResult.sessionPoints,
        totalQuestions: gameResult.totalQuestions,
      });
      return;
    }
    let active = true;
    const resultId = gameResult.sessionId;
    setSubmissionStatus("submitting");
    submitLeaderboardScore({
      schemaVersion: SCORE_VERSION,
      sessionId: resultId,
      mode: "note",
      totalQuestions: gameResult.totalQuestions,
      correctAnswers: gameResult.correctAnswers,
      totalTime: gameResult.totalTime,
    })
      .then((response) => {
        const latest = useGameStore.getState();
        if (
          !active ||
          latest.gameState !== "finished" ||
          latest.gameResult?.sessionId !== resultId
        )
          return;
        setSessionPoints(response.sessionPoints);
        setSubmissionStatus(response.submissionStatus);
        trackLeaderboardSubmission({
          status: response.submissionStatus,
          sessionPoints: response.sessionPoints,
          totalQuestions: gameResult.totalQuestions,
        });
      })
      .catch(() => {
        const latest = useGameStore.getState();
        if (
          !active ||
          latest.gameState !== "finished" ||
          latest.gameResult?.sessionId !== resultId
        )
          return;
        setSubmissionStatus("failed");
        trackLeaderboardSubmission({
          status: "failed",
          sessionPoints: gameResult.sessionPoints,
          totalQuestions: gameResult.totalQuestions,
        });
      });
    return () => {
      active = false;
    };
  }, [gameState, gameResult, sessionKind]);

  const start = async (
    options: NoteSessionOptions | undefined = runOptions,
  ) => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    const attempt = ++audioAttempt.current;
    const originalSettings = useGameStore.getState().settings;
    stopAllNotes();
    setAudioError(false);
    setSubmissionStatus("idle");
    setSessionPoints(0);
    let ready = false;
    if (originalSettings.enableSound) {
      try {
        await initializeAudio();
        ready = true;
      } catch {
        if (
          mounted.current &&
          attempt === audioAttempt.current &&
          originalSettings === useGameStore.getState().settings
        )
          setAudioError(true);
      }
    }
    if (
      mounted.current &&
      attempt === audioAttempt.current &&
      originalSettings === useGameStore.getState().settings
    ) {
      setAudioReady(ready);
      useGameStore.getState().startGame(options);
    }
    if (mounted.current && attempt === audioAttempt.current) {
      startingRef.current = false;
      setStarting(false);
    }
  };
  const retryAudio = async () => {
    const attempt = ++audioAttempt.current;
    const original = useGameStore.getState();
    const isCurrent = () => {
      const latest = useGameStore.getState();
      return (
        mounted.current &&
        attempt === audioAttempt.current &&
        latest.sessionId === original.sessionId &&
        latest.currentQuestion === original.currentQuestion &&
        latest.gameState === original.gameState &&
        latest.settings === original.settings
      );
    };
    try {
      await initializeAudio();
      if (isCurrent()) {
        setAudioReady(true);
        setAudioError(false);
      }
    } catch {
      if (isCurrent()) setAudioError(true);
    }
  };
  const answer = (note: Note) => {
    const isCorrect = useGameStore.getState().submitAnswer(note);
    if (isCorrect !== null)
      useGameStore.getState().setFeedback({
        message: isCorrect ? t.messages.correct : t.messages.incorrect,
        type: isCorrect ? "success" : "error",
      });
    return isCorrect;
  };
  const replay = async (note: Note) => {
    const attempt = ++audioAttempt.current;
    const original = useGameStore.getState();
    const isCurrent = () => {
      const latest = useGameStore.getState();
      return (
        mounted.current &&
        attempt === audioAttempt.current &&
        latest.sessionId === original.sessionId &&
        latest.currentQuestion === original.currentQuestion &&
        latest.gameState === original.gameState &&
        latest.settings === original.settings
      );
    };
    stopAllNotes();
    try {
      // Playback captures its cancellation generation before initializing audio.
      await playPianoNote(note, 700);
      if (isCurrent()) setAudioError(false);
    } catch {
      if (isCurrent()) setAudioError(true);
    }
  };
  const changePractice = () => {
    audioAttempt.current++;
    stopAllNotes();
    store.resetGame();
    if (onChangePractice) onChangePractice();
    else onSettingsOpen();
  };
  const mistakes =
    gameResult?.answers.filter((entry) => !entry.isCorrect && entry.question) ??
    [];
  const answerMode =
    gameState === "idle" ? settings.answerMode : sessionSettings.answerMode;
  const answerModeLabel = t.answerModes[answerMode];
  const summary = [
    t.clefs[settings.clef],
    answerModeLabel,
    settings.questionLimit
      ? t.learning.ten
      : settings.timeLimit
        ? `${settings.timeLimit} ${t.units.seconds}`
        : t.learning.free,
  ].join(" / ");
  const lastAnswer = answers[answers.length - 1];

  const stage =
    gameState === "finished" && gameResult ? (
      <NoteSessionResult
        result={gameResult}
        sessionPoints={sessionPoints}
        submissionStatus={submissionStatus}
        onRestart={() => void start()}
        onReview={() =>
          void start({
            kind: "review",
            questions: mistakes.map((entry) => entry.question!),
          })
        }
        onChange={changePractice}
      >
        {sessionKind !== "practice" && (
          <p className="text-sm text-slate-600">{t.learning.reviewNotice}</p>
        )}
        {mistakes.length > 0 && (
          <details>
            <summary className="min-h-11 cursor-pointer text-sm font-bold text-[#5b21b6]">
              {t.learning.review}
            </summary>
            <div className="mt-3 space-y-3">
              {mistakes.map((entry, index) => (
                <div
                  key={`${entry.question!.id}-${index}`}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <p className="text-xs text-slate-500">
                    {t.clefs[entry.question!.clef]} /{" "}
                    {t.keySignatures.major.replace(
                      "{key}",
                      entry.question!.keySignature.key.replace(" Major", ""),
                    )}
                  </p>
                  <Staff
                    responsive
                    clef={entry.question!.clef}
                    keySignature={entry.question!.keySignature}
                    note={entry.question!.displayNote}
                    originalNote={entry.question!.note}
                    width={620}
                    height={260}
                    className="mx-auto max-w-md"
                  />
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
                    {t.messages.playSound}
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </NoteSessionResult>
    ) : gameState === "idle" ? (
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        <p>{t.messages.startGameInstruction}</p>
        <p>
          {runOptions?.kind === "daily"
            ? t.learning.dailyNotice
            : t.learning.leaderboardNotice}
        </p>
      </div>
    ) : (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#5b21b6]">
              {currentQuestion && t.clefs[currentQuestion.clef]}
            </p>
            <h2
              className={`mt-1 text-base font-black sm:text-xl ${feedback?.type === "error" ? "text-red-700" : feedback ? "text-emerald-700" : "text-slate-950"}`}
            >
              <span role="status" aria-live="polite">
                {feedback?.message ?? t.messages.whichNoteShown}
              </span>
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <p className="text-sm font-bold tabular-nums">
              {answers.length}
              {questionLimit ? `/${questionLimit}` : ""}
            </p>
            <button
              type="button"
              aria-label={t.messages.playSound}
              title={t.messages.playSound}
              disabled={gameState !== "playing" || !currentQuestion}
              onClick={() =>
                currentQuestion && void replay(currentQuestion.displayNote)
              }
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#5b21b6] disabled:opacity-50"
            >
              <FaVolumeUp />
            </button>
          </div>
        </div>
        <p
          className="mb-2 min-h-8 text-xs leading-4 text-slate-600"
          aria-live="polite"
        >
          {feedback && lastAnswer
            ? `${t.messages.correctAnswer}: ${noteToString(lastAnswer.correctNote)} / ${t.messages.yourAnswer}: ${noteToString(lastAnswer.note)}`
            : ""}
        </p>
        <div className="flex min-h-[140px] items-center justify-center rounded-lg bg-white sm:min-h-[260px]">
          {currentQuestion && (
            <Staff
              responsive
              clef={currentQuestion.clef}
              keySignature={currentQuestion.keySignature}
              note={currentQuestion.displayNote}
              originalNote={currentQuestion.note}
              width={620}
              height={260}
              className="w-full max-w-[720px]"
            />
          )}
        </div>
      </div>
    );
  const input =
    gameState === "playing" || gameState === "paused" ? (
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-3 text-xs font-bold text-slate-500">
          {t.settingsLabels.answerMode}: {answerModeLabel}
        </p>
        {answerMode === "piano" ? (
          <PianoKeyboard
            onNoteClick={answer}
            onAudioError={() => setAudioError(true)}
            selectedNote={currentAnswer}
            disabled={gameState !== "playing" || isAnswerLocked}
            className="flex max-w-full flex-col items-center overflow-x-auto"
          />
        ) : answerMode === "solfege" ? (
          <SolfegeKeyboard
            onNoteClick={answer}
            onAudioError={() => setAudioError(true)}
            selectedNote={currentAnswer}
            disabled={gameState !== "playing" || isAnswerLocked}
          />
        ) : (
          <MicrophoneInput
            onSubmit={answer}
            selectedNote={currentAnswer}
            disabled={gameState !== "playing" || isAnswerLocked}
          />
        )}
      </div>
    ) : null;
  return (
    <PracticeShell
      modeSwitcher={<ModeSwitcher mode={mode} onChange={onModeChange} />}
      title={t.gameNavTitle}
      kicker={t.brandDescription}
      status={
        gameState === "finished" ? null : (
          <div className="grid grid-cols-3 gap-2">
            <StatusTile
              label={t.timer.elapsed}
              value={formatTime(elapsedTime)}
            />
            <StatusTile
              label={t.scoreboard.correct}
              value={String(store.getCurrentScore())}
            />
            <StatusTile
              label={t.scoreboard.accuracy}
              value={`${store.getAccuracy().toFixed(0)}%`}
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
                onClick={() => void retryAudio()}
                className="mt-2 min-h-11 rounded-lg border border-amber-300 px-3 font-bold"
              >
                {t.learning.retryAudio}
              </button>
            </div>
          )}
          {sessionKind === "review" && gameState === "playing" && (
            <p className="mb-2 text-sm text-slate-600">
              {t.learning.reviewNotice}
            </p>
          )}
          {stage}
        </>
      }
      input={input}
      actions={
        gameState === "finished" ? null : (
          <GameControl onStart={() => void start()} busy={starting} />
        )
      }
      settings={<NoteSettingsPanel />}
      settingsSummary={summary}
      isIdle={gameState === "idle"}
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
