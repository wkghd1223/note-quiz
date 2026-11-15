import { describe, expect, it } from "vitest";
import { defaultConfig, serializePracticeConfig } from "./config";
import { SUPPORTED_LOCALES, languageSwitchHref } from "@/lib/i18n/locale";
import {
  PRACTICE_MODES,
  isPracticeMode,
  legacyPracticeHref,
  parseRoutedPracticeConfig,
  practiceConfigSignature,
  practiceConfigurationHref,
  practiceModeFromPath,
  practiceModeHref,
  configWithNoteSettings,
  configWithEarSettings,
} from "./routing";
import { noteSettings, earSettings } from "./config";

describe("practice child route contract", () => {
  it.each(PRACTICE_MODES)(
    "makes the %s path authoritative over a stale query mode",
    (mode) => {
      const parsed = parseRoutedPracticeConfig(
        "mode=ear&share=1&level=custom&view=visual&length=timed&seconds=30",
        mode,
      );
      expect(parsed.config.mode).toBe(mode);
      expect(parsed.config.kind).toBe(mode === "chord" ? "chord" : "interval");
      expect(parsed.config.length).toBe("timed");
      expect(parsed.config.timeLimit).toBe(30);
      expect(parsed.shared).toBe(true);
      expect(practiceModeFromPath(`/practice/${mode}`)).toBe(mode);
    },
  );
  it.each(PRACTICE_MODES)(
    "keeps %s authoritative when oversized settings are discarded",
    (mode) => {
      const parsed = parseRoutedPracticeConfig(
        `share=1&mode=note&extra=${"x".repeat(1900)}`,
        mode,
      );
      expect(parsed.config).toEqual(defaultConfig(mode));
      expect(parsed.invalid).toBe(true);
      expect(parsed.shared).toBe(false);
    },
  );
  it.each(["other", "melody", "", undefined, null])(
    "rejects unknown mode %s",
    (mode) => {
      expect(isPracticeMode(mode)).toBe(false);
      expect(practiceModeFromPath(`/practice/${mode}`)).toBeNull();
    },
  );
  it("rejects unknown legacy modes and nested child paths", () => {
    expect(legacyPracticeHref({ mode: "unknown" })).toBeNull();
    expect(practiceModeFromPath("/practice/note/extra")).toBeNull();
    expect(practiceModeFromPath("/practice")).toBeNull();
    expect(legacyPracticeHref({})).toBe("/practice/note");
  });
  it.each([null, ...SUPPORTED_LOCALES])(
    "redirects the mode-free %s index to note with query intent intact",
    (locale) => {
      const prefix = locale ? `/${locale}` : "";
      expect(legacyPracticeHref({}, locale)).toBe(`${prefix}/practice/note`);
      const href = legacyPracticeHref(
        {
          share: "1",
          clef: "bass",
          daily: "1",
          settings: "open",
          leaderboard: "open",
        },
        locale,
      )!;
      const url = new URL(href, "https://example.com");
      expect(url.pathname).toBe(`${prefix}/practice/note`);
      expect(Object.fromEntries(url.searchParams)).toEqual({
        share: "1",
        clef: "bass",
        daily: "1",
        settings: "open",
        leaderboard: "open",
      });
    },
  );
  it.each(SUPPORTED_LOCALES)(
    "preserves each mode and all link intent in %s",
    (locale) => {
      for (const mode of PRACTICE_MODES) {
        const href = legacyPracticeHref(
          {
            mode,
            share: "1",
            key: "F#",
            daily: "1",
            settings: "open",
            leaderboard: "open",
            intervals: ["M3", "P5"],
          },
          locale,
        )!;
        const url = new URL(href, "https://example.com");
        expect(url.pathname).toBe(`/${locale}/practice/${mode}`);
        expect(url.searchParams.get("key")).toBe("F#");
        expect(url.searchParams.get("daily")).toBe("1");
        expect(url.searchParams.get("settings")).toBe("open");
        expect(url.searchParams.get("leaderboard")).toBe("open");
        expect(url.searchParams.getAll("intervals")).toEqual(["M3", "P5"]);
        expect(practiceModeFromPath(url.pathname)).toBe(mode);
        expect(practiceModeHref(mode, `/${locale}/practice/note`)).toBe(
          url.pathname,
        );
        expect(
          languageSwitchHref(url.pathname, url.search, "#history", "ja"),
        ).toBe(`/ja/practice/${mode}${url.search}#history`);
      }
    },
  );
  it("keeps overlay-only URL changes outside session configuration", () => {
    const query = "share=1&mode=note&level=basic&daily=1&key=F%23";
    expect(practiceConfigSignature(`${query}&settings=open`, "note")).toBe(
      practiceConfigSignature(`${query}&leaderboard=open`, "note"),
    );
    expect(practiceConfigSignature(query, "note")).not.toBe(
      practiceConfigSignature(query.replace("daily=1", ""), "note"),
    );
    expect(practiceConfigSignature(query, "note")).not.toBe(
      practiceConfigSignature(query, "ear"),
    );
  });
  it.each(PRACTICE_MODES)(
    "serializes %s settings and history replay on the matching child route",
    (mode) => {
      const config = defaultConfig(mode, "advanced");
      config.length = "timed";
      config.timeLimit = 30;
      const href = practiceConfigurationHref(config, "/zh/practice/note");
      const url = new URL(href, "https://example.com");
      expect(url.pathname).toBe(`/zh/practice/${mode}`);
      expect(
        serializePracticeConfig(
          parseRoutedPracticeConfig(url.search, mode).config,
        ),
      ).toBe(serializePracticeConfig(config));
    },
  );
  it("captures actual note and ear panel settings rather than stale entry parameters", () => {
    const note = defaultConfig("note", "advanced");
    note.clef = "bass";
    note.answerMode = "microphone";
    const actualNote = noteSettings(note) as GameSettings;
    expect(
      serializePracticeConfig(
        configWithNoteSettings(defaultConfig("note"), actualNote),
      ),
    ).toContain("clef=bass");
    expect(configWithNoteSettings(note, actualNote).answerMode).toBe(
      "microphone",
    );
    const ear = defaultConfig("ear", "advanced");
    ear.length = "timed";
    ear.timeLimit = 30;
    const actualEar = earSettings(ear) as EarTrainingSettings;
    const restored = configWithEarSettings(defaultConfig("ear"), actualEar);
    expect(restored.length).toBe("timed");
    expect(restored.timeLimit).toBe(30);
    expect(restored.octaveMax).toBe(5);
  });
});
