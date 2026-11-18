import { describe, expect, it, vi } from "vitest";
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
  it("uses Georgian regional metadata without inventing an Esperanto territory", () => {
    expect(localeMetadata("ka", "/melody/generated").openGraph).toMatchObject({
      locale: "ka_GE",
      url: "https://note-quiz.com/ka/melody/generated",
    });
    const metadata = localeMetadata("eo", "/practice/note?share=1#history");
    expect(metadata.openGraph).not.toHaveProperty("locale");
    expect(metadata.openGraph).toMatchObject({
      title: `${getTranslation("eo").learning.note} | Note Quiz`,
      url: "https://note-quiz.com/eo/practice/note",
    });
    expect(metadata.alternates?.languages).toMatchObject({
      ka: "https://note-quiz.com/ka/practice/note",
      eo: "https://note-quiz.com/eo/practice/note",
    });
  });
  it("publishes Russian social metadata and canonical leaf URLs without settings", () => {
    const metadata = localeMetadata(
      "ru",
      "/ru/practice?mode=ear&share=1#history",
    );
    expect(metadata.title).toEqual({
      absolute: "Определение звука на слух | Note Quiz",
    });
    expect(metadata.alternates?.canonical).toBe(
      "https://note-quiz.com/ru/practice/ear",
    );
    expect(metadata.alternates?.languages).toMatchObject({
      ru: "https://note-quiz.com/ru/practice/ear",
      "x-default": "https://note-quiz.com/practice/ear",
    });
    expect(metadata.openGraph).toMatchObject({
      locale: "ru_RU",
      url: "https://note-quiz.com/ru/practice/ear",
      title: "Определение звука на слух | Note Quiz",
    });
    expect(metadata.twitter).toMatchObject({
      description: getTranslation("ru").learning.earDescription,
    });
    const melody = localeMetadata("ru", "/melody/generated");
    expect(melody.title).toEqual({ absolute: "Практика мелодий | Note Quiz" });
    expect(melody.openGraph).toMatchObject({
      locale: "ru_RU",
      url: "https://note-quiz.com/ru/melody/generated",
    });
  });
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
        ru: "https://note-quiz.com/ru/practice/note",
        ka: "https://note-quiz.com/ka/practice/note",
        eo: "https://note-quiz.com/eo/practice/note",
        "x-default": "https://note-quiz.com/practice/note",
      });
      expect(metadata.description).toBe(
        getTranslation(locale).learning.noteDescription,
      );
      expect(metadata.twitter).toMatchObject({
        description: metadata.description,
      });
    },
  );

  it.each(SUPPORTED_LOCALES)(
    "describes and links melody practice in %s",
    (locale) => {
      const metadata = localeMetadata(locale, "/melody/generated");
      expect(metadata.alternates?.canonical).toBe(
        `https://note-quiz.com/${locale}/melody/generated`,
      );
      expect(metadata.description).toBe(melodyCopy(locale).intro);
      expect(metadata.openGraph).toMatchObject({
        url: `https://note-quiz.com/${locale}/melody/generated`,
        description: metadata.description,
      });
      expect(languageAlternates("/melody?tempo=80", locale)).toEqual(
        metadata.alternates,
      );
      const uploaded = localeMetadata(locale, "/melody/upload");
      expect(uploaded.title).not.toEqual(metadata.title);
      expect(uploaded.description).not.toEqual(metadata.description);
      expect(uploaded.alternates).toMatchObject({
        canonical: `https://note-quiz.com/${locale}/melody/upload`,
        languages: {
          "x-default": "https://note-quiz.com/melody/upload",
          ko: "https://note-quiz.com/ko/melody/upload",
        },
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
          description: t.learning[`${mode}Description`],
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
  it.each([true, false])(
    "includes Russian canonicals according to the melody feature flag (%s)",
    async (enabled) => {
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_CHALLENGE_ENABLED", String(enabled));
      try {
        const { default: flaggedSitemap } = await import("@/app/sitemap");
        const pages = flaggedSitemap();
        const urls = pages.map(({ url }) => url);
        expect(urls).toHaveLength(
          (enabled ? 7 : 5) * (SUPPORTED_LOCALES.length + 1) + 4,
        );
        expect(urls).toContain("https://note-quiz.com/ru");
        for (const source of ["generated", "upload"])
          expect(
            urls.includes(`https://note-quiz.com/ru/melody/${source}`),
          ).toBe(enabled);
        expect(urls).not.toContain("https://note-quiz.com/ru/melody");
        for (const mode of ["note", "ear", "interval", "chord"]) {
          const url = `https://note-quiz.com/ru/practice/${mode}`;
          expect(urls).toContain(url);
          expect(
            pages.find((page) => page.url === url)?.alternates?.languages,
          ).toMatchObject({ ru: url });
        }
        expect(urls).not.toContain("https://note-quiz.com/ru/practice");
        expect(
          urls.some((url) =>
            /^https:\/\/note-quiz.com\/ru\/(about|contact|privacy-policy|terms-of-service)$/.test(
              url,
            ),
          ),
        ).toBe(false);
      } finally {
        vi.unstubAllEnvs();
        vi.resetModules();
      }
    },
  );
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
    expect(urls.length).toBe(7 * (SUPPORTED_LOCALES.length + 1) + 4);
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
      expect(urls).not.toContain(`https://note-quiz.com/${locale}/melody`);
      for (const source of ["generated", "upload"])
        expect(urls).toContain(
          `https://note-quiz.com/${locale}/melody/${source}`,
        );
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
