"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_EAR_TRAINING_SETTINGS } from "@/lib/music/constants";
import {
  generateEarTrainingQuestion,
  noteToString,
  validateEarTrainingAnswer,
} from "@/lib/music/utils";
import {
  trackEarTrainingAnswer,
  trackEarTrainingComplete,
  trackEarTrainingStart,
} from "@/lib/analytics";

interface EarTrainingStore {
  settings: EarTrainingSettings;
  sessionState: GameState;
  currentQuestion: EarTrainingQuestion | null;
  answers: EarTrainingAnswer[];
  result: EarTrainingResult | null;
  stats: EarTrainingStats;
  startTime: number | null;
  elapsedTime: number;
  questionStartTime: number | null;
  replayCount: number;

  updateSettings: (settings: Partial<EarTrainingSettings>) => void;
  resetSettings: () => void;
  startSession: () => void;
  endSession: () => void;
  resetSession: () => void;
  generateNextQuestion: () => void;
  submitAnswer: (answer: Note) => boolean;
  replayCurrentQuestion: () => void;
  updateTimer: (time: number) => void;
  startQuestionTimer: () => void;
  getQuestionElapsedTime: () => number;
}

const initialStats: EarTrainingStats = {
  sessionsPlayed: 0,
  totalCorrect: 0,
  totalQuestions: 0,
  averageAccuracy: 0,
  bestAccuracy: 0,
  fastestAverageTime: Infinity,
};

export const useEarTrainingStore = create<EarTrainingStore>()(
  persist(
    (set, get) => ({
      settings: { ...DEFAULT_EAR_TRAINING_SETTINGS },
      sessionState: "idle",
      currentQuestion: null,
      answers: [],
      result: null,
      stats: initialStats,
      startTime: null,
      elapsedTime: 0,
      questionStartTime: null,
      replayCount: 0,

      updateSettings: (settings) =>
        set((state) => ({
          settings: { ...state.settings, ...settings },
        })),
      resetSettings: () =>
        set({
          settings: { ...DEFAULT_EAR_TRAINING_SETTINGS },
        }),

      startSession: () => {
        const { settings } = get();
        const now = Date.now();

        trackEarTrainingStart({
          inputMode: settings.inputMode,
          noteSet: settings.noteSet,
          timeLimit: settings.timeLimit ?? null,
          sessionType: settings.sessionType,
        });

        set({
          sessionState: "playing",
          currentQuestion: null,
          answers: [],
          result: null,
          startTime: now,
          elapsedTime: 0,
          questionStartTime: null,
          replayCount: 0,
        });

        get().generateNextQuestion();
      },

      endSession: () => {
        const { answers, elapsedTime, replayCount, stats } = get();
        const totalQuestions = answers.length;
        const correctAnswers = answers.filter((answer) => answer.isCorrect).length;
        const accuracy =
          totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
        const averageTime =
          totalQuestions > 0 ? elapsedTime / totalQuestions : 0;

        const result: EarTrainingResult = {
          totalQuestions,
          correctAnswers,
          totalTime: elapsedTime,
          averageTime,
          accuracy,
          replayCount,
          answers,
        };

        const updatedStats: EarTrainingStats = {
          sessionsPlayed: stats.sessionsPlayed + 1,
          totalCorrect: stats.totalCorrect + correctAnswers,
          totalQuestions: stats.totalQuestions + totalQuestions,
          averageAccuracy:
            stats.totalQuestions + totalQuestions > 0
              ? ((stats.totalCorrect + correctAnswers) /
                  (stats.totalQuestions + totalQuestions)) *
                100
              : 0,
          bestAccuracy: Math.max(stats.bestAccuracy, accuracy),
          fastestAverageTime: Math.min(stats.fastestAverageTime, averageTime || Infinity),
        };

        trackEarTrainingComplete({
          totalQuestions,
          correctAnswers,
          accuracy,
          averageTime,
          replayCount,
        });

        set({
          sessionState: "finished",
          result,
          stats: updatedStats,
          currentQuestion: null,
          questionStartTime: null,
        });
      },

      resetSession: () =>
        set({
          sessionState: "idle",
          currentQuestion: null,
          answers: [],
          result: null,
          startTime: null,
          elapsedTime: 0,
          questionStartTime: null,
          replayCount: 0,
        }),

      generateNextQuestion: () => {
        const { settings, sessionState } = get();
        if (sessionState !== "playing") return;

        set({
          currentQuestion: generateEarTrainingQuestion(settings),
          questionStartTime: Date.now(),
        });
      },

      submitAnswer: (answer) => {
        const { currentQuestion, settings, answers } = get();
        if (!currentQuestion) return false;

        const timeSpent = get().getQuestionElapsedTime();
        const isCorrect = validateEarTrainingAnswer(currentQuestion, answer);
        const answerEntry: EarTrainingAnswer = {
          note: answer,
          correctNote: currentQuestion.targetNote,
          isCorrect,
          timestamp: Date.now(),
          timeSpent,
        };

        trackEarTrainingAnswer({
          inputMode: settings.inputMode,
          expectedNote: noteToString(currentQuestion.targetNote),
          userNote: noteToString(answer),
          isCorrect,
          timeSpent,
        });

        const nextAnswers = [...answers, answerEntry];

        set({
          answers: nextAnswers,
        });

        get().generateNextQuestion();
        return isCorrect;
      },

      replayCurrentQuestion: () =>
        set((state) => ({
          replayCount: state.replayCount + 1,
        })),

      updateTimer: (time) =>
        set((state) => ({
          elapsedTime: state.startTime ? time - state.startTime : 0,
        })),

      startQuestionTimer: () =>
        set({
          questionStartTime: Date.now(),
        }),

      getQuestionElapsedTime: () => {
        const { questionStartTime } = get();
        if (!questionStartTime) return 0;
        return Date.now() - questionStartTime;
      },
    }),
    {
      name: "ear-training-storage",
      partialize: (state) => ({
        settings: state.settings,
        stats: state.stats,
      }),
    }
  )
);
