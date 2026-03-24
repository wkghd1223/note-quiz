"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface EarTrainingStatusProps {
  sessionState: GameState;
  elapsedTime: number;
  questionTime: number;
  totalQuestions: number;
  accuracy: number;
}

const EarTrainingStatus: React.FC<EarTrainingStatusProps> = ({
  sessionState,
  elapsedTime,
  questionTime,
  totalQuestions,
  accuracy,
}) => {
  const { t } = useTranslation();

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((milliseconds % 1000) / 100);

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${tenths}`;
  };

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 sm:hidden">
        <div className="rounded-2xl border border-[#ede9fe] bg-[#faf9fe] px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {t.timer.elapsed}
          </p>
          <p className="mt-1 font-mono text-lg font-black text-[#5b21b6]">
            {formatTime(elapsedTime)}
          </p>
        </div>
        {sessionState === "playing" ? (
          <div className="rounded-2xl border border-[#ede9fe] bg-[#faf9fe] px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              {t.ui.currentQuestionTime}
            </p>
            <p className="mt-1 font-mono text-lg font-black text-slate-950">
              {formatTime(questionTime)}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#ede9fe] bg-[#faf9fe] px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              {t.scoreboard.total}
            </p>
            <p className="mt-1 text-lg font-black text-slate-950">{totalQuestions}</p>
          </div>
        )}
        <div className="flex items-stretch">
          <span
            className={`inline-flex min-w-[5.6rem] items-center justify-center rounded-2xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] ${
              sessionState === "playing"
                ? "bg-[#dcfce7] text-[#166534]"
                : sessionState === "paused"
                  ? "bg-[#fef3c7] text-[#92400e]"
                  : sessionState === "finished"
                    ? "bg-[#fee2e2] text-[#991b1b]"
                    : "bg-[#ede9fe] text-[#5b21b6]"
            }`}
          >
            {t.gameStates[sessionState]}
          </span>
        </div>
      </div>
      <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl bg-[#faf9fe] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {t.timer.elapsed}
          </p>
          <p className="mt-1 font-mono text-2xl font-black text-[#5b21b6]">
            {formatTime(elapsedTime)}
          </p>
        </div>
        <div className="rounded-2xl bg-[#faf9fe] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {t.ui.currentQuestionTime}
          </p>
          <p className="mt-1 font-mono text-2xl font-black text-slate-950">
            {formatTime(questionTime)}
          </p>
        </div>
        <div className="rounded-2xl bg-[#faf9fe] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {t.scoreboard.total}
          </p>
          <p className="mt-1 text-2xl font-black text-slate-950">{totalQuestions}</p>
        </div>
        <div className="rounded-2xl bg-[#faf9fe] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {t.scoreboard.accuracy}
          </p>
          <p className="mt-1 text-2xl font-black text-slate-950">
            {accuracy.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-2xl bg-[#faf9fe] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {t.gameStates[sessionState]}
          </p>
          <p className="mt-1 text-2xl font-black text-[#10b981]">
            {t.gameStates[sessionState]}
          </p>
        </div>
      </div>
    </>
  );
};

export default EarTrainingStatus;
