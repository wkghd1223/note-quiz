/* eslint-disable @typescript-eslint/no-require-imports -- Optional external Playwright runtime. */
/*
 * Non-mutating production-server capture. API fixtures never reach a database.
 * Capture: UI_ARTIFACT_DIR=/tmp/before node scripts/verify-phase1-equivalence.cjs
 * Compare: UI_BASELINE=/tmp/before/equivalence.json UI_ARTIFACT_DIR=/tmp/after ...
 * Requires PLAYWRIGHT_MODULE and optionally BROWSER_PATH, UI_BASE_URL.
 * Only notation drawing is excluded; text, accessible names, network payloads,
 * history, answer feedback and surrounding geometry remain comparison oracles.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.UI_BASE_URL || "http://localhost:3011";
const output =
  process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-phase1-equivalence";
const country = { countryCode: "KR", countryName: "South Korea", flag: "🇰🇷" };
const paths = {
  note: "share=1&mode=note&length=ten&clef=treble&key=C&above=0&below=0&sound=0&input=piano",
  ear: "share=1&mode=ear&length=ten&notes=natural&min=4&max=4&input=piano",
  interval:
    "share=1&mode=interval&length=ten&level=custom&task=interval&view=visual&intervals=M3,P5&focus=P5",
  chord:
    "share=1&mode=chord&length=ten&level=custom&task=quality&view=visual&chords=major,minor&focus=minor",
};
const answers = {
  note: "C#4",
  ear: "C4",
  interval: "Major third",
  chord: "Major",
};
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label) {
  for (let i = 0; i < 300; i++) {
    if (await check()) return;
    await pause(50);
  }
  throw new Error(label);
}
function diff(before, after, path = "", differences = []) {
  if (
    typeof before === "number" &&
    typeof after === "number" &&
    path.includes(".geometry.")
  ) {
    if (Math.abs(before - after) > 1) differences.push({ path, before, after });
  } else if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object"
  ) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)]))
      diff(before[key], after[key], `${path}.${key}`, differences);
  } else if (before !== after) differences.push({ path, before, after });
  return differences;
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {}),
  });
  const report = {
    version: 1,
    seed: 1729,
    epoch: "2026-11-14T00:00:00Z",
    fixtures: [
      "all leaderboard requests",
      "fixed RNG and virtual clock",
      "external requests blocked",
    ],
    drawingExcluded: true,
    physicalDeviceVerified: false,
    audibleOutputVerified: false,
    cases: [],
  };
  try {
    for (const viewport of viewports)
      for (const mode of Object.keys(paths)) {
        const name = `${viewport.width}-${mode}`;
        console.log(`CAPTURE ${name}`);
        const context = await browser.newContext({
          viewport,
          locale: "en-US",
          reducedMotion: "reduce",
          serviceWorkers: "block",
        });
        await context.addInitScript(() => {
          let state = 1729;
          Math.random = () => {
            state = (state * 1664525 + 1013904223) >>> 0;
            return state / 4294967296;
          };
        });
        const page = await context.newPage();
        const network = [],
          errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await context.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url());
          if (url.pathname.startsWith("/api/leaderboard")) {
            if (request.method() === "POST") {
              const body = request.postDataJSON();
              assert.equal(url.pathname, "/api/leaderboard/scores");
              assert.equal(body.schemaVersion, 2);
              assert.equal(body.mode, "note");
              assert.equal(typeof body.sessionId, "string");
              network.push({
                method: "POST",
                path: url.pathname,
                body: { ...body, sessionId: "<session-id>" },
              });
              return route.fulfill({
                status: 200,
                json: {
                  ok: true,
                  country,
                  sessionPoints: Math.floor(
                    body.correctAnswers *
                      (0.5 + body.correctAnswers / body.totalQuestions),
                  ),
                  submissionStatus: "accepted",
                },
              });
            }
            assert.equal(request.method(), "GET");
            network.push({ method: "GET", path: url.pathname });
            return route.fulfill({
              status: 200,
              json: {
                viewerCountry: country,
                periodDate: "2026-11-14",
                entries: [],
              },
            });
          }
          if (url.origin !== new URL(baseURL).origin) return route.abort();
          if (!["GET", "HEAD"].includes(request.method()))
            throw new Error(
              `Unmocked mutation: ${request.method()} ${url.pathname}`,
            );
          return route.continue();
        });
        await page.clock.install({ time: new Date(report.epoch) });
        await page.clock.pauseAt(new Date(Date.parse(report.epoch) + 1000));
        await page.goto(`${baseURL}/practice?${paths[mode]}`, {
          waitUntil: "domcontentloaded",
        });
        await page.locator("[data-practice-mode]").waitFor();
        await until(
          () => network.some((event) => event.method === "GET"),
          "Hydration leaderboard fixture",
        );
        await page.evaluate(() => document.fonts.ready);
        const card = page
          .locator("main section")
          .filter({ has: page.locator("[data-practice-mode]") })
          .first();
        const result = () =>
          card.getByRole("region", { name: "Game Result", exact: true });
        const progress = async () => {
          const values = await card
            .getByText(/^(?:Progress:\s*)?\d+\/\d+$/)
            .allTextContents();
          return values
            .map((value) => value.match(/(\d+)\/(\d+)/))
            .filter(Boolean)
            .map((match) => ({ count: +match[1], limit: +match[2] }))[0];
        };
        const capture = async (phase) => {
          const snapshot = await card.evaluate((element) => {
            const geometry = (node) => {
              const r = node.getBoundingClientRect();
              return Object.fromEntries(
                ["x", "y", "width", "height"].map((key) => [
                  key,
                  Math.round(r[key] * 100) / 100,
                ]),
              );
            };
            const clone = element.cloneNode(true);
            clone
              .querySelectorAll("svg, canvas")
              .forEach((node) => node.remove());
            return {
              text: clone.textContent.replace(/\s+/g, " ").trim(),
              images: [...element.querySelectorAll('[role="img"]')].map(
                (node) => node.getAttribute("aria-label"),
              ),
              controls: [...element.querySelectorAll("button,select")]
                .filter((node) => node.getBoundingClientRect().width > 0)
                .map((node) => ({
                  tag: node.tagName,
                  label:
                    node.getAttribute("aria-label") ||
                    node.textContent.replace(/\s+/g, " ").trim(),
                  disabled: node.disabled,
                  value: node.tagName === "SELECT" ? node.value : undefined,
                  geometry: geometry(node),
                })),
              geometry: {
                card: geometry(element),
                main: geometry(document.querySelector("main")),
              },
              overflow:
                document.documentElement.scrollWidth > window.innerWidth,
            };
          });
          assert.equal(
            snapshot.overflow,
            false,
            `${name} ${phase}: no document overflow`,
          );
          await page.screenshot({ path: `${output}/${name}-${phase}.png` });
          return snapshot;
        };
        const entry = {
          name,
          viewport,
          mode,
          path: paths[mode],
          idle: await capture("idle"),
          answers: [],
        };
        await card
          .getByRole("button", {
            name: mode === "ear" ? "Start Session" : "Start Game",
            exact: true,
          })
          .click();
        await until(
          async () => !!(await progress()),
          "Started session progress",
        );
        entry.playing = await capture("playing");
        const finish = async (record) => {
          const current = await progress();
          assert(current, "Progress visible before answering");
          for (let index = current.count; index < current.limit; index++) {
            const button = card.getByRole("button", {
              name: answers[mode],
              exact: true,
            });
            await until(() => button.isEnabled(), "Answer enabled");
            const before = index;
            await button.click();
            await until(
              async () => (await progress())?.count === before + 1,
              "Single answer increments count",
            );
            if (record)
              entry.answers.push({
                input: answers[mode],
                count: before + 1,
                feedback: await card.evaluate((element) => {
                  const clone = element.cloneNode(true);
                  clone
                    .querySelectorAll("svg,canvas")
                    .forEach((node) => node.remove());
                  return clone.textContent.replace(/\s+/g, " ").trim();
                }),
                notation: await card
                  .locator('[role="img"]')
                  .evaluateAll((nodes) =>
                    nodes.map((node) => node.getAttribute("aria-label")),
                  ),
              });
            await page.clock.fastForward(1000);
            await pause(35);
          }
          await result().waitFor();
        };
        await finish(true);
        entry.result = await capture("result");
        const posts = network.filter((event) => event.method === "POST").length;
        assert.equal(
          posts,
          mode === "note" ? 1 : 0,
          "Only ordinary note sessions submit",
        );
        await result()
          .getByRole("button", { name: "Review mistakes", exact: true })
          .click();
        await until(async () => !!(await progress()), "Review started");
        entry.review = await capture("review");
        await finish(false);
        assert.equal(
          network.filter((event) => event.method === "POST").length,
          posts,
          "No review score submission",
        );
        entry.reviewResult = await capture("review-result");
        entry.history = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("note-quiz-learning-v1")),
        );
        await result()
          .getByRole("button", { name: "Same settings again", exact: true })
          .click();
        await until(
          async () => (await progress())?.count === 0,
          "Restart resets answers",
        );
        entry.restart = await capture("restart");
        entry.network = network;
        entry.errors = errors;
        assert.deepEqual(errors, [], "No uncaught application errors");
        report.cases.push(entry);
        fs.writeFileSync(
          `${output}/equivalence.json`,
          JSON.stringify(report, null, 2),
        );
        await context.close();
        console.log(`PASS ${name}`);
      }
    if (process.env.UI_BASELINE) {
      const baseline = JSON.parse(
        fs.readFileSync(process.env.UI_BASELINE, "utf8"),
      );
      const differences = diff(baseline, report);
      fs.writeFileSync(
        `${output}/differences.json`,
        JSON.stringify(differences, null, 2),
      );
      assert.deepEqual(
        differences,
        [],
        "Baseline semantic/network/layout equivalence (geometry tolerance 1px)",
      );
    }
    console.log(`PASS ${report.cases.length} semantic capture cases`);
  } catch (error) {
    report.failed = String(error);
    fs.writeFileSync(
      `${output}/equivalence.json`,
      JSON.stringify(report, null, 2),
    );
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
