import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import {
  matchHas,
  prepareDestination,
} from "next/dist/shared/lib/router/utils/prepare-destination";
import nextConfig from "../../../next.config";
import { getRedirectStatus } from "next/dist/lib/redirect-status";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locale";
import { PRACTICE_MODES } from "./routing";

/** Exercise the installed Next 15 matcher, without building or starting a server. */
async function resolveRedirect(
  pathname: string,
  query: Record<string, string>,
) {
  const routes = await nextConfig.redirects!();
  for (const route of routes) {
    const params = getPathMatch(route.source, { strict: true })(pathname);
    if (!params) continue;
    const conditions = matchHas(
      { headers: {} } as IncomingMessage,
      query,
      route.has,
      route.missing,
    );
    if (!conditions) continue;
    const destination = prepareDestination({
      appendParamsToQuery: false,
      destination: route.destination,
      params: { ...params, ...conditions },
      query,
    });
    return {
      route,
      status: getRedirectStatus(route),
      ...destination.parsedDestination,
    };
  }
  return null;
}

describe("legacy practice HTTP redirects", () => {
  it.each([null, ...SUPPORTED_LOCALES])(
    "redirects mode-free %s requests before the layout renders",
    async (locale) => {
      const prefix = locale ? `/${locale}` : "";
      const query = {
        share: "1",
        key: "F#",
        daily: "1",
        settings: "open",
        leaderboard: "open",
      };
      const result = await resolveRedirect(`${prefix}/practice`, query);
      expect(result?.pathname).toBe(`${prefix}/practice/note`);
      expect(result?.query).toEqual(query);
      expect(result?.route.permanent).toBe(true);
      expect(result?.status).toBe(308);
    },
  );
  it.each([null, ...SUPPORTED_LOCALES])(
    "preserves explicit legacy modes and query intent in %s",
    async (locale) => {
      const prefix = locale ? `/${locale}` : "";
      for (const mode of PRACTICE_MODES) {
        const query = {
          mode,
          share: "1",
          level: "custom",
          view: "visual",
          daily: "1",
          settings: "open",
          leaderboard: "open",
        };
        const result = await resolveRedirect(`${prefix}/practice`, query);
        expect(result?.pathname).toBe(`${prefix}/practice/${mode}`);
        expect(result?.query).toEqual(query);
        expect(result?.route.permanent).toBe(true);
        expect(result?.status).toBe(308);
      }
    },
  );
  it("leaves unknown modes and locales for the existing 404 handlers", async () => {
    expect(await resolveRedirect("/practice", { mode: "unknown" })).toBeNull();
    expect(
      await resolveRedirect("/ko/practice", { mode: "unknown" }),
    ).toBeNull();
    expect(await resolveRedirect("/zz/practice", {})).toBeNull();
    expect(await resolveRedirect("/practice/unknown", {})).toBeNull();
  });
  it("retains older game, ear training and leaderboard navigation", async () => {
    expect((await resolveRedirect("/game", {}))?.pathname).toBe(
      "/practice/note",
    );
    expect((await resolveRedirect("/ear-training", {}))?.pathname).toBe(
      "/practice/ear",
    );
    for (const pathname of ["/game", "/ear-training", "/leaderboard"])
      expect((await resolveRedirect(pathname, {}))?.route.permanent).toBe(
        false,
      );
    const board = await resolveRedirect("/leaderboard", { daily: "1" });
    expect(board?.pathname).toBe("/practice/note");
    expect(board?.query).toMatchObject({ daily: "1", leaderboard: "open" });
    expect(await resolveRedirect("/melody", {})).toBeNull();
    expect(await resolveRedirect("/ko/melody", {})).toBeNull();
  });
});
