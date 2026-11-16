import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackLearningEvent } from "./analytics";
import {
  GA_TRACKING_ID,
  analyticsCampaign,
  analyticsPageContext,
  captureAnalyticsPageContext,
  initializeAnalytics,
  recordAnalyticsPageView,
  scheduleAnalyticsPageView,
} from "./analytics-runtime";

const origin = "https://note-quiz.com";
function browser(path = "/practice/note") {
  vi.stubGlobal("window", { location: new URL(path, origin) });
  vi.stubGlobal("document", {
    title: "Sight reading | Note Quiz",
    referrer: "https://search.example/private/person?email=private#secret",
  });
}
const queued = () =>
  window.dataLayer!.map((item) => Array.from(item as IArguments));
const views = () =>
  queued().filter((call) => call[0] === "event" && call[1] === "page_view");
const effectiveEvents = () => {
  let config = {};
  return queued().flatMap(([command, name, payload]) => {
    if (command === "config" && name === GA_TRACKING_ID)
      config = { ...config, ...payload };
    return command === "event" ? [[name, { ...config, ...payload }]] : [];
  });
};
function navigate(path: string, title = path) {
  window.location = new URL(path, origin) as unknown as Location;
  document.title = title;
  const cancel = scheduleAnalyticsPageView(window.location.pathname);
  vi.runAllTimers();
  return cancel;
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.useFakeTimers();
  browser();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("queued production analytics", () => {
  it("keeps initialization before events and the first view while external JS is delayed", () => {
    browser("/practice/note?utm_source=newsletter&email=private#secret");
    const cleanup = scheduleAnalyticsPageView("/practice/note");
    // A session effect can run before the GoogleAnalytics effect or library.
    trackLearningEvent("entered", { mode: "note", difficulty: "beginner" });
    vi.runAllTimers();
    expect(typeof window.gtag).toBe("function");
    expect(queued().map((call) => call.slice(0, 2))).toEqual([
      ["js", expect.any(Date)],
      ["config", GA_TRACKING_ID],
      ["event", "practice_entered"],
      ["event", "page_view"],
    ]);
    expect(queued()[1][2]).toMatchObject({
      send_page_view: false,
      campaign_source: "newsletter",
      page_path: "/practice/note",
      page_location: `${origin}/practice/note`,
      page_referrer: "https://search.example/",
    });
    expect(views()).toHaveLength(1);
    // Controlled library stub consumes the queue; this is not live collection.
    const transport = vi.fn();
    for (const call of queued()) transport(...call);
    window.gtag = transport;
    initializeAnalytics();
    initializeAnalytics(); // repeated readiness / mount effects
    recordAnalyticsPageView("/practice/note");
    expect(transport).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(transport.mock.calls)).not.toMatch(
      /private|secret|email=|\?\?/,
    );
    cleanup();
  });

  it("counts committed paths, back/forward and locale changes, but no query-only updates", () => {
    navigate("/practice/note", "Note title");
    navigate(
      "/practice/note?settings=open&result=secret#history",
      "Note title",
    );
    navigate("/practice/ear?notes=C4&sessionId=private", "Ear title");
    navigate("/practice/note?history=open", "Note title"); // back
    navigate("/practice/ear", "Ear title"); // forward
    navigate("/ko/practice/ear?settings=open", "한국어 title");
    navigate("/ko/practice/ear?settings=closed", "한국어 title");
    expect(views().map((call) => call[2])).toEqual([
      {
        page_title: "Note title",
        page_path: "/practice/note",
        page_location: `${origin}/practice/note`,
        page_referrer: "https://search.example/",
      },
      {
        page_title: "Ear title",
        page_path: "/practice/ear",
        page_location: `${origin}/practice/ear`,
        page_referrer: `${origin}/practice/note`,
      },
      {
        page_title: "Note title",
        page_path: "/practice/note",
        page_location: `${origin}/practice/note`,
        page_referrer: `${origin}/practice/ear`,
      },
      {
        page_title: "Ear title",
        page_path: "/practice/ear",
        page_location: `${origin}/practice/ear`,
        page_referrer: `${origin}/practice/note`,
      },
      {
        page_title: "한국어 title",
        page_path: "/ko/practice/ear",
        page_location: `${origin}/ko/practice/ear`,
        page_referrer: `${origin}/practice/ear`,
      },
    ]);
    const updates = queued().filter(
      (call) => call[0] === "config" && call[2].update,
    );
    // Initial config already supplies the first route; each later path updates.
    expect(updates).toHaveLength(4);
    for (const call of updates) expect(call[2].send_page_view).toBe(false);
    expect(JSON.stringify(queued())).not.toMatch(
      /secret|sessionId|C4|settings=|history=|\?\?/,
    );
  });

  it("updates inherited route context before an early event and still sends one later pageview", () => {
    recordAnalyticsPageView("/practice/note");
    window.location = new URL(
      "/practice/ear?settings=open&sessionId=private",
      origin,
    ) as unknown as Location;
    document.title = "Ear practice title";

    // A route entry effect can beat the scheduled tracker page_view task.
    trackLearningEvent("entered", {
      mode: "ear",
      difficulty: "beginner",
    });
    const calls = queued();
    const contextUpdate = calls.at(-2)!;
    const entered = calls.at(-1)!;
    expect(contextUpdate[0]).toBe("config");
    expect(contextUpdate[2]).toMatchObject({
      update: true,
      page_path: "/practice/ear",
      page_location: `${origin}/practice/ear`,
      page_title: "Ear practice title",
      page_referrer: `${origin}/practice/note`,
    });
    expect(entered[1]).toBe("practice_entered");
    expect(entered[2]).not.toHaveProperty("page_path");
    expect(effectiveEvents().at(-1)![1]).toMatchObject({
      training_mode: "ear",
      page_path: "/practice/ear",
      page_location: `${origin}/practice/ear`,
      page_title: "Ear practice title",
      page_referrer: `${origin}/practice/note`,
    });

    recordAnalyticsPageView("/practice/ear");
    recordAnalyticsPageView("/practice/ear");
    expect(views()).toHaveLength(2);
    expect(views().at(-1)![2]).toMatchObject({
      page_path: "/practice/ear",
      page_location: `${origin}/practice/ear`,
      page_title: "Ear practice title",
      page_referrer: `${origin}/practice/note`,
    });
    expect(JSON.stringify(calls)).not.toMatch(
      /private|settings=|sessionId|\?\?/,
    );
  });

  it("preserves outgoing session context after the incoming route config and view without changing its defaults", () => {
    recordAnalyticsPageView("/practice/note");
    navigate("/en/melody?seed=private#notes", "Melody title");
    const sessionOrigin = captureAnalyticsPageContext();
    expect(sessionOrigin).toBeDefined();
    window.location = new URL("/practice/ear", origin) as unknown as Location;
    document.title = "Ear title";
    recordAnalyticsPageView("/practice/ear");
    trackLearningEvent(
      "completed",
      {
        mode: "melody",
        difficulty: "custom",
        completed: false,
      },
      sessionOrigin,
    );
    expect(effectiveEvents().at(-1)![1]).toMatchObject({
      training_mode: "melody",
      page_path: "/en/melody",
      page_location: `${origin}/en/melody`,
      page_title: "Melody title",
      page_referrer: `${origin}/practice/note`,
    });
    trackLearningEvent("started", { mode: "ear", difficulty: "beginner" });
    expect(effectiveEvents().at(-1)![1]).toMatchObject({
      training_mode: "ear",
      page_path: "/practice/ear",
      page_title: "Ear title",
      page_referrer: `${origin}/en/melody`,
    });
    expect(views()).toHaveLength(3);
    expect(JSON.stringify(queued())).not.toMatch(/seed|private|#notes/);
  });

  it("refreshes metadata after an early entry without replacing its previous virtual referrer", () => {
    recordAnalyticsPageView("/practice/note");
    window.location = new URL("/practice/ear", origin) as unknown as Location;
    // Entry can observe the previous title before Next metadata commits.
    trackLearningEvent("entered", { mode: "ear", difficulty: "beginner" });
    document.title = "Committed ear title";
    recordAnalyticsPageView("/practice/ear");
    expect(views().at(-1)![2]).toMatchObject({
      page_path: "/practice/ear",
      page_title: "Committed ear title",
      page_referrer: `${origin}/practice/note`,
    });
    document.title = "Updated ear title";
    trackLearningEvent("started", { mode: "ear", difficulty: "beginner" });
    expect(effectiveEvents().at(-1)![1]).toMatchObject({
      page_title: "Updated ear title",
      page_referrer: `${origin}/practice/note`,
    });
    recordAnalyticsPageView("/practice/ear");
    expect(views()).toHaveLength(2);
  });

  it("uses the preceding committed event route as referrer when another entry beats its pageview", () => {
    recordAnalyticsPageView("/practice/note");
    window.location = new URL("/practice/ear", origin) as unknown as Location;
    trackLearningEvent("entered", { mode: "ear", difficulty: "beginner" });
    window.location = new URL("/melody", origin) as unknown as Location;
    document.title = "Melody title";
    trackLearningEvent("entered", { mode: "melody", difficulty: "custom" });
    recordAnalyticsPageView("/practice/ear"); // stale deferred task
    recordAnalyticsPageView("/melody");
    expect(effectiveEvents().at(-1)![1]).toMatchObject({
      page_path: "/melody",
      page_referrer: `${origin}/practice/ear`,
      page_title: "Melody title",
    });
    expect(views().map((call) => call[2].page_path)).toEqual([
      "/practice/note",
      "/melody",
    ]);
  });

  it("reads the committed title, cancels throwaway effects and ignores stale routes", () => {
    const abandoned = scheduleAnalyticsPageView("/practice/note");
    abandoned(); // StrictMode test cleanup
    scheduleAnalyticsPageView("/practice/note");
    document.title = "Committed note title";
    vi.runAllTimers();
    expect(views()).toHaveLength(1);
    expect(views()[0][2].page_title).toBe("Committed note title");
    // Duplicate tracker mounts/readiness cannot add the same view.
    scheduleAnalyticsPageView("/practice/note");
    scheduleAnalyticsPageView("/practice/note");
    vi.runAllTimers();
    expect(views()).toHaveLength(1);
    scheduleAnalyticsPageView("/practice/ear");
    navigate("/melody", "Melody title");
    expect(views().map((call) => call[2].page_path)).toEqual([
      "/practice/note",
      "/melody",
    ]);
    const unmounted = scheduleAnalyticsPageView("/melody");
    unmounted();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not initialize scripts, queues or views in development or on the server", () => {
    vi.stubEnv("NODE_ENV", "development");
    scheduleAnalyticsPageView("/practice/note");
    vi.runAllTimers();
    expect(initializeAnalytics()).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("window", undefined);
    expect(() => recordAnalyticsPageView("/practice/note")).not.toThrow();
  });
});

describe("minimal URL and attribution contract", () => {
  it("uses only explicit bounded standard campaign config fields", () => {
    expect(
      analyticsCampaign(
        `${origin}/?utm_id=fall-26&utm_source=newsletter&utm_medium=email&utm_campaign=autumn+practice&utm_term=sight_reading&utm_content=top-link&gclid=private&session_id=private&email=private`,
      ),
    ).toEqual({
      campaign_id: "fall-26",
      campaign_source: "newsletter",
      campaign_medium: "email",
      campaign_name: "autumn practice",
      campaign_term: "sight_reading",
      campaign_content: "top-link",
    });
    for (const value of [
      "a".repeat(101),
      "person@example.com",
      "https://private/",
      "a\nb",
      "private#fragment",
      "a&token=secret",
    ])
      expect(
        analyticsCampaign(`${origin}/?utm_source=${encodeURIComponent(value)}`),
      ).toEqual({});
    expect(analyticsCampaign("javascript:private")).toEqual({});
  });

  it("strips query/hash and credentials from current and same-origin referrer URLs", () => {
    expect(
      analyticsPageContext(
        "https://person:secret@note-quiz.com/ko/melody?seed=private#notes=C4",
        "Melody",
        `${origin}/practice/note?answers=private#secret`,
      ),
    ).toEqual({
      page_title: "Melody",
      page_path: "/ko/melody",
      page_location: `${origin}/ko/melody`,
      page_referrer: `${origin}/practice/note`,
    });
    expect(
      analyticsPageContext(`${origin}/`, "a".repeat(400), "not a url")!
        .page_title,
    ).toHaveLength(300);
    expect(
      analyticsPageContext(`${origin}/`, "Home", "javascript:private")!
        .page_referrer,
    ).toBe("");
    expect(analyticsPageContext("not a url", "Home", "")).toBeUndefined();
  });
});
