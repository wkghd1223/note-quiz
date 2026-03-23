"use client";

import React, { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import GameControl from "./GameControl";

interface TimerProps {
  className?: string;
}

const Timer: React.FC<TimerProps> = ({ className = "" }) => {
  const { t } = useTranslation();
  const {
    gameState,
    elapsedTime,
    updateTimer,
    settings,
    endGame,
    getQuestionElapsedTime,
  } = useGameStore();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [displayTime, setDisplayTime] = useState(0);
  const [questionTime, setQuestionTime] = useState(0);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (gameState === "playing") {
      intervalId = setInterval(() => {
        const now = Date.now();
        updateTimer(now);
        setDisplayTime(elapsedTime);
        setQuestionTime(getQuestionElapsedTime());

        // 시간 제한 체크
        if (settings.timeLimit && elapsedTime >= settings.timeLimit * 1000) {
          endGame();
        }
      }, 100); // 100ms마다 업데이트
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [
    gameState,
    elapsedTime,
    updateTimer,
    settings.timeLimit,
    endGame,
    getQuestionElapsedTime,
  ]);

  // 시간을 MM:SS.T 형식으로 포맷
  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((milliseconds % 1000) / 100);

    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${tenths}`;
  };

  // 시간 제한이 있을 때 남은 시간 계산
  const getRemainingTime = (): number => {
    if (!settings.timeLimit) return 0;
    return Math.max(0, settings.timeLimit * 1000 - elapsedTime);
  };

  const remainingTime = getRemainingTime();
  const isTimeRunningOut = settings.timeLimit && remainingTime < 10000; // 10초 미만

  return (
    <div className={`timer-container ${className}`}>
      <div className="rounded-[1rem] border border-[#ded6f7] bg-white px-2 py-2 shadow-[0_4px_14px_rgba(15,23,42,0.05)] lg:rounded-[1.5rem] lg:p-5">
        <div className="mb-2 border-b border-[#ede9fe] pb-2 lg:mb-4 lg:pb-4">
          <GameControl />
        </div>
        <div className="flex items-center gap-2 lg:grid lg:grid-cols-1 lg:gap-4">
          <div className="min-w-0 flex-1 rounded-xl bg-[#faf9fe] px-2.5 py-2 text-center lg:min-w-0 lg:rounded-2xl lg:border lg:border-[#ede9fe] lg:px-5 lg:py-4">
            <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 lg:mb-1 lg:text-sm lg:tracking-[0.2em]">
              {settings.timeLimit ? t.timer.remaining : t.timer.elapsed}
            </div>
            <div
              className={`font-mono text-lg font-black leading-none transition-colors duration-200 lg:text-4xl ${
                isTimeRunningOut
                  ? "animate-pulse text-red-500"
                  : gameState === "playing"
                    ? "text-[#5b21b6]"
                    : "text-slate-900"
              }`}
            >
              {settings.timeLimit
                ? formatTime(remainingTime)
                : formatTime(elapsedTime)}
            </div>
            {/* 시간 제한이 있을 때 진행 바 */}
            {settings.timeLimit && (
              <div className="mt-1.5 lg:mt-3">
                <div className="h-2 w-full rounded-full bg-[#ede9fe]">
                  <div
                    className={`h-2 rounded-full transition-all duration-200 ${
                      isTimeRunningOut
                        ? "bg-red-500"
                        : "bg-gradient-to-r from-[#4c1d95] to-[#7c3aed]"
                    }`}
                    style={{
                      width: `${(remainingTime / (settings.timeLimit * 1000)) * 100}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-[9px] font-semibold text-slate-500 lg:text-xs">
                  {settings.timeLimit}
                </div>
              </div>
            )}
          </div>

          {/* 문제별 시간 표시 */}
          {gameState === "playing" && (
            <div className="min-w-0 flex-1 rounded-xl bg-[#faf9fe] px-2.5 py-2 text-center lg:min-w-0 lg:rounded-2xl lg:border lg:border-[#ede9fe] lg:px-5 lg:py-4">
              <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500 lg:mb-1 lg:text-xs lg:tracking-[0.16em]">
                {t.ui.currentQuestionTime}
              </div>
              <div className="font-mono text-lg font-bold leading-none text-[#6d28d9] lg:text-3xl">
                {formatTime(questionTime)}
              </div>
            </div>
          )}

          <div className="flex min-w-[5.4rem] items-center justify-center lg:min-w-0">
            <span
              className={`inline-flex w-full items-center justify-center rounded-xl px-2 py-2 text-[9px] font-bold uppercase tracking-[0.08em] lg:rounded-full lg:px-4 lg:py-2 lg:text-xs lg:tracking-[0.15em] ${
                gameState === "playing"
                  ? "bg-[#dcfce7] text-[#166534]"
                  : gameState === "paused"
                    ? "bg-[#fef3c7] text-[#92400e]"
                    : gameState === "finished"
                      ? "bg-[#fee2e2] text-[#991b1b]"
                      : "bg-[#ede9fe] text-[#5b21b6]"
              }`}
            >
              {gameState === "playing" && t.gameStates.playing}
              {gameState === "paused" && t.gameStates.paused}
              {gameState === "finished" && t.gameStates.finished}
              {gameState === "idle" && t.gameStates.idle}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timer;
