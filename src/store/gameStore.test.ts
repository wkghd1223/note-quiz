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
