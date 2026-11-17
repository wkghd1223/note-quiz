import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import type { AlphaTabNotationViewProps } from "@/components/notation/AlphaTabNotationView";
import type { NotationRenderResult } from "@/lib/notation/score";
import { stages, getStage } from "../data/stages";
import { challengeCopy } from "../i18n";
import ScoreViewport, { scoreBarLabels, stageBarScore } from "./ScoreViewport";

const notation = vi.hoisted(() => ({
  props: null as AlphaTabNotationViewProps | null,
}));
vi.mock("@/components/notation/AlphaTabNotationView", () => ({
  default: (props: AlphaTabNotationViewProps) => {
    notation.props = props;
    return React.createElement("svg", { "aria-label": props.accessibleLabel });
  },
}));

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

describe("challenge score notation contract", () => {
  it.each(stages)(
    "$id retains every written note/rest and event identity",
    (stage) => {
      const bars = Array.from({ length: stage.measures }, (_, i) =>
        stageBarScore(stage, i),
      );
      const events = bars.flatMap((bar) => bar.events);
      expect(events.map((event) => event.id)).toEqual(
        stage.events.map((event) => event.id),
      );
      expect(events.map((event) => event.notes[0]?.midi ?? null)).toEqual(
        stage.events.map((event) => event.writtenMidi ?? null),
      );
      for (const bar of bars)
        expect(
          bar.events.reduce(
            (sum, event) => sum + (4 / event.duration) * (event.dots ? 1.5 : 1),
            0,
          ),
        ).toBe(4);
    },
  );
  it("three-beat introductory rest is a dotted half rest, not truncated", () => {
    expect(stageBarScore(getStage("w3-s1")!, 0).events[1]).toMatchObject({
      notes: [],
      duration: 2,
      dots: 1,
    });
  });
});

describe("written-bar chord label layout", () => {
  const labels = [
    { barIndex: 0, label: "C" },
    { barIndex: 1, label: "C" },
    { barIndex: 2, label: "Bdim" },
  ] as const;
  const bounds: NotationRenderResult = {
    width: 320,
    height: 176,
    contentWidth: 1200,
    // The middle written bar is all rests: labels cannot depend on note bounds.
    events: [
      { id: "first", x: 103, y: 40, width: 16, height: 20 },
      { id: "last", x: 808, y: 40, width: 16, height: 20 },
    ],
    // Deliberately unordered: written index, not array position, owns the label.
    measures: [
      { index: 2, x: 780, timeStartX: 812.5, y: 0, width: 400, height: 176 },
      { index: 0, x: 0, timeStartX: 110.5, y: 0, width: 380, height: 176 },
      { index: 1, x: 380, timeStartX: 412.5, y: 0, width: 400, height: 176 },
    ],
  };

  it("retains repeated codes and an all-rest bar at native scaled time anchors", () => {
    expect(scoreBarLabels(labels, bounds)).toEqual([
      { ...labels[0], x: 110.5 },
      { ...labels[1], x: 412.5 },
      { ...labels[2], x: 812.5 },
    ]);
  });

  it("follows replacement render bounds after resizing without altering source indices", () => {
    const resized = {
      ...bounds,
      width: 1440,
      measures: bounds.measures!.map((bar) => ({
        ...bar,
        timeStartX: bar.timeStartX! + 8.25,
      })),
    };
    expect(scoreBarLabels([labels[2], labels[0]], resized)).toEqual([
      { ...labels[2], x: 820.75 },
      { ...labels[0], x: 118.75 },
    ]);
    expect(bounds.measures![0].timeStartX).toBe(812.5);
  });

  it("waits for timed measure bounds instead of guessing from note or bar edges", () => {
    expect(scoreBarLabels(labels, null)).toEqual([]);
    expect(scoreBarLabels([], bounds)).toEqual([]);
    expect(
      scoreBarLabels(labels, {
        ...bounds,
        measures: [
          { index: 0, x: 0, timeStartX: 0, y: 0, width: 100, height: 176 },
          { index: 2, x: 200, y: 0, width: 100, height: 176 },
        ],
      }),
    ).toEqual([{ ...labels[0], x: 0 }]);
  });

  function view(timeSpacing: boolean, barLabels?: typeof labels | readonly []) {
    return renderToStaticMarkup(
      React.createElement(ScoreViewport, {
        stage: getStage("w3-s1")!,
        targets: [],
        transitions: [],
        elapsed: 0,
        active: false,
        finished: false,
        reviewable: true,
        reducedMotion: false,
        result: null,
        c: challengeCopy("en"),
        onError: () => {},
        onReady: () => {},
        timeSpacing,
        barLabels,
      }),
    );
  }

  it.each([false, true])(
    "reserves only an extra band, keeping notation sizing with timeSpacing=%s",
    (timeSpacing) => {
      const height = timeSpacing ? 176 : 200;
      const withoutLabels = view(timeSpacing);
      expect(notation.props).toMatchObject({
        height,
        horizontalScale: timeSpacing ? 0.85 : 1,
      });
      expect(notation.props!.style).toBeUndefined();
      expect(view(timeSpacing, [])).toBe(withoutLabels);
      const withLabels = view(timeSpacing, labels);
      expect(notation.props).toMatchObject({
        height,
        horizontalScale: timeSpacing ? 0.85 : 1,
        style: { top: 24 },
      });
      expect(withoutLabels).toContain(`height:${height}px`);
      expect(withLabels).toContain(`height:${height + 24}px`);
      expect(notation.props!.accessibleLabel).toContain(
        "Measure 1: C; Measure 2: C; Measure 3: Bdim",
      );
      expect(withLabels.match(/Measure 3: Bdim/g)).toHaveLength(1);
    },
  );
});
