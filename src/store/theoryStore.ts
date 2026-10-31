import { create } from "zustand";
import {
  generateTheoryQuestion,
  regenerateTheoryQuestion,
  isTheoryAnswerCorrect,
  type TheoryQuestion,
  type TheorySettings,
} from "@/lib/music/theory";
import type { SessionKind, SessionLength } from "@/lib/practice/types";

export interface TheoryAnswer {
  question: TheoryQuestion;
  answer: string;
  correct: boolean;
  timeMs: number;
}
export interface TheoryResult {
  totalQuestions: number;
  correctAnswers: number;
  totalTime: number;
  averageTime: number;
  accuracy: number;
  completed: boolean;
  answers: TheoryAnswer[];
  kind: SessionKind;
}
interface TheoryStore {
  state: "idle" | "playing" | "finished";
  generation: number;
  settings: TheorySettings | null;
  length: SessionLength;
  limit: number;
  duration: number;
  kind: SessionKind;
  questions: TheoryQuestion[];
  current: TheoryQuestion | null;
  answers: TheoryAnswer[];
  result: TheoryResult | null;
  startedAt: number;
  questionAt: number;
  elapsed: number;
  feedback: TheoryAnswer | null;
  start: (
    settings: TheorySettings,
    options?: {
      length?: SessionLength;
      duration?: number;
      kind?: SessionKind;
      questions?: TheoryQuestion[];
    },
  ) => void;
  submit: (answer: string, now?: number) => boolean;
  next: () => void;
  tick: (now: number) => void;
  end: (now?: number, completed?: boolean) => void;
  reset: () => void;
  review: () => void;
}
let pending: ReturnType<typeof setTimeout> | undefined;
const cancel = () => {
  if (pending !== undefined) clearTimeout(pending);
  pending = undefined;
};
export const useTheoryStore = create<TheoryStore>((set, get) => ({
  state: "idle",
  generation: 0,
  settings: null,
  length: "ten",
  limit: 10,
  duration: 60,
  kind: "practice",
  questions: [],
  current: null,
  answers: [],
  result: null,
  startedAt: 0,
  questionAt: 0,
  elapsed: 0,
  feedback: null,
  start: (settings, options = {}) => {
    cancel();
    const now = Date.now();
    const queue = options.questions?.slice(0, 150) ?? [];
    const first = queue[0] ?? generateTheoryQuestion(settings);
    set({
      state: "playing",
      generation: get().generation + 1,
      settings: { ...settings },
      length: options.length ?? "ten",
      limit: queue.length || 10,
      duration: options.duration ?? 60,
      kind: options.kind ?? "practice",
      questions: queue,
      current: first,
      answers: [],
      result: null,
      startedAt: now,
      questionAt: now,
      elapsed: 0,
      feedback: null,
    });
  },
  submit: (answer, now = Date.now()) => {
    const state = get();
    if (
      state.state !== "playing" ||
      state.feedback ||
      !state.current ||
      !state.current.options.includes(answer)
    )
      return false;
    state.tick(now);
    if (get().state !== "playing") return false;
    const entry = {
      question: state.current,
      answer,
      correct: isTheoryAnswerCorrect(state.current, answer),
      timeMs: Math.max(0, now - state.questionAt),
    };
    set({ answers: [...state.answers, entry], feedback: entry });
    const generation = state.generation;
    pending = setTimeout(() => {
      if (get().generation === generation && get().state === "playing")
        get().next();
    }, 900);
    return true;
  },
  next: () => {
    const state = get();
    if (state.state !== "playing" || !state.feedback || !state.settings) return;
    cancel();
    if (
      (state.questions.length &&
        state.answers.length >= state.questions.length) ||
      (state.length === "ten" && state.answers.length >= state.limit) ||
      state.answers.length >= 150
    ) {
      state.end(Date.now(), true);
      return;
    }
    set({
      current:
        state.questions[state.answers.length] ??
        generateTheoryQuestion(state.settings),
      questionAt: Date.now(),
      feedback: null,
    });
  },
  tick: (now) => {
    const state = get();
    if (state.state !== "playing") return;
    const elapsed = Math.max(0, now - state.startedAt);
    if (state.length === "timed" && elapsed >= state.duration * 1000)
      state.end(state.startedAt + state.duration * 1000, true);
    else set({ elapsed });
  },
  end: (now = Date.now(), completed = false) => {
    const state = get();
    if (state.state !== "playing") return;
    cancel();
    const total = state.answers.length,
      correct = state.answers.filter((answer) => answer.correct).length,
      rawTime = Math.max(0, now - state.startedAt),
      deadlineReached =
        state.length === "timed" && rawTime >= state.duration * 1000,
      time =
        state.length === "timed"
          ? Math.min(rawTime, state.duration * 1000)
          : rawTime;
    set({
      state: "finished",
      elapsed: time,
      current: null,
      feedback: null,
      result: {
        totalQuestions: total,
        correctAnswers: correct,
        totalTime: time,
        averageTime: total ? time / total : 0,
        accuracy: total ? (correct / total) * 100 : 0,
        completed:
          completed ||
          deadlineReached ||
          (state.length === "ten" && total >= state.limit),
        answers: state.answers,
        kind: state.kind,
      },
    });
  },
  reset: () => {
    cancel();
    set({
      state: "idle",
      generation: get().generation + 1,
      current: null,
      answers: [],
      result: null,
      feedback: null,
      questions: [],
      elapsed: 0,
    });
  },
  review: () => {
    const state = get();
    if (!state.result || !state.settings) return;
    const missed = state.result.answers
      .filter((answer) => !answer.correct)
      .map((answer) => regenerateTheoryQuestion(answer.question));
    if (!missed.length) return;
    get().start(state.settings, {
      kind: "review",
      length: "ten",
      questions: missed,
    });
  },
}));
