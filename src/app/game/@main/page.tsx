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
import GameSettingsTrigger from "@/components/game/GameSettingsTrigger";
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
      <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="hidden space-y-6 lg:block">
            <Timer />
            <ScoreBoard />
          </div>
        </div>

        {/* 중앙: 게임 영역 */}
        <div className="min-w-0">
          <div className="mb-4 lg:hidden">
            <Timer />
          </div>

          <div className="mb-4 flex lg:hidden">
            <button
              onClick={() => setShowScoreBoardModal(true)}
              className="inline-flex items-center rounded-2xl border border-[#ded6f7] bg-white px-4 py-2.5 text-sm font-bold text-[#5b21b6] shadow-[0_10px_24px_rgba(76,29,149,0.08)]"
            >
              📊 {t.scoreboard.title}
            </button>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-[#ded6f7] bg-white shadow-[0_18px_50px_rgba(76,29,149,0.08)]">
            <div className="h-1.5 w-full bg-gradient-to-r from-[#5b21b6] via-[#6d28d9] to-[#ede9fe]" />
            <div className="bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.08),transparent_42%),linear-gradient(180deg,_#ffffff_0%,_#faf9fe_100%)] p-4 sm:p-6 lg:p-8">
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

              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#6d28d9] sm:text-sm sm:tracking-[0.2em]">
                    {currentQuestion
                      ? t.clefs[currentQuestion.clef]
                      : t.gameTitle}
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-slate-950 sm:text-3xl">
                    {currentQuestion
                      ? t.messages.whichNoteShown
                      : t.ui.welcome}
                  </h2>
                  {!currentQuestion && (
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                      {t.messages.startGameInstruction}
                    </p>
                  )}
                </div>
                <div className="rounded-full bg-[#ede9fe] px-4 py-2 text-sm font-bold text-[#5b21b6] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                  {t.scoreboard.total}:{" "}
                  {currentQuestion ? answers.length + 1 : answers.length}
                </div>
              </div>

              {currentQuestion ? (
                <div className="rounded-[1.75rem] border border-[#ece7fb] bg-[#faf9fe] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:p-4 lg:p-5">
                  <div className="rounded-[1.5rem] border border-[#e2e8f0] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] sm:p-5 lg:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                        {t.clefs[currentQuestion.clef]}
                      </p>
                      <span className="rounded-full bg-[#ede9fe] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5b21b6]">
                        {settings.answerMode === "piano"
                          ? t.answerModes.piano
                          : t.answerModes.solfege}
                      </span>
                    </div>

                    <Staff
                      clef={currentQuestion.clef}
                      keySignature={currentQuestion.keySignature}
                      note={currentQuestion.displayNote}
                      originalNote={currentQuestion.note}
                      className="flex justify-center"
                    />
                  </div>

                  {isGameActive() && (
                    <div className="mt-5 rounded-[1.4rem] border border-[#ede9fe] bg-white p-3 sm:p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                          {t.messages.whichNoteShown}
                        </p>
                        <span className="rounded-full bg-[#faf9fe] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                          {t.ui.currentQuestionTime}:{" "}
                          {(getQuestionElapsedTime() / 1000).toFixed(1)}
                          {t.units.seconds}
                        </span>
                      </div>

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
                </div>
              ) : (
                <div className="rounded-[1.75rem] border border-[#ece7fb] bg-[#faf9fe] p-3 sm:p-4 lg:p-5">
                  <div className="rounded-[1.5rem] border border-[#e7e1f5] bg-white px-6 py-12 text-center shadow-[0_10px_24px_rgba(15,23,42,0.04)] sm:px-8">
                    {gameState === "idle" && (
                      <>
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ede9fe] text-2xl text-[#5b21b6] shadow-[0_10px_24px_rgba(91,33,182,0.12)]">
                          ♪
                        </div>
                        <h3 className="text-3xl font-black tracking-[-0.05em] text-slate-950">
                          {t.ui.welcome}
                        </h3>
                        <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-slate-600">
                          {t.messages.startGameInstruction}
                        </p>
                      </>
                    )}

                    {gameState === "finished" && (
                      <>
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dcfce7] text-2xl text-[#10b981] shadow-[0_10px_24px_rgba(16,185,129,0.12)]">
                          ✓
                        </div>
                        <h3 className="text-3xl font-black tracking-[-0.05em] text-[#10b981]">
                          {t.messages.gameComplete}
                        </h3>
                        <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-slate-600">
                          {t.messages.gameCompleteInstruction}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 lg:hidden">
            <GameSettingsTrigger variant="mobile-card" />
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
