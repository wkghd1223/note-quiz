import React, {
  type DependencyList,
  type ReactElement,
  type ReactNode,
} from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMelody } from "../domain/generator";
import {
  defaultMelodySettings,
  melodySettingsStorageKey,
  type MelodySettings,
} from "../domain/settings";
import type { MelodyExercise } from "../domain/harmony";
import MelodyPractice from "./MelodyPractice";
import MelodySettingsPanel from "./MelodySettingsPanel";
import ScoreViewport from "@/features/challenge/components/ScoreViewport";
import PracticeController from "@/components/practice/PracticeController";
import type {
  AttemptResult,
  InputFrame,
} from "@/features/challenge/domain/performance";
import type { ProvisionalPitchFeedback } from "../domain/live-feedback";
import MelodyResultReview from "./MelodyResultReview";

type Effect = {
  run: () => void | (() => void);
  deps?: DependencyList;
  cleanup?: () => void;
};
const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  effects: [] as Effect[],
  pending: [] as number[],
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
  exercise: null as MelodyExercise | null,
  resultsOpen: false,
  setResultsOpen: vi.fn(),
  pitchFeedback: null as ProvisionalPitchFeedback | null,
  quality: "inactive",
  session: {
    state: {
      phase: "landing",
      attemptToken: 1,
      result: null as AttemptResult | null,
      liveResult: null,
    },
    previewing: false,
    busy: false,
    previewPreparing: false,
    elapsed: 0,
    scorePreRoll: null,
    frame: null as InputFrame | null,
    reset: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    example: vi.fn(),
    stopReview: vi.fn(),
    reviewBar: vi.fn(),
    reviewPlayback: "idle",
  },
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.stateIndex++;
    if (!(index in harness.states))
      harness.states[index] =
        typeof initial === "function" ? (initial as () => unknown)() : initial;
    return [
      harness.states[index],
      (value: unknown) => {
        harness.states[index] =
          typeof value === "function"
            ? (value as (old: unknown) => unknown)(harness.states[index])
            : value;
      },
    ];
  },
  useRef: (current: unknown) =>
    harness.refs[harness.refIndex++] ??
    (harness.refs[harness.refIndex - 1] = { current }),
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useEffect: (run: Effect["run"], deps?: DependencyList) => {
    const index = harness.effectIndex++,
      old = harness.effects[index];
    if (
      old &&
      deps &&
      old.deps &&
      deps.every((value, i) => Object.is(value, old.deps![i]))
    )
      return;
    harness.effects[index] = { run, deps, cleanup: old?.cleanup };
    harness.pending.push(index);
  },
}));
vi.mock("../domain/generator", async (importOriginal) => {
  const original = await importOriginal<typeof import("../domain/generator")>();
  return { ...original, createMelody: vi.fn(original.createMelody) };
});
vi.mock("@/hooks/useTranslation", async () => {
  const { getTranslation } = await import("@/lib/i18n/translations");
  return {
    useTranslation: () => ({ t: getTranslation("en"), language: "en" }),
  };
});
vi.mock("@/features/challenge/hooks/useChallengeSession", () => ({
  useChallengeSession: (exercise: MelodyExercise) => {
    harness.exercise = exercise;
    return harness.session;
  },
}));
vi.mock("../hooks/useMelodyAnalytics", () => ({ useMelodyAnalytics: vi.fn() }));
vi.mock("../hooks/useLivePitchFeedback", () => ({
  useLivePitchFeedback: () => harness.pitchFeedback,
  useFreshInputQuality: () => harness.quality,
}));
vi.mock("@/features/challenge/components/ScoreViewport", () => ({
  default: () => null,
}));
vi.mock("@/components/practice/PracticeResultSurface", () => ({
  default: () => null,
  usePracticeResultSurface: () => ({
    open: harness.resultsOpen,
    setOpen: harness.setResultsOpen,
  }),
}));
function render() {
  harness.stateIndex = harness.refIndex = harness.effectIndex = 0;
  return MelodyPractice();
}
function flush() {
  for (const index of harness.pending.splice(0)) {
    const effect = harness.effects[index];
    effect.cleanup?.();
    effect.cleanup = effect.run() || undefined;
  }
}
function find<T>(tree: ReactNode, type: unknown): T {
  if (!tree || typeof tree !== "object") throw new Error("element not found");
  const element = tree as ReactElement<{ children?: ReactNode }>;
  if (element.type === type) return element.props as T;
  for (const child of React.Children.toArray(element.props?.children)) {
    try {
      return find<T>(child, type);
    } catch {}
  }
  throw new Error("element not found");
}
const panel = (tree: ReactNode) =>
  find<{
    value: MelodySettings;
    onChange: (value: MelodySettings) => void;
    disabled: boolean;
    generation: ReturnType<typeof createMelody>;
  }>(tree, MelodySettingsPanel);
