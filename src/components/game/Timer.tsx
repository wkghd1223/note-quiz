"use client";

import React, { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import GameControl from "./GameControl";
import GameSettingsTrigger from "./GameSettingsTrigger";

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
      <div className="rounded-[1.75rem] border border-[#ded6f7] bg-white p-3 shadow-[0_14px_40px_rgba(76,29,149,0.08)] lg:p-5">
        <div className="mb-3 lg:mb-4 lg:border-b lg:border-[#ede9fe] lg:pb-4">
          <GameControl />
        </div>

        <div className="lg:hidden">
          <div className="rounded-[1.5rem] border border-[#ece7fb] bg-[linear-gradient(180deg,_#ffffff_0%,_#faf7ff_100%)] p-3 shadow-[0_10px_24px_rgba(76,29,149,0.06)]">
            <div className="flex items-start gap-2">
              <div
                className="min-w-0 flex-1 rounded-[1.25rem] border border-[#ede9fe] bg-white px-3 py-3"
                style={{ height: "stretch" }}
              >
                <div
                  className={`grid gap-3 ${
                    gameState === "playing" ? "grid-cols-2" : "grid-cols-1"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      {settings.timeLimit ? t.timer.remaining : t.timer.elapsed}
                    </div>
                    <div
                      className={`mt-1 font-mono text-[1.85rem] font-black leading-none ${
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
                  </div>

                  {gameState === "playing" && (
                    <div className="min-w-0 border-l border-[#ede9fe] pl-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                        {t.ui.currentQuestionTime}
                      </div>
                      <div className="mt-1 font-mono text-[1.85rem] font-black leading-none text-slate-900">
                        {formatTime(questionTime)}
                      </div>
                    </div>
                  )}
                </div>

                {settings.timeLimit && (
                  <div className="mt-3">
                    <div className="h-1.5 w-full rounded-full bg-[#ede9fe]">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-200 ${
                          isTimeRunningOut
                            ? "bg-red-500"
                            : "bg-gradient-to-r from-[#4c1d95] to-[#7c3aed]"
                        }`}
                        style={{
                          width: `${(remainingTime / (settings.timeLimit * 1000)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <span
                className={`inline-flex min-h-[5.25rem] min-w-[6.2rem] items-center justify-center rounded-[1.25rem] px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.1em] ${
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

        <div className="hidden lg:block">
          <div className="grid gap-4">
            <div className="grid gap-4">
              <div className="min-w-0 rounded-2xl border border-[#ede9fe] bg-[#faf9fe] px-5 py-4 text-center">
                <div className="mb-1 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                  {settings.timeLimit ? t.timer.remaining : t.timer.elapsed}
                </div>
                <div
                  className={`font-mono text-4xl font-black leading-none transition-colors duration-200 ${
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

                {settings.timeLimit && (
                  <div className="mt-3">
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
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {settings.timeLimit}
                    </div>
                  </div>
                )}
              </div>

              {gameState === "playing" && (
                <div className="min-w-0 rounded-2xl border border-[#ede9fe] bg-[#faf9fe] px-5 py-4 text-center">
                  <div className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    {t.ui.currentQuestionTime}
                  </div>
                  <div className="font-mono text-3xl font-bold leading-none text-[#6d28d9]">
                    {formatTime(questionTime)}
                  </div>
                </div>
              )}
            </div>

            <span
              className={`inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] ${
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

            <div className="border-t border-[#ede9fe] pt-4">
              <GameSettingsTrigger />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timer;
