import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "./gameStore";

describe("game timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T00:00:00.000Z"));
    useGameStore.getState().resetGame();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves accumulated time across pause and resume", () => {
    const store = useGameStore.getState();
    store.startGame();

    vi.advanceTimersByTime(2_000);
    expect(useGameStore.getState().updateTimer(Date.now())).toBe(2_000);
    useGameStore.getState().pauseGame();

    vi.advanceTimersByTime(5_000);
    useGameStore.getState().resumeGame();
    vi.advanceTimersByTime(1_500);

    expect(useGameStore.getState().updateTimer(Date.now())).toBe(3_500);
    useGameStore.getState().endGame();
    expect(useGameStore.getState().gameResult?.totalTime).toBe(3_500);
  });

  it("handles repeated pause cycles without counting paused time", () => {
    useGameStore.getState().startGame();

    vi.advanceTimersByTime(1_000);
    useGameStore.getState().pauseGame();
    vi.advanceTimersByTime(4_000);
    useGameStore.getState().resumeGame();
    vi.advanceTimersByTime(2_000);
    useGameStore.getState().pauseGame();
    vi.advanceTimersByTime(3_000);
    useGameStore.getState().resumeGame();
    vi.advanceTimersByTime(500);

    expect(useGameStore.getState().updateTimer(Date.now())).toBe(3_500);
  });

  it("creates a new anonymous session identifier for each game", () => {
    useGameStore.getState().startGame();
    const firstSessionId = useGameStore.getState().sessionId;
    useGameStore.getState().resetGame();
    useGameStore.getState().startGame();

    expect(firstSessionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(useGameStore.getState().sessionId).not.toBe(firstSessionId);
  });
});

function question(id: string, name: NoteName = "F"): Question {
  return {
    id,
    clef: "treble",
    keySignature: {
      key: "G Major",
      sharps: ["F"],
      flats: [],
      accidentalType: "sharp",
    },
    note: { name, accidental: null, octave: 4 },
    displayNote: {
      name,
      accidental: name === "F" ? "sharp" : "natural",
      octave: 4,
    },
  };
}
const fSharp: Note = { name: "F", accidental: "sharp", octave: 4 };

