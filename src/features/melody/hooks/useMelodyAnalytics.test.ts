import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DependencyList } from "react";
import type { NoteResult } from "@/features/challenge/domain/performance";
import { trackLearningEvent, trackMelodyPreviewStarted } from "@/lib/analytics";
import {
  GA_TRACKING_ID,
  recordAnalyticsPageView,
} from "@/lib/analytics-runtime";
import { useMelodyAnalytics } from "./useMelodyAnalytics";

interface Effect {
  effect: () => void | (() => void);
  deps: DependencyList;
  cleanup?: () => void;
}
const harness = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>,
  effects: [] as Effect[],
  pending: [] as number[],
  refIndex: 0,
  effectIndex: 0,
}));
// Node hook harness follows dependency/cleanup order. No audio, timer or store
// methods are replaced by this analytics hook; browser integration is separate.
vi.mock("react", () => ({
  useRef: (initial: unknown) => {
    const index = harness.refIndex++;
    return (harness.refs[index] ??= { current: initial });
  },
  useMemo: (factory: () => unknown) => factory(),
  useEffect: (effect: Effect["effect"], deps: DependencyList) => {
    const index = harness.effectIndex++;
    const old = harness.effects[index];
    if (old && deps.every((value, i) => Object.is(value, old.deps[i]))) return;
    harness.effects[index] = { effect, deps, cleanup: old?.cleanup };
    harness.pending.push(index);
  },
}));
vi.mock("@/lib/analytics", () => ({
  trackLearningEvent: vi.fn(),
  trackMelodyPreviewStarted: vi.fn(),
}));
function SessionAnalyticsProbe(...args: Parameters<typeof useMelodyAnalytics>) {
  harness.refIndex = harness.effectIndex = 0;
  useMelodyAnalytics(...args);
  for (const index of harness.pending.splice(0)) {
    const effect = harness.effects[index];
    effect.cleanup?.();
    effect.cleanup = effect.effect() || undefined;
  }
}
function cleanup() {
  for (const effect of harness.effects) effect.cleanup?.();
}
function strictReplay() {
  cleanup();
  for (const effect of harness.effects)
    effect.cleanup = effect.effect() || undefined;
}
const completedEvents = () =>
  vi
    .mocked(trackLearningEvent)
    .mock.calls.filter(([event]) => event === "completed");
const startedEvents = () =>
  vi
    .mocked(trackLearningEvent)
    .mock.calls.filter(([event]) => event === "started");
