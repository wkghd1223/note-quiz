export type TrainingMode = "note" | "ear" | "interval" | "chord";
export type SessionKind = "practice" | "review" | "daily";
export type SessionLength = "ten" | "free" | "timed";
export type Difficulty = "beginner" | "basic" | "advanced" | "custom";
export interface LearningCategory {
  id: string;
  correct: number;
  total: number;
}
export interface PracticeCompletion {
  mode: TrainingMode;
  kind: SessionKind;
  difficulty: string;
  total: number;
  correct: number;
  elapsedMs: number;
  completed: boolean;
  categories: LearningCategory[];
}
export interface DailyPracticeProps<Q> {
  dailyQuestions?: Q[];
  dailyKey?: string;
  onComplete?: (completion: PracticeCompletion) => void;
}
