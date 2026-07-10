"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Staff from "@/components/game/Staff";
import PianoKeyboard from "@/components/game/PianoKeyboard";
import SolfegeKeyboard from "@/components/game/SolfegeKeyboard";
import MicrophoneInput from "@/components/game/MicrophoneInput";
import GameControl from "@/components/game/GameControl";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import {
  applyKeySignature,
  generateQuestion,
  validateAnswer,
} from "@/lib/music/utils";
import { initializeAudio, playPianoNote } from "@/lib/music/audio";
import { trackLeaderboardSubmission } from "@/lib/analytics";
import {
  isScoreEligible,
  MAX_QUESTIONS_PER_SUBMISSION,
  SCORE_VERSION,
} from "@/lib/leaderboard/validation";
import { hasReachedTimeLimit } from "@/lib/sessionTimer";
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
}

export default function NotePracticeMode({
  mode,
  onModeChange,
  settingsOpen,
  onSettingsOpen,
  onSettingsClose,
  onLeaderboardOpen,
}: NotePracticeModeProps) {
  const { t } = useTranslation();
  const {
    gameState,
    settings,
    answers,
    currentQuestion,
    currentAnswer,
    feedback,
    gameResult,
    elapsedTime,
    setCurrentQuestion,
    setCurrentAnswer,
    addAnswer,
    isGameActive,
    startQuestionTimer,
    getQuestionElapsedTime,
    setFeedback,
    updateTimer,
    endGame,
    getCurrentScore,
    getAccuracy,
  } = useGameStore();
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [submissionStatus, setSubmissionStatus] =
    useState<SessionSubmissionUiStatus>("idle");
  const [sessionPoints, setSessionPoints] = useState(0);
  const [isAnswerLocked, setIsAnswerLocked] = useState(false);
  const submittedSessionIdRef = useRef<string | null>(null);

  const answerModeLabel =
    settings.answerMode === "piano"
      ? t.answerModes.piano
      : settings.answerMode === "solfege"
        ? t.answerModes.solfege
        : t.answerModes.microphone;

  useEffect(() => {
    async function initAudio() {
      try {
        await initializeAudio();
        setIsAudioInitialized(true);
      } catch (error) {
        console.error("Failed to initialize audio:", error);
      }
    }

    initAudio();
  }, []);

  useEffect(() => {
    if (gameState !== "playing") return;

    const interval = setInterval(() => {
      const now = Date.now();
      const nextElapsedTime = updateTimer(now);

      if (hasReachedTimeLimit(nextElapsedTime, settings.timeLimit)) {
        endGame();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gameState, updateTimer, settings.timeLimit, endGame]);

  const generateNewQuestion = useCallback(() => {
    if (!isGameActive()) return;

    const question = generateQuestion(settings);
    const displayNote =
      settings.keySignature === "random"
        ? question.displayNote
        : applyKeySignature(question.note, question.keySignature);

    const questionWithDisplayNote = {
      ...question,
      displayNote,
    };

    setCurrentQuestion(questionWithDisplayNote);
    setCurrentAnswer(null);
    setFeedback(null);
    setIsAnswerLocked(false);
    startQuestionTimer();

    if (settings.enableSound && isAudioInitialized) {
      playPianoNote(questionWithDisplayNote.displayNote, 1000).catch(
        console.error,
      );
    }
  }, [
    isGameActive,
    settings,
    setCurrentQuestion,
    setCurrentAnswer,
    setFeedback,
    startQuestionTimer,
    isAudioInitialized,
  ]);

  useEffect(() => {
    if (gameState === "playing" && !currentQuestion) {
      generateNewQuestion();
    }
  }, [gameState, currentQuestion, generateNewQuestion]);

  useEffect(() => {
    if (gameState === "playing") {
      submittedSessionIdRef.current = null;
      setSubmissionStatus("idle");
      setSessionPoints(0);
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState !== "finished" || !gameResult) return;

    if (submittedSessionIdRef.current === gameResult.sessionId) return;
    submittedSessionIdRef.current = gameResult.sessionId;
    setSessionPoints(gameResult.sessionPoints);

    if (!isScoreEligible(gameResult.totalQuestions)) {
      setSubmissionStatus("ineligible");
      trackLeaderboardSubmission({
        status: "ineligible",
        sessionPoints: gameResult.sessionPoints,
        totalQuestions: gameResult.totalQuestions,
      });
      return;
    }

    setSubmissionStatus("submitting");

    submitLeaderboardScore({
      schemaVersion: SCORE_VERSION,
      sessionId: gameResult.sessionId,
      mode: "note",
      totalQuestions: gameResult.totalQuestions,
      correctAnswers: gameResult.correctAnswers,
      totalTime: gameResult.totalTime,
    })
      .then((response) => {
        setSessionPoints(response.sessionPoints);
        setSubmissionStatus(response.submissionStatus);
        trackLeaderboardSubmission({
          status: response.submissionStatus,
          sessionPoints: response.sessionPoints,
          totalQuestions: gameResult.totalQuestions,
        });
      })
      .catch((error) => {
        setSubmissionStatus("failed");
        trackLeaderboardSubmission({
          status: "failed",
          sessionPoints: gameResult.sessionPoints,
          totalQuestions: gameResult.totalQuestions,
        });
        console.error("Failed to submit leaderboard score:", error);
      });
  }, [gameState, gameResult]);

  const handleAnswerSubmit = useCallback(
    (answer: Note) => {
      if (!currentQuestion || !isGameActive()) return;
      if (isAnswerLocked) return;

      const isCorrect = validateAnswer(currentQuestion, answer);
      const timeSpent = getQuestionElapsedTime();
      setIsAnswerLocked(true);

      addAnswer({
        note: answer,
        correctNote: currentQuestion.note,
        timestamp: Date.now(),
        isCorrect,
        timeSpent,
      });
      setCurrentAnswer(answer);
      setFeedback({
        message: isCorrect ? t.messages.correct : t.messages.incorrect,
        type: isCorrect ? "success" : "error",
      });

      setTimeout(() => {
        if (answers.length + 1 >= MAX_QUESTIONS_PER_SUBMISSION) {
          endGame();
        } else {
          generateNewQuestion();
        }
      }, 850);
    },
    [
      currentQuestion,
      answers.length,
      isGameActive,
      isAnswerLocked,
      getQuestionElapsedTime,
      addAnswer,
      setCurrentAnswer,
      setFeedback,
      t.messages.correct,
      t.messages.incorrect,
      endGame,
      generateNewQuestion,
    ],
  );

  const status = (
    <div className="grid min-w-0 grid-cols-3 gap-2">
      <StatusTile label={t.timer.elapsed} value={formatTime(elapsedTime)} />
      <StatusTile
        label={t.scoreboard.correct}
        value={String(getCurrentScore())}
      />
      <StatusTile
        label={t.scoreboard.accuracy}
        value={`${getAccuracy().toFixed(0)}%`}
      />
    </div>
  );

  const practiceStage = (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-[#5b21b6]">
            {currentQuestion ? t.clefs[currentQuestion.clef] : t.gameNavTitle}
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
            {currentQuestion ? t.messages.whichNoteShown : t.ui.welcome}
          </h2>
        </div>
        <span className="rounded-full bg-white px-3 py-2 text-sm font-black text-slate-700">
          {t.scoreboard.total}: {answers.length}
        </span>
      </div>

      <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-white sm:min-h-[300px]">
        {currentQuestion ? (
          <Staff
            clef={currentQuestion.clef}
            keySignature={currentQuestion.keySignature}
            note={currentQuestion.displayNote}
            originalNote={currentQuestion.note}
            width={620}
            height={260}
            className="w-full max-w-[720px]"
          />
        ) : (
          <div className="px-4 text-center">
            <p className="text-2xl font-black text-slate-950">{t.ui.welcome}</p>
            <p className="mt-3 text-sm text-slate-500">
              {t.messages.startGameInstruction}
            </p>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`mt-3 rounded-lg px-4 py-3 text-sm font-black ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );

  const stage =
    gameState === "finished" && gameResult ? (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <NoteSessionResult
          result={gameResult}
          sessionPoints={sessionPoints}
          submissionStatus={submissionStatus}
        />
      </div>
    ) : (
      practiceStage
    );

  const input = (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase text-slate-500">
          {t.settingsLabels.answerMode}
        </p>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
          {answerModeLabel}
        </span>
      </div>
      {settings.answerMode === "piano" ? (
        <PianoKeyboard
          onNoteClick={handleAnswerSubmit}
          selectedNote={currentAnswer}
          disabled={!isGameActive() || isAnswerLocked}
          className="flex max-w-full flex-col items-center justify-center overflow-x-auto"
        />
      ) : settings.answerMode === "solfege" ? (
        <SolfegeKeyboard
          onNoteClick={handleAnswerSubmit}
          selectedNote={currentAnswer}
          disabled={!isGameActive() || isAnswerLocked}
          className="flex max-w-full justify-center overflow-x-auto"
        />
      ) : (
        <MicrophoneInput
          onSubmit={handleAnswerSubmit}
          selectedNote={currentAnswer}
          disabled={!isGameActive() || isAnswerLocked}
        />
      )}
    </div>
  );

  const settingsSummary = useMemo(() => {
    const timeLabel = settings.timeLimit
      ? `${settings.timeLimit}s`
      : t.earTraining.session.practice;
    const clefLabel =
      settings.clef === "random" ? t.clefs.random : t.clefs[settings.clef];
    return [clefLabel, answerModeLabel, timeLabel].join(" / ");
  }, [
    answerModeLabel,
    settings.clef,
    settings.timeLimit,
    t.clefs,
    t.earTraining.session.practice,
  ]);

  return (
    <PracticeShell
      modeSwitcher={<ModeSwitcher mode={mode} onChange={onModeChange} />}
      title={t.gameNavTitle}
      kicker={t.brandDescription}
      status={status}
      stage={stage}
      input={gameState === "finished" ? null : input}
      actions={<GameControl />}
      settings={<NoteSettingsPanel />}
      settingsSummary={settingsSummary}
      settingsOpen={settingsOpen}
      onSettingsOpen={onSettingsOpen}
      onSettingsClose={onSettingsClose}
      onLeaderboardOpen={onLeaderboardOpen}
    />
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="truncate text-[11px] font-black uppercase text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-slate-950 sm:text-xl">
        {value}
      </p>
    </div>
  );
}

function formatTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((milliseconds % 1000) / 100);
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${tenths}`;
}
