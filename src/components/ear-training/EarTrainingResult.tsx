"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface EarTrainingResultProps {
  result: EarTrainingResult;
  stats: EarTrainingStats;
}

const EarTrainingResult: React.FC<EarTrainingResultProps> = ({
  result,
  stats,
}) => {
  const { t } = useTranslation();

  return (
    <div className="rounded-[1.6rem] border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
      <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
        {t.earTraining.result.title}
      </h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-[#faf9fe] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {t.scoreboard.finalScore}
          </p>
          <p className="mt-1 text-3xl font-black text-[#5b21b6]">
            {result.correctAnswers}/{result.totalQuestions}
          </p>
        </div>
        <div className="rounded-2xl bg-[#faf9fe] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {t.scoreboard.finalAccuracy}
          </p>
          <p className="mt-1 text-3xl font-black text-slate-950">
            {result.accuracy.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-2xl bg-[#faf9fe] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {t.earTraining.result.averageTime}
          </p>
          <p className="mt-1 text-2xl font-black text-slate-950">
            {(result.averageTime / 1000).toFixed(1)}
            {t.units.seconds}
          </p>
        </div>
        <div className="rounded-2xl bg-[#faf9fe] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {t.earTraining.result.replayCount}
          </p>
          <p className="mt-1 text-2xl font-black text-slate-950">
            {result.replayCount}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[#ede9fe] bg-[#faf9fe] p-4">
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-slate-500">{t.earTraining.result.bestAccuracy}</span>
          <span className="font-bold text-[#5b21b6]">
            {stats.bestAccuracy.toFixed(1)}%
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-3 text-sm">
          <span className="text-slate-500">
            {t.earTraining.result.sessionsPlayed}
          </span>
          <span className="font-bold text-slate-950">{stats.sessionsPlayed}</span>
        </div>
      </div>
    </div>
  );
};

export default EarTrainingResult;
