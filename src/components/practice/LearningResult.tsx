"use client";

import React, { useEffect, useId, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";

export interface LearningResultData {
  totalQuestions: number;
  correctAnswers: number;
  totalTime: number;
  accuracy: number;
  averageTime?: number;
  completed?: boolean;
}

export interface LearningResultProps {
  result: LearningResultData;
  onRestart: () => void;
  onReview: () => void;
  onChange: () => void;
  hasMistakes: boolean;
  children?: React.ReactNode;
}

export default function LearningResult({
  result,
  onRestart,
  onReview,
  onChange,
  hasMistakes,
  children,
}: LearningResultProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (document.querySelector("dialog[open]")) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, []);
  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
      aria-labelledby={titleId}
    >
      <h2
        ref={heading}
        id={titleId}
        tabIndex={-1}
        className="text-xl font-black text-slate-950"
      >
        {t.scoreboard.gameResult}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {result.completed ? t.learning.complete : t.learning.stopped}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3 border-y border-slate-200 py-4">
        {[
          [
            t.scoreboard.correct,
            `${result.correctAnswers}/${result.totalQuestions}`,
          ],
          [t.scoreboard.accuracy, `${result.accuracy.toFixed(0)}%`],
          [
            t.scoreboard.totalTime,
            `${(result.totalTime / 1000).toFixed(1)} ${t.units.seconds}`,
          ],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <p className="text-xs font-bold text-slate-500 [overflow-wrap:anywhere]">
              {label}
            </p>
            <p className="mt-1 text-lg font-black tabular-nums text-slate-950">
              {value}
            </p>
          </div>
        ))}
      </div>
      {children && <div className="mt-4 space-y-3">{children}</div>}
      {!result.totalQuestions ? (
        <p className="mt-4 text-sm text-slate-600">{t.learning.noAnswers}</p>
      ) : (
        !hasMistakes && (
          <p className="mt-4 text-sm text-slate-600">{t.learning.noMistakes}</p>
        )
      )}
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onRestart}
          className="min-h-11 rounded-lg bg-[#5b21b6] px-3 py-2 text-sm font-bold text-white"
        >
          {t.learning.restart}
        </button>
        <button
          type="button"
          onClick={onReview}
          disabled={!hasMistakes}
          className="min-h-11 rounded-lg border border-[#ded6f7] bg-white px-3 py-2 text-sm font-bold text-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t.learning.review}
        </button>
        <button
          type="button"
          onClick={onChange}
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
        >
          {t.learning.changePractice}
        </button>
      </div>
    </section>
  );
}
