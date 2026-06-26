"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FaPlay, FaRedoAlt, FaStop, FaVolumeUp } from "react-icons/fa";
import EarTrainingSettings from "@/components/ear-training/EarTrainingSettings";
import EarTrainingResult from "@/components/ear-training/EarTrainingResult";
import PianoKeyboard from "@/components/game/PianoKeyboard";
import SolfegeKeyboard from "@/components/game/SolfegeKeyboard";
import {
  trackEarTrainingReplay,
  trackEarTrainingSettingsChange,
} from "@/lib/analytics";
import { initializeAudio, playPianoNote } from "@/lib/music/audio";
import { noteToString } from "@/lib/music/utils";
import { useEarTrainingStore } from "@/store/earTrainingStore";
import { useTranslation } from "@/hooks/useTranslation";
import PracticeShell from "./PracticeShell";
import ModeSwitcher, { PracticeMode } from "./ModeSwitcher";

interface EarPracticeModeProps {
  mode: PracticeMode;
  onModeChange: (mode: PracticeMode) => void;
  settingsOpen: boolean;
  onSettingsOpen: () => void;
  onSettingsClose: () => void;
  onLeaderboardOpen: () => void;
}

interface EarFeedback {
  message: string;
  type: "success" | "error";
  submittedNote: string;
  correctNote: string;
  visible: boolean;
}

