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
    <div className="">
      <div className="flex items-center justify-center space-x-4">
        {gameState === "idle" && (
          <button
            onClick={handleStartGame}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-s font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {t.startGame}
          </button>
        )}

        {gameState === "playing" && (
          <button
            onClick={handlePauseGame}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-s font-medium text-white bg-yellow-600 border border-transparent rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            {t.pauseGame}
          </button>
        )}

        {gameState === "paused" && (
          <button
            onClick={handleResumeGame}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-s font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {t.resumeGame}
          </button>
        )}

        {(gameState === "playing" || gameState === "paused") && (
          <button
            onClick={handleEndGame}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-s font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {t.endGame}
          </button>
        )}

        {gameState === "finished" && (
          <button
            onClick={handleResetGame}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-s font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {t.resetGame}
          </button>
        )}
      </div>
    </div>
  );
};

export default GameControl;
