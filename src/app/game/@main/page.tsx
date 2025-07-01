"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { generateQuestion, validateAnswer } from "@/lib/music/utils";
import { playPianoNote, initializeAudio } from "@/lib/music/audio";

// 컴포넌트 임포트
import Staff from "@/components/game/Staff";
import PianoKeyboard from "@/components/game/PianoKeyboard";
import SolfegeKeyboard from "@/components/game/SolfegeKeyboard";
import Timer from "@/components/game/Timer";
import ScoreBoard from "@/components/game/ScoreBoard";

const GameMain: React.FC = () => {
  const { t } = useTranslation();
  const {
    gameState,
    settings,
    currentQuestion,
    currentAnswer,
    feedback,
    setCurrentQuestion,
    setCurrentAnswer,
    addAnswer,
    isGameActive,
    startQuestionTimer,
    getQuestionElapsedTime,
    setFeedback,
  } = useGameStore();

  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [showScoreBoardModal, setShowScoreBoardModal] = useState(false);

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
    setFeedback,
    isAudioInitialized,
    startQuestionTimer,
  ]);

  // 게임 시작 시 첫 문제 생성
  useEffect(() => {
    if (gameState === "playing" && !currentQuestion) {
      generateNewQuestion();
    }
  }, [gameState, currentQuestion, generateNewQuestion]);

  // 답안 제출 처리
  const handleAnswerSubmit = useCallback(
    (answer: Note) => {
      if (!currentQuestion || !isGameActive()) return;

      const isCorrect = validateAnswer(currentQuestion, answer);
      const timeSpent = getQuestionElapsedTime();
      const answerData = {
        note: answer,
        timestamp: Date.now(),
        isCorrect,
        timeSpent,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      currentQuestion,
      isGameActive,
      addAnswer,
      setCurrentAnswer,
      generateNewQuestion,
      getQuestionElapsedTime,
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

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 overflow-hidden relative">
        {/* 왼쪽: 타이머와 점수판 (데스크톱만) */}
        <div className="hidden md:block md:col-span-1 space-y-6">
          <Timer />
          <ScoreBoard />
        </div>

        {/* 중앙: 게임 영역 */}
        <div className="md:col-span-3">
          {/* 모바일 점수판 버튼 */}
          <div className="md:hidden mb-4 flex justify-end">
            <button
              onClick={() => setShowScoreBoardModal(true)}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              📊 {t.scoreboard.title}
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            {/* 피드백 메시지 */}
            <div
              className={`mb-4 rounded-md text-center font-medium absolute bottom-2 right-2 z-10
                  transition-opacity duration-300 ease-in-out
                  ${!!feedback ? "opacity-100 p-3" : "opacity-0"}
                  ${
                    feedback?.type === "success"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
            >
              {feedback?.message}
            </div>

            {/* 오선지 */}
            {currentQuestion &&
              (settings.gameMode === "visual" ||
                settings.gameMode === "both") && (
                <div className="mb-6">
                  <Staff
                    clef={currentQuestion.clef}
                    keySignature={currentQuestion.keySignature}
                    note={currentQuestion.displayNote}
                    originalNote={currentQuestion.note}
                    className="flex justify-center"
                  />
                </div>
              )}

            {/* 소리 재생 버튼 */}
            {currentQuestion && settings.enableSound && isAudioInitialized && (
              <div className="mb-6 text-center">
                <button
                  onClick={handlePlaySound}
                  className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {t.messages.playSound}
                </button>
              </div>
            )}

            {/* 답안 입력 영역 */}
            {isGameActive() && (
              <div className="mt-6">
                {settings.answerMode === "piano" ? (
                  <PianoKeyboard
                    onNoteClick={handleAnswerSubmit}
                    selectedNote={currentAnswer}
                    disabled={!isGameActive()}
                    className="flex flex-col justify-center items-center"
                  />
                ) : (
                  <SolfegeKeyboard
                    startOctave={3}
                    endOctave={6}
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
                  {t.ui.welcome}
                </h2>
                <p className="text-gray-600">
                  {t.messages.startGameInstruction}
                </p>
              </div>
            )}

            {/* 게임 완료 상태 */}
            {gameState === "finished" && (
              <div className="text-center py-12">
                <h2 className="text-2xl font-semibold text-green-700 mb-4">
                  {t.messages.gameComplete}
                </h2>
                <p className="text-gray-600">
                  Check your results on the scoreboard!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 모바일 점수판 모달 */}
      {showScoreBoardModal && (
        <div className="md:hidden fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {t.scoreboard.title}
              </h2>
              <button
                onClick={() => setShowScoreBoardModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <ScoreBoard />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GameMain;
