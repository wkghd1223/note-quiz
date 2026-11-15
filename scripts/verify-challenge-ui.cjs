/* eslint-disable @typescript-eslint/no-require-imports */
// A real browser/AudioContext, synthetic DOM key input, isolated local storage.
// No score injection. All external traffic and leaderboard writes are blocked.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.UI_BASE_URL || "http://localhost:3011";
const output = process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-challenge-qa";
const patterns = [
  [[60, 4]],
  [
    [60, 2],
    [62, 2],
  ],
  [
    [60, 2],
    [62, 1],
    [64, 1],
  ],
  [
    [64, 2],
    [67, 2],
  ],
  [
    [67, 1],
    [64, 1],
    [62, 1],
    [60, 1],
  ],
  [
    [60, 2],
    [62, 2],
    [64, 2],
    [67, 2],
  ],
  [
    [60, 2],
    [62, 2],
  ],
  [
    [60, 1],
    [62, 1],
    [64, 1],
    [67, 1],
  ],
  [
    [60, 2],
    [62, 1],
    [64, 1],
  ],
  [[67, 4]],
  [
    [64, 1],
    [62, 1],
    [60, 2],
  ],
  [
    [60, 4],
    [62, 2],
    [64, 1],
    [67, 1],
  ],
  [
    [60, 1],
    [null, 3],
  ],
  [
    [60, 1],
    [62, 1],
    [64, 1],
    [67, 1],
  ],
  [
    [60, 1],
    [60, 1],
    [62, 2],
  ],
  [
    [null, 2],
    [64, 2],
  ],
  [
    [62, 1],
    [64, 1],
    [67, 2],
  ],
  [
    [60, 1],
    [60, 1],
    [null, 2],
    [64, 2],
    [67, 2],
  ],
  [
    [60, 1],
    [62, 1],
    [64, 1],
    [67, 1],
  ],
  [
    [60, 1],
    [60, 1],
    [62, 1],
    [64, 1],
  ],
  [
    [60, 1],
    [null, 1],
    [64, 1],
    [67, 1],
  ],
  [
    [60, 1],
    [62, 1],
    [64, 2],
    [67, 1],
    [64, 1],
    [60, 2],
  ],
  [
    [60, 2],
    [null, 1],
    [62, 1],
    [64, 1],
    [67, 1],
    [64, 2],
  ],
  [
    [60, 1],
    [62, 1],
    [64, 1],
    [null, 1],
    [67, 1],
    [64, 1],
    [62, 1],
    [60, 1],
  ],
];
const bpms = [
  60, 60, 60, 65, 65, 70, 60, 65, 65, 70, 70, 75, 60, 65, 65, 70, 70, 75, 75,
  75, 80, 80, 80, 85,
];
const report = {
  baseURL,
  fixtures: [
    "DOM keyboard events timed from visible audio clock",
    "isolated browser storage",
    "all external traffic blocked",
    "leaderboard fixtures",
  ],
  physicalDeviceVerified: false,
  audibleOutputVerified: false,
  realMicrophoneVerified: false,
  realAdsVerified: false,
  cases: [],
  errors: [],
  leaderboardPosts: 0,
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "en-US",
    reducedMotion: "reduce",
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/leaderboard")) {
      if (route.request().method() === "POST") report.leaderboardPosts++;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          entries: [],
          viewerCountry: null,
          periodDate: "2026-11-14",
        }),
      });
    }
    if (url.origin !== new URL(baseURL).origin) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => report.errors.push(error.message));
  async function shot(name) {
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  }
  async function fits() {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    assert.ok(overflow <= 1, `horizontal overflow ${overflow}`);
  }
  async function caseRun(name, work) {
    try {
      await work();
      report.cases.push({ name, status: "pass" });
    } catch (error) {
      report.cases.push({ name, status: "fail", error: error.message });
      await shot(`failure-${report.cases.length}`);
      throw error;
    }
  }
  async function play(index, variation = "perfect") {
    const pattern = patterns[index],
      beat = 60 / bpms[index];
    await page
      .getByRole("button", { name: "Start challenge", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-challenge-phase]")
          ?.getAttribute("data-challenge-phase") === "playing",
    );
    const observed = await page.evaluate(
      async ({ pattern, beat, variation }) => {
        const keyFor = {
          60: "a",
          62: "s",
          64: "d",
          65: "f",
          67: "g",
          69: "h",
          71: "j",
        };
        let cursor = 0;
        const events = pattern.map(([midi, duration]) => {
          const e = {
            midi,
            start: cursor * beat,
            end: (cursor + duration) * beat,
          };
          cursor += duration;
          return e;
        });
        const sent = [];
        const keyEvent = (kind, midi) => {
          const key = keyFor[midi];
          window.dispatchEvent(
            new KeyboardEvent(kind, {
              key,
              code: `Key${key.toUpperCase()}`,
              bubbles: true,
            }),
          );
        };
        let held = null,
          index = 0;
        const deadline = performance.now() + 30000;
        while (performance.now() < deadline) {
          const root = document.querySelector("[data-challenge-phase]");
          if (root?.getAttribute("data-challenge-phase") === "result") break;
          const now = Number(root?.getAttribute("data-elapsed-seconds") || 0);
          const e = events[index];
          if (e) {
            const end =
              variation === "short"
                ? e.start + (e.end - e.start) * 0.2
                : e.end - 0.015;
            if (e.midi === null) {
              if (now >= e.end) index++;
            } else if (held === null && now >= e.start + 0.025) {
              held = variation === "wrong" ? 71 : e.midi;
              keyEvent("keydown", held);
              sent.push({ kind: "down", midi: held, time: now });
            } else if (held !== null && now >= end) {
              keyEvent("keyup", held);
              sent.push({ kind: "up", midi: held, time: now });
              held = null;
              index++;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 8));
        }
        if (held !== null) keyEvent("keyup", held);
        return sent;
      },
      { pattern, beat, variation },
    );
    await page.waitForSelector("[data-challenge-stars]", { timeout: 30000 });
    return {
      stars: Number(
        await page
          .locator("[data-challenge-stars]")
          .getAttribute("data-challenge-stars"),
      ),
      score: Number(
        await page
          .locator("[data-challenge-score]")
          .getAttribute("data-challenge-score"),
      ),
      observed,
    };
  }
  try {
    await caseRun("locked direct URL cannot award progress", async () => {
      await page.goto(`${baseURL}/challenge/play/w4-s6`);
      await page
        .getByText("Clear the previous stage first.", { exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Start challenge", exact: true })
          .isEnabled(),
        false,
      );
      await fits();
    });
    await caseRun("wrong pitch cannot be compensated by duration", async () => {
      await page.goto(`${baseURL}/challenge/play/w1-s1`);
      const result = await play(0, "wrong");
      assert.equal(result.stars, 0);
      await shot("wrong-pitch-result");
    });
    await caseRun("short correct pitch cannot earn stars", async () => {
      await page.goto(`${baseURL}/challenge/play/w1-s1`);
      const result = await play(0, "short");
      assert.equal(result.stars, 0);
      await shot("short-result");
    });
    for (let index = 0; index < 24; index++) {
      const id = `w${Math.floor(index / 6) + 1}-s${(index % 6) + 1}`;
      await caseRun(`official ${id} timed touch input / unlock`, async () => {
        await page.goto(`${baseURL}/challenge/play/${id}`);
        await fits();
        const result = await play(index);
        assert.ok(
          result.stars >= 1,
          `${id} stars=${result.stars} score=${result.score}; input=${JSON.stringify(result.observed)}`,
        );
        report.cases.push({
          name: `${id} measured result`,
          status: "evidence",
          ...result,
        });
        await shot(`${id}-result`);
      });
    }
    await caseRun(
      "progress persists and remains isolated from legacy leaderboard",
      async () => {
        await page.reload();
        const progress = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("note-quiz-challenge-v1")),
        );
        assert.equal(
          Object.values(progress.records).filter((r) => r.bestStars > 0).length,
          24,
        );
        assert.equal(report.leaderboardPosts, 0);
      },
    );
    for (const viewport of [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await caseRun(
        `responsive ${viewport.width}×${viewport.height}`,
        async () => {
          await page.setViewportSize(viewport);
          await page.goto(`${baseURL}/challenge/play/w4-s6`);
          await fits();
          await shot(`preview-${viewport.width}`);
          await page.goto(`${baseURL}/challenge`);
          await fits();
          await shot(`world-map-${viewport.width}`);
        },
      );
    }
    for (const locale of ["en", "ko", "ja", "es", "de", "fr", "zh"]) {
      await caseRun(`localized challenge ${locale}`, async () => {
        await page.goto(`${baseURL}/${locale}/challenge`);
        assert.equal(
          await page.locator("html").getAttribute("lang"),
          locale === "zh" ? "zh-Hans" : locale,
        );
        await fits();
        assert.ok(
          (
            await page.locator("link[rel=canonical]").getAttribute("href")
          ).endsWith(`/${locale}/challenge`),
        );
      });
    }
    assert.deepEqual(report.errors, []);
    assert.equal(report.leaderboardPosts, 0);
  } catch (error) {
    report.failure = error.stack;
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
  }
  console.log(
    JSON.stringify({
      output,
      cases: report.cases.length,
      failure: report.failure || null,
      leaderboardPosts: report.leaderboardPosts,
    }),
  );
})();
