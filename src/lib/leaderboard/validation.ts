import type { LeaderboardScorePayload } from "@/types/leaderboard";

const MAX_QUESTIONS_PER_SUBMISSION = 500;
const MAX_TIME_PER_SUBMISSION = 1000 * 60 * 60 * 6;

export function parseScorePayload(payload: unknown): LeaderboardScorePayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid score payload.");
  }

  const scorePayload = payload as Record<string, unknown>;
  const totalQuestions = Number(scorePayload.totalQuestions);
  const correctAnswers = Number(scorePayload.correctAnswers);
  const totalTime = Number(scorePayload.totalTime);

  if (!Number.isInteger(totalQuestions) || totalQuestions <= 0) {
    throw new Error("totalQuestions must be a positive integer.");
  }

  if (totalQuestions > MAX_QUESTIONS_PER_SUBMISSION) {
    throw new Error("totalQuestions is too large.");
  }

  if (!Number.isInteger(correctAnswers) || correctAnswers < 0) {
    throw new Error("correctAnswers must be a non-negative integer.");
  }

  if (correctAnswers > totalQuestions) {
    throw new Error("correctAnswers cannot exceed totalQuestions.");
  }

  if (!Number.isFinite(totalTime) || totalTime < 0) {
    throw new Error("totalTime must be a non-negative number.");
  }

  if (totalTime > MAX_TIME_PER_SUBMISSION) {
    throw new Error("totalTime is too large.");
  }

  return {
    totalQuestions,
    correctAnswers,
    totalTime: Math.round(totalTime),
  };
}

export function calculateScore(payload: LeaderboardScorePayload): number {
  return payload.correctAnswers;
}

export function calculateAccuracy(payload: LeaderboardScorePayload): number {
  return payload.totalQuestions > 0
    ? (payload.correctAnswers / payload.totalQuestions) * 100
    : 0;
}
