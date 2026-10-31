"use client";

import React from "react";
import { FaPause, FaPlay, FaRedoAlt, FaStop } from "react-icons/fa";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";

const GameControl: React.FC<{ onStart?: () => void; busy?: boolean }> = ({
  onStart,
  busy = false,
}) => {
  const { t } = useTranslation();
  const { gameState, startGame, pauseGame, resumeGame, endGame, resetGame } =
    useGameStore();

  // 게임 제어 함수들
  const handleStartGame = () => {
    if (onStart) onStart();
    else startGame();
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
      <div className="grid grid-cols-2 gap-2">
        {gameState === "idle" && (
          <button
            type="button"
            onClick={handleStartGame}
            disabled={busy}
            className="col-span-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#5b21b6] px-3 py-2 text-sm font-bold text-white hover:bg-[#4c1d95]"
          >
            <FaPlay className="mr-2 text-sm" />
            {t.startGame}
          </button>
        )}

        {gameState === "playing" && (
          <button
            type="button"
            onClick={handlePauseGame}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            <FaPause className="mr-2 text-sm" />
            {t.pauseGame}
          </button>
        )}

        {gameState === "paused" && (
          <button
            type="button"
            onClick={handleResumeGame}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#5b21b6] px-3 py-2 text-sm font-bold text-white hover:bg-[#4c1d95]"
          >
            <FaPlay className="mr-2 text-sm" />
            {t.resumeGame}
          </button>
        )}

        {(gameState === "playing" || gameState === "paused") && (
          <button
            type="button"
            onClick={handleEndGame}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-white hover:bg-red-600"
          >
            <FaStop className="mr-2 text-sm" />
            {t.endGame}
          </button>
        )}

        {gameState === "finished" && (
          <button
            type="button"
            onClick={handleResetGame}
            className="col-span-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#5b21b6] px-3 py-2 text-sm font-bold text-white hover:bg-[#4c1d95]"
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
