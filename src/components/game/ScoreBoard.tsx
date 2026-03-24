"use client";

import React from "react";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";

interface ScoreBoardProps {
  className?: string;
}

const ScoreBoard: React.FC<ScoreBoardProps> = ({ className = "" }) => {
  const { t } = useTranslation();
  const {
    answers,
    getCurrentScore,
    getAccuracy,
    gameResult,
    stats,
    gameState,
  } = useGameStore();

  const currentScore = getCurrentScore();
  const currentAccuracy = getAccuracy();
  const totalQuestions = answers.length;

  return (
    <div className={`scoreboard-container ${className}`}>
      <div className="rounded-[1.75rem] border border-[#ded6f7] bg-white p-5 shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
        <h3 className="mb-5 break-words text-center text-base font-black uppercase tracking-[0.14em] text-slate-500 lg:text-lg lg:tracking-[0.16em]">
          {t.scoreboard.title}
        </h3>

        <div className="space-y-3 rounded-[1.5rem] border border-[#ede9fe] bg-[#faf9fe] p-3">
          <div className="flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-[#ede9fe] bg-white px-4 py-3">
            <span className="min-w-0 break-words text-xs font-bold uppercase tracking-[0.12em] text-slate-500 lg:text-sm lg:tracking-[0.14em]">
              {t.scoreboard.correct}
            </span>
            <span className="shrink-0 text-right text-lg font-black text-[#10b981] lg:text-xl">
              {currentScore}
            </span>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-[#ede9fe] bg-white px-4 py-3">
            <span className="min-w-0 break-words text-xs font-bold uppercase tracking-[0.12em] text-slate-500 lg:text-sm lg:tracking-[0.14em]">
              {t.scoreboard.total}
            </span>
            <span className="shrink-0 text-right text-lg font-black text-slate-900 lg:text-xl">
              {totalQuestions}
            </span>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-[#ede9fe] bg-white px-4 py-3">
            <span className="min-w-0 break-words text-xs font-bold uppercase tracking-[0.12em] text-slate-500 lg:text-sm lg:tracking-[0.14em]">
              {t.scoreboard.accuracy}
            </span>
            <span className="shrink-0 text-right text-lg font-black text-[#5b21b6] lg:text-xl">
              {currentAccuracy.toFixed(1)}%
            </span>
          </div>

          {/* 정확도 진행 바 */}
          <div className="h-2 w-full rounded-full bg-[#ede9fe]">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-[#ef4444] via-[#f59e0b] to-[#10b981] transition-all duration-300"
              style={{ width: `${currentAccuracy}%` }}
            />
          </div>
        </div>

        {/* 게임 완료 시 결과 */}
        {gameState === "finished" && gameResult && (
          <div className="mt-6 rounded-[1.5rem] border border-[#ede9fe] bg-[#faf9fe] p-4">
            <h4 className="mb-3 break-words text-xs font-black uppercase tracking-[0.12em] text-slate-500 lg:text-sm lg:tracking-[0.15em]">
              {t.scoreboard.gameResult}
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex min-w-0 justify-between gap-2">
                <span className="min-w-0 break-words text-slate-500">
                  {t.scoreboard.finalScore}
                </span>
                <span className="shrink-0 text-right font-bold text-slate-900">
                  {gameResult.correctAnswers}/{gameResult.totalQuestions}
                </span>
              </div>
              <div className="flex min-w-0 justify-between gap-2">
                <span className="min-w-0 break-words text-slate-500">
                  {t.scoreboard.finalAccuracy}
                </span>
                <span className="shrink-0 text-right font-bold text-[#5b21b6]">
                  {gameResult.accuracy.toFixed(1)}%
                </span>
              </div>
              <div className="flex min-w-0 justify-between gap-2">
                <span className="min-w-0 break-words text-slate-500">
                  {t.scoreboard.totalTime}
                </span>
                <span className="shrink-0 text-right font-bold text-slate-900">
                  {(gameResult.totalTime / 1000).toFixed(1)}
                  {t.units.seconds}
                </span>
              </div>
              <div className="flex min-w-0 justify-between gap-2">
                <span className="min-w-0 break-words text-slate-500">
                  {t.scoreboard.averageTime}
                </span>
                <span className="shrink-0 text-right font-bold text-slate-900">
                  {(gameResult.averageTime / 1000).toFixed(1)}
                  {t.units.seconds}/{t.units.questions}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 전체 통계 */}
        <div className="mt-6 rounded-[1.5rem] border border-[#ede9fe] bg-[#faf9fe] p-4">
          <h4 className="mb-3 break-words text-xs font-black uppercase tracking-[0.12em] text-slate-500 lg:text-sm lg:tracking-[0.15em]">
            {t.scoreboard.overallStats}
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex min-w-0 justify-between gap-2">
              <span className="min-w-0 break-words text-slate-500">
                {t.scoreboard.gamesPlayed}
              </span>
              <span className="shrink-0 text-right font-bold text-slate-900">
                {stats.gamesPlayed}
                {t.units.games}
              </span>
            </div>
            <div className="flex min-w-0 justify-between gap-2">
              <span className="min-w-0 break-words text-slate-500">
                {t.scoreboard.overallAccuracy}
              </span>
              <span className="shrink-0 text-right font-bold text-[#5b21b6]">
                {stats.averageAccuracy.toFixed(1)}%
              </span>
            </div>

            <div className="flex min-w-0 justify-between gap-2">
              <span className="min-w-0 break-words text-slate-500">
                {t.scoreboard.bestTime}
              </span>
              <span className="shrink-0 text-right font-bold text-[#5b21b6]">
                {stats.bestTime === Infinity
                  ? "-"
                  : `${(stats.bestTime / 1000).toFixed(1)}${t.units.seconds}`}
              </span>
            </div>
          </div>
        </div>

        {/* 최근 답안 히스토리 */}
        {answers.length > 0 && (
          <div className="mt-6 rounded-[1.5rem] border border-[#ede9fe] bg-[#faf9fe] p-4">
            <h4 className="mb-3 break-words text-xs font-black uppercase tracking-[0.12em] text-slate-500 lg:text-sm lg:tracking-[0.15em]">
              {t.scoreboard.recentAnswers}
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {answers
                .slice(-5)
                .reverse()
                .map((answer, index) => (
                  <div
                    key={`answer-${answers.length - index}`}
                    className={`rounded-2xl border p-3 text-sm ${
                      answer.isCorrect
                        ? "border-[#bbf7d0] bg-[#ecfdf5] text-[#166534]"
                        : "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="min-w-0 break-words font-bold">
                        {answer.note.name}
                        {answer.note.accidental === "sharp" && "#"}
                        {answer.note.accidental === "flat" && "♭"}
                        {answer.note.octave}
                        {answer.isCorrect
                          ? ""
                          : " (" + answer.correctNote.name + ")"}
                      </span>
                      <span
                        className={`text-xs ${
                          answer.isCorrect ? "text-[#10b981]" : "text-[#ef4444]"
                        }`}
                      >
                        {answer.isCorrect ? "✓" : "✗"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs opacity-75">
                      {(answer.timeSpent / 1000).toFixed(1)}
                      {t.units.seconds}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 성취 배지 */}
        {gameState === "finished" && gameResult && (
          <div className="mt-6 rounded-[1.5rem] border border-[#ede9fe] bg-[#faf9fe] p-4">
            <h4 className="mb-3 break-words text-xs font-black uppercase tracking-[0.12em] text-slate-500 lg:text-sm lg:tracking-[0.15em]">
              {t.scoreboard.achievements}
            </h4>
            <div className="flex flex-wrap gap-2">
              {gameResult.accuracy === 100 && (
                <span className="inline-flex items-center rounded-full bg-[#fef3c7] px-3 py-1 text-xs font-bold text-[#92400e]">
                  {t.achievements.perfect}
                </span>
              )}
              {gameResult.accuracy >= 90 && (
                <span className="inline-flex items-center rounded-full bg-[#dcfce7] px-3 py-1 text-xs font-bold text-[#166534]">
                  {t.achievements.excellent}
                </span>
              )}
              {gameResult.accuracy >= 70 && (
                <span className="inline-flex items-center rounded-full bg-[#dbeafe] px-3 py-1 text-xs font-bold text-[#1d4ed8]">
                  {t.achievements.good}
                </span>
              )}
              {gameResult.totalQuestions >= 10 && (
                <span className="inline-flex items-center rounded-full bg-[#ede9fe] px-3 py-1 text-xs font-bold text-[#5b21b6]">
                  {t.achievements.endurance}
                </span>
              )}
              {gameResult.averageTime < 3000 && (
                <span className="inline-flex items-center rounded-full bg-[#ffedd5] px-3 py-1 text-xs font-bold text-[#c2410c]">
                  {t.achievements.fast}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoreBoard;
