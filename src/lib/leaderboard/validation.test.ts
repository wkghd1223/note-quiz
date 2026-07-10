import { describe, expect, it } from "vitest";
import {
  calculateSessionPoints,
  isScoreEligible,
  MAX_QUESTIONS_PER_SUBMISSION,
  parseScorePayload,
  SCORE_VERSION,
} from "./validation";

const validPayload = {
  schemaVersion: SCORE_VERSION,
  sessionId: "123e4567-e89b-42d3-a456-426614174000",
  mode: "note",
  totalQuestions: 20,
  correctAnswers: 15,
  totalTime: 30_000,
};

describe("calculateSessionPoints", () => {
  it.each([
    [20, 20, 30],
    [15, 20, 18],
    [10, 20, 10],
    [0, 20, 0],
    [0, 0, 0],
  ])("scores %i correct out of %i as %i points", (correct, total, points) => {
    expect(calculateSessionPoints(correct, total)).toBe(points);
  });

  it("rounds down fractional points", () => {
    expect(calculateSessionPoints(7, 10)).toBe(8);
  });
});

describe("score eligibility", () => {
  it("requires ten answered questions", () => {
    expect(isScoreEligible(9)).toBe(false);
    expect(isScoreEligible(10)).toBe(true);
  });
});

describe("parseScorePayload", () => {
  it("normalizes a valid payload", () => {
    expect(parseScorePayload(validPayload)).toEqual(validPayload);
  });

  it("accepts the maximum question count", () => {
    expect(
      parseScorePayload({
        ...validPayload,
        totalQuestions: MAX_QUESTIONS_PER_SUBMISSION,
        correctAnswers: MAX_QUESTIONS_PER_SUBMISSION,
      }).totalQuestions,
    ).toBe(MAX_QUESTIONS_PER_SUBMISSION);
  });

  it.each([
    [{ ...validPayload, schemaVersion: 1 }, "schemaVersion"],
    [{ ...validPayload, sessionId: "not-a-uuid" }, "sessionId"],
    [{ ...validPayload, mode: "ear" }, "mode"],
    [{ ...validPayload, correctAnswers: 21 }, "cannot exceed"],
    [{ ...validPayload, totalTime: 0 }, "positive"],
    [{ ...validPayload, totalQuestions: 151, correctAnswers: 15 }, "too large"],
  ])("rejects invalid payload %#", (payload, message) => {
    expect(() => parseScorePayload(payload)).toThrow(message as string);
  });
});
