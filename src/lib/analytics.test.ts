import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as analytics from "./analytics";
const gtag = vi.fn();
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubGlobal("window", { gtag });
  gtag.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("anonymous session analytics", () => {
  it.each([
    "entered",
    "started",
    "completed",
    "review_started",
    "result_restarted",
  ] as const)("emits only aggregate allow-listed fields for %s", (event) => {
    const details = {
      mode: "interval",
      difficulty: "basic",
      presentation: "audio",
      sessionType: "ten",
      kind: "practice",
      completed: true,
      total: 10,
      correct: 7,
      entryStart: true,
      hasMistakes: true,
      sessionId: "private-session",
      userId: "private-person",
      expectedNote: "C4",
      userNote: "D4",
      answers: ["C4"],
      audio: "raw-audio",
    };
    analytics.trackLearningEvent(event, details);
    expect(gtag).toHaveBeenCalledTimes(1);
    const [command, name, payload] = gtag.mock.calls[0];
    expect(command).toBe("event");
    expect(name).toBe(`practice_${event}`);
    expect(payload).toMatchObject({
      training_mode: "interval",
      difficulty: "basic",
      presentation: "audio",
      session_type: "ten",
      session_kind: "practice",
      completed: true,
      total_questions: 10,
      correct_answers: 7,
      entry_start: true,
      had_mistakes: true,
    });
    expect(Object.keys(payload).sort()).toEqual(
      [
        "training_mode",
        "difficulty",
        "presentation",
        "session_type",
        "session_kind",
        "completed",
        "total_questions",
        "correct_answers",
        "entry_start",
        "had_mistakes",
      ].sort(),
    );
    expect(JSON.stringify(payload)).not.toMatch(
      /private|C4|D4|raw-audio|sessionId|userId|expectedNote|userNote/,
    );
  });
  it("retains existing note and ear start/completion events using aggregate values", () => {
    analytics.trackGameStart({
      clef: "treble",
      keySignature: "C",
      answerMode: "piano",
    });
    analytics.trackGameComplete({
      score: 7,
      accuracy: 70,
      totalQuestions: 10,
      timeSpent: 12000,
      sessionPoints: 7,
      eligibleForLeaderboard: true,
    });
    analytics.trackEarTrainingStart({
      inputMode: "piano",
      noteSet: "natural",
      timeLimit: null,
      sessionType: "practice",
    });
    analytics.trackEarTrainingComplete({
      totalQuestions: 10,
      correctAnswers: 7,
      accuracy: 70,
      averageTime: 1200,
      replayCount: 2,
    });
    expect(gtag.mock.calls.map((call) => call[1])).toEqual([
      "note_quiz_session_started",
      "note_quiz_session_completed",
      "ear_training_session_started",
      "ear_training_session_completed",
    ]);
    for (const call of gtag.mock.calls)
      expect(
        Object.keys(call[2]).some((key) =>
          /^(expected_note|user_note|session_id|user_id|answer|answers)$/.test(
            key,
          ),
        ),
      ).toBe(false);
  });
  it("has no answer-level tracking API remaining", () => {
    expect("trackAnswer" in analytics).toBe(false);
    expect("trackEarTrainingAnswer" in analytics).toBe(false);
  });
  it("does not track development, disabled analytics or server rendering", () => {
    vi.stubEnv("NODE_ENV", "development");
    analytics.trackLearningEvent("entered", {
      mode: "note",
      difficulty: "beginner",
    });
    expect(gtag).not.toHaveBeenCalled();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("window", {});
    expect(() => analytics.trackPageView("practice")).not.toThrow();
    vi.stubGlobal("window", undefined);
    expect(() =>
      analytics.trackLearningEvent("entered", {
        mode: "note",
        difficulty: "beginner",
      }),
    ).not.toThrow();
    expect(gtag).not.toHaveBeenCalled();
  });
});