const controller = (tree: ReactNode) =>
  find<{
    states: Record<
      string,
      Array<{ id: string; onClick: () => void; disabled?: boolean }>
    >;
  }>(tree, PracticeController);
function hydrate() {
  render();
  flush();
  return render();
}
beforeEach(() => {
  harness.states.length =
    harness.refs.length =
    harness.effects.length =
    harness.pending.length =
      0;
  harness.session.state.phase = "landing";
  harness.session.state.result = null;
  harness.session.frame = null;
  harness.quality = "inactive";
  harness.pitchFeedback = null;
  harness.resultsOpen = false;
  harness.session.previewing = false;
  harness.session.busy = false;
  localStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
});
afterEach(() => {
  for (const effect of harness.effects) effect.cleanup?.();
  vi.unstubAllGlobals();
});

describe("melody settings and exercise lifecycle", () => {
  it("generates once per valid edit, auto-saves the request and retains the last good score for impossible/incomplete drafts", () => {
    let tree = hydrate();
    vi.mocked(createMelody).mockClear();
    panel(tree).onChange({
      ...panel(tree).value,
      progressionId: "major-basic",
    });
    tree = render();
    expect(createMelody).toHaveBeenCalledTimes(1);
    const good = harness.exercise!;
    expect(good.harmony!.patternId).toBe("major-basic");
    expect(find<{ barLabels: unknown }>(tree, ScoreViewport).barLabels).toBe(
      good.harmony!.bars,
    );
    expect(
      JSON.parse(localStorage.getItem(melodySettingsStorageKey)!).settings
        .progressionId,
    ).toBe("major-basic");
    panel(tree).onChange({ ...panel(tree).value, maxMidi: 60 });
    tree = render();
    expect(createMelody).toHaveBeenCalledTimes(2);
    expect(harness.exercise).toBe(good);
    expect(panel(tree).generation).toMatchObject({
      ok: false,
      issue: { chord: "G" },
    });
    expect(
      JSON.parse(localStorage.getItem(melodySettingsStorageKey)!).settings
        .maxMidi,
    ).toBe(67);
    expect(
      controller(tree).states.ready.find((action) => action.id === "start")!
        .disabled,
    ).toBe(true);
    panel(tree).onChange({ ...panel(tree).value, bpm: NaN });
    tree = render();
    expect(harness.exercise).toBe(good);
    expect(panel(tree).generation).toMatchObject({
      ok: false,
      issue: { code: "bpm" },
    });
    panel(tree).onChange({ ...defaultMelodySettings, progressionId: "random" });
    tree = render();
    expect(harness.exercise).not.toBe(good);
    expect(panel(tree).generation.ok).toBe(true);
    expect(
      JSON.parse(localStorage.getItem(melodySettingsStorageKey)!).settings
        .progressionId,
    ).toBe("random");
  });
  it.each([
    "permission",
    "countIn",
    "playing",
    "paused",
    "evaluating",
    "preview",
  ])("locks settings in %s without generation or saving", (phase) => {
    let tree = hydrate();
    harness.session.state.phase = phase === "preview" ? "landing" : phase;
    harness.session.previewing = phase === "preview";
    tree = render();
    const exercise = harness.exercise;
    vi.mocked(createMelody).mockClear();
    expect(panel(tree).disabled).toBe(true);
    panel(tree).onChange({ ...defaultMelodySettings, tonalityId: "A-minor" });
    render();
    expect(createMelody).not.toHaveBeenCalled();
    expect(harness.exercise).toBe(exercise);
    expect(localStorage.getItem(melodySettingsStorageKey)).toBeNull();
  });
  it("rerolls a random request once while retry keeps the completed exercise and harmony", () => {
    localStorage.setItem(
      melodySettingsStorageKey,
      JSON.stringify({
        version: 2,
        settings: { ...defaultMelodySettings, progressionId: "random" },
      }),
    );
    let tree = hydrate();
    const first = harness.exercise!;
    find<{ onReady: () => void }>(tree, ScoreViewport).onReady();
    harness.session.state.phase = "result";
    tree = render();
    vi.mocked(createMelody).mockClear();
    controller(tree)
      .states.result.find((action) => action.id === "retry")!
      .onClick();
    render();
    expect(harness.exercise).toBe(first);
    expect(harness.session.start).toHaveBeenCalledWith(
      expect.objectContaining({ stageId: first.id }),
    );
    expect(createMelody).not.toHaveBeenCalled();
    // The next button lives outside PracticeController.
    function nextAction(node: ReactNode): (() => void) | undefined {
      if (
        !React.isValidElement<{ children?: ReactNode; onClick?: () => void }>(
          node,
        )
      )
        return;
      if (node.type === "button" && node.props.children === "New melody")
        return node.props.onClick;
      for (const child of React.Children.toArray(node.props.children)) {
        const action = nextAction(child);
        if (action) return action;
      }
    }
    nextAction(tree)!();
    render();
    expect(createMelody).toHaveBeenCalledTimes(1);
    expect(harness.exercise!.id).not.toBe(first.id);
    expect(panel(render()).value.progressionId).toBe("random");
  });
  it("restores old major settings through the single generation boundary", () => {
    localStorage.setItem(
      melodySettingsStorageKey,
      JSON.stringify({
        clef: "bass",
        keySignature: "Eb",
        minMidi: 48,
        maxMidi: 62,
        durations: [0.5, 2],
      }),
    );
    const tree = hydrate();
    expect(panel(tree).value).toMatchObject({
      tonalityId: "Eb-major",
      progressionId: "none",
      clef: "bass",
      bpm: 60,
    });
    expect(harness.exercise!.keySignature).toBe("Eb");
    expect(harness.exercise!.harmony).toBeUndefined();
  });
});

