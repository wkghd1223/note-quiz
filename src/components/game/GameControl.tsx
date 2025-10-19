"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { applyKeySignature, generateQuestion } from "@/lib/music/utils";
import { playPianoNote, initializeAudio } from "@/lib/music/audio";

const GameControl: React.FC = () => {
  const { t } = useTranslation();
  const {
    gameState,
    settings,
    currentQuestion,
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    resetGame,
    setCurrentQuestion,
    setCurrentAnswer,
    isGameActive,
    startQuestionTimer,
    setFeedback,
  } = useGameStore();

  // const [feedback, setFeedback] = useState<>(null);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);

  // 오디오 초기화
  useEffect(() => {
    const initAudio = async () => {
      try {
        await initializeAudio();
        setIsAudioInitialized(true);
      } catch (error) {
        console.error("Failed to initialize audio:", error);
      }
    };

    initAudio();
  }, []);

  // 새 문제 생성
  const generateNewQuestion = useCallback(() => {
    if (!isGameActive()) return;

    const question = generateQuestion(settings);
    setCurrentQuestion(question);
    setCurrentAnswer(null);
    setFeedback(null);

    // 문제별 타이머 시작
    startQuestionTimer();

    // 소리 재생
    if (settings.enableSound && isAudioInitialized) {
      setTimeout(() => {
        const note = applyKeySignature(question.note, question.keySignature);
        playPianoNote(note, 1000).catch(console.error);
      }, 500);
    }
  }, [
    settings,
    isGameActive,
    setCurrentQuestion,
    setCurrentAnswer,
    isAudioInitialized,
    startQuestionTimer,
  ]);

  // 게임 시작 시 첫 문제 생성
  useEffect(() => {
    if (gameState === "playing" && !currentQuestion) {
      // generateNewQuestion();
    }
  }, [gameState, currentQuestion, generateNewQuestion]);

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
