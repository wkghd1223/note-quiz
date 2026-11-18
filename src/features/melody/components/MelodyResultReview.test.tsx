import React, { type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getStage } from "@/features/challenge/data/stages";
import type { MelodyReviewEvent } from "../domain/result-review";
import { melodyCopy } from "../i18n";
import MelodyResultReview, { reviewEventLabel } from "./MelodyResultReview";
const events: MelodyReviewEvent[] = [
  {
    stageEventId: "first-visit",
    sourceEventId: "a",
    barIndex: 0,
    ordinal: 1,
    name: "C4",
    reasons: ["pitchCorrectTooShort", "late"],
  },
  {
    stageEventId: "second-visit",
    sourceEventId: "b",
    barIndex: 0,
    ordinal: 2,
    name: "C4",
    reasons: ["noSignal"],
  },
];
const props = () => ({
  events,
  selectedId: null as string | null,
  onSelect: vi.fn(),
  stage: getStage("w1-s2")!,
  playback: "idle" as "idle" | "preparing" | "playing" | "error",
  onListen: vi.fn(),
  onStop: vi.fn(),
  m: melodyCopy("en"),
  rest: "Rest",
});
function find(
  tree: ReactNode,
  type: string,
): ReactElement<Record<string, unknown>> {
  const element = tree as ReactElement<{ children?: ReactNode }>;
  if (element?.type === type)
    return element as ReactElement<Record<string, unknown>>;
  for (const child of React.Children.toArray(element?.props?.children)) {
    try {
      return find(child, type);
    } catch {}
  }
  throw new Error(`Missing ${type}`);
}
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
describe("result-only review controls", () => {
  it("provides one labelled select whose repeated notes differ by ordinal and stageEventId", () => {
    const input = props();
    const tree = MelodyResultReview(input);
    const html = renderToStaticMarkup(tree);
    expect(html.match(/<select/g)).toHaveLength(1);
    expect(html).toContain("Select a mistake");
    expect(html).toContain('value="first-visit"');
    expect(html).toContain('value="second-visit"');
    expect(html).toContain("Bar 1 · 1 · C4");
    expect(html).toContain("Bar 1 · 2 · C4");
    expect(html).not.toContain("<button");
    (find(tree, "select").props.onChange as (event: unknown) => void)({
      target: { value: "second-visit" },
    });
    expect(input.onSelect).toHaveBeenCalledWith("second-visit");
  });
  it("shows only the selected immutable reasons and starts explicit target playback", () => {
    const input = { ...props(), selectedId: "first-visit" };
    const tree = MelodyResultReview(input);
    const html = renderToStaticMarkup(tree);
    expect(html).toContain(input.m.reasonPitchCorrectTooShort);
    expect(html).toContain(input.m.reasonLate);
    expect(html).not.toContain(input.m.reasonNoSignal);
    expect(html).not.toMatch(/Hz|¢|cents|confidence/i);
    expect(input.onListen).not.toHaveBeenCalled();
    (find(tree, "button").props.onClick as () => void)();
    expect(input.onListen).toHaveBeenCalledWith("first-visit");
  });
  it.each(["preparing", "playing"] as const)(
    "allows cancellation while %s",
    (playback) => {
      const input = { ...props(), selectedId: "first-visit", playback };
      const tree = MelodyResultReview(input);
      expect(renderToStaticMarkup(tree)).toContain(input.m.reviewStop);
      (find(tree, "button").props.onClick as () => void)();
      expect(input.onStop).toHaveBeenCalledOnce();
      expect(input.onListen).not.toHaveBeenCalled();
    },
  );
  it("keeps playback errors beside review and exposes retry through the same listen button", () => {
    const input = {
      ...props(),
      selectedId: "second-visit",
      playback: "error" as const,
    };
    const tree = MelodyResultReview(input);
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('role="alert"');
    expect(html).toContain(input.m.reviewError);
    (find(tree, "button").props.onClick as () => void)();
    expect(input.onListen).toHaveBeenCalledWith("second-visit");
  });
  it("keeps reasons for an all-rest bar without an empty play button", () => {
    const input = {
      ...props(),
      events: [
        { ...events[0], name: null, reasons: ["restViolation" as const] },
      ],
      selectedId: "first-visit",
      stage: {
        ...getStage("w1-s1")!,
        events: [
          { id: "a", kind: "rest" as const, startBeat: 0, durationBeats: 4 },
        ],
      },
    };
    const html = renderToStaticMarkup(MelodyResultReview(input));
    expect(html).toContain(input.m.reasonRestViolation);
    expect(html).toContain("Bar 1 · 1 · Rest");
    expect(html).not.toContain("<button");
    expect(MelodyResultReview({ ...input, events: [] })).toBeNull();
  });
  it.each([
    "en",
    "ko",
    "ja",
    "es",
    "de",
    "fr",
    "zh",
    "pt",
    "ru",
    "ka",
    "eo",
  ] as const)("has complete review and direction copy in %s", (language) => {
    const copy = melodyCopy(language);
    for (const key of Object.keys(melodyCopy("en")) as (keyof typeof copy)[])
      expect(copy[key]?.trim()).toBeTruthy();
    const label = reviewEventLabel(events[1], copy, "Rest");
    expect(label).not.toMatch(/\{bar\}|\{ordinal\}|\{note\}/);
    expect(label).toContain("C4");
    for (const key of [
      "centsHint",
      "pitchMeasuring",
      "pitchListening",
      "livePitchHint",
    ])
      expect(copy).not.toHaveProperty(key);
  });
});