describe("note session lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T00:00:00Z"));
    useGameStore.getState().resetSettings();
    useGameStore.getState().resetStats();
  });
  afterEach(() => {
    useGameStore.getState().resetGame();
    vi.useRealTimers();
  });

  it("defaults to ten answers and lets the last feedback finish before ending once", () => {
    useGameStore.getState().startGame({
      questions: Array.from({ length: 10 }, (_, index) =>
        question(String(index)),
      ),
    });
    for (let index = 0; index < 9; index++) {
      expect(useGameStore.getState().submitAnswer(fSharp)).toBe(true);
      vi.advanceTimersByTime(850);
    }
    expect(useGameStore.getState().submitAnswer(fSharp)).toBe(true);
    expect(useGameStore.getState().gameState).toBe("playing");
    vi.advanceTimersByTime(849);
    expect(useGameStore.getState().gameResult).toBeNull();
    vi.advanceTimersByTime(1);
    expect(useGameStore.getState().gameResult).toMatchObject({
      totalQuestions: 10,
      correctAnswers: 10,
      completed: true,
    });
    useGameStore.getState().endGame();
    expect(useGameStore.getState().stats.gamesPlayed).toBe(1);
  });

  it("rejects same-question rapid pointer or keyboard callbacks synchronously", () => {
    useGameStore
      .getState()
      .startGame({ questions: [question("one"), question("two")] });
    expect(useGameStore.getState().submitAnswer(fSharp)).toBe(true);
    expect(useGameStore.getState().submitAnswer(fSharp)).toBeNull();
    expect(useGameStore.getState().submitAnswer(fSharp)).toBeNull();
    expect(useGameStore.getState().answers).toHaveLength(1);
    vi.advanceTimersByTime(850);
    expect(useGameStore.getState().currentQuestion?.id).toBe("two");
  });

  it("resumes a pending transition after pausing immediately after an answer", () => {
    useGameStore
      .getState()
      .startGame({ questions: [question("one"), question("two")] });
    useGameStore.getState().submitAnswer(fSharp);
    vi.advanceTimersByTime(200);
    useGameStore.getState().pauseGame();
    vi.advanceTimersByTime(5000);
    expect(useGameStore.getState().currentQuestion?.id).toBe("one");
    useGameStore.getState().resumeGame();
    vi.advanceTimersByTime(649);
    expect(useGameStore.getState().isAnswerLocked).toBe(true);
    vi.advanceTimersByTime(1);
    expect(useGameStore.getState().currentQuestion?.id).toBe("two");
    expect(useGameStore.getState().isAnswerLocked).toBe(false);
    expect(useGameStore.getState().updateTimer(Date.now())).toBe(850);
  });

  it("excludes paused time from the per-question answer duration", () => {
    useGameStore.getState().startGame({ questions: [question("one")] });
    vi.advanceTimersByTime(200);
    useGameStore.getState().pauseGame();
    vi.advanceTimersByTime(10000);
    useGameStore.getState().resumeGame();
    vi.advanceTimersByTime(300);
    useGameStore.getState().submitAnswer(fSharp);
    expect(useGameStore.getState().answers[0].timeSpent).toBe(500);
  });

  it("cancels old feedback callbacks on reset, settings changes, and a fresh start", () => {
    useGameStore
      .getState()
      .startGame({ questions: [question("old"), question("old-next")] });
    useGameStore.getState().submitAnswer(fSharp);
    vi.advanceTimersByTime(100);
    useGameStore.getState().updateSettings({ clef: "bass" });
    expect(useGameStore.getState().gameState).toBe("idle");
    useGameStore.getState().startGame({ questions: [question("new")] });
    vi.advanceTimersByTime(1000);
    expect(useGameStore.getState().currentQuestion?.id).toBe("new");
    expect(useGameStore.getState().answers).toHaveLength(0);
  });

  it("preserves the original clef, key, display pitch and answer for separate review", () => {
    const original = question("context");
    original.clef = "alto";
    useGameStore.getState().startGame({ questions: [original] });
    useGameStore
      .getState()
      .submitAnswer({ name: "C", accidental: "natural", octave: 4 });
    original.keySignature.sharps.length = 0;
    vi.advanceTimersByTime(850);
    const firstResult = useGameStore.getState().gameResult!;
    expect(firstResult.answers[0].question).toMatchObject({
      clef: "alto",
      keySignature: { sharps: ["F"] },
      displayNote: fSharp,
    });
    useGameStore.getState().startGame({
      kind: "review",
      questions: [firstResult.answers[0].question!],
    });
    useGameStore.getState().submitAnswer(fSharp);
    vi.advanceTimersByTime(850);
    expect(useGameStore.getState().sessionKind).toBe("review");
    expect(useGameStore.getState().stats.gamesPlayed).toBe(1);
    expect(firstResult.correctAnswers).toBe(0);
    expect(firstResult.answers).toHaveLength(1);
  });

  it("uses the exact timed boundary and does not accept answers after it", () => {
    useGameStore
      .getState()
      .updateSettings({ timeLimit: 30, questionLimit: undefined });
    useGameStore.getState().startGame();
    vi.advanceTimersByTime(30020);
    expect(useGameStore.getState().submitAnswer(fSharp)).toBeNull();
    expect(useGameStore.getState().gameResult).toMatchObject({
      totalQuestions: 0,
      totalTime: 30000,
      completed: true,
    });
    useGameStore.getState().endGame();
    expect(useGameStore.getState().stats.gamesPlayed).toBe(1);
  });

  it("marks an early finish incomplete and permits free practice beyond ten questions", () => {
    useGameStore
      .getState()
      .updateSettings({ questionLimit: undefined, timeLimit: undefined });
    useGameStore.getState().startGame();
    for (let index = 0; index < 11; index++) {
      useGameStore.getState().submitAnswer(fSharp);
      vi.advanceTimersByTime(850);
    }
    expect(useGameStore.getState().gameState).toBe("playing");
    useGameStore.getState().endGame();
    expect(useGameStore.getState().gameResult).toMatchObject({
      totalQuestions: 11,
      completed: false,
    });
  });
});

describe("note persistence failure", () => {
  it("still starts and ends when browser storage writes are blocked", () => {
    const write = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    expect(() => {
      useGameStore.getState().resetGame();
      useGameStore.getState().startGame();
      useGameStore.getState().endGame();
    }).not.toThrow();
    expect(useGameStore.getState().gameState).toBe("finished");
    write.mockRestore();
    useGameStore.getState().resetGame();
  });
});