function allText(tree: ReactNode): string {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  const element = tree as ReactElement<{ children?: ReactNode }>;
  return element?.props
    ? React.Children.toArray(element.props.children).map(allText).join(" ")
    : "";
}
function finished() {
  hydrate();
  const stage = harness.exercise!;
  harness.session.state.phase = "result";
  harness.session.state.result = {
    scoringVersion: 1,
    score: 0,
    stars: 0,
    cleared: false,
    notePassRate: 0,
    unscorable: false,
    notes: [
      {
        stageEventId: stage.events.find((event) => event.kind === "note")!.id,
        eventId: null,
        status: "missed",
        pitchPass: false,
        durationPass: false,
        onsetPass: false,
        distinctAttackPass: false,
        reasons: ["missed"],
        pitchScore: 0,
        durationScore: 0,
        onsetScore: null,
      },
    ],
    restViolations: [],
    breakdown: { pitch: 0, duration: 0, onset: null },
  };
  render();
  flush();
  return render();
}
describe("melody result-review integration", () => {
  it("offers review only behind the minimized summary, uses stage identity, and cancels on summary reopen", () => {
    let tree = finished();
    const snapshot = JSON.stringify(harness.session.state.result);
    const review = find<React.ComponentProps<typeof MelodyResultReview>>(
      tree,
      MelodyResultReview,
    );
    expect(review.events).toHaveLength(1);
    const id = review.events[0].stageEventId;
    harness.session.stopReview.mockClear();
    review.onSelect(id);
    expect(harness.session.stopReview).toHaveBeenCalledOnce();
    tree = render();
    expect(
      find<{ selectedReviewId: string }>(tree, ScoreViewport).selectedReviewId,
    ).toBe(id);
    controller(tree)
      .states.result.find((action) => action.id === "results")!
      .onClick();
    expect(harness.setResultsOpen).toHaveBeenCalledWith(true);
    expect(harness.session.stopReview).toHaveBeenCalledTimes(2);
    harness.resultsOpen = true;
    tree = render();
    flush();
    expect(
      find<{ reviewEvents: unknown[]; onReviewSelect?: unknown }>(
        tree,
        ScoreViewport,
      ).reviewEvents,
    ).toEqual([]);
    expect(
      find<{ onReviewSelect?: unknown }>(tree, ScoreViewport).onReviewSelect,
    ).toBeUndefined();
    expect(() => find(tree, MelodyResultReview)).toThrow();
    expect(JSON.stringify(harness.session.state.result)).toBe(snapshot);
  });
  it("clears selection and stops review on settings edits", () => {
    let tree = finished();
    find<React.ComponentProps<typeof MelodyResultReview>>(
      tree,
      MelodyResultReview,
    ).onSelect(harness.session.state.result!.notes[0].stageEventId);
    tree = render();
    harness.session.stopReview.mockClear();
    panel(tree).onChange({ ...panel(tree).value, bpm: 90 });
    expect(harness.session.stopReview).toHaveBeenCalledOnce();
    tree = render();
    expect(
      find<{ selectedReviewId: unknown }>(tree, ScoreViewport).selectedReviewId,
    ).toBeNull();
  });
  it("has no Hz/cents tooltip or numeric pitch details and uses one short current status", () => {
    hydrate();
    harness.session.state.phase = "playing";
    harness.session.frame = {
      audioTimeSec: 10,
      streamSampleIndex: 480000,
      rms: 0.1,
      detectedHz: 293.6648,
      confidence: 0.99,
      isVoiced: true,
      inputQuality: "stable",
    };
    harness.quality = "stable";
    harness.pitchFeedback = {
      stageEventId: harness.exercise!.events[0].id,
      pitchMatches: false,
      direction: "higher",
    };
    const text = allText(render());
    expect(text).toMatch(/Current pitch\s*:\s*Higher/);
    expect(text).not.toMatch(/Hz|¢|cents|The line shows pitch only/);
    harness.quality = "weak";
    expect(allText(render())).toContain("Input is quiet");
  });
});
