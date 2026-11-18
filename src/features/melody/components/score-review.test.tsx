import React, { type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScoreViewport from "@/features/challenge/components/ScoreViewport";
import { getStage } from "@/features/challenge/data/stages";
import { challengeCopy } from "@/features/challenge/i18n";
import { getInstrumentProfile } from "@/features/challenge/domain/instrument-profile";
import { buildPlaybackTimeline } from "@/features/challenge/domain/score-timeline";
import type { MelodyReviewEvent } from "../domain/result-review";
import { scoreAttempt } from "@/features/challenge/domain/scoring";
import { getScoringProfile } from "@/features/challenge/domain/instrument-profile";

// Element/hook wiring only: supplied renderer bounds, pointer events, and scrolling
// are fixtures. Real alphaTab/browser geometry is verified separately by root.
const harness = vi.hoisted(() => ({
  render: {
    width: 320,
    height: 176,
    contentWidth: 900,
    events: [{ id: "n1", x: 103.5, y: 42.25, width: 12, height: 18 }],
  },
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => [
    initial === null ? harness.render : initial,
    vi.fn(),
  ],
  useMemo: (factory: () => unknown) => factory(),
  useEffect: vi.fn(),
  useLayoutEffect: vi.fn(),
}));
const stage = getStage("w1-s2")!;
const targets = buildPlaybackTimeline(
  stage,
  getInstrumentProfile("voice")!,
  0,
).targets;
const review: MelodyReviewEvent = {
  stageEventId: targets[0].stageEventId,
  sourceEventId: "n1",
  barIndex: 0,
  ordinal: 1,
  name: "C4",
  reasons: ["missed"],
};
function byData(
  tree: ReactNode,
  attribute: string,
): ReactElement<Record<string, unknown>> {
  const element = tree as ReactElement<
    Record<string, unknown> & { children?: ReactNode }
  >;
  if (element?.props && attribute in element.props) return element;
  for (const child of React.Children.toArray(element?.props?.children)) {
    try {
      return byData(child, attribute);
    } catch {}
  }
  throw new Error(`Missing ${attribute}`);
}
function setup(finished = true) {
  const select = vi.fn();
  const result = scoreAttempt([], targets, getScoringProfile(stage, "voice"));
  const before = JSON.stringify(result);
  const tree = ScoreViewport({
    stage,
    targets,
    transitions: [],
    elapsed: 4,
    active: false,
    finished,
    reviewable: true,
    reducedMotion: true,
    result,
    c: challengeCopy("en"),
    onReady: vi.fn(),
    onError: vi.fn(),
    reviewEvents: [review],
    selectedReviewId: review.stageEventId,
    onReviewSelect: select,
    barLabels: [{ barIndex: 0, label: "C" }],
    timeSpacing: true,
  });
  const viewport = byData(tree, "data-score-viewport");
  const target = {
    scrollLeft: 90,
    querySelector: () => ({
      getBoundingClientRect: () => ({ left: -90, top: 10 }),
    }),
  };
  const event = (x = 20, y = 80) => ({
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
    currentTarget: target,
  });
  const call = (name: string, e = event()) =>
    (viewport.props[name] as (e: unknown) => void)(e);
  return { select, result, before, tree, viewport, target, event, call };
}
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());
describe("score result-review pointer wiring", () => {
  it("selects an actual bound in scrolled rail coordinates without altering settled color/history or scroll", () => {
    const { call, select, viewport, tree, result, before, target } = setup();
    const colors = viewport.props["data-score-colors"];
    call("onPointerDown");
    call("onPointerUp");
    expect(select).toHaveBeenCalledWith(review.stageEventId);
    expect(JSON.stringify(result)).toBe(before);
    expect(viewport.props["data-score-colors"]).toBe(colors);
    expect(target.scrollLeft).toBe(90);
    expect(viewport.props.tabIndex).toBe(0);
    expect(viewport.props.onKeyDown).toBeUndefined(); // native arrow scrolling remains
    expect(byData(tree, "data-score-review-selection").props.style).toEqual({
      left: 103.5,
      top: 66.25,
      width: 12,
      height: 18,
    });
    expect(byData(tree, "data-score-rail").props.style).toMatchObject({
      transform: undefined,
    });
    expect(() => byData(tree, "data-score-playhead")).toThrow();
  });
  it.each(["move", "scroll", "cancel", "drag-return", "outside"])(
    "does not select after %s",
    (kind) => {
      const { call, select, target, event } = setup();
      call("onPointerDown");
      if (kind === "scroll") {
        target.scrollLeft = 120;
        call("onScroll");
        target.scrollLeft = 90;
      }
      if (kind === "cancel") call("onPointerCancel");
      if (kind === "move" || kind === "drag-return")
        call("onPointerMove", event(60));
      call(
        "onPointerUp",
        kind === "move" ? event(60) : kind === "outside" ? event(40) : event(),
      );
      expect(select).not.toHaveBeenCalled();
    },
  );
  it("does not expose selection during non-result score reading", () => {
    const { call, select, tree } = setup(false);
    call("onPointerDown");
    call("onPointerUp");
    expect(select).not.toHaveBeenCalled();
    expect(() => byData(tree, "data-score-review-selection")).toThrow();
  });
});
