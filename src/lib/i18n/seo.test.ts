import { describe, expect, it } from "vitest";
import {
  languageAlternates,
  localeMetadata,
  practiceModeMetadata,
} from "./seo";
import { SUPPORTED_LOCALES } from "./locale";
import { getTranslation } from "./translations";
import sitemap from "@/app/sitemap";
import { melodyCopy } from "@/features/melody/i18n";

describe("static locale metadata", () => {
  it("publishes Brazilian Portuguese social metadata", () => {
    expect(localeMetadata("pt", "/practice/note").openGraph).toMatchObject({
      locale: "pt_BR",
      url: "https://note-quiz.com/pt/practice/note",
    });
  });
  it.each(SUPPORTED_LOCALES)(
    "generates self-canonical and reciprocal language links for %s",
    (locale) => {
      const metadata = localeMetadata(
        locale,
        "/practice?mode=note&share=1#history",
      );
      expect(metadata.alternates?.canonical).toBe(
        `https://note-quiz.com/${locale}/practice/note`,
      );
      expect(metadata.alternates?.languages).toEqual({
        en: "https://note-quiz.com/en/practice/note",
        ko: "https://note-quiz.com/ko/practice/note",
        ja: "https://note-quiz.com/ja/practice/note",
        es: "https://note-quiz.com/es/practice/note",
        de: "https://note-quiz.com/de/practice/note",
        fr: "https://note-quiz.com/fr/practice/note",
        "zh-Hans": "https://note-quiz.com/zh/practice/note",
        "pt-BR": "https://note-quiz.com/pt/practice/note",
        "x-default": "https://note-quiz.com/practice/note",
      });
      expect(metadata.description).toBe(
        getTranslation(locale).learning.entryDescription,
      );
      expect(metadata.twitter).toMatchObject({
        description: metadata.description,
      });
    },
  );

  it.each(SUPPORTED_LOCALES)(
    "describes and links melody practice in %s",
    (locale) => {
      const metadata = localeMetadata(locale, "/melody");
      expect(metadata.alternates?.canonical).toBe(
        `https://note-quiz.com/${locale}/melody`,
      );
      expect(metadata.description).toBe(melodyCopy(locale).intro);
      expect(metadata.openGraph).toMatchObject({
        url: `https://note-quiz.com/${locale}/melody`,
        description: metadata.description,
      });
      expect(getTranslation(locale).navigation.melody).toBeTruthy();
    },
  );

  it("retains unprefixed canonical URLs and does not add practice settings to SEO URLs", () => {
    expect(languageAlternates("/practice?mode=ear", null).canonical).toBe(
      "https://note-quiz.com/practice/ear",
    );
    expect(languageAlternates("/", null).canonical).toBe(
      "https://note-quiz.com/",
    );
    expect(languageAlternates("/ko/challenge/play/w2-s3", "zh").canonical).toBe(
      "https://note-quiz.com/zh/challenge/play/w2-s3",
    );
  });

  it.each([null, ...SUPPORTED_LOCALES])(
    "aligns legacy and final practice SEO for %s",
    (locale) => {
      const prefix = locale ? `/${locale}` : "";
      const t = getTranslation(locale ?? "en");
      expect(
        languageAlternates(`${prefix}/practice?share=1#history`, locale)
          .canonical,
      ).toBe(`https://note-quiz.com${prefix}/practice/note`);
      for (const mode of ["note", "ear", "interval", "chord"] as const) {
        const path = `/practice/${mode}`;
        const canonical = `https://note-quiz.com${prefix}${path}`;
        const expected = {
          title: `${t.learning[mode]} | Note Quiz`,
          description: t.learning.entryDescription,
        };
        const metadata = practiceModeMetadata(mode, locale);
        expect(metadata.title).toEqual({ absolute: expected.title });
        expect(metadata.description).toBe(expected.description);
        expect(metadata.openGraph).toMatchObject({
          ...expected,
          url: canonical,
        });
        expect(metadata.twitter).toMatchObject(expected);
        const legacy = languageAlternates(
          `${prefix}/practice?mode=${mode}&share=1&daily=1#history`,
          locale,
        );
        expect(legacy).toEqual(metadata.alternates);
        expect(legacy.canonical).toBe(canonical);
        expect(legacy.languages).toMatchObject({
          en: `https://note-quiz.com/en${path}`,
          ko: `https://note-quiz.com/ko${path}`,
          "zh-Hans": `https://note-quiz.com/zh${path}`,
          "x-default": `https://note-quiz.com${path}`,
        });
        if (locale)
          expect(
            localeMetadata(locale, `${prefix}/practice?mode=${mode}&share=1`)
              .openGraph,
          ).toMatchObject({ ...expected, url: canonical });
      }
    },
  );

  it("includes translated challenge objectives and the Simplified Chinese social locale", () => {
    const metadata = localeMetadata("zh", "/challenge/world/w1", {
      title: "初识音符 | Note Quiz",
      description: "认识五线谱上的音符。",
    });
    expect(metadata.title).toEqual({ absolute: "初识音符 | Note Quiz" });
    expect(metadata.openGraph).toMatchObject({
      locale: "zh_CN",
      url: "https://note-quiz.com/zh/challenge/world/w1",
      description: "认识五线谱上的音符。",
    });
  });
});