export default function EarPracticeMode({
  mode,
  onModeChange,
  settingsOpen,
  onSettingsOpen,
  onSettingsClose,
  onLeaderboardOpen,
}: EarPracticeModeProps) {
  const { t } = useTranslation();
  const {
    settings,
    sessionState,
    currentQuestion,
    isAdvancingQuestion,
    answers,
    result,
    stats,
    elapsedTime,
    updateSettings,
    startSession,
    endSession,
    resetSession,
    submitAnswer,
    replayCurrentQuestion,
    updateTimer,
    getQuestionElapsedTime,
  } = useEarTrainingStore();
  const [audioReady, setAudioReady] = useState(false);
  const [feedback, setFeedback] = useState<EarFeedback | null>(null);
  const [questionTime, setQuestionTime] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (sessionState === "playing") {
      interval = setInterval(() => {
        updateTimer(Date.now());
        setQuestionTime(getQuestionElapsedTime());
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [getQuestionElapsedTime, sessionState, updateTimer]);

  useEffect(() => {
    if (
      sessionState === "playing" &&
      currentQuestion &&
      settings.enableSound &&
      audioReady
    ) {
      playPianoNote(currentQuestion.targetNote, 900).catch(console.error);
    }
  }, [audioReady, currentQuestion, settings.enableSound, sessionState]);

  const currentAccuracy = useMemo(() => {
    if (answers.length === 0) return 0;
    const correctAnswers = answers.filter((answer) => answer.isCorrect).length;
    return (correctAnswers / answers.length) * 100;
  }, [answers]);

  const settingsSummary = useMemo(() => {
    const sessionLabel =
      settings.sessionType === "timed"
        ? `${t.earTraining.session.timed}${
            settings.timeLimit ? ` / ${settings.timeLimit}s` : ""
          }`
        : t.earTraining.session.practice;
    const noteSetLabel =
      settings.noteSet === "chromatic"
        ? t.earTraining.noteSet.chromatic
        : t.earTraining.noteSet.natural;
    const inputLabel =
      settings.inputMode === "piano"
        ? t.earTraining.inputMode.piano
        : t.earTraining.inputMode.solfege;

    return [sessionLabel, noteSetLabel, inputLabel].join(" / ");
  }, [
    settings.inputMode,
    settings.noteSet,
    settings.sessionType,
    settings.timeLimit,
    t.earTraining.inputMode.piano,
    t.earTraining.inputMode.solfege,
    t.earTraining.noteSet.chromatic,
    t.earTraining.noteSet.natural,
    t.earTraining.session.practice,
    t.earTraining.session.timed,
  ]);

  const handleSettingsChange = (nextSettings: Partial<EarTrainingSettings>) => {
    Object.entries(nextSettings).forEach(([key, value]) => {
      trackEarTrainingSettingsChange(key, String(value));
    });
    updateSettings(nextSettings);
  };

  const handleStartSession = async () => {
    await initializeAudio();
    setAudioReady(true);
    startSession();
    setFeedback(null);
  };

  const handleRestartSession = async () => {
    resetSession();
    await initializeAudio();
    setAudioReady(true);
    startSession();
    setFeedback(null);
  };

  const handleReplay = async () => {
    if (!currentQuestion) return;
    await initializeAudio();
    setAudioReady(true);
    replayCurrentQuestion();
    trackEarTrainingReplay();
    await playPianoNote(currentQuestion.targetNote, 900);
  };

  const handleAnswer = (note: Note) => {
    if (sessionState !== "playing" || !currentQuestion || isAdvancingQuestion) {
      return;
    }

    const submittedNote = noteToString(note);
    const correctNote = noteToString(currentQuestion.targetNote);
    const isCorrect = submitAnswer(note);

    setFeedback({
      message: isCorrect ? t.messages.correct : t.messages.incorrect,
      type: isCorrect ? "success" : "error",
      submittedNote,
      correctNote,
      visible: true,
    });

    setTimeout(() => {
      setFeedback((current) =>
        current ? { ...current, visible: false } : current
      );
    }, 1400);

    setTimeout(() => {
      setFeedback(null);
    }, 1800);
  };

  const status = (
    <div className="grid min-w-0 grid-cols-3 gap-2">
      <StatusTile label={t.timer.elapsed} value={formatTime(elapsedTime)} />
      <StatusTile
        label={t.ui.currentQuestionTime}
        value={formatTime(questionTime)}
      />
      <StatusTile
        label={t.scoreboard.accuracy}
        value={`${currentAccuracy.toFixed(0)}%`}
      />
    </div>
  );

  const stage = (
    <div className="relative rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
      {feedback && (
        <div
          className={`absolute left-1/2 top-4 z-20 w-[min(340px,calc(100%-32px))] -translate-x-1/2 rounded-lg px-4 py-3 text-center text-sm font-black shadow-[0_14px_34px_rgba(15,23,42,0.16)] transition-all duration-300 ${
            feedback.visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
          } ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          <p>{feedback.message}</p>
          <p className="mt-1 text-xs">
            {t.messages.yourAnswer}: {feedback.submittedNote} /{" "}
            {t.messages.correctAnswer}: {feedback.correctNote}
          </p>
        </div>
      )}

      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg bg-white p-4 text-center sm:min-h-[300px]">
        {result ? (
          <EarTrainingResult result={result} stats={stats} />
        ) : (
          <>
            <p className="text-xs font-black uppercase text-[#5b21b6]">
              {t.earTraining.subtitle}
            </p>
            <h2 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">
              {sessionState === "playing"
                ? t.earTraining.listenPrompt
                : t.earTraining.description}
            </h2>
            <button
              type="button"
              onClick={handleReplay}
              disabled={!currentQuestion || sessionState !== "playing"}
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <FaVolumeUp />
              {t.earTraining.replay}
            </button>
          </>
        )}
      </div>
    </div>
  );

  const input = (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase text-slate-500">
          {t.earTraining.currentTarget}
        </p>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
          {settings.noteSet === "chromatic"
            ? t.earTraining.noteSet.chromatic
            : t.earTraining.noteSet.natural}
        </span>
      </div>
      {settings.inputMode === "piano" ? (
        <PianoKeyboard
          onNoteClick={handleAnswer}
          disabled={sessionState !== "playing" || isAdvancingQuestion}
          showAccidentals={settings.noteSet === "chromatic"}
          className="flex max-w-full flex-col items-center justify-center overflow-x-auto"
        />
      ) : (
        <SolfegeKeyboard
          onNoteClick={handleAnswer}
          disabled={sessionState !== "playing" || isAdvancingQuestion}
          showAccidentals={settings.noteSet === "chromatic"}
          className="flex max-w-full justify-center overflow-x-auto"
        />
      )}
    </div>
  );

  const actions = (
    <div className="grid gap-2 sm:grid-cols-2">
      {sessionState === "playing" ? (
        <button
          type="button"
          onClick={endSession}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 text-sm font-black text-white"
        >
          <FaStop />
          {t.earTraining.stop}
        </button>
      ) : (
        <button
          type="button"
          onClick={result ? handleRestartSession : handleStartSession}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#5b21b6] px-4 text-sm font-black text-white"
        >
          {result ? <FaRedoAlt /> : <FaPlay />}
          {result ? t.earTraining.restart : t.earTraining.start}
        </button>
      )}
    </div>
  );

  return (
    <PracticeShell
      modeSwitcher={<ModeSwitcher mode={mode} onChange={onModeChange} />}
      title={t.earTraining.title}
      kicker={t.earTraining.subtitle}
      status={status}
      stage={stage}
      input={input}
      actions={actions}
      settings={
        <EarTrainingSettings
          settings={settings}
          onChange={handleSettingsChange}
        />
      }
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
      <p className="mt-1 text-lg font-black text-slate-950 sm:text-xl">{value}</p>
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
