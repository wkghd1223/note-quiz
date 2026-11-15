/* eslint-disable @typescript-eslint/no-require-imports -- Optional external Playwright runner. */
/*
 * Verifies an ALREADY RUNNING isolated snapshot; never starts/restarts a server.
 * UI_BASE_URL is mandatory so this cannot silently target another active session.
 * PLAYWRIGHT_MODULE and BROWSER_PATH follow verify-practice-ui.cjs conventions.
 * Leaderboard responses are fixtures; no scores or external telemetry are sent.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.UI_BASE_URL;
assert(
  baseURL,
  "Set UI_BASE_URL to the coordinator's isolated snapshot server",
);
const output = process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-practice-routes";
const modes = ["note", "ear", "interval", "chord"];
const locales = ["en", "ko", "ja", "es", "de", "fr", "zh", "pt"];
const report = {
  baseURL,
  routes: [],
  interactions: [],
  errors: [],
  limitations: [
    "Synthetic leaderboard fixtures; does not prove audible output or physical microphone hardware.",
  ],
};
const waitFor = async (predicate, message) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(message);
};
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {}),
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(baseURL).origin) return route.abort();
      if (url.pathname === "/api/leaderboard") {
        assert.equal(
          route.request().method(),
          "GET",
          "Route checks must never submit a score",
        );
        return route.fulfill({
          json: {
            viewerCountry: {
              countryCode: "KR",
              countryName: "South Korea",
              flag: "🇰🇷",
            },
            periodDate: "2026-11-15",
            entries: [],
          },
        });
      }
      return route.continue();
    });
    let page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(error.message));
    const selected = () =>
      page.locator("[data-practice-mode] input:checked").inputValue();
    const go = async (href) => {
      const response = await page.goto(new URL(href, baseURL).toString(), {
        waitUntil: "domcontentloaded",
      });
      await page.locator("[data-practice-mode]").waitFor();
      return response;
    };
    for (const locale of [null, ...locales])
      for (const mode of modes) {
        const prefix = locale ? `/${locale}` : "";
        const pathname = `${prefix}/practice/${mode}`;
        const response = await go(`${pathname}?mode=note&share=1&sound=0`);
        assert.equal(response.status(), 200);
        assert.equal(await selected(), mode, "Path mode overrides query mode");
        assert.equal(
          await page.locator('link[rel="canonical"]').getAttribute("href"),
          `https://note-quiz.com${pathname}`,
        );
        assert.equal(
          await page.locator('link[hreflang="zh-Hans"]').getAttribute("href"),
          `https://note-quiz.com/zh/practice/${mode}`,
        );
        assert.equal(
          await page.locator("footer").count(),
          1,
          "Practice has one footer",
        );
        assert.equal(
          await page.locator('header nav a[aria-current="page"]').count(),
          1,
        );
        assert.equal(
          await page.locator('meta[property="og:url"]').getAttribute("content"),
          `https://note-quiz.com${pathname}`,
        );
        const description = await page
          .locator('meta[name="description"]')
          .getAttribute("content");
        assert(description, "Leaf description remains available");
        for (const selector of [
          'meta[property="og:description"]',
          'meta[name="twitter:description"]',
        ])
          assert.equal(
            await page.locator(selector).getAttribute("content"),
            description,
          );
        for (const selector of [
          'meta[property="og:title"]',
          'meta[name="twitter:title"]',
        ])
          assert.equal(
            await page.locator(selector).getAttribute("content"),
            await page.title(),
          );
        report.routes.push(pathname);
      }
    for (const locale of [null, ...locales]) {
      const prefix = locale ? `/${locale}` : "";
      const response = await go(`${prefix}/practice`);
      assert.equal(new URL(page.url()).pathname, `${prefix}/practice/note`);
      assert.equal(
        response.request().redirectedFrom() !== null,
        true,
        "Mode-free index performs a real HTTP redirect",
      );
      assert.equal(
        (await response.request().redirectedFrom().response()).status(),
        308,
        "Practice index migration is permanent HTTP 308",
      );
      assert.equal(await selected(), "note");
    }
    report.interactions.push(
      `Mode-free root and all ${locales.length} locale indexes permanently HTTP-308 redirect to note`,
    );
    for (const locale of [null, ...locales])
      for (const mode of modes) {
        const prefix = locale ? `/${locale}` : "";
        const query = new URLSearchParams({
          mode,
          share: "1",
          key: "F#",
          daily: "1",
          settings: "open",
          leaderboard: "open",
        });
        const response = await context.request.get(
          new URL(`${prefix}/practice?${query}`, baseURL).toString(),
          { maxRedirects: 0 },
        );
        assert.equal(response.status(), 308);
        const location = new URL(response.headers().location, baseURL);
        assert.equal(location.pathname, `${prefix}/practice/${mode}`);
        assert.deepEqual(
          Object.fromEntries(location.searchParams),
          Object.fromEntries(query),
        );
      }
    report.interactions.push(
      "Explicit legacy modes preserve locale and share/daily/overlay queries with HTTP 308",
    );
    for (const locale of [null, ...locales]) {
      const prefix = locale ? `/${locale}` : "";
      const response = await context.request.get(
        new URL(`${prefix}/practice?mode=unknown&share=1`, baseURL).toString(),
        { maxRedirects: 0 },
      );
      assert.equal(
        response.status(),
        404,
        `Unknown ${prefix}/practice mode must return HTTP 404 before any layout stream`,
      );
      assert.equal(response.headers().location, undefined);
    }
    report.interactions.push(
      `Unknown legacy modes return actual HTTP 404 across root and ${locales.length} locales`,
    );
    for (const pathname of [
      "/practice/unknown",
      "/ko/practice/unknown",
      "/zz/practice/note",
    ]) {
      assert.equal(
        (await page.goto(new URL(pathname, baseURL).toString())).status(),
        404,
      );
    }
    // Empty route-handler 404s can reject browser navigation before returning a
    // Response. Their status and absent redirect are asserted via request above.
    report.interactions.push("Unknown rendered paths return HTTP 404");
    // Start interaction checks below Chromium's 50-entry session-history cap.
    // Keep the same context fixtures, but isolate them from the route matrix.
    await page.close();
    page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(error.message));
    await go(
      "/practice?mode=chord&share=1&level=basic&daily=1&leaderboard=open",
    );
    assert.equal(new URL(page.url()).pathname, "/practice/chord");
    assert.equal(new URL(page.url()).searchParams.get("daily"), "1");
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    report.interactions.push(
      "Legacy link preserves share/daily/leaderboard intent",
    );

    await go(
      "/practice/note?share=1&mode=note&clef=bass&key=C&length=ten&sound=0&input=piano",
    );
    const historyBefore = await page.evaluate(() => history.length);
    await page.locator("[data-practice-scroll]").evaluate((element) => {
      element.__persistentProbe = "shell";
    });
    await page.locator("header").evaluate((element) => {
      element.__persistentProbe = "header";
    });
    await page
      .getByRole("button", { name: "Start practice", exact: true })
      .click();
    await page.getByRole("button", { name: "End Game", exact: true }).waitFor();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.waitForURL((url) => url.searchParams.get("settings") === "open");
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "End Game", exact: true }).waitFor();
    await page.waitForURL((url) => !url.searchParams.has("settings"));
    assert.equal(
      await page.evaluate(() => history.length),
      historyBefore,
      "Overlay changes replace history",
    );
    report.interactions.push(
      "Same-mode settings overlay preserves running note session and history length",
    );

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.waitForURL((url) => url.searchParams.get("settings") === "open");
    await page
      .getByRole("dialog")
      .getByLabel("Key Signature", { exact: true })
      .selectOption("F");
    await page.waitForURL((url) => url.searchParams.get("key") === "F");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.waitForURL((url) => !url.searchParams.has("settings"));
    const noteURL = page.url();
    // Changing settings intentionally resets a session; start again to prove route-exit cleanup.
    await page
      .getByRole("button", { name: "Start practice", exact: true })
      .click();
    await page.getByRole("button", { name: "End Game", exact: true }).waitFor();
    await page
      .locator("[data-practice-mode] label")
      .filter({ has: page.locator('input[value="ear"]') })
      .click();
    await page.waitForURL((url) => url.pathname === "/practice/ear");
    await waitFor(async () => (await selected()) === "ear", "Ear mode loads");
    assert.equal(
      await page.evaluate(() => history.length),
      historyBefore + 1,
      "Mode changes push history",
    );
    assert.equal(
      await page
        .locator("[data-practice-scroll]")
        .evaluate((element) => element.__persistentProbe),
      "shell",
    );
    assert.equal(
      await page
        .locator("header")
        .evaluate((element) => element.__persistentProbe),
      "header",
    );
    await page.goBack();
    await page.waitForURL(noteURL);
    await waitFor(
      async () => (await selected()) === "note",
      "Back restores note mode",
    );
    await page
      .getByRole("button", { name: "Start practice", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.waitForURL((url) => url.searchParams.get("settings") === "open");
    assert.equal(
      await page
        .getByRole("dialog")
        .getByLabel("Key Signature", { exact: true })
        .inputValue(),
      "F",
    );
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.waitForURL((url) => !url.searchParams.has("settings"));
    await page.goForward();
    await page.waitForURL((url) => url.pathname === "/practice/ear");
    report.interactions.push(
      "Sibling routes retain shell/header; back/forward restores modes and settings; old note session cleaned up",
    );

    await go(
      "/en/practice/chord?share=1&mode=chord&view=visual&level=basic#history",
    );
    await page.locator("header select").selectOption("ko");
    await page.waitForURL((url) => url.pathname === "/ko/practice/chord");
    assert.equal(new URL(page.url()).hash, "#history");
    assert.equal(new URL(page.url()).searchParams.get("level"), "basic");
    assert.equal(await selected(), "chord");
    report.interactions.push(
      "Locale switching retains child mode, configuration and fragment",
    );
    // Unprefixed routes retain the stored locale. Restore English before the
    // following English-label interaction cases without resetting user state.
    await page.locator("header select").selectOption("en");
    await page.waitForURL((url) => url.pathname === "/en/practice/chord");

    const openSettings = async () => {
      const inline = page.locator("[data-practice-settings]:visible");
      if (await inline.count()) return inline;
      const dialog = page.getByRole("dialog");
      if (!(await dialog.isVisible())) {
        await page
          .getByRole("button", { name: "Settings", exact: true })
          .click();
        await page.waitForURL(
          (url) => url.searchParams.get("settings") === "open",
        );
        await dialog.waitFor();
      }
      return dialog;
    };
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      // Previously distributed share URLs still restore supported settings directly.
      await go(
        "/practice/note?share=1&mode=note&clef=bass&key=F&length=ten&sound=0&campaign=music#history",
      );
      assert.equal(
        await page.locator("main > details").count(),
        0,
        "The top preset/share details are removed",
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Copy practice link", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Start today’s practice", exact: true })
          .count(),
        0,
      );
      let panel = await openSettings();
      assert.equal(
        await panel.getByLabel("Key Signature", { exact: true }).inputValue(),
        "F",
      );
      const before = await page.evaluate(() => history.length);
      let intro = panel.locator("[data-practice-settings-intro]");
      // Deliberately do not await a URL commit between consecutive settings operations.
      await intro
        .getByRole("combobox", { name: "Preset", exact: true })
        .selectOption("bass");
      await intro
        .getByRole("combobox", { name: "Difficulty", exact: true })
        .selectOption("advanced");
      await panel
        .getByLabel("Key Signature", { exact: true })
        .selectOption("F");
      await page.waitForURL(
        (url) =>
          url.searchParams.get("level") === "advanced" &&
          url.searchParams.get("key") === "F",
      );
      assert.equal(
        await page.evaluate(() => history.length),
        before,
        "Same-mode settings replace history",
      );
      assert.equal(new URL(page.url()).searchParams.get("campaign"), "music");
      assert.equal(new URL(page.url()).hash, "#history");
      if (viewport.width < 1024)
        assert.equal(new URL(page.url()).searchParams.get("settings"), "open");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("[data-practice-mode]").waitFor();
      panel = await openSettings();
      assert.equal(
        await panel.getByLabel("Key Signature", { exact: true }).inputValue(),
        "F",
      );
      assert.equal(
        await panel
          .locator("[data-practice-settings-intro]")
          .getByRole("combobox", { name: "Difficulty", exact: true })
          .inputValue(),
        "advanced",
      );

      await go(
        "/practice/chord?share=1&mode=chord&view=visual&level=basic&campaign=music#history",
      );
      panel = await openSettings();
      intro = panel.locator("[data-practice-settings-intro]");
      await intro
        .getByRole("combobox", { name: "Preset", exact: true })
        .selectOption("chord");
      await intro
        .getByRole("combobox", { name: "Difficulty", exact: true })
        .selectOption("advanced");
      await intro
        .getByRole("combobox", { name: "Session", exact: true })
        .selectOption("timed");
      await intro.getByLabel("time limit", { exact: true }).selectOption("30");
      await page.waitForURL(
        (url) =>
          url.searchParams.get("level") === "advanced" &&
          url.searchParams.get("length") === "timed" &&
          url.searchParams.get("seconds") === "30",
      );
      assert.equal(new URL(page.url()).pathname, "/practice/chord");
      assert.equal(new URL(page.url()).searchParams.get("campaign"), "music");
      assert.equal(new URL(page.url()).hash, "#history");
      if (viewport.width < 1024)
        assert.equal(new URL(page.url()).searchParams.get("settings"), "open");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("[data-practice-mode]").waitFor();
      panel = await openSettings();
      intro = panel.locator("[data-practice-settings-intro]");
      assert.equal(
        await intro
          .getByRole("combobox", { name: "Session", exact: true })
          .inputValue(),
        "timed",
      );
      assert.equal(
        await intro.getByLabel("time limit", { exact: true }).inputValue(),
        "30",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: path.join(output, `routes-${viewport.width}.png`),
        fullPage: true,
      });

      await go("/practice/note?share=1&mode=note&daily=1&sound=0");
      assert.equal(
        await page
          .getByRole("button", { name: "Start today’s practice", exact: true })
          .count(),
        0,
      );
      panel = await openSettings();
      await panel
        .getByRole("button", { name: "Normal practice", exact: true })
        .click();
      await page.waitForURL((url) => !url.searchParams.has("daily"));
      if (viewport.width < 1024)
        assert.equal(new URL(page.url()).searchParams.get("settings"), "open");
      assert.equal(await selected(), "note");
      if (viewport.width < 1024) {
        await panel.getByRole("button", { name: "Close", exact: true }).click();
        await page.waitForURL((url) => !url.searchParams.has("settings"));
      }
    }
    report.interactions.push(
      "Mobile/desktop settings intro applies preset/difficulty/theory length/seconds, composes rapid changes and restores direct share URLs after refresh",
    );
    report.interactions.push(
      "Top preset/share/daily entry UI is absent; direct daily URLs retain a settings-only normal-practice exit",
    );
    // Recent history is a local presentation panel; all storage below is an isolated fixture.
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await go("/practice/note?share=1&mode=note&sound=0&length=free");
      await page.evaluate(() => {
        localStorage.setItem(
          "note-quiz-learning-v1",
          JSON.stringify({
            version: 1,
            daily: {},
            sessions: [
              {
                at: Date.now(),
                mode: "interval",
                kind: "practice",
                difficulty: "basic",
                total: 10,
                correct: 2,
                elapsedMs: 10000,
                completed: true,
                categories: [{ id: "M3", total: 10, correct: 2 }],
                configuration:
                  "share=1&mode=interval&level=basic&task=interval&view=visual&length=ten",
              },
            ],
          }),
        );
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      const trigger = page.locator("[data-practice-history-trigger]");
      await trigger.waitFor();
      assert.equal(
        await page.locator("main table").count(),
        0,
        "Recent records are not inline before opening",
      );
      const triggerBounds = await trigger.boundingBox();
      assert(
        triggerBounds.width >= 44 && triggerBounds.height >= 44,
        "History has a 44px keyboard/pointer target",
      );
      const historyDialog = page.getByRole("dialog", {
        name: "Recent practice & next steps",
        exact: true,
      });
      const beforeURL = page.url();
      const beforeHistory = await page.evaluate(() => history.length);
      const restored = () =>
        waitFor(
          () =>
            trigger.evaluate((element) => element === document.activeElement),
          "History close returns focus to its trigger",
        );
      await trigger.focus();
      await page.keyboard.press("Enter");
      await historyDialog.waitFor();
      assert.equal(await historyDialog.locator("tbody tr").count(), 1);
      await historyDialog
        .getByRole("button", { name: "Close", exact: true })
        .click();
      await historyDialog.waitFor({ state: "hidden" });
      await restored();
      await page.keyboard.press("Space");
      await historyDialog.waitFor();
      await page.keyboard.press("Escape");
      await historyDialog.waitFor({ state: "hidden" });
      await restored();
      await trigger.click();
      await historyDialog.waitFor();
      const bounds = await historyDialog.boundingBox();
      assert(bounds.x > 2, "Dialog leaves a reachable backdrop");
      await page.mouse.click(
        bounds.x / 2,
        Math.min(viewport.height - 1, bounds.y + bounds.height / 2),
      );
      await historyDialog.waitFor({ state: "hidden" });
      await restored();
      assert.equal(
        page.url(),
        beforeURL,
        "Opening/closing history does not change route settings",
      );
      assert.equal(await page.evaluate(() => history.length), beforeHistory);
      await trigger.click();
      await historyDialog
        .getByRole("button", { name: /Practice this type/ })
        .click();
      await historyDialog.waitFor({ state: "hidden" });
      await page.waitForURL(
        (url) =>
          url.pathname === "/practice/interval" &&
          url.searchParams.get("focus") === "M3",
      );
      assert.equal(
        await selected(),
        "interval",
        "History practice selection retains the existing choose navigation",
      );
      await trigger.click();
      const panel = page.getByRole("dialog", {
        name: "Recent practice & next steps",
        exact: true,
      });
      await panel
        .getByRole("button", { name: "Reset learning history", exact: true })
        .click();
      await panel
        .getByRole("status")
        .filter({ hasText: "Learning history cleared." })
        .waitFor();
      assert.equal(await panel.locator("tbody tr").count(), 0);
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("note-quiz-learning-v1")).sessions
              .length,
        ),
        0,
      );
      await panel.getByRole("button", { name: "Close", exact: true }).click();
      await panel.waitFor({ state: "hidden" });
      await restored();
      for (const mode of modes) {
        await go(
          `/practice/${mode}?share=1&mode=${mode}&sound=0&length=free&view=visual`,
        );
        assert.equal(await trigger.isEnabled(), true);
        await page
          .getByRole("button", { name: "Start practice", exact: true })
          .click();
        await waitFor(
          () => trigger.isDisabled(),
          `${mode} blocks history while its authoritative session is playing`,
        );
        assert.equal(await historyDialog.isVisible(), false);
        if (mode === "note") {
          await page
            .getByRole("button", { name: "Pause", exact: true })
            .click();
          await waitFor(
            () => trigger.isEnabled(),
            "Paused note practice can open history",
          );
          await trigger.click();
          await historyDialog.waitFor();
          await page.keyboard.press("Escape");
          await historyDialog.waitFor({ state: "hidden" });
          await restored();
          await page
            .getByRole("button", { name: "Resume", exact: true })
            .click();
          await waitFor(
            () => trigger.isDisabled(),
            "Resuming preserves the playing guard",
          );
        }
      }
    }
    report.interactions.push(
      "Mobile/desktop history opens by keyboard and button, dismisses through close/Escape/backdrop, restores trigger focus, keeps records out of the main flow, selects practice and preserves clear notices/storage behavior",
    );
    report.interactions.push(
      "History trigger blocks all four current playing modes and permits paused note practice without changing session state",
    );
    assert.deepEqual(
      report.errors,
      [],
      "No page errors during route transitions",
    );
    report.outcome = "passed";
    await context.close();
  } catch (error) {
    report.outcome = "failed";
    report.failure = error.stack || String(error);
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(
      path.join(output, "report.json"),
      JSON.stringify(report, null, 2),
    );
    await browser.close();
    console.log(JSON.stringify(report, null, 2));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
