"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import {
  applyKeySignature,
  generateQuestion,
  validateAnswer,
} from "@/lib/music/utils";
import { playPianoNote, initializeAudio } from "@/lib/music/audio";

// 컴포넌트 임포트
import Staff from "@/components/game/Staff";
import PianoKeyboard from "@/components/game/PianoKeyboard";
import SolfegeKeyboard from "@/components/game/SolfegeKeyboard";
import Timer from "@/components/game/Timer";
import ScoreBoard from "@/components/game/ScoreBoard";
import { useLanguageStore } from "@/store/languageStore";

const GameMain: React.FC = () => {
  const { t } = useTranslation();
  const {
    gameState,
    settings,
    answers,
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
    setTimeout(() => {
      setFeedback(null);
    }, 500);

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
        correctNote: currentQuestion.note,
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
      generateNewQuestion();
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
    ],
  );

  const { isInitialized } = useLanguageStore();

  // 언어 초기화가 완료될 때까지 로딩
  if (!isInitialized) {
    return null;
  }

  // 소리 재생 (문제 다시 듣기)
  // const handlePlaySound = useCallback(async () => {
  //   if (!currentQuestion || !settings.enableSound || !isAudioInitialized)
  //     return;

  //   try {
  //     await playPianoNote(currentQuestion.displayNote, 1000);
  //   } catch (error) {
  //     console.error("Failed to play sound:", error);
  //   }
  // }, [currentQuestion, settings.enableSound, isAudioInitialized]);

  return (
    <>
      <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="hidden space-y-6 lg:block">
            <Timer />
            <ScoreBoard />
          </div>
        </div>

        {/* 중앙: 게임 영역 */}
        <div className="min-w-0">
          {/* 모바일 점수판 버튼 */}
          <div className="lg:hidden mb-4 flex justify-end">
            <button
              onClick={() => setShowScoreBoardModal(true)}
              className="rounded-2xl border border-[#c4b5fd] bg-[#ede9fe] px-4 py-2 text-sm font-bold text-[#5b21b6] shadow-[0_8px_18px_rgba(76,29,149,0.08)]"
            >
              📊 {t.scoreboard.title}
            </button>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-[#ded6f7] bg-white shadow-[0_18px_50px_rgba(76,29,149,0.08)]">
            <div className="h-1.5 w-full bg-gradient-to-r from-[#5b21b6] via-[#6d28d9] to-[#ede9fe]" />
            <div className="p-6 lg:p-8">
              {/* 피드백 메시지 */}
              <div
                className={`mb-4 rounded-2xl border text-center font-bold fixed bottom-[50%] right-[50%] z-10
                  transition-opacity duration-300 ease-in-out transform translate-x-1/2
                  ${!!feedback ? "opacity-100 px-5 py-3 shadow-[0_14px_40px_rgba(76,29,149,0.12)]" : "opacity-0"}
                  ${
                    feedback?.type === "success"
                      ? "border-[#bbf7d0] bg-[#ecfdf5] text-[#166534]"
                      : "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]"
                  }`}
              >
                {feedback?.message}
              </div>

              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#6d28d9]">
                    {currentQuestion
                      ? t.clefs[currentQuestion.clef]
                      : t.gameTitle}
                  </p>
                  {/* <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
                  {t.ui.welcome}
                </h2> */}
                </div>
                <div className="rounded-full bg-[#ede9fe] px-4 py-2 text-sm font-bold text-[#5b21b6]">
                  {t.scoreboard.total}:{" "}
                  {currentQuestion ? answers.length + 1 : answers.length}
                </div>
              </div>

              {/* 오선지 */}
              {currentQuestion && (
                <div className="mb-6 rounded-[1.75rem] bg-[#f8fafc] p-5 lg:p-8">
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
              {/* {currentQuestion && settings.enableSound && isAudioInitialized && (
              <div className="mb-6 text-center">
                <button
                  onClick={handlePlaySound}
                  className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {t.messages.playSound}
                </button>
              </div>
            )} */}

              {/* 답안 입력 영역 */}
              {isGameActive() && (
                <div className="mt-6">
                  {settings.answerMode === "piano" ? (
                    <PianoKeyboard
                      onNoteClick={handleAnswerSubmit}
                      selectedNote={currentAnswer}
                      disabled={!isGameActive()}
                      className="flex flex-col items-center justify-center"
                    />
                  ) : (
                    <SolfegeKeyboard
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
                <div className="py-12 text-center">
                  <h2 className="mb-4 text-3xl font-black tracking-[-0.04em] text-slate-900">
                    {t.ui.welcome}
                  </h2>
                  <p className="mx-auto max-w-xl leading-8 text-slate-600">
                    {t.messages.startGameInstruction}
                  </p>
                </div>
              )}

              {/* 게임 완료 상태 */}
              {gameState === "finished" && (
                <div className="py-12 text-center">
                  <h2 className="mb-4 text-3xl font-black tracking-[-0.04em] text-[#10b981]">
                    {t.messages.gameComplete}
                  </h2>
                  <p className="mx-auto max-w-xl leading-8 text-slate-600">
                    {t.messages.gameCompleteInstruction}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 점수판 모달 */}
      {showScoreBoardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 lg:hidden">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-[1.75rem] border border-[#ded6f7] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between border-b border-[#ede9fe] p-4">
              <h2 className="text-lg font-black tracking-[-0.03em] text-slate-900">
                {t.scoreboard.title}
              </h2>
              <button
                onClick={() => setShowScoreBoardModal(false)}
                className="text-xl font-bold text-slate-400 hover:text-slate-700"
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
