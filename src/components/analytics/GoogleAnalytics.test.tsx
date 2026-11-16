import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Script from "next/script";
import GoogleAnalytics from "./GoogleAnalytics";
import GoogleAnalyticsRouteTracker from "./GoogleAnalyticsRouteTracker";
import { GA_TRACKING_ID, initializeAnalytics } from "@/lib/analytics-runtime";

const harness = vi.hoisted(() => ({
  ready: false,
  pathname: "/practice/note",
  effects: [] as Array<{ effect: () => void | (() => void); deps: unknown[] }>,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: () => [
    harness.ready,
    (value: boolean) => {
      harness.ready = value;
    },
  ],
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    harness.effects.push({ effect, deps });
  },
}));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => harness.pathname }));

beforeEach(() => {
  harness.ready = false;
  harness.pathname = "/practice/note";
  harness.effects.length = 0;
  vi.stubEnv("NODE_ENV", "production");
  vi.stubGlobal("React", React); // Node JSX fixture; Next supplies its JSX runtime.
  vi.stubGlobal("window", {
    location: new URL("https://note-quiz.com/practice/note"),
  });
  vi.stubGlobal("document", { title: "Note title", referrer: "" });
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const commands = () =>
  window.dataLayer!.map((value) => Array.from(value as IArguments));

describe("analytics component wiring (Node effect fixture)", () => {
  it("establishes the queue/config before exposing the external script, including repeated mount/readiness", () => {
    expect(GoogleAnalytics()).toBeNull();
    expect(window.dataLayer).toBeUndefined();
    harness.effects[0].effect();
    harness.effects[0].effect();
    initializeAnalytics(); // another consumer/readiness call
    expect(commands().map((call) => call[0])).toEqual(["js", "config"]);
    const script = GoogleAnalytics()!;
    expect(script.type).toBe(Script);
    expect(script.props.src).toBe(
      `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`,
    );
    expect(script.props.strategy).toBe("afterInteractive");
    expect(script.props.children).toBeUndefined();
  });

  it("schedules the pathname only, with cleanup and shared deduplication", () => {
    GoogleAnalyticsRouteTracker();
    expect(harness.effects[0].deps).toEqual(["/practice/note"]);
    const cancel = harness.effects[0].effect();
    expect(typeof cancel).toBe("function");
    if (cancel) cancel();
    harness.effects[0].effect();
    document.title = "Committed note title";
    vi.runAllTimers();
    window.location = new URL(
      "https://note-quiz.com/practice/note?settings=open#private",
    ) as unknown as Location;
    GoogleAnalyticsRouteTracker();
    expect(harness.effects[1].deps).toEqual(["/practice/note"]);
    // Even if a duplicate mount runs an identical effect, it cannot add a view.
    harness.effects[1].effect();
    vi.runAllTimers();
    const views = commands().filter((call) => call[0] === "event");
    expect(views).toEqual([
      [
        "event",
        "page_view",
        {
          page_title: "Committed note title",
          page_path: "/practice/note",
          page_location: "https://note-quiz.com/practice/note",
          page_referrer: "",
        },
      ],
    ]);
  });

  it("never renders the tag in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(GoogleAnalytics()).toBeNull();
    harness.effects[0].effect();
    expect(GoogleAnalytics()).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });
});
