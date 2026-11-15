import { describe, expect, it } from "vitest";
import {
  defaultConfig,
  parsePracticeConfig,
  serializePracticeConfig,
} from "./config";
import { PRACTICE_MODES } from "./routing";
import {
  createPracticeUrlIntent,
  patchPracticeQuery,
  practiceSettingsHref,
} from "./settingsNavigation";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locale";

describe("settings URL intent", () => {
  it.each([null, ...SUPPORTED_LOCALES])(
    "keeps open settings, daily and unrelated %s URL intent",
    (locale) => {
      const prefix = locale ? `/${locale}` : "";
      const current = `${prefix}/practice/chord?settings=open&daily=1&campaign=music&campaign=fall&focus=major#history`;
      const config = defaultConfig("chord", "basic");
      config.length = "timed";
      config.timeLimit = 30;
      const url = new URL(
        practiceSettingsHref(config, current),
        "https://example.com",
      );
      expect(url.pathname).toBe(`${prefix}/practice/chord`);
      expect(url.searchParams.get("settings")).toBe("open");
      expect(url.searchParams.get("daily")).toBe("1");
      expect(url.searchParams.getAll("campaign")).toEqual(["music", "fall"]);
      expect(url.searchParams.has("focus")).toBe(false);
      expect(url.hash).toBe("#history");
      expect(parsePracticeConfig(url.search).config).toMatchObject({
        mode: "chord",
        difficulty: "basic",
        length: "timed",
        timeLimit: 30,
      });
    },
  );
  it.each(PRACTICE_MODES)(
    "serializes actual %s settings while removing stale configuration fields",
    (mode) => {
      const config = defaultConfig(mode, "advanced");
      config.length = "timed";
      config.timeLimit = 30;
      const href = practiceSettingsHref(
        config,
        `/practice/${mode}?settings=open&key=F&focus=unknown&intervals=unknown&inversions=3`,
      );
      const url = new URL(href, "https://example.com");
      const restored = parsePracticeConfig(url.search);
      expect(restored.invalid).toBe(false);
      expect(serializePracticeConfig(restored.config)).toBe(
        serializePracticeConfig(config),
      );
      expect(url.searchParams.get("settings")).toBe("open");
    },
  );
  it("composes open, preset, difficulty, length, seconds and close before URL commits", () => {
    const intent = createPracticeUrlIntent(
      "/ko/practice/interval?daily=1&campaign=music#history",
    );
    const open = intent.replace(
      patchPracticeQuery(intent.href, { settings: "open", leaderboard: null }),
    );
    let config = defaultConfig("interval", "basic");
    const preset = intent.replace(practiceSettingsHref(config, intent.href));
    config = defaultConfig("interval", "advanced");
    const difficulty = intent.replace(
      practiceSettingsHref(config, intent.href),
    );
    config = { ...config, length: "timed" };
    const length = intent.replace(practiceSettingsHref(config, intent.href));
    config = { ...config, timeLimit: 30 };
    const seconds = intent.replace(practiceSettingsHref(config, intent.href));
    for (const intermediate of [open, preset, difficulty, length]) {
      expect(intent.observe(intermediate)).toBe(false);
      expect(intent.href).toBe(seconds);
    }
    expect(intent.observe(seconds)).toBe(true);
    const closed = intent.replace(
      patchPracticeQuery(intent.href, { settings: null }),
    );
    const url = new URL(closed, "https://example.com");
    expect(url.pathname).toBe("/ko/practice/interval");
    expect(url.searchParams.has("settings")).toBe(false);
    expect(url.searchParams.get("campaign")).toBe("music");
    expect(url.searchParams.get("daily")).toBe("1");
    expect(parsePracticeConfig(url.search).config).toMatchObject({
      difficulty: "advanced",
      length: "timed",
      timeLimit: 30,
    });
    expect(url.hash).toBe("#history");
    expect(intent.observe(closed)).toBe(true);
  });
  it("accepts the latest replacement when Next coalesces intermediate URLs", () => {
    const intent = createPracticeUrlIntent("/practice/note");
    intent.replace("/practice/note?settings=open");
    const latest = intent.replace("/practice/note?settings=open&key=F");
    expect(intent.observe(latest)).toBe(true);
    expect(intent.href).toBe(latest);
    intent.replace(latest);
    intent.replace(latest);
    expect(intent.observe(latest)).toBe(true);
  });
  it("restores browser history and removes daily only through an explicit patch", () => {
    const intent = createPracticeUrlIntent(
      "/practice/ear?daily=1&share=1&notes=chromatic",
    );
    intent.replace(patchPracticeQuery(intent.href, { settings: "open" }));
    const back = "/practice/ear?share=1&notes=natural";
    expect(intent.observe(back)).toBe(true);
    expect(intent.href).toBe(back);
    const normal = patchPracticeQuery(
      "/practice/note?share=1&daily=1&settings=open#history",
      { daily: null },
    );
    expect(normal).toBe("/practice/note?share=1&settings=open#history");
  });
});
