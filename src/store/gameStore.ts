import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_GAME_SETTINGS } from "@/lib/music/constants";
import {
  calculateSessionPoints,
  isScoreEligible,
} from "@/lib/leaderboard/validation";
import {
  trackGameStart,
  trackAnswer,
  trackGameComplete,
} from "@/lib/analytics";

interface GameStore {
  // 게임 설정
  settings: GameSettings;
  updateSettings: (settings: Partial<GameSettings>) => void;
  resetSettings: () => void;

  // 게임 상태
  gameState: GameState;
  setGameState: (state: GameState) => void;
  sessionId: string | null;

  // 현재 문제
  currentQuestion: Question | null;
  setCurrentQuestion: (question: Question | null) => void;

  // 답안 및 점수
  currentAnswer: Note | null;
  setCurrentAnswer: (answer: Note | null) => void;
  answers: Answer[];
  addAnswer: (answer: Answer) => void;
  clearAnswers: () => void;

  // 타이머
  startTime: number | null;
  currentTime: number;
  elapsedTime: number;
  accumulatedTime: number;
  questionStartTime: number | null; // 현재 문제 시작 시간
  startTimer: () => void;
  resumeTimer: () => void;
  updateTimer: (time: number) => number;
  stopTimer: () => void;
  resetTimer: () => void;
  startQuestionTimer: () => void;
  getQuestionElapsedTime: () => number;

  // 게임 결과
  gameResult: GameResult | null;
  setGameResult: (result: GameResult) => void;

  // 게임 통계 (localStorage에 저장)
  stats: GameStats;
  updateStats: (result: GameResult) => void;
  resetStats: () => void;

  // 게임 제어
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  resetGame: () => void;

  // 유틸리티
  isGameActive: () => boolean;
  getCurrentScore: () => number;
  getAccuracy: () => number;

  feedback: Feedback | null;
  setFeedback: (feedback: Feedback | null) => void;
}

