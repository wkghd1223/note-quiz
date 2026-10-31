import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEarTrainingStore } from "./earTrainingStore";
const target: Note = { name: "C", accidental: "natural", octave: 4 };
const question = (id: string): EarTrainingQuestion => ({
  id,
  targetNote: { ...target },
});

describe("ear practice lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T00:00:00Z"));
    useEarTrainingStore.getState().resetSettings();
    useEarTrainingStore.setState({
      stats: {
        sessionsPlayed: 0,
        totalCorrect: 0,
        totalQuestions: 0,
        averageAccuracy: 0,
        bestAccuracy: 0,
        fastestAverageTime: Infinity,
      },
    });
  });
  afterEach(() => {
    useEarTrainingStore.getState().resetSession();
    vi.useRealTimers();
  });

  it.each([30, 60, 180])(
    "ends a %i-second timed session once at the authoritative boundary",
    (seconds) => {
      useEarTrainingStore
        .getState()
        .updateSettings({
          sessionType: "timed",
          timeLimit: seconds,
          questionLimit: undefined,
        });
      useEarTrainingStore.getState().startSession();
      vi.advanceTimersByTime(seconds * 1000 - 1);
      useEarTrainingStore.getState().updateTimer(Date.now());
      expect(useEarTrainingStore.getState().sessionState).toBe("playing");
      vi.advanceTimersByTime(2);
      useEarTrainingStore.getState().updateTimer(Date.now());
      expect(useEarTrainingStore.getState().result).toMatchObject({
        totalTime: seconds * 1000,
        completed: true,
      });
      useEarTrainingStore.getState().updateTimer(Date.now() + 10000);
      useEarTrainingStore.getState().endSession();
      expect(useEarTrainingStore.getState().stats.sessionsPlayed).toBe(1);
      expect(useEarTrainingStore.getState().submitAnswer(target)).toBeNull();
    },
  );

  it("finishes after the tenth answer feedback and rejects rapid duplicates", () => {
    useEarTrainingStore
      .getState()
      .startSession({
        questions: Array.from({ length: 10 }, (_, index) =>
          question(String(index)),
        ),
      });
    for (let index = 0; index < 10; index++) {
      expect(useEarTrainingStore.getState().submitAnswer(target)).toBe(true);
      expect(useEarTrainingStore.getState().submitAnswer(target)).toBeNull();
      if (index === 9) expect(useEarTrainingStore.getState().result).toBeNull();
      vi.advanceTimersByTime(900);
    }
    expect(useEarTrainingStore.getState().result).toMatchObject({
      totalQuestions: 10,
      correctAnswers: 10,
      completed: true,
    });
    expect(useEarTrainingStore.getState().stats.sessionsPlayed).toBe(1);
  });

  it("does not let a previous session's scheduled question enter the new one", () => {
    useEarTrainingStore
      .getState()
      .startSession({ questions: [question("old"), question("old-next")] });
    useEarTrainingStore.getState().submitAnswer(target);
    vi.advanceTimersByTime(100);
    useEarTrainingStore.getState().endSession();
    useEarTrainingStore
      .getState()
      .startSession({ questions: [question("new")] });
    vi.advanceTimersByTime(1000);
    expect(useEarTrainingStore.getState().currentQuestion?.id).toBe("new");
    expect(useEarTrainingStore.getState().answers).toHaveLength(0);
  });

  it("uses fresh elapsed time on manual stop instead of the last interval update", () => {
    useEarTrainingStore.getState().startSession();
    vi.advanceTimersByTime(1234);
    useEarTrainingStore.getState().endSession();
    expect(useEarTrainingStore.getState().result?.totalTime).toBe(1234);
    expect(useEarTrainingStore.getState().result?.completed).toBe(false);
  });

  it("keeps missed question context in separate review without appending to original results", () => {
    useEarTrainingStore
      .getState()
      .startSession({ questions: [question("one")] });
    useEarTrainingStore
      .getState()
      .submitAnswer({ name: "D", accidental: "natural", octave: 4 });
    vi.advanceTimersByTime(900);
    const original = useEarTrainingStore.getState().result!;
    useEarTrainingStore
      .getState()
      .startSession({
        kind: "review",
        questions: [original.answers[0].question!],
      });
    useEarTrainingStore.getState().submitAnswer(target);
    vi.advanceTimersByTime(900);
    expect(useEarTrainingStore.getState().result?.correctAnswers).toBe(1);
    expect(original.correctAnswers).toBe(0);
    expect(useEarTrainingStore.getState().stats.sessionsPlayed).toBe(1);
  });

  it("keeps free sessions running and cancels transitions when settings change", () => {
    useEarTrainingStore
      .getState()
      .updateSettings({
        questionLimit: undefined,
        sessionType: "practice",
        timeLimit: undefined,
      });
    useEarTrainingStore.getState().startSession();
    vi.advanceTimersByTime(200000);
    useEarTrainingStore.getState().updateTimer(Date.now());
    expect(useEarTrainingStore.getState().sessionState).toBe("playing");
    useEarTrainingStore.getState().submitAnswer(target);
    useEarTrainingStore.getState().updateSettings({ noteSet: "chromatic" });
    vi.advanceTimersByTime(1000);
    expect(useEarTrainingStore.getState().sessionState).toBe("idle");
    expect(useEarTrainingStore.getState().currentQuestion).toBeNull();
  });
});

describe("ear persistence failure", () => {
  it("still starts and ends when browser storage writes are blocked", () => {
    const write = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    expect(() => {
      useEarTrainingStore.getState().resetSession();
      useEarTrainingStore.getState().startSession();
      useEarTrainingStore.getState().endSession();
    }).not.toThrow();
    expect(useEarTrainingStore.getState().sessionState).toBe("finished");
    write.mockRestore();
    useEarTrainingStore.getState().resetSession();
  });
});
