"use client";

import React, { useEffect, useRef, useState } from "react";
import { FaVolumeUp, FaClock, FaCheck, FaBullseye } from "react-icons/fa";
import Staff from "@/components/game/Staff";
import PianoKeyboard from "@/components/game/PianoKeyboard";
import SolfegeKeyboard from "@/components/game/SolfegeKeyboard";
import MicrophoneInput from "@/components/game/MicrophoneInput";
import GameControl from "@/components/game/GameControl";
import { useShallow } from "zustand/react/shallow";
import PracticeFeedback from "./PracticeFeedback";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { noteToString } from "@/lib/music/utils";
import { KEY_SIGNATURES } from "@/lib/music/constants";
import {
  initializeAudio,
  playPianoNote,
  stopAllNotes,
} from "@/lib/music/audio";
import { trackLeaderboardSubmission } from "@/lib/analytics";
import { isScoreEligible, SCORE_VERSION } from "@/lib/leaderboard/validation";
import { submitLeaderboardScore } from "@/services/leaderboard";
import PracticeShell from "./PracticeShell";
import PracticeMetrics from "./PracticeMetrics";
import ModeSwitcher, { PracticeMode } from "./ModeSwitcher";
import NoteSettingsPanel from "./NoteSettingsPanel";
import NoteSessionResult, {
  SessionSubmissionUiStatus,
} from "./NoteSessionResult";

interface NotePracticeModeProps {
  mode: PracticeMode;
  onModeChange: (mode: PracticeMode) => void;
  settingsOpen: boolean;
  settingsIntro?: React.ReactNode;
  headerActions?: React.ReactNode;
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
  settingsIntro,
  headerActions,
  onSettingsOpen,
  onSettingsClose,
  runOptions,
  onComplete,
  onChangePractice,
}: NotePracticeModeProps) {
  const { t } = useTranslation();
  const store = useGameStore(
    useShallow((state) => ({
      gameState: state.gameState,
      settings: state.settings,
      sessionSettings: state.sessionSettings,
      sessionKind: state.sessionKind,
      answers: state.answers,
      currentQuestion: state.currentQuestion,
      currentAnswer: state.currentAnswer,
      feedback: state.feedback,
      gameResult: state.gameResult,
      isAnswerLocked: state.isAnswerLocked,
      questionLimit: state.questionLimit,
      resetGame: state.resetGame,
    })),
  );
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
  const isIdle = gameState === "idle";
  const isFinished = gameState === "finished";
  const stageFeedback = isIdle || isFinished ? null : feedback;
  // Random settings use a neutral staff; only Start may generate a question.
  const staffQuestion = isIdle
    ? null
    : isFinished
      ? (gameResult?.answers.at(-1)?.question ?? null)
      : currentQuestion;
  const staffClef =
    staffQuestion?.clef ??
    (settings.clef === "random" ? "treble" : settings.clef);
  const staffKeySignature =
    staffQuestion?.keySignature ??
    KEY_SIGNATURES[settings.keySignature] ??
    KEY_SIGNATURES.C;

  const resultContent =
    isFinished && gameResult ? (
      <NoteSessionResult
        preserveScroll
        focusOnMount={false}
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
    ) : null;
  const stage = (
    <div
      data-practice-stage
      data-practice-phase={isIdle ? "idle" : isFinished ? "finished" : "active"}
      data-preview-clef={isIdle ? staffClef : undefined}
      data-preview-key={isIdle ? staffKeySignature.key : undefined}
      className="relative rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4"
    >
      <div className="mb-2 flex h-14 items-center justify-between gap-3">
        <div className="relative h-14 min-w-0 flex-1" data-practice-prompt-band>
          <p
            className={`text-xs font-bold leading-4 text-[#5b21b6] ${gameState === "playing" && stageFeedback ? "opacity-0" : ""}`}
          >
            {isIdle ? t.clefs[settings.clef] : t.clefs[staffClef]}
          </p>
          <h2
            data-practice-prompt
            tabIndex={-1}
            className={`max-h-10 overflow-auto text-base font-black leading-5 text-slate-950 sm:text-xl ${gameState === "playing" && stageFeedback ? "opacity-0" : ""}`}
          >
            {t.messages.whichNoteShown}
          </h2>
          <PracticeFeedback
            message={
              gameState === "playing" ? stageFeedback?.message : undefined
            }
            correct={stageFeedback?.type === "success"}
            announcementKey={answers.length}
          />
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
            <FaVolumeUp aria-hidden="true" />
          </button>
        </div>
      </div>
      <Staff
        stable
        responsive
        clef={staffClef}
        keySignature={staffKeySignature}
        note={staffQuestion?.displayNote}
        originalNote={staffQuestion?.note}
        width={620}
        height={260}
      />
      <div
        data-practice-explanation
        tabIndex={isIdle || stageFeedback || isFinished ? 0 : undefined}
        className="mt-1 h-8 overflow-auto text-xs leading-4 text-slate-600 [overflow-wrap:anywhere]"
      >
        {isIdle ? (
          <>
            <p>{t.messages.startGameInstruction}</p>
            <p>
              {runOptions?.kind === "daily"
                ? t.learning.dailyNotice
                : t.learning.leaderboardNotice}
            </p>
          </>
        ) : (stageFeedback || isFinished) && lastAnswer ? (
          `${t.messages.correctAnswer}: ${noteToString(lastAnswer.correctNote)} / ${t.messages.yourAnswer}: ${noteToString(lastAnswer.note)}`
        ) : null}
      </div>
    </div>
  );
  const input =
    gameState === "playing" || gameState === "paused" || isFinished ? (
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
        ) : isFinished ? (
          <p className="text-sm text-slate-600">
            {gameResult?.completed ? t.learning.complete : t.learning.stopped}
          </p>
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
      status={<NoteStatus />}
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
        <div
          aria-hidden={isFinished || undefined}
          inert={isFinished || undefined}
          className={isFinished ? "invisible" : undefined}
        >
          <GameControl onStart={() => void start()} busy={starting} />
        </div>
      }
      headerActions={headerActions}
      settingsIntro={settingsIntro}
      settings={<NoteSettingsPanel />}
      settingsSummary={summary}
      isIdle={isIdle}
      isFinished={isFinished}
      result={resultContent}
      resultKey={gameResult?.sessionId ?? null}
      settingsOpen={settingsOpen}
      onSettingsOpen={onSettingsOpen}
      onSettingsClose={onSettingsClose}
    />
  );
}
/** Clock updates stop here instead of reconciling notation and answer inputs. */
function NoteStatus() {
  const { t } = useTranslation();
  const elapsedTime = useGameStore((state) => state.elapsedTime);
  const answers = useGameStore((state) => state.answers);
  const correct = answers.filter((answer) => answer.isCorrect).length;
  return (
    <PracticeMetrics
      items={[
        {
          label: t.timer.elapsed,
          value: formatTime(elapsedTime),
          icon: <FaClock />,
        },
        {
          label: t.scoreboard.correct,
          value: String(correct),
          icon: <FaCheck />,
        },
        {
          label: t.scoreboard.accuracy,
          value: `${(answers.length ? (correct / answers.length) * 100 : 0).toFixed(0)}%`,
          icon: <FaBullseye />,
        },
      ]}
    />
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
