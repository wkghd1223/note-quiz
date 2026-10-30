/* Run against a local server with Playwright available:
 * PLAYWRIGHT_MODULE=/path/to/playwright BROWSER_PATH=/path/to/chrome node scripts/verify-practice-ui.cjs
 * Only GET /api/leaderboard is mocked. Advertising scripts are left enabled.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.UI_BASE_URL || "http://127.0.0.1:3101";
const output = process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-ui-qa";
const boardTitle = "Today's Nationality Leaderboard";
const emptyText =
  "No leaderboard scores yet. Complete a game to start the rankings.";
const fixture = {
  viewerCountry: { countryCode: "KR", countryName: "South Korea", flag: "🇰🇷" },
  periodDate: "2026-10-30",
  entries: [],
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function eventually(check, message) {
  for (let i = 0; i < 80; i++) {
    if (await check()) return;
    await sleep(100);
  }
  throw new Error(message);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {}),
  });
  const results = [];
  let activePage;
  try {
    for (const [size, viewport] of [
      ["mobile", { width: 390, height: 844 }],
      ["desktop", { width: 1440, height: 900 }],
    ]) {
      const context = await browser.newContext({
        viewport,
        locale: "en-US",
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      activePage = page;
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let responseMode = "empty";
      let requestCount = 0;
      await page.route("**/api/leaderboard", async (route) => {
        requestCount++;
        const mode = responseMode;
        if (mode === "slow") await sleep(900);
        await route.fulfill({
          status: mode === "error" ? 500 : 200,
          json:
            mode === "rows"
              ? {
                  ...fixture,
                  entries: Array.from({ length: 10 }, (_, i) => ({
                    ...fixture.viewerCountry,
                    countryCode: `C${i}`,
                    countryName: `Country ${i + 1}`,
                    rank: i + 1,
                    totalScore: 1000 - i,
                    totalQuestions: 20,
                    totalCorrect: 18,
                  })),
                }
              : fixture,
        });
      });
      const go = async (path) => {
        const previousRequests = requestCount;
        await page.goto(baseURL + path, { waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { level: 1 }).waitFor();
        if (path.startsWith("/practice"))
          await eventually(
            () => Promise.resolve(requestCount > previousRequests),
            "Practice hydration complete",
          );
      };
      const screenshot = (name) =>
        page.screenshot({ path: `${output}/after-${size}-${name}.png` });
      const dialog = () => page.getByRole("dialog");
      const close = () =>
        dialog().getByRole("button", { name: "Close", exact: true });
      const ticker = () =>
        page.getByRole("button", { name: new RegExp("^" + boardTitle) });
      const unlocked = () =>
        eventually(
          () =>
            page.evaluate(
              () =>
                document.body.style.overflow !== "hidden" &&
                document.body.style.overflowY !== "hidden",
            ),
          "Body scroll must be restored",
        );
      const noDialog = () =>
        eventually(
          async () => (await dialog().count()) === 0,
          "Dialog must close",
        );

      await go("/");
      assert.equal(
        await page.locator("footer").count(),
        1,
        "One shared home footer",
      );
      for (const path of [
        "/about",
        "/contact",
        "/privacy-policy",
        "/terms-of-service",
      ])
        assert.equal(await page.locator(`footer a[href="${path}"]`).count(), 1);
      for (const mode of ["note", "ear"]) {
        const link = page.locator(`main a[href="/practice?mode=${mode}"]`);
        const box = await link.boundingBox();
        assert(
          box.y + box.height <= viewport.height,
          `${mode} home action fits initial viewport`,
        );
      }
      await screenshot("home");
      await page.locator('main a[href="/practice?mode=note"]').click();
      await page
        .getByRole("button", { name: "Start Game", exact: true })
        .waitFor();
      const startBox = await page
        .getByRole("button", { name: "Start Game", exact: true })
        .boundingBox();
      assert(startBox.y + startBox.height < 400, "Start is near top");
      assert.equal(
        await page.locator(".piano-keyboard").count(),
        0,
        "No idle keyboard",
      );
      await screenshot("note");
      await page
        .getByRole("button", { name: "Start Game", exact: true })
        .click();
      await page.locator("svg.staff-svg").waitFor();
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      assert(
        await page
          .getByRole("button", { name: "C4", exact: true })
          .isDisabled(),
      );
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await page.getByRole("button", { name: "C4", exact: true }).click();
      await eventually(
        async () =>
          (await page.getByText("Total: 1", { exact: true }).count()) > 0,
        "Note answer counted once",
      );
      await sleep(1000);
      await screenshot("note-playing");
      await page.getByRole("button", { name: "End Game", exact: true }).click();
      await page.getByRole("button", { name: "Reset", exact: true }).waitFor();
      await screenshot("note-result");
      await page.getByRole("button", { name: "Reset", exact: true }).click();
      await page
        .getByRole("button", { name: "Start Game", exact: true })
        .waitFor();

      await page
        .getByRole("button", { name: "Ear Training", exact: true })
        .click();
      await eventually(
        () => Promise.resolve(page.url().includes("mode=ear")),
        "Mode switch URL",
      );
      await page
        .getByRole("button", { name: "Start Session", exact: true })
        .waitFor();
      assert.equal(await page.locator(".piano-keyboard").count(), 0);
      await screenshot("ear");
      await page
        .getByRole("button", { name: "Start Session", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Replay Note", exact: true })
        .click();
      await page.getByRole("button", { name: "C4", exact: true }).click();
      await sleep(2000);
      const label = page.getByText("Current Question Time", { exact: true });
      assert(
        await label.evaluate(
          (e) =>
            e.scrollWidth <= e.clientWidth &&
            getComputedStyle(e).textOverflow !== "ellipsis",
        ),
        "Question time label readable",
      );
      await screenshot("ear-playing");
      await page
        .getByRole("button", { name: "End Session", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Restart", exact: true })
        .waitFor();
      assert.equal(await page.locator(".piano-keyboard").count(), 0);
      await screenshot("ear-result");
      await page.getByRole("button", { name: "Restart", exact: true }).click();
      await page
        .getByRole("button", { name: "End Session", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "End Session", exact: true })
        .click();

      console.log(`${size}: home, note and ear flows passed`);

      // Direct query, loading, empty, error, retry, fresh fetch on reopen.
      responseMode = "slow";
      await go("/practice?leaderboard=open");
      await dialog().waitFor();
      assert.equal(await dialog().getAttribute("aria-modal"), "true");
      assert.equal(
        await dialog().getByRole("heading", { name: boardTitle }).count(),
        1,
      );
      await dialog().getByRole("status").waitFor();
      await dialog().getByText(emptyText, { exact: true }).waitFor();
      await screenshot("leaderboard-empty");
      assert(
        await close().evaluate((e) => e === document.activeElement),
        "Initial focus enters dialog",
      );
      await page.keyboard.press("Shift+Tab");
      assert(
        await dialog().evaluate((e) => e.contains(document.activeElement)),
        "Backward tab stays in dialog",
      );
      await page.keyboard.press("Tab");
      assert(
        await dialog().evaluate((e) => e.contains(document.activeElement)),
        "Forward tab stays in dialog",
      );
      await page.keyboard.press("Escape");
      await noDialog();
      await unlocked();
      await eventually(
        () => Promise.resolve(!page.url().includes("leaderboard=open")),
        "Closing clears leaderboard query",
      );
      responseMode = "error";
      await ticker().click();
      await dialog().getByRole("alert").waitFor();
      assert(
        !(await dialog().textContent()).includes(emptyText),
        "Error is distinct from empty",
      );
      await screenshot("leaderboard-error");
      responseMode = "rows";
      await dialog()
        .getByRole("button", { name: "Try again", exact: true })
        .click();
      await dialog().getByText("🇰🇷 Country 10", { exact: true }).waitFor();
      await dialog()
        .getByText("🇰🇷 Country 10", { exact: true })
        .scrollIntoViewIfNeeded();
      await screenshot("leaderboard");
      await close().click();
      await noDialog();
      await unlocked();
      assert(
        await ticker().evaluate((e) => e === document.activeElement),
        "Return focus to ticker",
      );
      const count = requestCount;
      await ticker().click();
      await dialog().waitFor();
      await eventually(
        async () => requestCount > count,
        "Reopening refreshes data",
      );
      await page.mouse.click(4, 4);
      await noDialog();
      await unlocked();
      assert(await ticker().evaluate((e) => e === document.activeElement));

      console.log(`${size}: leaderboard states and dismissal passed`);

      if (size === "mobile") {
        await go("/practice?mode=note");
        const settings = () =>
          page.getByRole("button", { name: "Settings", exact: true });
        await settings().click();
        await dialog().waitFor();
        assert.equal(
          await dialog()
            .getByRole("heading", { name: "Settings", exact: true })
            .count(),
          1,
        );
        await dialog()
          .getByRole("button", { name: "Solfege", exact: true })
          .click();
        for (let i = 0; i < 30; i++) {
          await page.keyboard.press("Tab");
          assert(
            await dialog().evaluate((e) => e.contains(document.activeElement)),
            "Settings tab trap",
          );
        }
        await screenshot("settings");
        await close().click();
        await noDialog();
        await unlocked();
        assert(await settings().evaluate((e) => e === document.activeElement));
        await settings().click();
        await page.keyboard.press("Escape");
        await noDialog();
        await unlocked();
        await settings().click();
        await page.mouse.click(4, 4);
        await noDialog();
        await unlocked();
        await settings().click();
        await page.setViewportSize({ width: 1440, height: 900 });
        await noDialog();
        await unlocked();
        await eventually(
          () => Promise.resolve(!page.url().includes("settings=open")),
          "Resize clears settings query",
        );
        await page.setViewportSize(viewport);
        assert.equal(
          await dialog().count(),
          0,
          "Settings do not reopen when shrinking",
        );
        await ticker().click();
        await page.setViewportSize({ width: 1440, height: 900 });
        await dialog().waitFor();
        await screenshot("leaderboard-resized");
        await page.keyboard.press("Escape");
        await noDialog();
        await unlocked();
        await page.setViewportSize(viewport);
        await go("/practice?mode=ear&settings=open");
        await dialog().waitFor();
        await screenshot("ear-settings");
        await page.keyboard.press("Escape");
        await noDialog();
        await unlocked();
      } else {
        await go("/practice?settings=open");
        await noDialog();
        await unlocked();
        await eventually(
          () => Promise.resolve(!page.url().includes("settings=open")),
          "Desktop settings use sidebar",
        );
        await screenshot("settings");
      }
      await go("/practice?settings=open&leaderboard=open");
      await dialog().waitFor();
      await page.keyboard.press("Escape");
      await noDialog();
      await unlocked();
      await eventually(
        () => Promise.resolve(!page.url().includes("=open")),
        "Closing competing direct-open query returns to page",
      );

      // Actual page scroll position and inline overflow must survive close.
      await page.evaluate(() => {
        document.body.style.overflow = "auto";
        window.scrollTo({ top: 100, behavior: "instant" });
      });
      const original = await page.evaluate(() => window.scrollY);
      await ticker().evaluate((e) => e.focus({ preventScroll: true }));
      await page.keyboard.press("Enter");
      await dialog().waitFor();
      await page.keyboard.press("Escape");
      await noDialog();
      assert.equal(
        await page.evaluate(() => document.body.style.overflow),
        "auto",
      );
      assert.equal(await page.evaluate(() => window.scrollY), original);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
        "No horizontal overflow",
      );
      assert.deepEqual(errors, [], "No browser JS errors");
      results.push({ size, passed: true, leaderboardRequests: requestCount });
      await context.close();
    }
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    await activePage?.screenshot({ path: `${output}/failure.png` });
    console.error({
      url: activePage?.url(),
      dialogs: await activePage?.getByRole("dialog").count(),
    });
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