describe("note pause at timed deadline", () => {
  it("finishes instead of parking an expired timed session in paused state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    useGameStore
      .getState()
      .updateSettings({ questionLimit: undefined, timeLimit: 30 });
    useGameStore.getState().startGame();
    vi.advanceTimersByTime(30001);
    useGameStore.getState().pauseGame();
    expect(useGameStore.getState().gameState).toBe("finished");
    expect(useGameStore.getState().gameResult?.totalTime).toBe(30000);
    useGameStore.getState().resetSettings();
    vi.useRealTimers();
  });
});

describe("note persisted state writes", () => {
  const key = "note-quiz-game-store";
  const saved = () => JSON.parse(localStorage.getItem(key)!);
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    useGameStore.getState().resetSettings();
    useGameStore.getState().resetStats();
  });
  afterEach(() => {
    useGameStore.getState().resetGame();
    vi.useRealTimers();
  });

  it("keeps 20 timer updates live without rewriting settings or stats", () => {
    useGameStore.getState().startGame();
    const write = vi.spyOn(localStorage, "setItem");
    for (let tick = 1; tick <= 20; tick++) {
      vi.advanceTimersByTime(50);
      useGameStore.getState().updateTimer(Date.now());
    }
    expect(useGameStore.getState().elapsedTime).toBe(1000);
    expect(write).not.toHaveBeenCalled();
    useGameStore.getState().endGame();
    expect(saved().state.stats.gamesPlayed).toBe(1);
    expect(write).toHaveBeenCalledTimes(1);
    useGameStore.getState().updateSettings({ clef: "bass" });
    expect(saved().state.settings.clef).toBe("bass");
    expect(write).toHaveBeenCalledTimes(2);
    useGameStore.getState().resetSettings();
    expect(saved().state.settings.clef).toBe(
      useGameStore.getState().settings.clef,
    );
    useGameStore.getState().resetStats();
    expect(saved().state.stats.gamesPlayed).toBe(0);
  });

  it("writes again after external overwrite or clear and rehydrates current storage", async () => {
    useGameStore.getState().startGame();
    const original = localStorage.getItem(key)!;
    localStorage.setItem(key, "external overwrite");
    useGameStore.getState().updateTimer(1050);
    expect(localStorage.getItem(key)).toBe(original);
    useGameStore.persist.clearStorage();
    expect(localStorage.getItem(key)).toBeNull();
    useGameStore.getState().updateTimer(1100);
    expect(localStorage.getItem(key)).toBe(original);
    const external = saved();
    external.state.settings.clef = "bass";
    localStorage.setItem(key, JSON.stringify(external));
    await useGameStore.persist.rehydrate();
    expect(useGameStore.getState().settings.clef).toBe("bass");
  });

  it("preserves legacy timed settings, nested defaults and missing stats", async () => {
    localStorage.setItem(
      key,
      JSON.stringify({
        state: {
          settings: { timeLimit: 30, staffRange: { min: -2 } },
          stats: { gamesPlayed: 7 },
        },
        version: 0,
      }),
    );
    await useGameStore.persist.rehydrate();
    expect(useGameStore.getState().settings).toMatchObject({
      questionLimit: null,
      timeLimit: 30,
      staffRange: {
        ...useGameStore.getInitialState().settings.staffRange,
        min: -2,
      },
    });
    expect(useGameStore.getState().stats.gamesPlayed).toBe(7);
    expect(useGameStore.getState().stats.bestTime).toBe(Infinity);
  });

  it("retains explicit null question limits and existing Infinity JSON behavior", async () => {
    useGameStore
      .getState()
      .updateSettings({ questionLimit: undefined, timeLimit: undefined });
    expect(saved().version).toBe(0);
    expect(saved().state.settings.questionLimit).toBeNull();
    expect(saved().state.stats.bestTime).toBeNull();
    await useGameStore.persist.rehydrate();
    expect(useGameStore.getState().settings.questionLimit).toBeNull();
    // Existing JSON null is preserved by the merge; this refactor does not migrate it.
    expect(useGameStore.getState().stats.bestTime).toBeNull();
  });
});
