import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUPPORTED_LOCALES } from "./locale";
import { homeCopy } from "./home";

const { currentPath } = vi.hoisted(() => ({ currentPath: vi.fn(() => "/") }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: currentPath,
  useRouter: () => ({ push: vi.fn() }),
}));

const melodyTerms: Record<Language, RegExp> = {
  en: /melod(?:y|ies)|eight.bar|metronome|piano example/i,
  ko: /멜로디|8마디|메트로놈|피아노 예시/,
  ja: /メロディー|8小節|メトロノーム|ピアノのお手本/,
  es: /melod[ií]a|ocho compases|metr[oó]nomo|ejemplo al piano/i,
  de: /melodie|acht takte|metronom|klavierbeispiel/i,
  fr: /mélodie|huit mesures|métronome|exemple au piano/i,
  zh: /旋律|八小节|节拍器|钢琴示范/,
  pt: /melodia|oito compassos|metrônomo|exemplo no piano/i,
};

function escaped(text: string) {
  return renderToStaticMarkup(createElement("span", null, text)).slice(6, -7);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  currentPath.mockReturnValue("/");
});

describe.each([true, false])("home with melody enabled=%s", (enabled) => {
  beforeEach(() => {
    vi.resetModules();
    // Vitest uses classic JSX; Next supplies the automatic JSX runtime.
    vi.stubGlobal("React", React);
    vi.stubEnv("NEXT_PUBLIC_CHALLENGE_ENABLED", String(enabled));
  });

  it.each(SUPPORTED_LOCALES)(
    "matches %s visible content and metadata to the available features",
    async (locale) => {
      const { generateMetadata } = await import("@/app/[locale]/page");
      const { default: HomeClient } = await import("@/app/(site)/HomeClient");
      const page = await generateMetadata({
        params: Promise.resolve({ locale }),
      });
      const copy = homeCopy(locale, enabled);
      expect(page.title).toEqual({ absolute: copy.metaTitle });
      expect(page.description).toBe(copy.metaDescription);
      expect(page.alternates?.canonical).toBe(
        `https://note-quiz.com/${locale}`,
      );
      expect(page.alternates?.languages?.["x-default"]).toBe(
        "https://note-quiz.com/",
      );
      expect(page.openGraph).toMatchObject({
        title: copy.metaTitle,
        description: copy.metaDescription,
        url: `https://note-quiz.com/${locale}`,
      });
      expect(page.twitter).toMatchObject({
        title: copy.metaTitle,
        description: copy.metaDescription,
      });

      currentPath.mockReturnValue(`/${locale}`);
      const markup = renderToStaticMarkup(createElement(HomeClient));
      for (const text of [
        copy.introduction,
        ...copy.steps.map((step) => step.description),
        ...copy.faq.flatMap((item) => [item.question, item.answer]),
      ]) {
        expect(markup).toContain(escaped(text));
      }
      for (const mode of ["note", "ear", "interval", "chord"]) {
        expect(markup).toContain(`href="/${locale}/practice/${mode}"`);
      }
      expect(markup).toContain(
        `href="/${locale}/practice/note?leaderboard=open"`,
      );
      expect(markup.includes(`href="/${locale}/melody"`)).toBe(enabled);
      expect(markup.match(/<summary\b/g)).toHaveLength(enabled ? 4 : 3);
      if (enabled) {
        expect(markup).toContain(escaped(copy.melodyDescription));
        expect(markup).toContain(escaped(copy.melodyFeatures));
      } else {
        expect(`${markup} ${JSON.stringify(page)}`).not.toMatch(
          melodyTerms[locale],
        );
      }
    },
  );

  it("keeps the unprefixed home metadata and links aligned with the feature flag", async () => {
    const { metadata, default: HomePage } = await import("@/app/(site)/page");
    const copy = homeCopy("en", enabled);
    expect(metadata.title).toEqual({ absolute: copy.metaTitle });
    expect(metadata.description).toBe(copy.metaDescription);
    expect(metadata.alternates.canonical).toBe("https://note-quiz.com/");
    expect(metadata.openGraph).toMatchObject({
      url: "https://note-quiz.com",
      title: copy.metaTitle,
      description: copy.metaDescription,
    });
    expect(metadata.twitter).toMatchObject({
      title: copy.metaTitle,
      description: copy.metaDescription,
    });
    const markup = renderToStaticMarkup(createElement(HomePage));
    expect(markup).toContain('href="/practice/note"');
    expect(markup.includes('href="/melody"')).toBe(enabled);
    if (!enabled) {
      expect(`${markup} ${JSON.stringify(metadata)}`).not.toMatch(
        melodyTerms.en,
      );
    }
  });

  it("does not generate metadata for an unsupported locale", async () => {
    const { generateMetadata } = await import("@/app/[locale]/page");
    await expect(
      generateMetadata({ params: Promise.resolve({ locale: "xx" }) }),
    ).rejects.toThrow();
  });
});
