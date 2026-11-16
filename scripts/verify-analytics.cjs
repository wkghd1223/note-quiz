/* eslint-disable @typescript-eslint/no-require-imports */
// Run only against an independently started, isolated production snapshot.
// Controlled gtag queue consumer + synthetic Chromium microphone, NOT Google
// collection or physical-device evidence. This never starts/attaches a server.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

if (!process.env.UI_BASE_URL)
  throw new Error(
    "UI_BASE_URL is required; point it at the isolated QA server.",
  );
const base = new URL(process.env.UI_BASE_URL);
assert.ok(
  ["http:", "https:"].includes(base.protocol),
  "QA server must use HTTP(S)",
);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname),
  "QA server must be local",
);
assert.notEqual(
  base.port,
  "3001",
  "user3001 is protected; use the isolated QA snapshot",
);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const out = process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-analytics-qa";
const viewport =
  process.env.UI_MOBILE === "1"
    ? { width: 390, height: 844 }
    : { width: 1440, height: 900 };
const report = {
  base: base.origin,
  expectedBuild: process.env.EXPECTED_BUILD_ID,
  transport: "controlled gtag queue consumer; all external traffic intercepted",
  realGoogleCollection: false,
  realMicrophone: false,
  viewport,
  cases: [],
  errors: [],
  blockedCollections: 0,
  blockedWrites: 0,
};
const stub = `(() => {
  const calls = [];
  const observations = [];
  const take = entry => {
    calls.push(Array.from(entry));
    observations.push({page_title: document.title.slice(0, 300), page_path: location.pathname});
  };
  const layer = window.dataLayer || (window.dataLayer = []);
  for (const entry of layer) take(entry);
  layer.push = function (...entries) {
    for (const entry of entries) take(entry);
    return Array.prototype.push.apply(this, entries);
  };
  window.__analyticsControlledStub = { calls, observations, transport: 'controlled stub' };
})();`;
const button = (page, name) => page.getByRole("button", { name, exact: true });
const calls = (page) =>
  page.evaluate(() => window.__analyticsControlledStub?.calls || []);
const events = async (page, name, mode) =>
  (await calls(page)).filter(
    ([command, event, payload]) =>
      command === "event" &&
      event === name &&
      (!mode || payload.training_mode === mode),
  );