describe("indexable route sitemap", () => {
  it.each([null, ...SUPPORTED_LOCALES])(
    "lists only final practice canonical URLs in sitemap for %s",
    (locale) => {
      const pages = sitemap();
      const prefix = locale ? `/${locale}` : "";
      expect(
        pages.some(
          ({ url }) => url === `https://note-quiz.com${prefix}/practice`,
        ),
      ).toBe(false);
      for (const mode of ["note", "ear", "interval", "chord"] as const) {
        const metadata = practiceModeMetadata(mode, locale);
        const entry = pages.find(
          ({ url }) => url === metadata.alternates?.canonical,
        );
        expect(entry).toBeDefined();
        expect(entry?.alternates?.languages).toEqual(
          metadata.alternates?.languages,
        );
        expect(entry?.url).not.toMatch(/[?#]/);
      }
      for (const path of [
        "/about",
        "/contact",
        "/privacy-policy",
        "/terms-of-service",
      ])
        expect(
          pages.some(({ url }) => url === `https://note-quiz.com${path}`),
        ).toBe(true);
    },
  );

  it("lists existing pages and all supported localized home/practice/melody routes exactly once", () => {
    const pages = sitemap(),
      urls = pages.map(({ url }) => url);
    expect(urls.length).toBe(6 * (SUPPORTED_LOCALES.length + 1) + 4);
    expect(new Set(urls).size).toBe(urls.length);
    for (const locale of SUPPORTED_LOCALES) {
      expect(urls).toContain(`https://note-quiz.com/${locale}`);
      for (const mode of ["note", "ear", "interval", "chord"] as const) {
        expect(urls).toContain(
          `https://note-quiz.com/${locale}/practice/${mode}`,
        );
        const metadata = practiceModeMetadata(mode, locale);
        expect(metadata.title).toEqual({
          absolute: `${getTranslation(locale).learning[mode]} | Note Quiz`,
        });
        expect(metadata.alternates?.canonical).toBe(
          `https://note-quiz.com/${locale}/practice/${mode}`,
        );
      }
      expect(urls).not.toContain(`https://note-quiz.com/${locale}/practice`);
      expect(urls).toContain(`https://note-quiz.com/${locale}/melody`);
      expect(urls.some((url) => url.includes("/challenge"))).toBe(false);
      for (const path of [
        "about",
        "contact",
        "privacy-policy",
        "terms-of-service",
      ])
        expect(urls).not.toContain(`https://note-quiz.com/${locale}/${path}`);
    }
    expect(urls).toContain("https://note-quiz.com/about");
    expect(urls).not.toContain("https://note-quiz.com/game");
    expect(urls).not.toContain("https://note-quiz.com/leaderboard");
    expect(
      pages.find(({ url }) => url === "https://note-quiz.com/zh/practice/note")
        ?.alternates?.languages,
    ).toMatchObject({
      ko: "https://note-quiz.com/ko/practice/note",
      "zh-Hans": "https://note-quiz.com/zh/practice/note",
      "x-default": "https://note-quiz.com/practice/note",
    });
  });
});
