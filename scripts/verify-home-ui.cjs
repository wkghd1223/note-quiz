/* eslint-disable @typescript-eslint/no-require-imports */
// Run against an existing production server; external requests are blocked.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.UI_BASE_URL || "http://localhost:3013";
const out = process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-home-qa";
const report = {
  base,
  build: process.env.EXPECTED_BUILD_ID,
  realAds: false,
  cases: [],
  errors: [],
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH,
  });
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
      { width: 320, height: 740 },
    ]) {
      const context = await browser.newContext({
        viewport,
        reducedMotion: "reduce",
      });
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith("/api/leaderboard"))
          return route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              entries: [],
              viewerCountry: null,
              periodDate: "2026-11-15",
            }),
          });
        return url.origin === new URL(base).origin &&
          ["GET", "HEAD"].includes(route.request().method())
          ? route.continue()
          : route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => report.errors.push(error.message));
      for (const locale of [
        "en",
        "ko",
        "ja",
        "es",
        "de",
        "fr",
        "zh",
        "pt",
        "ru",
        "ka",
        "eo",
      ]) {
        const response = await page.goto(`${base}/${locale}`);
        assert.equal(response.status(), 200);
        if (report.build)
          assert.ok(
            (await response.text()).includes(report.build),
            "Expected build ID",
          );
        await page.locator("#home-heading").waitFor();
        assert.equal(await page.getByRole("contentinfo").count(), 1);
        for (const legal of [
          "about",
          "contact",
          "privacy-policy",
          "terms-of-service",
        ])
          assert.equal(
            await page.locator(`footer a[href="/${legal}"]`).count(),
            1,
          );
        assert.equal(
          await page.locator('head link[rel="canonical"]').getAttribute("href"),
          `https://note-quiz.com/${locale}`,
        );
        for (const path of [
          "practice/note",
          "practice/ear",
          "practice/interval",
          "practice/chord",
          "melody",
        ]) {
          assert.equal(
            await page.locator(`main a[href="/${locale}/${path}"]`).count(),
            1,
          );
        }
        const layout = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          controls: [...document.querySelectorAll("main a, main summary")].map(
            (e) => {
              const r = e.getBoundingClientRect();
              return { height: r.height, width: r.width };
            },
          ),
          melodyBottom: document
            .querySelector('main a[href$="/melody"]')
            .getBoundingClientRect().bottom,
          horizontalClip: [
            ...document.querySelectorAll(
              "main h1, main h2, main p, main a, main summary",
            ),
          ].some((e) => e.scrollWidth > e.clientWidth + 1),
        }));
        assert.equal(
          layout.overflow,
          false,
          `${locale} ${viewport.width} overflow`,
        );
        assert.equal(
          layout.horizontalClip,
          false,
          `${locale} ${viewport.width} text clipping`,
        );
        assert.ok(
          layout.controls.every((r) => r.height >= 44 && r.width >= 44),
          "Touch controls",
        );
        if (viewport.width === 390 && locale === "ko")
          assert.ok(
            layout.melodyBottom <= 754,
            "Korean primary choices visible above a 90px bottom reservation",
          );
        const summary = page.locator("summary").first();
        await summary.focus();
        await page.keyboard.press("Enter");
        assert.equal(
          await page.locator("details").first().getAttribute("open"),
          "",
        );
        await page.keyboard.press("Enter");
        assert.equal(
          await page.locator("details").first().getAttribute("open"),
          null,
        );
        await page.evaluate(() => scrollTo(0, 0));
        if (["ko", "de", "pt"].includes(locale))
          await page.screenshot({
            path: `${out}/${locale}-${viewport.width}.png`,
          });
        report.cases.push({ locale, width: viewport.width, ...layout });
      }
      if (viewport.width !== 320) {
        for (const mode of ["note", "ear", "interval", "chord"]) {
          await page.goto(`${base}/ko`);
          await page.locator(`main a[href="/ko/practice/${mode}"]`).click();
          await page.waitForURL(`**/ko/practice/${mode}`);
          await page.locator("[data-practice-phase=idle]").waitFor();
        }
        await page.goto(`${base}/ko`);
        await page.locator('main a[href="/ko/melody"]').click();
        await page.locator("[data-melody-phase=landing]").waitFor();
        await page.goto(`${base}/ko`);
        await page
          .locator('main a[href="/ko/practice/note?leaderboard=open"]')
          .click();
        await page.getByRole("dialog").waitFor();
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          () => !document.querySelector("dialog[open]"),
        );
        assert.notEqual(
          await page.evaluate(() => getComputedStyle(document.body).overflowY),
          "hidden",
        );
        await page.goto(`${base}/ko`);
        await page
          .locator("header .language-selector button[aria-haspopup=dialog]")
          .click();
        await page
          .getByRole("menuitemradio", { name: "Deutsch", exact: true })
          .click();
        await page.waitForURL("**/de");
        assert.match(
          await page.locator("#home-heading").textContent(),
          /Noten/,
        );
      }
      await context.close();
    }
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    for (const locale of ["", "ko", "pt"]) {
      const page = await noJs.newPage();
      await page.goto(`${base}/${locale}`);
      assert.ok(
        (await page.locator("#home-heading").textContent()).length > 0,
        "SSR home content",
      );
      assert.equal(await page.locator('main a[href$="/melody"]').count(), 1);
      await page.close();
    }
    await noJs.close();
    assert.deepEqual(report.errors, []);
  } catch (error) {
    report.failure = String(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  }
  console.log(
    JSON.stringify({
      cases: report.cases.length,
      errors: report.errors,
      failure: report.failure,
    }),
  );
})();