const session = (
  phase: Parameters<typeof useMelodyAnalytics>[2]["state"]["phase"],
  attemptToken = 2,
  elapsed = 0,
): Parameters<typeof useMelodyAnalytics>[2] => ({
  state: { phase, attemptToken, elapsedSec: 0, result: null },
  elapsed,
  previewing: false,
});
beforeEach(() => {
  harness.refs.length = harness.effects.length = harness.pending.length = 0;
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubGlobal("window", {
    location: new URL("https://note-quiz.com/en/melody?seed=private#notes"),
  });
  vi.stubGlobal("document", {
    title: "Melody title",
    referrer: "https://note-quiz.com/en/practice/note?email=private#answer",
  });
});
afterEach(async () => {
  cleanup();
  await Promise.resolve();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("useMelodyAnalytics observing integration", () => {
  it("survives StrictMode cleanup and records only an actual exit of a started attempt", async () => {
    const exercise = {};
    SessionAnalyticsProbe(true, exercise, session("playing", 2, 4.456));
    strictReplay();
    await Promise.resolve();
    expect(startedEvents()).toHaveLength(1);
    expect(completedEvents()).toHaveLength(0);
    SessionAnalyticsProbe(true, exercise, session("paused", 2, 3.8));
    SessionAnalyticsProbe(true, exercise, session("countIn", 2, 3.8));
    SessionAnalyticsProbe(true, exercise, session("playing", 2, 3.9));
    expect(startedEvents()).toHaveLength(1);
    cleanup();
    await Promise.resolve();
    expect(completedEvents()).toHaveLength(1);
    expect(completedEvents()[0][1]).toMatchObject({
      completed: false,
      elapsedMs: 3900,
    });
  });

  it("derives final passed/total from the existing result and canonical final clock only", async () => {
    const exercise = {};
    SessionAnalyticsProbe(true, exercise, session("countIn"));
    const final = session("result", 2, 999); // visual elapsed must not replace final store clock
    final.state.elapsedSec = 20.125;
    final.state.result = {
      notes: ["passed", "failed", "missed", "passed"].map((status, i) => ({
        stageEventId: `private-${i}`,
        eventId: `private-input-${i}`,
        status,
        reasons: ["wrongPitch"],
        pitchScore: 12,
        durationScore: 34,
        onsetScore: null,
      })) as NoteResult[],
    };
    SessionAnalyticsProbe(true, exercise, final);
    SessionAnalyticsProbe(true, exercise, final);
    cleanup();
    await Promise.resolve();
    expect(startedEvents()).toHaveLength(1);
    expect(completedEvents()).toHaveLength(1);
    expect(completedEvents()[0][1]).toMatchObject({
      completed: true,
      total: 4,
      correct: 2,
      elapsedMs: 20125,
    });
    expect(
      JSON.stringify(vi.mocked(trackLearningEvent).mock.calls),
    ).not.toMatch(/private|wrongPitch|pitchScore|eventId|999/);
  });

  it("keeps a deferred unmount completion on the outgoing melody after incoming entry and pageview", async () => {
    const actual =
      await vi.importActual<typeof import("@/lib/analytics")>(
        "@/lib/analytics",
      );
    vi.mocked(trackLearningEvent).mockImplementation(actual.trackLearningEvent);
    const exercise = {};
    recordAnalyticsPageView("/en/melody");
    SessionAnalyticsProbe(true, exercise, session("countIn"));
    document.title = "Committed melody title";
    SessionAnalyticsProbe(true, exercise, session("playing", 2, 4.456));
    cleanup(); // Exit is deferred to distinguish StrictMode cleanup.
    window.location = new URL(
      "https://note-quiz.com/en/practice/note?session=private#answer",
    ) as unknown as Location;
    document.title = "Note title";
    actual.trackLearningEvent("entered", {
      mode: "note",
      difficulty: "beginner",
    });
    recordAnalyticsPageView("/en/practice/note");
    await Promise.resolve();

    expect(completedEvents()).toHaveLength(1);
    expect(completedEvents()[0][2]).toEqual({
      page_path: "/en/melody",
      page_location: "https://note-quiz.com/en/melody",
      page_title: "Committed melody title",
      page_referrer: "https://note-quiz.com/en/practice/note",
    });
    let config = {};
    const effective = window.dataLayer!.flatMap((item) => {
      const [command, name, payload] = Array.from(item as IArguments);
      if (command === "config" && name === GA_TRACKING_ID)
        config = { ...config, ...payload };
      return command === "event" ? [[name, { ...config, ...payload }]] : [];
    });
    expect(effective.at(-1)).toEqual([
      "practice_completed",
      expect.objectContaining({
        training_mode: "melody",
        completed: false,
        elapsed_time_ms: 4400,
        page_path: "/en/melody",
        page_title: "Committed melody title",
        page_referrer: "https://note-quiz.com/en/practice/note",
      }),
    ]);
    expect(config).toMatchObject({
      page_path: "/en/practice/note",
      page_referrer: "https://note-quiz.com/en/melody",
    });
    expect(JSON.stringify(window.dataLayer)).not.toMatch(
      /private|seed|session=|#answer/,
    );
  });

  it("observes hydration and actual preview flag, without wrapping session methods or treating count-in as start", async () => {
    const exercise = {};
    SessionAnalyticsProbe(false, exercise, session("landing"));
    expect(trackLearningEvent).not.toHaveBeenCalled();
    SessionAnalyticsProbe(true, exercise, session("landing"));
    SessionAnalyticsProbe(true, exercise, session("error", 3));
    expect(trackMelodyPreviewStarted).not.toHaveBeenCalled();
    SessionAnalyticsProbe(true, exercise, {
      ...session("landing", 3),
      previewing: true,
    });
    SessionAnalyticsProbe(true, exercise, {
      ...session("landing", 3),
      previewing: true,
    });
    SessionAnalyticsProbe(true, exercise, session("countIn", 4));
    cleanup();
    await Promise.resolve();
    expect(trackMelodyPreviewStarted).toHaveBeenCalledTimes(1);
    expect(startedEvents()).toHaveLength(0);
    expect(completedEvents()).toHaveLength(0);
  });
});
