import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import PracticeHistoryPanel from "./PracticeHistoryPanel";
import { emptyLearningData } from "@/lib/practice/history";
import { getTranslation } from "@/lib/i18n/translations";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locale";
import { PRACTICE_MODES } from "@/lib/practice/routing";

const { states, locale } = vi.hoisted(() => ({
  states: { note: "idle", ear: "idle", theory: "idle" },
  locale: { value: "en" as Language },
}));
vi.mock("@/store/gameStore", () => ({
  useGameStore: (select: (state: { gameState: string }) => unknown) =>
    select({ gameState: states.note }),
}));
vi.mock("@/store/earTrainingStore", () => ({
  useEarTrainingStore: (select: (state: { sessionState: string }) => unknown) =>
    select({ sessionState: states.ear }),
}));
vi.mock("@/store/theoryStore", () => ({
  useTheoryStore: (select: (state: { state: string }) => unknown) =>
    select({ state: states.theory }),
}));
vi.mock("@/hooks/useTranslation", async () => {
  const { getTranslation } = await import("@/lib/i18n/translations");
  return {
    useTranslation: () => ({
      t: getTranslation(locale.value),
      language: locale.value,
    }),
  };
});
const noop = () => {};
const render = (mode: (typeof PRACTICE_MODES)[number], notice?: string) =>
  renderToStaticMarkup(
    <PracticeHistoryPanel
      mode={mode}
      data={emptyLearningData()}
      available
      onReset={noop}
      onPractice={noop}
      notice={notice}
    />,
  );
beforeEach(() => {
  states.note = states.ear = states.theory = "idle";
  locale.value = "en";
});
it.each(PRACTICE_MODES)(
  "blocks opening history while %s is playing",
  (mode) => {
    states[mode === "note" || mode === "ear" ? mode : "theory"] = "playing";
    expect(render(mode)).toMatch(
      /data-practice-history-trigger[^>]*disabled=""/,
    );
  },
);
it.each(PRACTICE_MODES)(
  "allows %s history when only other modes are playing",
  (mode) => {
    states.note = states.ear = states.theory = "playing";
    states[mode === "note" || mode === "ear" ? mode : "theory"] = "idle";
    expect(render(mode)).not.toContain('disabled=""');
  },
);
it.each(["idle", "paused", "finished"])(
  "allows note history in %s without mounting inline records",
  (state) => {
    states.note = state;
    const html = render("note");
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain(getTranslation("en").learning.localOnly);
    expect(html).not.toContain("<table");
  },
);
it.each(SUPPORTED_LOCALES)(
  "reuses the translated history trigger for %s",
  (language) => {
    locale.value = language;
    expect(render("note")).toContain(
      renderToStaticMarkup(<>{getTranslation(language).learning.history}</>),
    );
  },
);
it("keeps a previous clear notice out of the compact closed header", () => {
  const notice = getTranslation("en").learning.historyCleared;
  expect(render("note", notice)).not.toContain(notice);
  expect(render("note", notice)).not.toContain('role="status"');
});
