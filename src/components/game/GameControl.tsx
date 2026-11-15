"use client";

import React from "react";
import { FaPause, FaPlay, FaRedoAlt, FaStop } from "react-icons/fa";
import { useShallow } from "zustand/react/shallow";
import PracticeController, {
  type PracticeAction,
} from "@/components/practice/PracticeController";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";

const GameControl: React.FC<{ onStart?: () => void; busy?: boolean }> = ({
  onStart,
  busy = false,
}) => {
  const { t } = useTranslation();
  const { gameState, startGame, pauseGame, resumeGame, endGame, resetGame } =
    useGameStore(
      useShallow((state) => ({
        gameState: state.gameState,
        startGame: state.startGame,
        pauseGame: state.pauseGame,
        resumeGame: state.resumeGame,
        endGame: state.endGame,
        resetGame: state.resetGame,
      })),
    );

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

  const end: PracticeAction = {
    id: "end",
    label: t.endGame,
    onClick: handleEndGame,
    tone: "danger",
    icon: <FaStop />,
  };
  return (
    <PracticeController
      state={gameState}
      states={{
        idle: [
          {
            id: "start",
            label: t.startGame,
            onClick: handleStartGame,
            disabled: busy,
            tone: "primary",
            icon: <FaPlay />,
          },
        ],
        playing: [
          {
            id: "pause",
            label: t.pauseGame,
            onClick: handlePauseGame,
            icon: <FaPause />,
          },
          end,
        ],
        paused: [
          {
            id: "resume",
            label: t.resumeGame,
            onClick: handleResumeGame,
            tone: "primary",
            icon: <FaPlay />,
          },
          end,
        ],
        finished: [
          {
            id: "reset",
            label: t.resetGame,
            onClick: handleResetGame,
            tone: "primary",
            icon: <FaRedoAlt />,
          },
        ],
      }}
    />
  );
};

export default GameControl;
