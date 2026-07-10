import type { SessionScorePayload } from "@/types/leaderboard";

export const SCORE_VERSION = 2 as const;
export const MIN_QUESTIONS_FOR_POINTS = 10;
export const MAX_QUESTIONS_PER_SUBMISSION = 150;
const MAX_TIME_PER_SUBMISSION = 1000 * 60 * 60 * 6;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ScorePayloadValidationError extends Error {}

export function parseScorePayload(payload: unknown): SessionScorePayload {
  if (!payload || typeof payload !== "object") {
    throw new ScorePayloadValidationError("Invalid score payload.");
  }

  const scorePayload = payload as Record<string, unknown>;
  const schemaVersion = Number(scorePayload.schemaVersion);
  const sessionId = scorePayload.sessionId;
  const mode = scorePayload.mode;
  const totalQuestions = Number(scorePayload.totalQuestions);
  const correctAnswers = Number(scorePayload.correctAnswers);
  const totalTime = Number(scorePayload.totalTime);

  if (schemaVersion !== SCORE_VERSION) {
    throw new ScorePayloadValidationError(
      `schemaVersion must be ${SCORE_VERSION}.`,
    );
  }

  if (typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId)) {
    throw new ScorePayloadValidationError("sessionId must be a valid UUID.");
  }

  if (mode !== "note") {
    throw new ScorePayloadValidationError("mode must be note.");
  }

  if (!Number.isInteger(totalQuestions) || totalQuestions < 0) {
    throw new ScorePayloadValidationError(
      "totalQuestions must be a non-negative integer.",
    );
  }

  if (totalQuestions > MAX_QUESTIONS_PER_SUBMISSION) {
    throw new ScorePayloadValidationError("totalQuestions is too large.");
  }

  if (!Number.isInteger(correctAnswers) || correctAnswers < 0) {
    throw new ScorePayloadValidationError(
      "correctAnswers must be a non-negative integer.",
    );
  }

  if (correctAnswers > totalQuestions) {
    throw new ScorePayloadValidationError(
      "correctAnswers cannot exceed totalQuestions.",
    );
  }

  if (!Number.isFinite(totalTime) || totalTime <= 0) {
    throw new ScorePayloadValidationError(
      "totalTime must be a positive number.",
    );
  }

  if (totalTime > MAX_TIME_PER_SUBMISSION) {
    throw new ScorePayloadValidationError("totalTime is too large.");
  }

  return {
    schemaVersion: SCORE_VERSION,
    sessionId,
    mode,
    totalQuestions,
    correctAnswers,
    totalTime: Math.round(totalTime),
  };
}

export function isScoreEligible(totalQuestions: number): boolean {
  return totalQuestions >= MIN_QUESTIONS_FOR_POINTS;
}

export function calculateSessionPoints(
  correctAnswers: number,
  totalQuestions: number,
): number {
  if (totalQuestions <= 0 || correctAnswers <= 0) return 0;

  const accuracyRatio = correctAnswers / totalQuestions;
  return Math.floor(correctAnswers * (0.5 + accuracyRatio));
}

export function calculateAccuracy(
  correctAnswers: number,
  totalQuestions: number,
): number {
  return totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
}
