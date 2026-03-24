"use client";

import React from "react";
import { FaPause, FaPlay, FaRedoAlt, FaStop } from "react-icons/fa";
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
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:justify-center md:gap-3">
        {gameState === "idle" && (
          <button
            onClick={handleStartGame}
            className="col-span-2 inline-flex w-full items-center justify-center rounded-[1.15rem] bg-gradient-to-r from-[#5b21b6] to-[#6d28d9] px-4 py-2.5 text-[15px] font-bold text-white shadow-[0_12px_28px_rgba(91,33,182,0.26)] hover:-translate-y-0.5 md:min-w-[9rem] md:w-auto md:rounded-2xl md:px-5 md:py-3 md:text-sm"
          >
            <FaPlay className="mr-2 text-sm" />
            {t.startGame}
          </button>
        )}

        {gameState === "playing" && (
          <button
            onClick={handlePauseGame}
            className="inline-flex w-full items-center justify-center rounded-[1.1rem] bg-[#f59e0b] px-4 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_24px_rgba(245,158,11,0.24)] hover:-translate-y-0.5 md:min-w-[9rem] md:w-auto md:rounded-2xl md:px-5 md:py-3"
          >
            <FaPause className="mr-2 text-sm" />
            {t.pauseGame}
          </button>
        )}

        {gameState === "paused" && (
          <button
            onClick={handleResumeGame}
            className="inline-flex w-full items-center justify-center rounded-[1.1rem] bg-[#10b981] px-4 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_24px_rgba(16,185,129,0.24)] hover:-translate-y-0.5 md:min-w-[9rem] md:w-auto md:rounded-2xl md:px-5 md:py-3"
          >
            <FaPlay className="mr-2 text-sm" />
            {t.resumeGame}
          </button>
        )}

        {(gameState === "playing" || gameState === "paused") && (
          <button
            onClick={handleEndGame}
            className="inline-flex w-full items-center justify-center rounded-[1.1rem] bg-[#ef4444] px-4 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_24px_rgba(239,68,68,0.22)] hover:-translate-y-0.5 md:min-w-[9rem] md:w-auto md:rounded-2xl md:px-5 md:py-3"
          >
            <FaStop className="mr-2 text-sm" />
            {t.endGame}
          </button>
        )}

        {gameState === "finished" && (
          <button
            onClick={handleResetGame}
            className="col-span-2 inline-flex w-full items-center justify-center rounded-[1.15rem] bg-gradient-to-r from-[#5b21b6] to-[#6d28d9] px-4 py-2.5 text-[15px] font-bold text-white shadow-[0_12px_28px_rgba(91,33,182,0.26)] hover:-translate-y-0.5 md:min-w-[9rem] md:w-auto md:rounded-2xl md:px-5 md:py-3 md:text-sm"
          >
            <FaRedoAlt className="mr-2 text-sm" />
            {t.resetGame}
          </button>
        )}
      </div>
    </div>
  );
};

export default GameControl;
