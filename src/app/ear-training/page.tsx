"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FaPlay, FaRedoAlt, FaStop } from "react-icons/fa";
import EarTrainingSettings from "@/components/ear-training/EarTrainingSettings";
import EarTrainingResult from "@/components/ear-training/EarTrainingResult";
import EarTrainingStatus from "@/components/ear-training/EarTrainingStatus";
import PianoKeyboard from "@/components/game/PianoKeyboard";
import SolfegeKeyboard from "@/components/game/SolfegeKeyboard";
import {
  trackEarTrainingReplay,
  trackEarTrainingSettingsChange,
} from "@/lib/analytics";
import { initializeAudio, playPianoNote } from "@/lib/music/audio";
import { noteToString } from "@/lib/music/utils";
import { useEarTrainingStore } from "@/store/earTrainingStore";
import { useLanguageStore } from "@/store/languageStore";
import { useTranslation } from "@/hooks/useTranslation";

interface EarTrainingFeedback {
  message: string;
  type: Feedback["type"];
  submittedNote: string;
  correctNote: string;
  visible: boolean;
}

export default function EarTrainingPage() {
  const { t } = useTranslation();
  const { isInitialized } = useLanguageStore();
  const {
    settings,
    sessionState,
    currentQuestion,
    answers,
    result,
    stats,
    elapsedTime,
    startTime,
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
  const [feedback, setFeedback] = useState<EarTrainingFeedback | null>(null);
  const [questionTime, setQuestionTime] = useState(0);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    if (sessionState === "playing") {
      intervalId = setInterval(() => {
        const now = Date.now();
        updateTimer(now);
        setQuestionTime(getQuestionElapsedTime());

        if (settings.sessionType === "timed" && settings.timeLimit) {
          const nextElapsed = now - (startTime ?? now);
          if (nextElapsed >= settings.timeLimit * 1000) {
            endSession();
          }
        }
      }, 100);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [endSession, getQuestionElapsedTime, sessionState, settings.sessionType, settings.timeLimit, startTime, updateTimer]);

  useEffect(() => {
    if (
      !audioReady ||
      !settings.enableSound ||
      !currentQuestion ||
      sessionState !== "playing"
    ) {
      return;
    }

    playPianoNote(currentQuestion.targetNote, 900).catch(console.error);
  }, [audioReady, currentQuestion, settings.enableSound, sessionState]);

  const currentAccuracy = useMemo(() => {
    if (answers.length === 0) return 0;
    const correctAnswers = answers.filter((answer) => answer.isCorrect).length;
    return (correctAnswers / answers.length) * 100;
  }, [answers]);

  const settingsSummary = useMemo(() => {
    const sessionLabel =
      settings.sessionType === "timed"
        ? `${t.earTraining.session.timed}${settings.timeLimit ? ` · ${settings.timeLimit}s` : ""}`
        : t.earTraining.session.practice;
    const noteSetLabel =
      settings.noteSet === "chromatic"
        ? t.earTraining.noteSet.chromatic
        : t.earTraining.noteSet.natural;
    const inputLabel =
      settings.inputMode === "piano"
        ? t.earTraining.inputMode.piano
        : t.earTraining.inputMode.solfege;

    return [sessionLabel, noteSetLabel, inputLabel].join(" · ");
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

  if (!isInitialized) {
    return null;
  }

  const handleSettingsChange = (nextSettings: Partial<EarTrainingSettings>) => {
    Object.entries(nextSettings).forEach(([key, value]) => {
      trackEarTrainingSettingsChange(key, String(value));
    });
    updateSettings(nextSettings);
  };

  const handleStartSession = async () => {
    try {
      await initializeAudio();
      setAudioReady(true);
    } catch (error) {
      console.error("Failed to initialize audio:", error);
    }
    setFeedback(null);
    startSession();
  };

  const handleStopSession = () => {
    setFeedback(null);
    endSession();
  };

  const handleRestartSession = async () => {
    resetSession();
    await handleStartSession();
  };

  const handleReplay = async () => {
    if (!currentQuestion) return;
    try {
      await initializeAudio();
      setAudioReady(true);
      replayCurrentQuestion();
      trackEarTrainingReplay();
      await playPianoNote(currentQuestion.targetNote, 900);
    } catch (error) {
      console.error("Failed to replay note:", error);
    }
  };

  const handleAnswer = (note: Note) => {
    if (sessionState !== "playing" || !currentQuestion) return;

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
        current
          ? {
              ...current,
              visible: false,
            }
          : null,
      );
    }, 1400);

    setTimeout(() => {
      setFeedback(null);
    }, 1800);
  };

  return (
    <main className="app-shell">
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-6">
          <div className="order-2 space-y-4 xl:order-1 xl:space-y-6">
            <div className="xl:hidden">
              <details className="rounded-[1.5rem] border border-[#ded6f7] bg-white shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4">
                  <div>
                    <p className="text-sm font-black tracking-[-0.03em] text-slate-950">
                      {t.earTraining.settings}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {settingsSummary}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#ede9fe] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5b21b6]">
                    Open
                  </span>
                </summary>
                <div className="border-t border-[#ede9fe] p-4 pt-4">
                  <EarTrainingSettings
                    settings={settings}
                    onChange={handleSettingsChange}
                  />
                </div>
              </details>
            </div>

            <div className="hidden xl:block">
              <EarTrainingSettings
                settings={settings}
                onChange={handleSettingsChange}
              />
            </div>
          </div>

          <div className="order-1 space-y-4 xl:order-2 xl:space-y-6">
            <div className="rounded-[1.75rem] border border-[#ded6f7] bg-white p-4 shadow-[0_14px_40px_rgba(76,29,149,0.08)] sm:p-6">
              <div className="mb-4 flex flex-col gap-4 border-b border-[#ede9fe] pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#6d28d9]">
                    {t.earTraining.subtitle}
                  </p>
                  <h1 className="mt-2 text-2xl font-black tracking-[-0.05em] text-slate-950 sm:text-3xl">
                    {t.earTraining.description}
                  </h1>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  {sessionState !== "playing" ? (
                    <button
                      onClick={result ? handleRestartSession : handleStartSession}
                      className="col-span-2 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#5b21b6] to-[#6d28d9] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(91,33,182,0.28)]"
                    >
                      <FaPlay className="mr-2" />
                      {result ? t.earTraining.restart : t.earTraining.start}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleReplay}
                        className="inline-flex items-center justify-center rounded-2xl border border-[#ded6f7] bg-[#faf9fe] px-4 py-3 text-sm font-bold text-slate-700"
                      >
                        <FaRedoAlt className="mr-2" />
                        {t.earTraining.replay}
                      </button>
                      <button
                        onClick={handleStopSession}
                        className="inline-flex items-center justify-center rounded-2xl bg-[#ef4444] px-4 py-3 text-sm font-bold text-white"
                      >
                        <FaStop className="mr-2" />
                        {t.earTraining.stop}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <EarTrainingStatus
                sessionState={sessionState}
                elapsedTime={elapsedTime}
                questionTime={questionTime}
                totalQuestions={answers.length}
                accuracy={currentAccuracy}
              />

              <div className="relative mt-4 rounded-[1.6rem] border border-[#ede9fe] bg-[#faf9fe] p-4 sm:mt-6 sm:p-6">
                {feedback && (
                  <div
                    className={`pointer-events-none absolute right-4 top-4 z-20 min-w-[13rem] max-w-[calc(100%-2rem)] rounded-[1.2rem] border px-4 py-3 shadow-[0_14px_32px_rgba(15,23,42,0.12)] transition-all duration-300 sm:right-6 sm:top-6 sm:min-w-[15rem] ${
                      feedback.type === "success"
                        ? "border-[#bbf7d0] bg-[#ecfdf5] text-[#166534]"
                        : "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]"
                    } ${
                      feedback.visible
                        ? "translate-y-0 opacity-100"
                        : "-translate-y-2 opacity-0"
                    }`}
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.14em]">
                      {feedback.message}
                    </p>
                    <div className="mt-2 space-y-1 text-sm font-semibold">
                      <p>
                        {t.messages.yourAnswer}: {feedback.submittedNote}
                      </p>
                      <p>
                        {t.messages.correctAnswer}: {feedback.correctNote}
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {t.earTraining.listenPrompt}
                </p>
                <p className="mt-2 text-base font-semibold text-slate-700 sm:pr-0 sm:text-lg">
                  {sessionState === "playing"
                    ? t.earTraining.listenPrompt
                    : t.earTraining.start}
                </p>

                <div className="mt-4 rounded-[1.3rem] border border-[#ede9fe] bg-white p-3 sm:mt-5 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      {t.earTraining.currentTarget}
                    </span>
                    <span className="rounded-full bg-[#ede9fe] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#5b21b6]">
                      {sessionState === "finished" && currentQuestion
                        ? noteToString(currentQuestion.targetNote)
                        : settings.noteSet === "chromatic"
                          ? t.earTraining.noteSet.chromatic
                          : t.earTraining.noteSet.natural}
                    </span>
                  </div>
                  <div className="mt-3 sm:mt-4">
                    {settings.inputMode === "piano" ? (
                      <PianoKeyboard
                        onNoteClick={handleAnswer}
                        disabled={sessionState !== "playing"}
                        showAccidentals={settings.noteSet === "chromatic"}
                        className="flex justify-center"
                      />
                    ) : (
                      <SolfegeKeyboard
                        onNoteClick={handleAnswer}
                        disabled={sessionState !== "playing"}
                        showAccidentals={settings.noteSet === "chromatic"}
                        className="flex justify-center"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {result && (
              <EarTrainingResult
                result={result}
                stats={stats}
              />
            )}
          </div>
        </div>
    </main>
  );
}
