"use client";

import React from "react";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";

const GameControl: React.FC = () => {
  const { t } = useTranslation();
  const { gameState, startGame, pauseGame, resumeGame, endGame, resetGame } =
    useGameStore();

  // 게임 제어 함수들
  const handleStartGame = () => {
    startGame();
  };

  const handlePauseGame = () => {
    pauseGame();
  };

  const handleResumeGame = () => {
    resumeGame();
  };

  const handleEndGame = () => {
    endGame();
  };

  const handleResetGame = () => {
    resetGame();
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-3">
        {gameState === "idle" && (
          <button
            onClick={handleStartGame}
            className="inline-flex min-w-[5.8rem] items-center justify-center rounded-xl bg-gradient-to-r from-[#5b21b6] to-[#6d28d9] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(91,33,182,0.26)] hover:-translate-y-0.5 md:min-w-[9rem] md:rounded-2xl md:px-5 md:py-3 md:text-sm"
          >
            {t.startGame}
          </button>
        )}

        {gameState === "playing" && (
          <button
            onClick={handlePauseGame}
            className="inline-flex min-w-[5.8rem] items-center justify-center rounded-xl bg-[#f59e0b] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(245,158,11,0.24)] hover:-translate-y-0.5 md:min-w-[9rem] md:rounded-2xl md:px-5 md:py-3 md:text-sm"
          >
            {t.pauseGame}
          </button>
        )}

        {gameState === "paused" && (
          <button
            onClick={handleResumeGame}
            className="inline-flex min-w-[5.8rem] items-center justify-center rounded-xl bg-[#10b981] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(16,185,129,0.24)] hover:-translate-y-0.5 md:min-w-[9rem] md:rounded-2xl md:px-5 md:py-3 md:text-sm"
          >
            {t.resumeGame}
          </button>
        )}

        {(gameState === "playing" || gameState === "paused") && (
          <button
            onClick={handleEndGame}
            className="inline-flex min-w-[5.8rem] items-center justify-center rounded-xl bg-[#ef4444] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(239,68,68,0.22)] hover:-translate-y-0.5 md:min-w-[9rem] md:rounded-2xl md:px-5 md:py-3 md:text-sm"
          >
            {t.endGame}
          </button>
        )}

        {gameState === "finished" && (
          <button
            onClick={handleResetGame}
            className="inline-flex min-w-[5.8rem] items-center justify-center rounded-xl bg-gradient-to-r from-[#5b21b6] to-[#6d28d9] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(91,33,182,0.26)] hover:-translate-y-0.5 md:min-w-[9rem] md:rounded-2xl md:px-5 md:py-3 md:text-sm"
          >
            {t.resetGame}
          </button>
        )}
      </div>
    </div>
  );
};

export default GameControl;
