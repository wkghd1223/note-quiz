"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { generateQuestion, validateAnswer } from "@/lib/music/utils";
import { playPianoNote, initializeAudio } from "@/lib/music/audio";
import { Note } from "@/types/music";

// 컴포넌트 임포트
import Staff from "@/components/game/Staff";
import PianoKeyboard from "@/components/game/PianoKeyboard";
import SolfegeKeyboard from "@/components/game/SolfegeKeyboard";
import GameSettings from "@/components/game/GameSettings";
import Timer from "@/components/game/Timer";
import ScoreBoard from "@/components/game/ScoreBoard";
import GameResultModal from "@/components/game/GameResultModal";

const GamePage: React.FC = () => {
  const { t } = useTranslation();
  const {
    gameState,
    settings,
    currentQuestion,
    currentAnswer,
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    resetGame,
    setCurrentQuestion,
    setCurrentAnswer,
    addAnswer,
    isGameActive,
  } = useGameStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
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

    // 오디오 모드일 때 소리 재생
    if (settings.gameMode === "audio" || settings.gameMode === "both") {
      if (settings.enableSound && isAudioInitialized) {
        setTimeout(() => {
          playPianoNote(question.displayNote, 1000).catch(console.error);
        }, 500);
      }
    }
  }, [
    settings,
    isGameActive,
    setCurrentQuestion,
    setCurrentAnswer,
    isAudioInitialized,
  ]);

  // 게임 시작 시 첫 문제 생성
  useEffect(() => {
    if (gameState === "playing" && !currentQuestion) {
      generateNewQuestion();
    }
  }, [gameState, currentQuestion, generateNewQuestion]);

  // 게임 완료 시 결과 모달 표시
  useEffect(() => {
    if (gameState === "finished") {
      setShowResultModal(true);
    }
  }, [gameState]);

  // 답안 제출 처리
  const handleAnswerSubmit = useCallback(
    (answer: Note) => {
      if (!currentQuestion || !isGameActive()) return;

      const isCorrect = validateAnswer(currentQuestion, answer);
      const answerData = {
        note: answer,
        timestamp: Date.now(),
        isCorrect,
      };

      addAnswer(answerData);
      setCurrentAnswer(answer);

      // 피드백 표시
      setFeedback({
        message: isCorrect ? t.messages.correct : t.messages.incorrect,
        type: isCorrect ? "success" : "error",
      });

      // 다음 문제로 넘어가기
      setTimeout(() => {
        generateNewQuestion();
      }, 1500);
    },
    [
      currentQuestion,
      isGameActive,
      addAnswer,
      setCurrentAnswer,
      generateNewQuestion,
      t,
    ]
  );

  // 소리 재생 (문제 다시 듣기)
  const handlePlaySound = useCallback(async () => {
    if (!currentQuestion || !settings.enableSound || !isAudioInitialized)
      return;

    try {
      await playPianoNote(currentQuestion.displayNote, 1000);
    } catch (error) {
      console.error("Failed to play sound:", error);
    }
  }, [currentQuestion, settings.enableSound, isAudioInitialized]);

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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">{t.gameTitle}</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {t.settings}
              </button>
            </div>
          </div>
        </header>

        {/* 게임 컨트롤 */}
        <div className="mb-6">
          <div className="flex items-center justify-center space-x-4">
            {gameState === "idle" && (
              <button
                onClick={handleStartGame}
                className="px-6 py-3 text-lg font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {t.startGame}
              </button>
            )}

            {gameState === "playing" && (
              <button
                onClick={handlePauseGame}
                className="px-6 py-3 text-lg font-medium text-white bg-yellow-600 border border-transparent rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                {t.pauseGame}
              </button>
            )}

            {gameState === "paused" && (
              <button
                onClick={handleResumeGame}
                className="px-6 py-3 text-lg font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {t.resumeGame}
              </button>
            )}

            {(gameState === "playing" || gameState === "paused") && (
              <button
                onClick={handleEndGame}
                className="px-6 py-3 text-lg font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {t.endGame}
              </button>
            )}

            {gameState === "finished" && (
              <button
                onClick={handleResetGame}
                className="px-6 py-3 text-lg font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {t.resetGame}
              </button>
            )}
          </div>
        </div>

        {/* 메인 게임 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 왼쪽: 타이머와 점수판 */}
          <div className="lg:col-span-1 space-y-6">
            <Timer />
            <ScoreBoard />
          </div>

          {/* 중앙: 게임 영역 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-md p-6">
              {/* 피드백 메시지 */}
              {feedback && (
                <div
                  className={`mb-4 p-3 rounded-md text-center font-medium ${
                    feedback.type === "success"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              {/* 오선지 */}
              {currentQuestion &&
                (settings.gameMode === "visual" ||
                  settings.gameMode === "both") && (
                  <div className="mb-6">
                    <Staff
                      clef={currentQuestion.clef}
                      keySignature={currentQuestion.keySignature}
                      note={currentQuestion.displayNote}
                      className="flex justify-center"
                    />
                  </div>
                )}

              {/* 소리 재생 버튼 */}
              {currentQuestion &&
                settings.enableSound &&
                isAudioInitialized && (
                  <div className="mb-6 text-center">
                    <button
                      onClick={handlePlaySound}
                      className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      🔊 소리 듣기
                    </button>
                  </div>
                )}

              {/* 답안 입력 영역 */}
              {isGameActive() && (
                <div className="mt-6">
                  {settings.answerMode === "piano" ? (
                    <PianoKeyboard
                      startOctave={settings.octaveRange.min}
                      endOctave={settings.octaveRange.max}
                      onNoteClick={handleAnswerSubmit}
                      selectedNote={currentAnswer}
                      disabled={!isGameActive()}
                      className="flex justify-center"
                    />
                  ) : (
                    <SolfegeKeyboard
                      startOctave={settings.octaveRange.min}
                      endOctave={settings.octaveRange.max}
                      onNoteClick={handleAnswerSubmit}
                      selectedNote={currentAnswer}
                      disabled={!isGameActive()}
                      className="flex justify-center"
                    />
                  )}
                </div>
              )}

              {/* 게임 대기 상태 */}
              {gameState === "idle" && (
                <div className="text-center py-12">
                  <h2 className="text-2xl font-semibold text-gray-700 mb-4">
                    게임을 시작해보세요!
                  </h2>
                  <p className="text-gray-600">
                    설정을 조정한 후 "게임 시작" 버튼을 클릭하세요.
                  </p>
                </div>
              )}

              {/* 게임 완료 상태 */}
              {gameState === "finished" && (
                <div className="text-center py-12">
                  <h2 className="text-2xl font-semibold text-green-700 mb-4">
                    {t.messages.gameComplete}
                  </h2>
                  <p className="text-gray-600">점수판에서 결과를 확인하세요!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 설정 모달 */}
      <GameSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};

export default GamePage;
