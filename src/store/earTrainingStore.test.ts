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

describe("ear persisted state writes", () => {
  const key = "ear-training-storage";
  const saved = () => JSON.parse(localStorage.getItem(key)!);
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    useEarTrainingStore.getState().resetSettings();
    useEarTrainingStore.setState({
      stats: { ...useEarTrainingStore.getInitialState().stats },
    });
  });
  afterEach(() => {
    useEarTrainingStore.getState().resetSession();
    vi.useRealTimers();
  });

  it("keeps 20 timer updates live without rewriting settings or stats", () => {
    useEarTrainingStore.getState().startSession();
    const write = vi.spyOn(localStorage, "setItem");
    for (let tick = 1; tick <= 20; tick++) {
      vi.advanceTimersByTime(50);
      useEarTrainingStore.getState().updateTimer(Date.now());
    }
    expect(useEarTrainingStore.getState().elapsedTime).toBe(1000);
    expect(write).not.toHaveBeenCalled();
    useEarTrainingStore.getState().endSession();
    expect(saved().state.stats.sessionsPlayed).toBe(1);
    expect(write).toHaveBeenCalledTimes(1);
    useEarTrainingStore.getState().updateSettings({ noteSet: "chromatic" });
    expect(saved().state.settings.noteSet).toBe("chromatic");
    expect(write).toHaveBeenCalledTimes(2);
    useEarTrainingStore.getState().resetSettings();
    expect(saved().state.settings.noteSet).toBe(
      useEarTrainingStore.getState().settings.noteSet,
    );
  });

  it("writes again after external overwrite or clear and rehydrates current storage", async () => {
    useEarTrainingStore.getState().startSession();
    const original = localStorage.getItem(key)!;
    localStorage.setItem(key, "external overwrite");
    useEarTrainingStore.getState().updateTimer(1050);
    expect(localStorage.getItem(key)).toBe(original);
    useEarTrainingStore.persist.clearStorage();
    expect(localStorage.getItem(key)).toBeNull();
    useEarTrainingStore.getState().updateTimer(1100);
    expect(localStorage.getItem(key)).toBe(original);
    const external = saved();
    external.state.settings.noteSet = "chromatic";
    localStorage.setItem(key, JSON.stringify(external));
    await useEarTrainingStore.persist.rehydrate();
    expect(useEarTrainingStore.getState().settings.noteSet).toBe("chromatic");
  });

  it("preserves legacy timed settings, nested defaults and missing stats", async () => {
    localStorage.setItem(
      key,
      JSON.stringify({
        state: {
          settings: {
            sessionType: "timed",
            timeLimit: 30,
            octaveRange: { min: 3 },
          },
          stats: { sessionsPlayed: 7 },
        },
        version: 0,
      }),
    );
    await useEarTrainingStore.persist.rehydrate();
    expect(useEarTrainingStore.getState().settings).toMatchObject({
      questionLimit: null,
      sessionType: "timed",
      timeLimit: 30,
      octaveRange: {
        ...useEarTrainingStore.getInitialState().settings.octaveRange,
        min: 3,
      },
    });
    expect(useEarTrainingStore.getState().stats.sessionsPlayed).toBe(7);
    expect(useEarTrainingStore.getState().stats.fastestAverageTime).toBe(
      Infinity,
    );
  });

  it("retains explicit null question limits and existing Infinity JSON behavior", async () => {
    useEarTrainingStore.getState().updateSettings({ questionLimit: undefined });
    expect(saved().version).toBe(0);
    expect(saved().state.settings.questionLimit).toBeNull();
    expect(saved().state.stats.fastestAverageTime).toBeNull();
    await useEarTrainingStore.persist.rehydrate();
    expect(useEarTrainingStore.getState().settings.questionLimit).toBeNull();
    expect(useEarTrainingStore.getState().stats.fastestAverageTime).toBeNull();
  });
});
