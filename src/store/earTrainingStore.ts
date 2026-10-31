"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_EAR_TRAINING_SETTINGS } from "@/lib/music/constants";
import {
  generateEarTrainingQuestion,
  validateEarTrainingAnswer,
} from "@/lib/music/utils";
import {
  trackEarTrainingComplete,
  trackEarTrainingStart,
} from "@/lib/analytics";

interface EarTrainingStore {
  settings: EarTrainingSettings;
  sessionSettings: EarTrainingSettings;
  sessionKind: PracticeSessionKind;
  sessionId: string | null;
  questionQueue: EarTrainingQuestion[] | null;
  questionLimit: number | null;
  sessionState: GameState;
  currentQuestion: EarTrainingQuestion | null;
  isAdvancingQuestion: boolean;
  answers: EarTrainingAnswer[];
  result: EarTrainingResult | null;
  stats: EarTrainingStats;
  startTime: number | null;
  elapsedTime: number;
  questionStartTime: number | null;
  replayCount: number;
  updateSettings: (settings: Partial<EarTrainingSettings>) => void;
  resetSettings: () => void;
  startSession: (options?: EarSessionOptions) => void;
  endSession: (now?: number) => void;
  resetSession: () => void;
  generateNextQuestion: () => void;
  submitAnswer: (answer: Note) => boolean | null;
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
const defaultSettings = (): EarTrainingSettings => ({
  ...DEFAULT_EAR_TRAINING_SETTINGS,
  octaveRange: { ...DEFAULT_EAR_TRAINING_SETTINGS.octaveRange },
  questionLimit: 10,
});
let transitionTimer: ReturnType<typeof setTimeout> | null = null;
function cancelTransition() {
  if (transitionTimer !== null) clearTimeout(transitionTimer);
  transitionTimer = null;
}
function snapshotQuestion(question: EarTrainingQuestion): EarTrainingQuestion {
  return { ...question, targetNote: { ...question.targetNote } };
}

export const useEarTrainingStore = create<EarTrainingStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings(),
      sessionSettings: defaultSettings(),
      sessionKind: "practice",
      sessionId: null,
      questionQueue: null,
      questionLimit: 10,
      sessionState: "idle",
      currentQuestion: null,
      isAdvancingQuestion: false,
      answers: [],
      result: null,
      stats: initialStats,
      startTime: null,
      elapsedTime: 0,
      questionStartTime: null,
      replayCount: 0,
      updateSettings: (settings) => {
        get().resetSession();
        set({ settings: { ...get().settings, ...settings } });
      },
      resetSettings: () => {
        get().resetSession();
        set({ settings: defaultSettings() });
      },
      startSession: (options = {}) => {
        cancelTransition();
        const settings = {
          ...get().settings,
          octaveRange: { ...get().settings.octaveRange },
        };
        const queue = options.questions?.length
          ? options.questions.map(snapshotQuestion)
          : null;
        const sessionSettings = {
          ...settings,
          timeLimit:
            options.kind === "review" || options.kind === "daily"
              ? undefined
              : settings.timeLimit,
        };
        const now = Date.now();
        set({
          sessionState: "playing",
          sessionId: crypto.randomUUID(),
          sessionKind: options.kind ?? "practice",
          sessionSettings,
          questionQueue: queue,
          questionLimit:
            queue?.length ??
            options.questionLimit ??
            settings.questionLimit ??
            null,
          currentQuestion: null,
          isAdvancingQuestion: false,
          answers: [],
          result: null,
          startTime: now,
          elapsedTime: 0,
          questionStartTime: null,
          replayCount: 0,
        });
        get().generateNextQuestion();
        trackEarTrainingStart({
          inputMode: settings.inputMode,
          noteSet: settings.noteSet,
          timeLimit: sessionSettings.timeLimit ?? null,
          sessionType: settings.sessionType,
        });
      },
      endSession: (now = Date.now()) => {
        const state = get();
        if (state.sessionState !== "playing") return;
        cancelTransition();
        const limit =
          state.sessionSettings.sessionType === "timed"
            ? state.sessionSettings.timeLimit
            : undefined;
        const elapsed =
          state.startTime !== null
            ? Math.max(0, now - state.startTime)
            : state.elapsedTime;
        const elapsedTime = limit ? Math.min(elapsed, limit * 1000) : elapsed;
        const totalQuestions = state.answers.length;
        const correctAnswers = state.answers.filter(
          (answer) => answer.isCorrect,
        ).length;
        const accuracy = totalQuestions
          ? (correctAnswers / totalQuestions) * 100
          : 0;
        const averageTime = totalQuestions ? elapsedTime / totalQuestions : 0;
        const completed =
          state.questionLimit !== null
            ? totalQuestions >= state.questionLimit
            : Boolean(limit && elapsedTime >= limit * 1000);
        const result: EarTrainingResult = {
          sessionId: state.sessionId!,
          completed,
          totalQuestions,
          correctAnswers,
          totalTime: elapsedTime,
          averageTime,
          accuracy,
          replayCount: state.replayCount,
          answers: state.answers,
        };
        const total = state.stats.totalQuestions + totalQuestions;
        const correct = state.stats.totalCorrect + correctAnswers;
        const stats =
          state.sessionKind === "practice"
            ? {
                sessionsPlayed: state.stats.sessionsPlayed + 1,
                totalQuestions: total,
                totalCorrect: correct,
                averageAccuracy: total ? (correct / total) * 100 : 0,
                bestAccuracy: Math.max(state.stats.bestAccuracy, accuracy),
                fastestAverageTime: Math.min(
                  state.stats.fastestAverageTime ?? Infinity,
                  averageTime || Infinity,
                ),
              }
            : state.stats;
        set({
          sessionState: "finished",
          result,
          stats,
          elapsedTime,
          startTime: null,
          currentQuestion: null,
          isAdvancingQuestion: false,
          questionStartTime: null,
        });
        trackEarTrainingComplete({
          totalQuestions,
          correctAnswers,
          accuracy,
          averageTime,
          replayCount: state.replayCount,
        });
      },
      resetSession: () => {
        cancelTransition();
        set({
          sessionState: "idle",
          sessionId: null,
          sessionKind: "practice",
          questionQueue: null,
          questionLimit: null,
          currentQuestion: null,
          isAdvancingQuestion: false,
          answers: [],
          result: null,
          startTime: null,
          elapsedTime: 0,
          questionStartTime: null,
          replayCount: 0,
        });
      },
      generateNextQuestion: () => {
        const state = get();
        if (state.sessionState !== "playing") return;
        cancelTransition();
        if (
          state.questionLimit !== null &&
          state.answers.length >= state.questionLimit
        ) {
          state.endSession();
          return;
        }
        const question =
          state.questionQueue?.[state.answers.length] ??
          generateEarTrainingQuestion(state.sessionSettings);
        set({
          currentQuestion: snapshotQuestion(question),
          isAdvancingQuestion: false,
          questionStartTime: Date.now(),
        });
      },
      submitAnswer: (note) => {
        get().updateTimer(Date.now());
        const state = get();
        if (
          state.sessionState !== "playing" ||
          !state.currentQuestion ||
          state.isAdvancingQuestion
        )
          return null;
        const question = snapshotQuestion(state.currentQuestion);
        const isCorrect = validateEarTrainingAnswer(question, note);
        const answer: EarTrainingAnswer = {
          question,
          note: { ...note },
          correctNote: { ...question.targetNote },
          isCorrect,
          timestamp: Date.now(),
          timeSpent: state.getQuestionElapsedTime(),
        };
        set({ answers: [...state.answers, answer], isAdvancingQuestion: true });
        const sessionId = state.sessionId;
        transitionTimer = setTimeout(() => {
          transitionTimer = null;
          if (get().sessionId === sessionId && get().sessionState === "playing")
            get().generateNextQuestion();
        }, 900);
        return isCorrect;
      },
      replayCurrentQuestion: () => {
        if (get().sessionState === "playing")
          set((state) => ({ replayCount: state.replayCount + 1 }));
      },
      updateTimer: (time) => {
        const state = get();
        if (state.sessionState !== "playing") return;
        const elapsedTime =
          state.startTime !== null ? Math.max(0, time - state.startTime) : 0;
        const limit =
          state.sessionSettings.sessionType === "timed"
            ? state.sessionSettings.timeLimit
            : undefined;
        set({
          elapsedTime: limit
            ? Math.min(elapsedTime, limit * 1000)
            : elapsedTime,
        });
        if (limit && elapsedTime >= limit * 1000) get().endSession(time);
      },
      startQuestionTimer: () => set({ questionStartTime: Date.now() }),
      getQuestionElapsedTime: () => {
        const state = get();
        return state.questionStartTime !== null &&
          state.sessionState === "playing"
          ? Math.max(0, Date.now() - state.questionStartTime)
          : 0;
      },
    }),
    {
      name: "ear-training-storage",
      storage: createJSONStorage(() => ({
        getItem: (key) => {
          try {
            return localStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch {
            /* Practice remains usable without storage. */
          }
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch {
            /* Storage can be blocked. */
          }
        },
      })),
      partialize: (state) => ({
        settings: {
          ...state.settings,
          questionLimit: state.settings.questionLimit ?? null,
        },
        stats: state.stats,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<EarTrainingStore> | undefined;
        return {
          ...current,
          settings: {
            ...defaultSettings(),
            ...saved?.settings,
            octaveRange: {
              ...DEFAULT_EAR_TRAINING_SETTINGS.octaveRange,
              ...saved?.settings?.octaveRange,
            },
            questionLimit:
              saved?.settings &&
              !("questionLimit" in saved.settings) &&
              saved.settings.sessionType === "timed"
                ? null
                : saved?.settings?.questionLimit === undefined
                  ? 10
                  : saved.settings.questionLimit,
          },
          stats: { ...initialStats, ...saved?.stats },
        };
      },
    },
  ),
);
