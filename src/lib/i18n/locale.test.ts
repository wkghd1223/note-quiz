import { describe, expect, it, vi } from "vitest";
import {
  htmlLanguage,
  isLanguage,
  languageSwitchHref,
  localeFromPathname,
  localizedHref,
  resolveLanguage,
  stripLocale,
  SUPPORTED_LOCALES,
} from "./locale";

// Static route parameters do not need the document's Next font transform.
vi.mock("@/components/layouts/RootDocument", () => ({ default: () => null }));

describe("localized URL contract", () => {
  it.each(["ka", "eo"] as const)(
    "preserves shared settings and fragments when switching to %s",
    (locale) => {
      expect(htmlLanguage(locale)).toBe(locale);
      expect(
        languageSwitchHref(
          "/ru/practice/chord",
          "?key=F%23&sound=1&sound=0",
          "#history",
          locale,
        ),
      ).toBe(`/${locale}/practice/chord?key=F%23&sound=1&sound=0#history`);
      expect(
        languageSwitchHref("/practice/chord", "?key=F%23", "#history", locale),
      ).toBeNull();
    },
  );
  it.each(SUPPORTED_LOCALES)(
    "recognizes only complete %s path segments",
    (locale) => {
      expect(isLanguage(locale)).toBe(true);
      expect(localeFromPathname(`/${locale}`)).toBe(locale);
      expect(localeFromPathname(`/${locale}/practice`)).toBe(locale);
      expect(localeFromPathname(`/${locale}-other/practice`)).toBeNull();
      expect(stripLocale(`/${locale}`)).toBe("/");
      expect(stripLocale(`/${locale}/challenge/play/treble-01`)).toBe(
        "/challenge/play/treble-01",
      );
    },
  );
  it.each(["", "EN", "zh-Hans", "../../ko", undefined, null, 1])(
    "does not accept unsupported locale %s",
    (value) => {
      expect(isLanguage(value)).toBe(false);
    },
  );
  it.each([
    "/",
    "/practice",
    "/practice/note",
    "/practice/ear",
    "/practice/interval",
    "/practice/chord",
    "/challenge",
    "/challenge/world/treble",
    "/challenge/play/treble-01",
  ])("localizes %s without duplicating the prefix", (pathname) => {
    const expected = `/ko${pathname === "/" ? "" : pathname}`;
    expect(localizedHref(pathname, "ko")).toBe(expected);
    expect(localizedHref(localizedHref(pathname, "en"), "ko")).toBe(expected);
    expect(localizedHref(pathname, null)).toBe(pathname);
  });
  it("preserves query settings and hash verbatim when switching a localized route", () => {
    expect(
      languageSwitchHref(
        "/ko/practice",
        "?share=1&mode=note&key=F%23&daily=1",
        "#history",
        "zh",
      ),
    ).toBe("/zh/practice?share=1&mode=note&key=F%23&daily=1#history");
    expect(languageSwitchHref("/en", "", "", "ko")).toBe("/ko");
    expect(localizedHref("/practice?mode=ear#history", "ja")).toBe(
      "/ja/practice?mode=ear#history",
    );
  });
  it("keeps the existing unprefixed selector in place rather than navigating", () => {
    expect(languageSwitchHref("/practice", "?mode=note", "", "zh")).toBeNull();
    expect(languageSwitchHref("/", "", "", "ko")).toBeNull();
  });
  it.each([
    "/about",
    "/contact",
    "/privacy-policy",
    "/terms-of-service",
    "/api/leaderboard",
    "/logo.svg",
    "https://example.com/",
    "//example.com/practice",
    "#history",
    "mailto:hello@example.com",
  ])("does not invent a localized version of %s", (href) => {
    expect(localizedHref(href, "zh")).toBe(href);
  });
  it("selects request-local language without changing a persisted language", () => {
    const persisted = { language: "de" as const, isInitialized: false };
    expect(
      resolveLanguage(
        "/ko/practice",
        persisted.language,
        persisted.isInitialized,
      ),
    ).toEqual({ locale: "ko", language: "ko", isInitialized: true });
    expect(
      resolveLanguage("/zh", persisted.language, persisted.isInitialized),
    ).toEqual({ locale: "zh", language: "zh", isInitialized: true });
    expect(persisted).toEqual({ language: "de", isInitialized: false });
    expect(resolveLanguage("/practice", "de", false)).toEqual({
      locale: null,
      language: "de",
      isInitialized: false,
    });
    expect(resolveLanguage("/practice", "zh", true)).toEqual({
      locale: null,
      language: "zh",
      isInitialized: true,
    });
  });
  it("uses the explicit Simplified Chinese HTML language tag", () => {
    expect(htmlLanguage("zh")).toBe("zh-Hans");
    expect(htmlLanguage("ko")).toBe("ko");
  });
  it("uses Brazilian Portuguese metadata while retaining the short URL prefix", () => {
    expect(htmlLanguage("pt")).toBe("pt-BR");
    expect(localeFromPathname("/pt/practice/note")).toBe("pt");
    expect(
      languageSwitchHref("/ko/practice/ear", "?sound=1", "#history", "pt"),
    ).toBe("/pt/practice/ear?sound=1#history");
    expect(resolveLanguage("/pt/practice/note", "ko", true)).toEqual({
      locale: "pt",
      language: "pt",
      isInitialized: true,
    });
  });
  it("uses short Russian URL and HTML tags while preserving settings and fragments", () => {
    expect(htmlLanguage("ru")).toBe("ru");
    expect(localeFromPathname("/ru/practice/note")).toBe("ru");
    expect(isLanguage("ru-RU")).toBe(false);
    expect(
      languageSwitchHref(
        "/pt/practice/interval",
        "?share=1&key=F%23&sound=1&sound=0",
        "#history",
        "ru",
      ),
    ).toBe("/ru/practice/interval?share=1&key=F%23&sound=1&sound=0#history");
    expect(
      languageSwitchHref("/practice/note", "?share=1", "#history", "ru"),
    ).toBeNull();
    expect(localizedHref("/ru/melody?tempo=80#score", "en")).toBe(
      "/en/melody?tempo=80#score",
    );
    expect(resolveLanguage("/ru/practice/ear", "ko", false)).toEqual({
      locale: "ru",
      language: "ru",
      isInitialized: true,
    });
    for (const href of [
      "/about",
      "/contact",
      "/privacy-policy",
      "/terms-of-service",
    ]) {
      expect(localizedHref(href, "ru")).toBe(href);
    }
  });
});

it("keeps the melody route localized when linking and changing language", () => {
  expect(localizedHref("/melody", "ko")).toBe("/ko/melody");
  expect(languageSwitchHref("/ko/melody", "", "", "de")).toBe("/de/melody");
});

it("pre-renders Russian alongside the existing supported locale layouts", async () => {
  const { generateStaticParams } = await import("@/app/[locale]/layout");
  const params = generateStaticParams();
  expect(params).toContainEqual({ locale: "ru" });
  expect(params).toHaveLength(SUPPORTED_LOCALES.length);
  expect(new Set(params.map(({ locale }) => locale)).size).toBe(params.length);
});
