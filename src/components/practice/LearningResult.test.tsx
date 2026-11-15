import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LearningResult from "./LearningResult";
import NoteSessionResult from "./NoteSessionResult";

const { effects, heading } = vi.hoisted(() => ({
  effects: [] as { run: () => void; dependencies?: readonly unknown[] }[],
  heading: { focus: vi.fn(), scrollIntoView: vi.fn() },
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useRef: () => ({ current: heading }),
  useEffect: (run: () => void, dependencies?: readonly unknown[]) => {
    effects.push({ run, dependencies });
  },
}));
vi.mock("@/hooks/useTranslation", async () => {
  const { getTranslation } = await import("@/lib/i18n/translations");
  return { useTranslation: () => ({ t: getTranslation("en") }) };
});
const result = {
  totalQuestions: 1,
  correctAnswers: 1,
  totalTime: 1000,
  accuracy: 100,
  completed: true,
};
const noop = () => {};
beforeEach(() => {
  effects.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal("document", { querySelector: vi.fn(() => null) });
});
afterEach(() => vi.unstubAllGlobals());
it.each([false, true])(
  "preserveScroll=%s keeps accessible result focus and only scrolls when allowed",
  (preserveScroll) => {
    const markup = renderToStaticMarkup(
      <LearningResult
        result={result}
        hasMistakes={false}
        onRestart={noop}
        onReview={noop}
        onChange={noop}
        preserveScroll={preserveScroll}
      />,
    );
    expect(markup).toContain("aria-labelledby=");
    expect(markup).toContain('tabindex="-1"');
    expect(effects[0].dependencies).toEqual([preserveScroll, true]);
    effects[0].run();
    expect(heading.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(heading.scrollIntoView).toHaveBeenCalledTimes(
      preserveScroll ? 0 : 1,
    );
  },
);
it("keeps the legacy default scroll behavior for callers without the option", () => {
  renderToStaticMarkup(
    <LearningResult
      result={result}
      hasMistakes={false}
      onRestart={noop}
      onReview={noop}
      onChange={noop}
    />,
  );
  effects[0].run();
  expect(heading.scrollIntoView).toHaveBeenCalledWith({
    block: "start",
    behavior: "instant",
  });
});
it("does not take focus from an open dialog", () => {
  vi.stubGlobal("document", { querySelector: () => ({ open: true }) });
  renderToStaticMarkup(
    <LearningResult
      result={result}
      hasMistakes={false}
      onRestart={noop}
      onReview={noop}
      onChange={noop}
      preserveScroll
    />,
  );
  effects[0].run();
  expect(heading.focus).not.toHaveBeenCalled();
  expect(heading.scrollIntoView).not.toHaveBeenCalled();
});
it("forwards the basic note result's scroll preservation option", () => {
  const gameResult = {
    ...result,
    sessionId: "result-test",
    sessionPoints: 1,
    averageTime: 1000,
    answers: [],
  };
  renderToStaticMarkup(
    <NoteSessionResult
      result={gameResult}
      sessionPoints={1}
      submissionStatus="idle"
      preserveScroll
    />,
  );
  effects[0].run();
  expect(heading.focus).toHaveBeenCalledWith({ preventScroll: true });
  expect(heading.scrollIntoView).not.toHaveBeenCalled();
});

it("lets the result surface own focus when focusOnMount is false", () => {
  renderToStaticMarkup(
    <LearningResult
      result={result}
      hasMistakes={false}
      onRestart={noop}
      onReview={noop}
      onChange={noop}
      preserveScroll
      focusOnMount={false}
    />,
  );
  effects[0].run();
  expect(heading.focus).not.toHaveBeenCalled();
  expect(heading.scrollIntoView).not.toHaveBeenCalled();
});
