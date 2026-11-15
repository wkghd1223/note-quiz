import { expect, it } from "vitest";
import { GET as practiceGET } from "@/app/(site)/practice/route";
import { GET as localizedPracticeGET } from "@/app/[locale]/practice/route";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locale";
import { PRACTICE_MODES } from "./routing";

function fallback(locale: Language | null, search: URLSearchParams) {
  const prefix = locale ? `/${locale}` : "";
  const request = new Request(
    `https://note-quiz.com${prefix}/practice?${search}`,
  );
  return (locale ? localizedPracticeGET : practiceGET)(request);
}

it.each([null, ...SUPPORTED_LOCALES])(
  "returns HTTP 308 with mode-free %s shared intent intact",
  (locale) => {
    const prefix = locale ? `/${locale}` : "";
    const search = new URLSearchParams({
      share: "1",
      daily: "1",
      settings: "open",
      leaderboard: "open",
    });
    const response = fallback(locale, search);
    expect(response.status).toBe(308);
    const url = new URL(response.headers.get("location")!);
    expect(url.pathname).toBe(`${prefix}/practice/note`);
    expect(url.searchParams.toString()).toBe(search.toString());
  },
);
it.each([null, ...SUPPORTED_LOCALES])(
  "keeps explicit %s mode fallback responses permanent and preserves every query value",
  (locale) => {
    const prefix = locale ? `/${locale}` : "";
    for (const mode of PRACTICE_MODES) {
      const search = new URLSearchParams({
        mode,
        share: "1",
        key: "F#",
        daily: "1",
        settings: "open",
        leaderboard: "open",
      });
      search.append("extra", "first");
      search.append("extra", "second");
      const response = fallback(locale, search);
      expect(response.status).toBe(308);
      const url = new URL(response.headers.get("location")!);
      expect(url.pathname).toBe(`${prefix}/practice/${mode}`);
      expect(url.searchParams.toString()).toBe(search.toString());
    }
  },
);
it.each([null, ...SUPPORTED_LOCALES])(
  "returns an actual HTTP 404 rather than a streamed error for unknown %s legacy modes",
  async (locale) => {
    for (const mode of ["unknown", "melody", "NOTE", "../note"]) {
      const response = fallback(
        locale,
        new URLSearchParams({ mode, share: "1" }),
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
      expect(await response.text()).toBe("");
    }
  },
);
it("keeps unsupported locale/index paths at HTTP 404", () => {
  for (const pathname of ["/zz/practice", "/ko/practice/extra"]) {
    const response = localizedPracticeGET(
      new Request(`https://note-quiz.com${pathname}?mode=ear`),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  }
});

it("matches Next redirect selection for repeated mode parameters", () => {
  const accepted = fallback(
    null,
    new URLSearchParams([
      ["mode", "unknown"],
      ["mode", "ear"],
    ]),
  );
  expect(accepted.status).toBe(308);
  expect(new URL(accepted.headers.get("location")!).pathname).toBe(
    "/practice/ear",
  );
  const rejected = fallback(
    null,
    new URLSearchParams([
      ["mode", "ear"],
      ["mode", "unknown"],
    ]),
  );
  expect(rejected.status).toBe(404);
  expect(rejected.headers.get("location")).toBeNull();
});