// gtag events inherit the most recent target config; event parameters win.
// Retain raw calls as evidence and assert the effective context at emission.
const effectiveEvents = async (page, name, mode) => {
  const commands = await calls(page);
  const target = commands.find(([command]) => command === "config")?.[1];
  let config = {};
  return commands.flatMap(([command, event, payload]) => {
    if (command === "config" && event === target)
      config = { ...config, ...payload };
    return command === "event" &&
      event === name &&
      (!mode || payload.training_mode === mode)
      ? [[command, event, { ...config, ...payload }]]
      : [];
  });
};
async function count(page, name, mode, expected) {
  await page.waitForFunction(
    ({ name, mode, expected }) =>
      (window.__analyticsControlledStub?.calls || []).filter(
        ([command, event, payload]) =>
          command === "event" &&
          event === name &&
          (!mode || payload.training_mode === mode),
      ).length === expected,
    { name, mode, expected },
    { timeout: 45000 },
  );
}
async function phase(page, expected) {
  await page.waitForFunction(
    (value) =>
      document.querySelector("[data-melody-phase]")?.dataset.melodyPhase ===
      value,
    expected,
    { timeout: 45000 },
  );
}
function privacy(commands) {
  assert.ok(
    !JSON.stringify(commands).match(
      /private-email|private-fragment|private-session|raw_answer|\?\?/,
    ),
  );
  for (const [, , payload] of commands) {
    if (!payload || typeof payload !== "object") continue;
    for (const [key, value] of Object.entries(payload)) {
      assert.ok(
        !/^(session_id|user_id|attempt_token|exercise_id|seed|notes|answers|pitch_samples|device_id|frequency|recording)$/.test(
          key,
        ),
        key,
      );
      assert.ok(
        value == null || ["string", "number", "boolean"].includes(typeof value),
        key,
      );
      if (["page_location", "page_referrer"].includes(key) && value) {
        const url = new URL(value);
        assert.equal(url.search + url.hash + url.username + url.password, "");
      }
    }
  }
}
async function context(
  browser,
  { delayed = false, denyFirstMicrophone = false } = {},
) {
  const c = await browser.newContext({ viewport });
  await c.grantPermissions(["microphone"], { origin: base.origin });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let held = delayed;
  await c.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (
      url.hostname === "www.googletagmanager.com" &&
      url.pathname === "/gtag/js"
    ) {
      if (held) await gate;
      return route.fulfill({
        contentType: "application/javascript",
        body: stub,
      });
    }
    if (
      /google-analytics\.com$/.test(url.hostname) ||
      /\/g\/collect$/.test(url.pathname)
    ) {
      report.blockedCollections++;
      return route.fulfill({ status: 204, body: "" });
    }
    if (!["GET", "HEAD"].includes(request.method())) {
      report.blockedWrites++;
      return route.abort();
    }
    if (url.origin !== base.origin) return route.abort();
    if (url.pathname === "/api/leaderboard")
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          viewerCountry: {
            countryCode: "XX",
            countryName: "Unknown",
            flag: "🏳",
          },
          periodDate: "2026-11-16",
          entries: [],
        }),
      });
    return route.continue();
  });
  if (denyFirstMicrophone)
    await c.addInitScript(() => {
      const native = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      let denied = false;
      navigator.mediaDevices.getUserMedia = (...args) => {
        if (!denied) {
          denied = true;
          return Promise.reject(
            new DOMException(
              "Controlled permission failure",
              "NotAllowedError",
            ),
          );
        }
        return native(...args);
      };
    });
  const page = await c.newPage();
  page.setDefaultTimeout(25000);
  page.on("pageerror", (error) => report.errors.push(error.message));
  return {
    c,
    page,
    release: () => {
      held = false;
      release();
    },
  };
}
async function open(page, route) {
  const response = await page.goto(new URL(route, base.origin).href, {
    waitUntil: "domcontentloaded",
  });
  assert.ok(response.ok(), `HTTP ${response.status()}`);
  if (process.env.EXPECTED_BUILD_ID)
    assert.ok(
      (await response.text()).includes(process.env.EXPECTED_BUILD_ID),
      "Snapshot build ID",
    );
}
async function ready(page) {
  await button(page, "Start practice").waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (item) => item.textContent === "Start practice" && !item.disabled,
    ),
  );
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });
  async function test(name, run) {
    try {
      const evidence = await run();
      report.cases.push({ name, passed: true, evidence });
      console.log("PASS", name);
    } catch (error) {
      report.cases.push({ name, passed: false, error: String(error) });
      console.error("FAIL", name, String(error));
    }
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2),
    );
  }
  try {
    await test("delayed initial tag, query/navigation/back-forward and basic compatibility", async () => {
      const fixture = await context(browser, { delayed: true });
      const { c, page } = fixture;
      try {
        await open(
          page,
          "/practice/note?utm_source=analytics_fixture&utm_medium=test&utm_campaign=refresh&email=private-email#private-fragment",
        );
        await page.waitForFunction(() =>
          (window.dataLayer || []).some(
            (entry) => entry[0] === "event" && entry[1] === "page_view",
          ),
        );
        const before = await page.evaluate(() =>
          (window.dataLayer || []).map((entry) => Array.from(entry)),
        );
        assert.equal(
          before.filter(([a, b]) => a === "event" && b === "page_view").length,
          1,
        );
        assert.equal(before[0][0], "js");
        assert.equal(before[1][0], "config");
        assert.equal(before[1][2].campaign_source, "analytics_fixture");
        assert.equal(before[1][2].send_page_view, false);
        privacy(before);
        fixture.release();
        await count(page, "page_view", undefined, 1);
        assert.equal(
          (await events(page, "page_view"))[0][2].page_title,
          await page.title(),
        );
        await ready(page);
        await button(page, "Start practice").click();
        await count(page, "practice_started", "note", 1);
        await count(page, "note_quiz_session_started", undefined, 1);
        const noteStart = (
          await effectiveEvents(page, "practice_started", "note")
        )[0][2];
        assert.equal(noteStart.page_path, "/practice/note");
        assert.equal(noteStart.page_location, `${base.origin}/practice/note`);
        assert.equal(noteStart.page_title, await page.title());
        await button(page, "End Game").click();
        await count(page, "practice_completed", "note", 1);
        await count(page, "note_quiz_session_completed", undefined, 1);
        await page.evaluate(() =>
          history.replaceState(
            null,
            "",
            `${location.pathname}?history=open&session=private-session#raw_answer`,
          ),
        );
        await page.waitForTimeout(200);
        assert.equal((await events(page, "page_view")).length, 1);
        const resultDialog = page.locator(
          '[role="dialog"]:has([data-minimize-results])',
        );
        assert.equal(await resultDialog.count(), 1);
        await resultDialog.locator("[data-minimize-results]").click();
        // PracticeDialog stays mounted after close(); only its visibility and
        // native open/top-layer state change before the mode label is usable.
        await resultDialog.waitFor({ state: "hidden" });
        const earChoice = page.locator(
          '[data-practice-mode] input[value="ear"]',
        );
        await earChoice.locator("..").click();
        await page.waitForFunction(
          () =>
            document.querySelector('[data-practice-mode] input[value="ear"]')
              ?.checked,
          undefined,
          { timeout: 10000 },
        );
        await count(page, "practice_entered", "ear", 1);
        const earEntry = (
          await effectiveEvents(page, "practice_entered", "ear")
        )[0][2];
        assert.equal(earEntry.page_path, "/practice/ear");
        assert.equal(earEntry.page_location, `${base.origin}/practice/ear`);
        assert.equal(earEntry.page_referrer, `${base.origin}/practice/note`);
        const earObservation = await page.evaluate(() => {
          const { calls, observations } = window.__analyticsControlledStub;
          return observations[
            calls.findIndex(
              ([command, event, payload]) =>
                command === "event" &&
                event === "practice_entered" &&
                payload.training_mode === "ear",
            )
          ];
        });
        assert.equal(earEntry.page_title, earObservation.page_title);
        assert.equal(earEntry.page_path, earObservation.page_path);
        await page.waitForURL(/\/practice\/ear/);
        await count(page, "page_view", undefined, 2);
        const second = (await events(page, "page_view"))[1][2];
        assert.equal(second.page_title, await page.title());
        assert.equal(second.page_path, "/practice/ear");
        assert.equal(second.page_referrer, `${base.origin}/practice/note`);
        await page.goBack();
        await count(page, "page_view", undefined, 3);
        await page.goForward();
        await count(page, "page_view", undefined, 4);
        const navigation = await calls(page);
        privacy(navigation);
        // Unprefixed routes change the stored language in place, without a view.
        const unprefixedUrl = page.url();
        assert.equal(new URL(unprefixedUrl).pathname, "/practice/ear");
        assert.equal((await events(page, "page_view")).length, 4);
        await page.locator(".language-selector button[aria-haspopup=dialog]").click();
        await page.getByRole("menuitemradio", { name: "한국어", exact: true }).click();
        await page.waitForFunction(() =>
          document.documentElement.lang === "ko" &&
          document.querySelector(".language-selector button[aria-haspopup=dialog]")?.dataset.value === "ko",
        );
        await button(page, "연습 시작").waitFor();
        // Readiness above is semantic; this bounded window only checks absence.
        await page.waitForTimeout(200);
        assert.equal(page.url(), unprefixedUrl);
        const inPlaceLanguage = await calls(page);
        assert.deepEqual(inPlaceLanguage.slice(0, navigation.length), navigation);
        assert.deepEqual(
          await events(page, "page_view"),
          navigation.filter(([a, b]) => a === "event" && b === "page_view"),
        );
        privacy(inPlaceLanguage);
        return { queuedBeforeStub: before, navigation, inPlaceLanguage };
      } finally {
        fixture.release();
        await c.close();
      }
    });
    await test("localized language selector navigation and exactly-once target view", async () => {
      // A separate intercepted context keeps the unprefixed evidence intact.
      const { c, page } = await context(browser);
      try {
        const source = "/en/practice/ear";
        const target = "/ko/practice/ear";
        const suffix = "?email=private-email#private-fragment";
        await open(page, `${source}${suffix}`);
        await ready(page);
        await count(page, "practice_entered", "ear", 1);
        await count(page, "page_view", undefined, 1);
        const baseline = await calls(page);
        const baselineView = (await events(page, "page_view"))[0][2];
        assert.equal(baselineView.page_path, source);
        assert.equal(baselineView.page_location, `${base.origin}${source}`);
        assert.equal(baselineView.page_referrer, "");
        assert.equal(baselineView.page_title, await page.title());
        privacy(baseline);
        const sourceTimeOrigin = await page.evaluate(
          () => performance.timeOrigin,
        );
        const selector = page.locator(".language-selector button[aria-haspopup=dialog]");
        await selector.waitFor({ state: "visible" });
        assert.equal(await selector.getAttribute("data-value"), "en");
        // Use the real router action, including any root-layout document reload.
        await selector.click();
        await page.getByRole("menuitemradio", { name: "한국어", exact: true }).click();
        await page.waitForURL(`${base.origin}${target}${suffix}`);
        await page.waitForFunction(() =>
          document.documentElement.lang === "ko" &&
          document.querySelector(".language-selector button[aria-haspopup=dialog]")?.dataset.value === "ko",
        );
        await button(page, "연습 시작").waitFor();
        await page.waitForFunction(() =>
          (window.__analyticsControlledStub?.calls || []).some(
            ([command, event, payload]) =>
              command === "event" &&
              event === "page_view" &&
              payload.page_path === "/ko/practice/ear",
          ),
        );
        const sameDocument = sourceTimeOrigin ===
          (await page.evaluate(() => performance.timeOrigin));
        await count(page, "page_view", undefined, sameDocument ? 2 : 1);
        // Only duplicate absence uses stabilization, after UI and event readiness.
        await page.waitForTimeout(200);
        const destination = await calls(page);
        if (sameDocument)
          assert.deepEqual(destination.slice(0, baseline.length), baseline);
        // A new document has a new queue: retain both raw streams, never replace
        // the baseline with the destination and mistake a reset for deduplication.
        const combined = sameDocument
          ? destination
          : [...baseline, ...destination];
        const views = combined.filter(
          ([a, b]) => a === "event" && b === "page_view",
        );
        assert.equal(views.length, 2);
        assert.equal(views.filter(([, , p]) => p.page_path === source).length, 1);
        assert.equal(views.filter(([, , p]) => p.page_path === target).length, 1);
        const targetView = views.at(-1)[2];
        const expected = {
          page_path: target,
          page_location: `${base.origin}${target}`,
          page_referrer: `${base.origin}${source}`,
          page_title: await page.title(),
        };
        for (const [key, value] of Object.entries(expected))
          assert.equal(targetView[key], value, key);
        const effectiveTarget = (
          await effectiveEvents(page, "page_view")
        ).filter(([, , p]) => p.page_path === target);
        assert.equal(effectiveTarget.length, 1);
        for (const [key, value] of Object.entries(expected))
          assert.equal(effectiveTarget[0][2][key], value, `effective view ${key}`);
        const currentConfig = destination
          .filter(([a]) => a === "config").at(-1)[2];
        for (const [key, value] of Object.entries(expected))
          assert.equal(currentConfig[key], value, `current config ${key}`);
        assert.equal(currentConfig.send_page_view, false);
        assert.equal(page.url(), `${base.origin}${target}${suffix}`);
        privacy(combined);
        return { baseline, destination, views, sameDocument };
      } finally {
        await c.close();
      }
    });
    await test("melody preview, denied start, playing/pause/resume, completion, retry and exit", async () => {
      const { c, page } = await context(browser, { denyFirstMicrophone: true });
      try {
        await open(page, "/en/melody");
        await ready(page);
        await count(page, "practice_entered", "melody", 1);
        await button(page, "Play example").click();
        await count(page, "practice_preview_started", "melody", 1);
        assert.equal(
          (await events(page, "practice_started", "melody")).length,
          0,
        );
        await button(page, "Stop example").click();
        await button(page, "Start practice").click();
        await phase(page, "error");
        assert.equal(
          (await events(page, "practice_started", "melody")).length,
          0,
        );
        assert.equal(
          (await events(page, "practice_completed", "melody")).length,
          0,
        );
        await button(page, "Start practice").click();
        await phase(page, "countIn");
        await button(page, "End Game").click();
        await phase(page, "landing");
        assert.equal(
          (await events(page, "practice_started", "melody")).length,
          0,
        );
        assert.equal(
          (await events(page, "practice_completed", "melody")).length,
          0,
        );
        await button(page, "Start practice").click();
        await phase(page, "playing");
        await count(page, "practice_started", "melody", 1);
        await button(page, "Pause").click();
        await phase(page, "paused");
        await button(page, "Resume from this note").click();
        await phase(page, "playing");
        assert.equal(
          (await events(page, "practice_started", "melody")).length,
          1,
        );
        await phase(page, "result");
        await count(page, "practice_completed", "melody", 1);
        const complete = (
          await events(page, "practice_completed", "melody")
        )[0][2];
        assert.equal(complete.completed, true);
        assert.ok(complete.total_questions > 0);
        assert.ok(
          complete.correct_answers >= 0 &&
            complete.correct_answers <= complete.total_questions,
        );
        const displayed = await page
          .locator("[data-result-heading]")
          .locator("..")
          .locator("p strong")
          .innerText();
        const [passed, total] = displayed.match(/\d+/g).map(Number);
        assert.equal(complete.correct_answers, passed);
        assert.equal(complete.total_questions, total);
        // Opening/closing a result is query/UI state, never another session.
        const close = page.getByRole("button", { name: /Close/ }).first();
        if (await close.isVisible()) await close.click();
        await button(page, "Repeat this melody").click();
        await phase(page, "playing");
        await count(page, "practice_started", "melody", 2);
        await button(page, "End Game").click();
        await count(page, "practice_completed", "melody", 2);
        const interrupted = (
          await events(page, "practice_completed", "melody")
        )[1][2];
        assert.equal(interrupted.completed, false);
        assert.equal(interrupted.total_questions, undefined);
        assert.equal(interrupted.correct_answers, undefined);
        await button(page, "Start practice").click();
        await phase(page, "playing");
        await count(page, "practice_started", "melody", 3);
        const melodyTitle = await page.title();
        await page.locator('header nav a[href="/en/practice"]').click();
        await page.waitForURL(/\/en\/practice\/note/);
        await count(page, "practice_completed", "melody", 3);
        const exit = (
          await effectiveEvents(page, "practice_completed", "melody")
        )[2][2];
        assert.equal(exit.completed, false);
        assert.equal(exit.total_questions, undefined);
        assert.equal(exit.correct_answers, undefined);
        assert.equal(exit.page_path, "/en/melody");
        assert.equal(exit.page_location, `${base.origin}/en/melody`);
        assert.equal(exit.page_title, melodyTitle);
        assert.equal(exit.page_referrer, "");
        await count(page, "practice_entered", "note", 1);
        await count(page, "page_view", undefined, 2);
        const incoming = (await events(page, "page_view"))[1][2];
        assert.equal(incoming.page_path, "/en/practice/note");
        assert.equal(incoming.page_title, await page.title());
        assert.equal(incoming.page_referrer, `${base.origin}/en/melody`);
        const captured = await calls(page);
        privacy(captured);
        assert.ok(!(await events(page, "note_quiz_session_started")).length);
        return { calls: captured, syntheticMicrophone: true };
      } finally {
        await c.close();
      }
    });
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2),
    );
  }
  assert.equal(report.errors.length, 0, report.errors.join("\n"));
  assert.ok(
    report.cases.length && report.cases.every((item) => item.passed),
    "See report.json",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
