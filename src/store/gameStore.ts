import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_GAME_SETTINGS } from "@/lib/music/constants";
import { generateQuestion, validateAnswer } from "@/lib/music/utils";
import {
  calculateSessionPoints,
  isScoreEligible,
  MAX_QUESTIONS_PER_SUBMISSION,
} from "@/lib/leaderboard/validation";
import { trackGameStart, trackGameComplete } from "@/lib/analytics";

interface GameStore {
  settings: GameSettings;
  sessionSettings: GameSettings;
  sessionKind: PracticeSessionKind;
  questionQueue: Question[] | null;
  questionLimit: number | null;
  updateSettings: (settings: Partial<GameSettings>) => void;
  resetSettings: () => void;
  gameState: GameState;
  setGameState: (state: GameState) => void;
  sessionId: string | null;
  currentQuestion: Question | null;
  setCurrentQuestion: (question: Question | null) => void;
  currentAnswer: Note | null;
  setCurrentAnswer: (answer: Note | null) => void;
  answers: Answer[];
  addAnswer: (answer: Answer) => void;
  submitAnswer: (answer: Note) => boolean | null;
  advanceQuestion: () => void;
  isAnswerLocked: boolean;
  pendingAdvance: boolean;
  clearAnswers: () => void;
  startTime: number | null;
  currentTime: number;
  elapsedTime: number;
  accumulatedTime: number;
  questionStartTime: number | null;
  questionAccumulatedTime: number;
  startTimer: () => void;
  resumeTimer: () => void;
  updateTimer: (time: number) => number;
  stopTimer: () => void;
  resetTimer: () => void;
  startQuestionTimer: () => void;
  getQuestionElapsedTime: () => number;
  gameResult: GameResult | null;
  setGameResult: (result: GameResult) => void;
  stats: GameStats;
  updateStats: (result: GameResult) => void;
  resetStats: () => void;
  startGame: (options?: NoteSessionOptions) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: (now?: number) => void;
  resetGame: () => void;
  isGameActive: () => boolean;
  getCurrentScore: () => number;
  getAccuracy: () => number;
  feedback: Feedback | null;
  setFeedback: (feedback: Feedback | null) => void;
}

