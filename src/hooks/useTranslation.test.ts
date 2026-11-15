import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTranslation } from "./useTranslation";
import { useLanguageStore } from "@/store/languageStore";

const { currentPath } = vi.hoisted(() => ({ currentPath: vi.fn(() => "/") }));
vi.mock("next/navigation", () => ({ usePathname: currentPath }));

function TranslationProbe() {
  const { language, t, isInitialized } = useTranslation();
  return createElement(
    "p",
    null,
    `${language}|${isInitialized}|${t.learning.chooseMode}`,
  );
}

afterEach(() => currentPath.mockReturnValue("/"));

describe("request-local translation during server rendering", () => {
  it("renders alternating locale requests without changing the singleton store", () => {
    const initialState = useLanguageStore.getState();
    for (const [path, expected] of [
      ["/ko/practice", "ko|true|연습 종류"],
      ["/zh", "zh|true|练习类型"],
      ["/ja/challenge/world/treble", "ja|true|練習の種類"],
      ["/ko", "ko|true|연습 종류"],
    ]) {
      currentPath.mockReturnValue(path);
      expect(renderToStaticMarkup(createElement(TranslationProbe))).toBe(
        `<p>${expected}</p>`,
      );
      expect(useLanguageStore.getState()).toBe(initialState);
    }
  });

  it("retains the existing unprefixed initial SSR language and readiness", () => {
    currentPath.mockReturnValue("/practice");
    expect(renderToStaticMarkup(createElement(TranslationProbe))).toBe(
      "<p>en|false|Practice type</p>",
    );
  });
});