const initialStats: GameStats = {
  gamesPlayed: 0,
  totalCorrect: 0,
  totalQuestions: 0,
  bestTime: Infinity,
  averageAccuracy: 0,
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // 게임 설정
      settings: { ...DEFAULT_GAME_SETTINGS },
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      resetSettings: () => set({ settings: { ...DEFAULT_GAME_SETTINGS } }),

      // 게임 상태
      gameState: "idle" as const,
      setGameState: (gameState) => set({ gameState }),
      sessionId: null,

      // 현재 문제
      currentQuestion: null,
      setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),

      // 답안 및 점수
      currentAnswer: null,
      setCurrentAnswer: (currentAnswer) => set({ currentAnswer }),
      answers: [],
      addAnswer: (answer) => {
        const { settings, answers } = get();

        trackAnswer({
          isCorrect: answer.isCorrect,
          timeSpent: answer.timeSpent,
          answerMode: settings.answerMode,
          questionNumber: answers.length + 1,
        });

        set((state) => ({
          answers: [...state.answers, answer],
        }));
      },
      clearAnswers: () => set({ answers: [] }),

      // 타이머
      startTime: null,
      currentTime: 0,
      elapsedTime: 0,
      accumulatedTime: 0,
      questionStartTime: null,
      startTimer: () => {
        const now = Date.now();
        set({
          startTime: now,
          currentTime: now,
          elapsedTime: 0,
          accumulatedTime: 0,
        });
      },
      resumeTimer: () => {
        const now = Date.now();
        set({ startTime: now, currentTime: now });
      },
      updateTimer: (time) => {
        const state = get();
        const nextElapsedTime = state.startTime
          ? state.accumulatedTime + Math.max(0, time - state.startTime)
          : state.accumulatedTime;

        set({
          currentTime: time,
          elapsedTime: nextElapsedTime,
        });

        return nextElapsedTime;
      },
      stopTimer: () => {
        const state = get();
        const now = Date.now();
        const nextElapsedTime = state.startTime
          ? state.accumulatedTime + Math.max(0, now - state.startTime)
          : state.accumulatedTime;

        set({
          startTime: null,
          currentTime: now,
          elapsedTime: nextElapsedTime,
          accumulatedTime: nextElapsedTime,
        });
      },
      resetTimer: () =>
        set({
          startTime: null,
          currentTime: 0,
          elapsedTime: 0,
          accumulatedTime: 0,
          questionStartTime: null,
        }),

      startQuestionTimer: () => {
        const now = Date.now();
        set({ questionStartTime: now });
      },

      getQuestionElapsedTime: () => {
        const { questionStartTime } = get();
        if (!questionStartTime) return 0;
        return Date.now() - questionStartTime;
      },

      // 게임 결과
      gameResult: null,
      setGameResult: (gameResult) => set({ gameResult }),

      // 게임 통계
      stats: initialStats,
      updateStats: (result) =>
        set((state) => {
          const newStats = { ...state.stats };
          newStats.gamesPlayed += 1;
          newStats.totalCorrect += result.correctAnswers;
          newStats.totalQuestions += result.totalQuestions;

          if (
            result.averageTime < newStats.bestTime ||
            newStats.bestTime === Infinity
          ) {
            newStats.bestTime = result.averageTime;
          }

          newStats.averageAccuracy =
            newStats.totalQuestions > 0
              ? (newStats.totalCorrect / newStats.totalQuestions) * 100
              : 0;

          return { stats: newStats };
        }),
      resetStats: () => set({ stats: initialStats }),

      // 게임 제어
      startGame: () => {
        const { startTimer, settings } = get();

        // Google Analytics 이벤트 추적
        trackGameStart({
          clef: settings.clef,
          keySignature: settings.keySignature,
          answerMode: settings.answerMode,
        });

        set({
          gameState: "playing",
          sessionId: crypto.randomUUID(),
          answers: [],
          gameResult: null,
          currentAnswer: null,
          currentQuestion: null,
        });
        startTimer();
      },

      pauseGame: () => {
        const { stopTimer } = get();
        set({ gameState: "paused" });
        stopTimer();
      },

      resumeGame: () => {
        const { resumeTimer } = get();
        set({ gameState: "playing" });
        resumeTimer();
      },

      endGame: () => {
        get().stopTimer();
        const { answers, elapsedTime, sessionId } = get();

        const totalQuestions = answers.length;
        const correctAnswers = answers.filter((a) => a.isCorrect).length;
        const accuracy =
          totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
        const averageTime =
          totalQuestions > 0 ? elapsedTime / totalQuestions : 0;
        const sessionPoints = calculateSessionPoints(
          correctAnswers,
          totalQuestions,
        );

        const result: GameResult = {
          sessionId: sessionId ?? crypto.randomUUID(),
          sessionPoints,
          totalQuestions,
          correctAnswers,
          totalTime: elapsedTime,
          averageTime,
          accuracy,
          answers,
        };

        set({
          gameState: "finished",
          gameResult: result,
        });

        trackGameComplete({
          score: sessionPoints,
          accuracy,
          totalQuestions,
          timeSpent: elapsedTime,
          sessionPoints,
          eligibleForLeaderboard: isScoreEligible(totalQuestions),
        });

        // 통계 업데이트
        get().updateStats(result);
      },

      resetGame: () => {
        const { resetTimer } = get();
        set({
          gameState: "idle",
          sessionId: null,
          currentQuestion: null,
          currentAnswer: null,
          answers: [],
          gameResult: null,
        });
        resetTimer();
      },

      // 유틸리티
      isGameActive: () => {
        const { gameState } = get();
        return gameState === "playing";
      },

      getCurrentScore: () => {
        const { answers } = get();
        return answers.filter((a) => a.isCorrect).length;
      },

      getAccuracy: () => {
        const { answers } = get();
        if (answers.length === 0) return 0;
        const correct = answers.filter((a) => a.isCorrect).length;
        return (correct / answers.length) * 100;
      },

      feedback: null,
      setFeedback: (feedback) => set({ feedback }),
    }),
    {
      name: "note-quiz-game-store",
      partialize: (state) => ({
        settings: state.settings,
        stats: state.stats,
      }),
    },
  ),
);