const defaultSettings = (): GameSettings => ({
  ...DEFAULT_GAME_SETTINGS,
  staffRange: { ...DEFAULT_GAME_SETTINGS.staffRange },
  questionLimit: 10,
});
const initialStats: GameStats = {
  gamesPlayed: 0,
  totalCorrect: 0,
  totalQuestions: 0,
  bestTime: Infinity,
  averageAccuracy: 0,
};
let transitionTimer: ReturnType<typeof setTimeout> | null = null;
let transitionDueAt = 0;
let transitionRemaining = 850;
function cancelTransition() {
  if (transitionTimer !== null) clearTimeout(transitionTimer);
  transitionTimer = null;
}
function copySettings(settings: GameSettings) {
  return { ...settings, staffRange: { ...settings.staffRange } };
}
function snapshotQuestion(question: Question): Question {
  return {
    ...question,
    note: { ...question.note },
    displayNote: { ...question.displayNote },
    keySignature: {
      ...question.keySignature,
      sharps: [...question.keySignature.sharps],
      flats: [...question.keySignature.flats],
    },
  };
}
function elapsedAt(
  state: Pick<GameStore, "startTime" | "accumulatedTime">,
  now: number,
) {
  return (
    state.accumulatedTime +
    (state.startTime !== null ? Math.max(0, now - state.startTime) : 0)
  );
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      const scheduleTransition = (delay = 850) => {
        cancelTransition();
        const sessionId = get().sessionId;
        transitionRemaining = delay;
        transitionDueAt = Date.now() + delay;
        transitionTimer = setTimeout(() => {
          transitionTimer = null;
          const state = get();
          if (
            state.sessionId === sessionId &&
            state.gameState === "playing" &&
            state.pendingAdvance
          )
            state.advanceQuestion();
        }, delay);
      };
      return {
        settings: defaultSettings(),
        sessionSettings: defaultSettings(),
        sessionKind: "practice",
        questionQueue: null,
        questionLimit: 10,
        updateSettings: (settings) => {
          get().resetGame();
          set({ settings: { ...get().settings, ...settings } });
        },
        resetSettings: () => {
          get().resetGame();
          set({ settings: defaultSettings() });
        },
        gameState: "idle",
        sessionId: null,
        setGameState: (gameState) => set({ gameState }),
        currentQuestion: null,
        setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),
        currentAnswer: null,
        setCurrentAnswer: (currentAnswer) => set({ currentAnswer }),
        answers: [],
        isAnswerLocked: false,
        pendingAdvance: false,
        addAnswer: (answer) => {
          const state = get();
          if (
            state.gameState !== "playing" ||
            state.isAnswerLocked ||
            !state.currentQuestion
          )
            return;
          set({
            answers: [
              ...state.answers,
              { ...answer, question: snapshotQuestion(state.currentQuestion) },
            ],
            isAnswerLocked: true,
          });
        },
        submitAnswer: (note) => {
          get().updateTimer(Date.now());
          const state = get();
          if (
            state.gameState !== "playing" ||
            !state.currentQuestion ||
            state.isAnswerLocked
          )
            return null;
          const question = snapshotQuestion(state.currentQuestion);
          const isCorrect = validateAnswer(question, note);
          const answer: Answer = {
            question,
            note: { ...note },
            correctNote: { ...question.displayNote },
            isCorrect,
            timestamp: Date.now(),
            timeSpent: state.getQuestionElapsedTime(),
          };
          set({
            answers: [...state.answers, answer],
            currentAnswer: note,
            isAnswerLocked: true,
            pendingAdvance: true,
          });
          scheduleTransition();
          return isCorrect;
        },
        advanceQuestion: () => {
          const state = get();
          if (state.gameState !== "playing") return;
          cancelTransition();
          if (
            (state.questionLimit !== null &&
              state.answers.length >= state.questionLimit) ||
            state.answers.length >= MAX_QUESTIONS_PER_SUBMISSION
          ) {
            state.endGame();
            return;
          }
          const question =
            state.questionQueue?.[state.answers.length] ??
            generateQuestion(state.sessionSettings);
          set({
            currentQuestion: snapshotQuestion(question),
            currentAnswer: null,
            feedback: null,
            isAnswerLocked: false,
            pendingAdvance: false,
            questionStartTime: Date.now(),
            questionAccumulatedTime: 0,
          });
        },
        clearAnswers: () => set({ answers: [] }),
        startTime: null,
        currentTime: 0,
        elapsedTime: 0,
        accumulatedTime: 0,
        questionStartTime: null,
        questionAccumulatedTime: 0,
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
          if (state.gameState !== "playing") return state.elapsedTime;
          const nextElapsed = elapsedAt(state, time);
          const limit = state.sessionSettings.timeLimit;
          set({
            currentTime: time,
            elapsedTime: limit
              ? Math.min(nextElapsed, limit * 1000)
              : nextElapsed,
          });
          if (limit && nextElapsed >= limit * 1000) get().endGame(time);
          return get().elapsedTime;
        },
        stopTimer: () => {
          const now = Date.now();
          const elapsedTime = elapsedAt(get(), now);
          set({
            startTime: null,
            currentTime: now,
            elapsedTime,
            accumulatedTime: elapsedTime,
          });
        },
        resetTimer: () =>
          set({
            startTime: null,
            currentTime: 0,
            elapsedTime: 0,
            accumulatedTime: 0,
            questionStartTime: null,
            questionAccumulatedTime: 0,
          }),
        startQuestionTimer: () =>
          set({ questionStartTime: Date.now(), questionAccumulatedTime: 0 }),
        getQuestionElapsedTime: () => {
          const state = get();
          return (
            state.questionAccumulatedTime +
            (state.gameState === "playing" && state.questionStartTime !== null
              ? Math.max(0, Date.now() - state.questionStartTime)
              : 0)
          );
        },
        gameResult: null,
        setGameResult: (gameResult) => set({ gameResult }),
        stats: initialStats,
        updateStats: (result) =>
          set((state) => {
            const totalQuestions =
              state.stats.totalQuestions + result.totalQuestions;
            const totalCorrect =
              state.stats.totalCorrect + result.correctAnswers;
            return {
              stats: {
                gamesPlayed: state.stats.gamesPlayed + 1,
                totalQuestions,
                totalCorrect,
                averageAccuracy: totalQuestions
                  ? (totalCorrect / totalQuestions) * 100
                  : 0,
                bestTime: result.totalQuestions
                  ? Math.min(
                      state.stats.bestTime ?? Infinity,
                      result.averageTime,
                    )
                  : state.stats.bestTime,
              },
            };
          }),
        resetStats: () => set({ stats: initialStats }),
        startGame: (options = {}) => {
          cancelTransition();
          const settings = copySettings(get().settings);
          const queue = options.questions?.length
            ? options.questions.map(snapshotQuestion)
            : null;
          const questionLimit =
            queue?.length ??
            options.questionLimit ??
            settings.questionLimit ??
            null;
          set({
            gameState: "playing",
            sessionId: crypto.randomUUID(),
            sessionKind: options.kind ?? "practice",
            sessionSettings: {
              ...settings,
              timeLimit:
                options.kind === "review" || options.kind === "daily"
                  ? undefined
                  : settings.timeLimit,
            },
            questionQueue: queue,
            questionLimit,
            answers: [],
            gameResult: null,
            currentAnswer: null,
            currentQuestion: null,
            feedback: null,
            isAnswerLocked: false,
            pendingAdvance: false,
          });
          get().startTimer();
          get().advanceQuestion();
          trackGameStart({
            clef: settings.clef,
            keySignature: settings.keySignature,
            answerMode: settings.answerMode,
          });
        },
        pauseGame: () => {
          get().updateTimer(Date.now());
          const state = get();
          if (state.gameState !== "playing") return;
          const now = Date.now();
          const elapsedTime = elapsedAt(state, now);
          const questionAccumulatedTime = state.getQuestionElapsedTime();
          if (state.pendingAdvance)
            transitionRemaining = Math.max(0, transitionDueAt - now);
          cancelTransition();
          set({
            gameState: "paused",
            startTime: null,
            currentTime: now,
            elapsedTime,
            accumulatedTime: elapsedTime,
            questionStartTime: null,
            questionAccumulatedTime,
          });
        },
        resumeGame: () => {
          const state = get();
          if (state.gameState !== "paused") return;
          set({
            gameState: "playing",
            startTime: Date.now(),
            questionStartTime: state.isAnswerLocked ? null : Date.now(),
          });
          if (state.pendingAdvance) scheduleTransition(transitionRemaining);
        },
        endGame: (now = Date.now()) => {
          const state = get();
          if (state.gameState !== "playing" && state.gameState !== "paused")
            return;
          cancelTransition();
          const limit = state.sessionSettings.timeLimit;
          const elapsedTime = limit
            ? Math.min(elapsedAt(state, now), limit * 1000)
            : elapsedAt(state, now);
          const totalQuestions = state.answers.length;
          const correctAnswers = state.answers.filter(
            (answer) => answer.isCorrect,
          ).length;
          const accuracy = totalQuestions
            ? (correctAnswers / totalQuestions) * 100
            : 0;
          const completed =
            state.questionLimit !== null
              ? totalQuestions >= state.questionLimit
              : Boolean(limit && elapsedTime >= limit * 1000);
          const sessionPoints = calculateSessionPoints(
            correctAnswers,
            totalQuestions,
          );
          const result: GameResult = {
            sessionId: state.sessionId!,
            completed,
            sessionPoints,
            totalQuestions,
            correctAnswers,
            totalTime: elapsedTime,
            averageTime: totalQuestions ? elapsedTime / totalQuestions : 0,
            accuracy,
            answers: state.answers,
          };
          set({
            gameState: "finished",
            gameResult: result,
            elapsedTime,
            accumulatedTime: elapsedTime,
            startTime: null,
            currentTime: now,
            pendingAdvance: false,
            isAnswerLocked: true,
          });
          if (state.sessionKind === "practice") get().updateStats(result);
          trackGameComplete({
            score: sessionPoints,
            accuracy,
            totalQuestions,
            timeSpent: elapsedTime,
            sessionPoints,
            eligibleForLeaderboard:
              state.sessionKind === "practice" &&
              isScoreEligible(totalQuestions),
          });
        },
        resetGame: () => {
          cancelTransition();
          set({
            gameState: "idle",
            sessionId: null,
            sessionKind: "practice",
            currentQuestion: null,
            currentAnswer: null,
            answers: [],
            gameResult: null,
            feedback: null,
            isAnswerLocked: false,
            pendingAdvance: false,
            questionQueue: null,
            questionLimit: null,
          });
          get().resetTimer();
        },
        isGameActive: () => get().gameState === "playing",
        getCurrentScore: () =>
          get().answers.filter((answer) => answer.isCorrect).length,
        getAccuracy: () => {
          const answers = get().answers;
          return answers.length
            ? (answers.filter((answer) => answer.isCorrect).length /
                answers.length) *
                100
            : 0;
        },
        feedback: null,
        setFeedback: (feedback) => set({ feedback }),
      };
    },
    {
      name: "note-quiz-game-store",
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
        const saved = persisted as Partial<GameStore> | undefined;
        return {
          ...current,
          settings: {
            ...defaultSettings(),
            ...saved?.settings,
            staffRange: {
              ...DEFAULT_GAME_SETTINGS.staffRange,
              ...saved?.settings?.staffRange,
            },
            questionLimit:
              saved?.settings &&
              !("questionLimit" in saved.settings) &&
              saved.settings.timeLimit
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
