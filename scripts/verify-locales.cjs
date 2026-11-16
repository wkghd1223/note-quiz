/* eslint-disable @typescript-eslint/no-require-imports -- Optional external Playwright runtime. */
// Checks a running production server; all leaderboard traffic is fixture-only.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.UI_BASE_URL || "http://localhost:3013";
const output = process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-locales";
const locales = [
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
];
const siteURL = "https://note-quiz.com";
const fixture = {
  viewerCountry: { countryCode: "KR", countryName: "South Korea", flag: "🇰🇷" },
  periodDate: "2026-11-14",
  entries: [],
};

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {}),
  });
  const report = {
    fixtures: [
      "all leaderboard requests",
      "external resources blocked",
      "isolated browser storage",
    ],
    ssr: [],
    interactions: [],
    physicalDeviceVerified: false,
  };
  async function context(options) {
    const result = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "en-US",
      serviceWorkers: "block",
      ...options,
    });
    await result.route("**/*", (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (url.pathname.startsWith("/api/leaderboard"))
        return route.fulfill({
          status: request.method() === "GET" ? 200 : 503,
          json:
            request.method() === "GET"
              ? fixture
              : { error: "Score writes disabled in locale checks" },
        });
      if (url.origin !== new URL(baseURL).origin) return route.abort();
      assert(
        ["GET", "HEAD"].includes(request.method()),
        "No unmocked mutations",
      );
      return route.continue();
    });
    return result;
  }
  try {
    const ssr = await context({ javaScriptEnabled: false }),
      page = await ssr.newPage();
    for (const locale of locales)
      for (const path of [
        "",
        "/practice",
        "/challenge",
        "/challenge/world/w1",
        "/challenge/play/w1-s1",
      ]) {
        const url = `/${locale}${path}`,
          response = await page.goto(`${baseURL}${url}`, {
            waitUntil: "domcontentloaded",
          });
        assert.equal(response.status(), 200, url);
        assert.equal(
          await page.locator("html").getAttribute("lang"),
          locale === "zh" ? "zh-Hans" : locale === "pt" ? "pt-BR" : locale,
          `${url} SSR html language`,
        );
        assert.equal(
          await page.locator('link[rel="canonical"]').getAttribute("href"),
          `${siteURL}${url}`,
        );
        assert.equal(
          await page.locator('link[rel="alternate"][hreflang]').count(),
          locales.length + 1,
        );
        for (const alternate of locales)
          assert.equal(
            await page
              .locator(
                `link[rel="alternate"][hreflang="${alternate === "zh" ? "zh-Hans" : alternate === "pt" ? "pt-BR" : alternate}"]`,
              )
              .getAttribute("href"),
            `${siteURL}/${alternate}${path}`,
          );
        assert.equal(
          await page
            .locator('link[rel="alternate"][hreflang="x-default"]')
            .getAttribute("href"),
          `${siteURL}${path || "/"}`,
        );
        const title = await page.title(),
          description = await page
            .locator('meta[name="description"]')
            .getAttribute("content");
        assert(title.length > "Note Quiz".length);
        assert(description.length > 0);
        if (locale === "zh")
          assert(
            /[\u3400-\u9fff]/.test(title + description),
            "Chinese initial HTML metadata, not English fallback",
          );
        if (!path) {
          assert.equal(
            await page
              .locator(`a[href="/${locale}/practice?mode=note"]`)
              .count(),
            1,
            "Localized home content and links exist without page JavaScript",
          );
          assert.equal(
            await page.locator('footer a[href="/privacy-policy"]').count(),
            1,
            "Untranslated legal destination remains unprefixed",
          );
        }
        report.ssr.push({
          url,
          status: response.status(),
          language: await page.locator("html").getAttribute("lang"),
          title,
          description,
        });
        console.log(`SSR PASS ${url}`);
      }
    for (const [path, status] of [
      ["/xx", 404],
      ["/zh/about", 404],
      ["/ko/challenge/world/w9", 404],
      ["/zh/challenge/play/not-a-stage", 404],
    ])
      assert.equal(
        (await page.goto(`${baseURL}${path}`)).status(),
        status,
        path,
      );
    for (const [path, canonical, title] of [
      ["/", `${siteURL}/`, "Note Quiz"],
      [
        "/practice",
        `${siteURL}/practice`,
        "Practice Music Notes and Ear Training | Note Quiz",
      ],
    ]) {
      await page.goto(`${baseURL}${path}`);
      assert.equal(
        await page.locator('link[rel="canonical"]').getAttribute("href"),
        canonical,
      );
      assert.equal(
        await page.title(),
        title,
        "Existing unprefixed title preserved",
      );
    }
    const xml = await (await fetch(`${baseURL}/sitemap.xml`)).text();
    assert.equal((xml.match(/<loc>/g) || []).length, 252);
    const robots = await (await fetch(`${baseURL}/robots.txt`)).text();
    assert(
      robots.includes("Allow: /") &&
        robots.includes("Disallow: /suggest") &&
        robots.includes("Sitemap: https://note-quiz.com/sitemap.xml"),
    );
    await ssr.close();

    const interactive = await context(),
      active = await interactive.newPage(),
      errors = [];
    active.on("pageerror", (error) => errors.push(error.message));
    await interactive.addInitScript(() =>
      localStorage.setItem(
        "language-storage",
        JSON.stringify({
          state: { language: "de", isInitialized: true },
          version: 0,
        }),
      ),
    );
    const query = "?share=1&mode=note&length=ten&clef=bass&input=piano&sound=0";
    await active.goto(`${baseURL}/zh/practice${query}#history`);
    const selector = active.locator(
      ".language-selector button[aria-haspopup=dialog]",
    );
    await selector.waitFor();
    await active.locator("[data-practice-mode]").waitFor();
    assert.equal(
      await selector.getAttribute("data-value"),
      "zh",
      "URL overrides persisted German",
    );
    assert.equal(await active.locator("html").getAttribute("lang"), "zh-Hans");
    assert.equal(
      await active.locator("footer").count(),
      1,
      "No duplicate localized practice footer",
    );
    assert(
      await active.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await active.screenshot({ path: `${output}/zh-practice-390.png` });
    await selector.click();
    await active
      .getByRole("menuitemradio", { name: "한국어", exact: true })
      .click();
    await active.waitForURL(`${baseURL}/ko/practice${query}#history`);
    await active.waitForFunction(() => document.documentElement.lang === "ko");
    assert.equal(await selector.getAttribute("data-value"), "ko");
    assert.equal(
      await active.evaluate(
        () =>
          JSON.parse(localStorage.getItem("language-storage")).state.language,
      ),
      "de",
      "URL language does not overwrite legacy preference",
    );
    for (const width of [360, 390, 768, 1440]) {
      await active.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      assert(
        await active.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await active.screenshot({ path: `${output}/ko-practice-${width}.png` });
    }
    await active.goto(`${baseURL}/practice${query}`);
    await selector.waitFor();
    await selector.click();
    await active
      .getByRole("menuitemradio", { name: "简体中文", exact: true })
      .click();
    await active.waitForFunction(
      () => document.documentElement.lang === "zh-Hans",
    );
    assert.equal(
      active.url(),
      `${baseURL}/practice${query}`,
      "Unprefixed selector does not navigate",
    );
    assert.equal(await selector.getAttribute("data-value"), "zh");
    assert.equal(
      await active.evaluate(
        () =>
          JSON.parse(localStorage.getItem("language-storage")).state.language,
      ),
      "zh",
    );
    await active.getByRole("button", { name: "开始练习", exact: true }).click();
    await active.getByRole("button", { name: "C#4", exact: true }).click();
    await active.getByRole("button", { name: "结束练习", exact: true }).click();
    await active
      .getByRole("region", { name: "练习结果", exact: true })
      .waitFor();
    await active.setViewportSize({ width: 360, height: 800 });
    assert(
      await active.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await active.screenshot({ path: `${output}/zh-practice-result-360.png` });
    await active.goto(`${baseURL}/zh`);
    for (const width of [360, 1440]) {
      await active.setViewportSize({ width, height: 900 });
      await active.getByRole("link", { name: /识谱/ }).first().waitFor();
      assert(
        await active.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await active.screenshot({ path: `${output}/zh-home-${width}.png` });
    }
    assert.deepEqual(errors, [], "No application exceptions");
    report.interactions.push(
      "URL precedence over persisted language",
      "prefixed selector preserves query and hash",
      "prefixed selector does not overwrite legacy preference",
      "unprefixed selector updates language in place",
      "single localized practice footer",
      "four-width overflow checks",
      "Chinese start-answer-result flow",
      "Chinese home and result responsive screenshots",
    );
    await interactive.close();
    console.log(
      `PASS ${report.ssr.length} initial-HTML locale checks and ${report.interactions.length} interaction contracts`,
    );
  } catch (error) {
    report.failed = String(error);
    throw error;
  } finally {
    fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
