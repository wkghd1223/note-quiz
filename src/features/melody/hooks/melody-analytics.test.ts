import { describe, expect, it, vi } from "vitest";
import {
  createMelodyAnalyticsObserver,
  type MelodyAnalyticsSnapshot,
} from "./melody-analytics";

function setup() {
  const learning = vi.fn(),
    preview = vi.fn();
  const observer = createMelodyAnalyticsObserver({ learning, preview });
  const exercise = { id: "private-exercise", seed: 123456 };
  const observe = (change: Partial<MelodyAnalyticsSnapshot> = {}) =>
    observer.observe({
      ready: true,
      exercise,
      attemptToken: 1,
      phase: "landing",
      previewing: false,
      elapsedSec: 0,
      result: null,
      ...change,
    });
  const events = (name: string) =>
    learning.mock.calls
      .filter(([event]) => event === name)
      .map(([, details]) => details);
  return { observer, learning, preview, exercise, observe, events };
}
const finished = { total: 28, correct: 20, elapsedSec: 26.6667 };

describe("melody aggregate milestone observer", () => {
  it("records one hydrated entry, independent of settings/new seeds and readiness replays", () => {
    const { observe, events } = setup();
    observe({ ready: false });
    expect(events("entered")).toHaveLength(0);
    observe();
    observe();
    observe({ exercise: { id: "new-private-seed" }, attemptToken: 0 });
    expect(events("entered")).toEqual([
      {
        mode: "melody",
        difficulty: "custom",
        presentation: "visual",
        sessionType: "exercise",
        kind: "practice",
      },
    ]);
    expect(events("started")).toHaveLength(0);
  });

  it("counts actual ready previews separately, never preparation or failed loading", () => {
    const { observe, preview, events, observer } = setup();
    observe(); // preparing samples: previewing is still false
    observe({ phase: "error", attemptToken: 2 }); // failed preparation
    expect(preview).not.toHaveBeenCalled();
    observe({ previewing: true, attemptToken: 2 }); // scheduling after samples load
    observe({ previewing: true, attemptToken: 2 });
    expect(preview).toHaveBeenCalledTimes(1);
    observe({ attemptToken: 2 }); // stopped
    observe({ previewing: true, attemptToken: 2 }); // another preview
    expect(preview).toHaveBeenCalledTimes(2);
    observer.exit();
    expect(events("started")).toHaveLength(0);
    expect(events("completed")).toHaveLength(0);
  });

  it("does not manufacture sessions for denied initialization, count-in cancellation or a pre-playing pause", () => {
    const { observe, events, observer } = setup();
    observe({ phase: "permission" });
    observe({ phase: "countIn", attemptToken: 2 });
    observe({ phase: "error", attemptToken: 3 }); // denied / unsupported AudioContext
    observe({ phase: "countIn", attemptToken: 4 });
    observe({ phase: "paused", attemptToken: 4 });
    observe({ phase: "landing", attemptToken: 5 }); // stop/reset before actual playing
    observer.exit();
    expect(events("started")).toHaveLength(0);
    expect(events("completed")).toHaveLength(0);
  });

  it("keeps playing, pause, resumed count-in and result in exactly one session", () => {
    const { observe, events, observer } = setup();
    observe({ phase: "countIn", attemptToken: 2 });
    observe({ phase: "playing", attemptToken: 2, elapsedSec: 0 });
    for (let frame = 1; frame <= 120; frame++)
      observe({ phase: "playing", attemptToken: 2, elapsedSec: frame / 60 });
    observe({ phase: "paused", attemptToken: 2, elapsedSec: 1.5 });
    observe({ phase: "countIn", attemptToken: 2, elapsedSec: 1.5 });
    observe({ phase: "playing", attemptToken: 2, elapsedSec: 1.5 });
    observe({
      phase: "evaluating",
      attemptToken: 2,
      elapsedSec: finished.elapsedSec,
    });
    observe({ phase: "result", attemptToken: 2, result: finished });
    observe({ phase: "result", attemptToken: 2, result: { ...finished } });
    observer.exit();
    observer.exit();
    expect(events("started")).toHaveLength(1);
    expect(events("started")[0].entryStart).toBe(true);
    expect(events("completed")).toEqual([
      {
        mode: "melody",
        difficulty: "custom",
        presentation: "visual",
        sessionType: "exercise",
        kind: "practice",
        completed: true,
        total: 28,
        correct: 20,
        hasMistakes: true,
        elapsedMs: 26667,
      },
    ]);
  });

  it("accepts a valid final result as evidence of a batched playing transition, then counts a real retry once", () => {
    const { observe, events } = setup();
    observe({ phase: "countIn", attemptToken: 2 });
    observe({ phase: "result", attemptToken: 2, result: finished });
    observe({ phase: "result", attemptToken: 2, result: finished });
    observe({ phase: "countIn", attemptToken: 3 });
    expect(events("started")).toHaveLength(1); // retry click alone is not a start
    observe({ phase: "playing", attemptToken: 3 });
    observe({
      phase: "result",
      attemptToken: 3,
      result: { ...finished, correct: 28 },
    });
    expect(events("started").map((details) => details.entryStart)).toEqual([
      true,
      false,
    ]);
    expect(events("completed")).toHaveLength(2);
    expect(events("completed")[1].hasMistakes).toBe(false);
  });

  it.each([
    { total: 0, correct: 0, elapsedSec: 1 },
    { total: 2, correct: 3, elapsedSec: 1 },
    { total: 2, correct: 1, elapsedSec: NaN },
    { total: 2, correct: 1.5, elapsedSec: 1 },
  ])(
    "does not treat an invalid final aggregate as proof of a start: %j",
    (result) => {
      const { observe, events, observer } = setup();
      observe({ phase: "result", result });
      observer.exit();
      expect(events("started")).toHaveLength(0);
      expect(events("completed")).toHaveLength(0);
    },
  );

  it("ends stop/reset once without inventing partial totals, and a new real attempt can start", () => {
    const { observe, events, observer } = setup();
    observe({ phase: "playing", attemptToken: 2, elapsedSec: 2.876 });
    observe({ phase: "paused", attemptToken: 2, elapsedSec: 2.2 }); // canonical rewind
    observe({ attemptToken: 3, elapsedSec: 0 });
    observe({ attemptToken: 3 });
    expect(events("completed")).toHaveLength(1);
    expect(events("completed")[0]).toMatchObject({
      completed: false,
      elapsedMs: 2200,
    });
    expect(events("completed")[0]).not.toHaveProperty("total");
    expect(events("completed")[0]).not.toHaveProperty("correct");
    expect(events("completed")[0]).not.toHaveProperty("hasMistakes");
    observe({ phase: "countIn", attemptToken: 4 });
    observe({ phase: "playing", attemptToken: 4, elapsedSec: 0.056 });
    observer.exit();
    observe({ phase: "result", attemptToken: 4, result: finished }); // closed observer
    expect(events("started")).toHaveLength(2);
    expect(events("completed")).toHaveLength(2);
    expect(events("completed")[1]).toMatchObject({
      completed: false,
      elapsedMs: 0,
    });
  });

  it("ends a post-start error, rejects stale result tokens and omits unavailable elapsed", () => {
    const { observe, events, observer } = setup();
    observe({ phase: "playing", attemptToken: 2, elapsedSec: undefined });
    observe({ phase: "error", attemptToken: 3, elapsedSec: 0 }); // fail increments token
    observe({ phase: "result", attemptToken: 2, result: finished });
    observer.exit();
    expect(events("started")).toHaveLength(1);
    expect(events("completed")).toHaveLength(1);
    expect(events("completed")[0]).toMatchObject({ completed: false });
    expect(events("completed")[0]).not.toHaveProperty("elapsedMs");
  });

  it("handles new exercise/store tokens, stale exercise snapshots and actual exit without private payloads", () => {
    const { observe, events, observer, learning, preview } = setup();
    observe({ phase: "playing", attemptToken: 12, elapsedSec: 1.234 });
    const next = { id: "next-private-exercise", seed: 777777 };
    observe({ exercise: next, attemptToken: 1 }); // new store resets its token sequence
    observe({
      exercise: next,
      phase: "playing",
      attemptToken: 2,
      elapsedSec: 3.499,
    });
    observe({ phase: "result", attemptToken: 12, result: finished }); // old exercise
    observe({
      exercise: next,
      phase: "result",
      attemptToken: 1,
      result: finished,
    }); // old token
    observer.exit();
    observer.exit();
    expect(events("started")).toHaveLength(2);
    expect(
      events("completed").map((details) => [
        details.completed,
        details.elapsedMs,
      ]),
    ).toEqual([
      [false, 1200],
      [false, 3400],
    ]);
    expect(
      JSON.stringify([learning.mock.calls, preview.mock.calls]),
    ).not.toMatch(
      /private|exerciseId|attemptToken|seed|777777|123456|notes|frequency|device|sessionId/,
    );
    for (const [, details] of learning.mock.calls)
      expect(
        Object.values(details).every((value) =>
          ["string", "number", "boolean"].includes(typeof value),
        ),
      ).toBe(true);
  });
});
