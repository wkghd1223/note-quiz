/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS runner with an optional, locally resolved Playwright module. */
/*
 * Regression runner for an ALREADY RUNNING Note Quiz server. Never starts a server
 * and never attaches to a user's browser. Example:
 * PLAYWRIGHT_MODULE=/path/to/playwright BROWSER_PATH=/path/to/chrome node scripts/verify-practice-ui.cjs
 * UI_BASE_URL defaults to http://localhost:3001; UI_ARTIFACT_DIR controls output.
 * GET leaderboard and POST score responses are fixtures, so no score is written.
 * Ads stay enabled. Synthetic ad wrappers, blocked storage/clipboard/audio and
 * fast-forwarded feedback/deadline clocks are labelled test fixtures, not evidence
 * of real creatives, audible output, physical touch or production analytics.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.UI_BASE_URL || "http://localhost:3001";
const output = process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-learning-qa";
const boardTitle = "Today's Nationality Leaderboard";
const emptyText =
  "No leaderboard scores yet. Complete a game to start the rankings.";
const country = { countryCode: "KR", countryName: "South Korea", flag: "🇰🇷" };
const fixture = {
  viewerCountry: country,
  periodDate: "2026-10-31",
  entries: [],
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function eventually(check, message, timeout = 15000) {
  const until = Date.now() + timeout;
  do {
    if (await check()) return;
    await pause(50);
  } while (Date.now() < until);
  throw new Error(message);
}
const en = {
  result: "Game Result",
  start: "Start Game",
  earStart: "Start Session",
  restart: "Same settings again",
  review: "Review mistakes",
  change: "Change practice or difficulty",
  dailyDone: "Completed in this browser",
  noHistory: "Complete a practice to see recent results.",
};
const mainPaths = {
  note: "/practice?share=1&mode=note&length=ten&clef=treble&key=C&above=0&below=0&sound=0&input=piano",
  ear: "/practice?share=1&mode=ear&length=ten&notes=natural&min=4&max=4&input=piano",
  interval:
    "/practice?share=1&mode=interval&length=ten&level=custom&task=interval&view=visual&intervals=M3,P5&focus=P5",
  chord:
    "/practice?share=1&mode=chord&length=ten&level=custom&task=quality&view=visual&chords=major,minor&focus=minor",
};
const choices = {
  note: "C#4",
  ear: "C4",
  interval: "Major third",
  chord: "Major",
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
    baseURL,
    fixtures: [
      "leaderboard GET",
      "score POST",
      "feedback/deadline virtual clock",
      "synthetic ad wrappers",
      "blocked platform APIs",
    ],
    realAdsVerified: false,
    liveHouseAdObservations: [],
    paidCreativesVerified: false,
    physicalDeviceVerified: false,
    audibleOutputVerified: false,
    cases: [],
    warnings: [],
  };
  let activePage;
  async function session(viewport = { width: 390, height: 844 }, init) {
    const context = await browser.newContext({
      viewport,
      locale: "en-US",
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      window.__qaAudioStarts = 0;
      const AudioContextConstructor =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) return;
      const original = AudioContextConstructor.prototype.createOscillator;
      AudioContextConstructor.prototype.createOscillator = function (...args) {
        const oscillator = original.apply(this, args),
          start = oscillator.start.bind(oscillator);
        oscillator.start = (...values) => {
          window.__qaAudioStarts++;
          return start(...values);
        };
        return oscillator;
      };
    });
    if (init) await context.addInitScript(init);
    const page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) =>
      errors.push({ message: error.message, stack: error.stack || "" }),
    );
    const api = {
      mode: "empty",
      gets: 0,
      posts: [],
      defer: false,
      pending: [],
    };
    await page.route("**/api/leaderboard**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (path === "/api/leaderboard/scores") {
        assert.equal(request.method(), "POST");
        const payload = request.postDataJSON();
        api.posts.push(payload);
        assert.equal(
          payload.mode,
          "note",
          "Only ordinary sight reading submits country points",
        );
        assert.deepEqual(
          Object.keys(payload).sort(),
          [
            "schemaVersion",
            "sessionId",
            "mode",
            "totalQuestions",
            "correctAnswers",
            "totalTime",
          ].sort(),
        );
        let points = Math.floor(
          payload.correctAnswers *
            (0.5 + payload.correctAnswers / payload.totalQuestions),
        );
        if (api.defer)
          points = await new Promise((resolve) => api.pending.push(resolve));
        await route
          .fulfill({
            status: 200,
            json: {
              ok: true,
              country,
              sessionPoints: points,
              submissionStatus: "accepted",
            },
          })
          .catch(() => {});
      } else if (path === "/api/leaderboard") {
        api.gets++;
        const mode = api.mode;
        if (mode === "slow") await pause(700);
        const rows = Array.from({ length: 10 }, (_, i) => ({
          ...country,
          countryCode: `C${i}`,
          countryName: `Country ${i + 1}`,
          rank: i + 1,
          totalScore: 1000 - i,
          totalQuestions: 20,
          totalCorrect: 18,
        }));
        await route
          .fulfill({
            status: mode === "error" ? 500 : 200,
            json: mode === "rows" ? { ...fixture, entries: rows } : fixture,
          })
          .catch(() => {});
      } else await route.continue();
    });
    const virtual = !!page.clock;
    if (virtual) await page.clock.install({ time: new Date() });
    const advance = async (ms = 1000) => {
      if (virtual) await page.clock.fastForward(ms);
      else await page.waitForTimeout(ms);
      await pause(35);
    };
    const go = async (path) => {
      const prior = api.gets;
      await page.goto(new URL(path, baseURL).toString(), {
        waitUntil: "domcontentloaded",
      });
      if (path.startsWith("/practice")) {
        await page.locator("[data-practice-mode]").waitFor();
        await eventually(
          () => Promise.resolve(api.gets > prior),
          "Practice must finish hydration",
        );
      } else await page.getByRole("heading", { level: 1 }).waitFor();
    };
    const card = () =>
      page
        .locator("main section")
        .filter({ has: page.locator("[data-practice-mode]") })
        .first();
    const result = () =>
      card().getByRole("region", { name: en.result, exact: true });
    const resultHeading = () =>
      card().getByRole("heading", { name: en.result, exact: true });
    const shot = (name) => page.screenshot({ path: `${output}/${name}.png` });
    const progress = async () => {
      const values = await card()
        .getByText(/^(?:Progress:\s*)?\d+\/\d+$/)
        .allTextContents();
      for (const value of values) {
        const match = value.match(/(\d+)\/(\d+)/);
        if (match) return { current: +match[1], limit: +match[2] };
      }
      return null;
    };
    const start = async (mode, short = true) => {
      await card()
        .getByRole("button", {
          name: mode === "ear" ? en.earStart : en.start,
          exact: true,
        })
        .click();
      if (short)
        await eventually(
          async () => !!(await progress()),
          `${mode} must start with visible short-session progress`,
        );
      else
        await card()
          .getByRole("button", {
            name:
              mode === "note"
                ? "End Game"
                : mode === "ear"
                  ? "End Session"
                  : "Finish",
            exact: true,
          })
          .waitFor();
    };
    const answer = async (mode, name = choices[mode], duplicate = false) => {
      const before = await progress();
      assert(before, `${mode} progress is visible before answer`);
      const key = card().getByRole("button", { name, exact: true });
      await eventually(
        () => key.isEnabled(),
        `${name} answer must become enabled`,
        25000,
      );
      if (duplicate) await key.dblclick({ delay: 15 });
      else await key.click();
      await eventually(
        async () => (await progress())?.current === before.current + 1,
        "One answer counts exactly once",
      );
      const notation = await card()
        .locator('svg[role="img"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("aria-label")),
        );
      await advance(1000);
      return notation;
    };
    const finishTen = async (mode, name = choices[mode]) => {
      const first = await progress();
      assert(first, `${mode} short-session progress exists`);
      const feedback = [];
      for (let index = first.current; index < first.limit; index++)
        feedback.push(await answer(mode, name));
      await resultHeading().waitFor();
      assert(
        await result().getByText("Completed", { exact: true }).isVisible(),
        "Last answer automatically completes short session",
      );
      return feedback;
    };
    const finishEarly = async (mode) => {
      await card()
        .getByRole("button", {
          name:
            mode === "note"
              ? "End Game"
              : mode === "ear"
                ? "End Session"
                : "Finish",
          exact: true,
        })
        .click();
      await resultHeading().waitFor();
    };
    const noDialog = () =>
      eventually(
        async () => (await page.getByRole("dialog").count()) === 0,
        "Dialog closes",
      );
    const unlocked = () =>
      eventually(
        () => page.evaluate(() => document.body.style.overflowY !== "hidden"),
        "Body scroll is restored",
      );
    const close = () =>
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Close", exact: true });
    const ticker = () =>
      page.getByRole("button", { name: new RegExp(`^${boardTitle}`) });
    const checkErrors = () => {
      const own = errors.filter((error) =>
        /webpack-internal|\/_next\/|src\//.test(error.stack),
      );
      assert.deepEqual(own, [], "Application JavaScript must not throw");
      report.warnings.push(...errors.filter((error) => !own.includes(error)));
    };
    return {
      context,
      page,
      api,
      advance,
      go,
      card,
      result,
      resultHeading,
      shot,
      progress,
      start,
      answer,
      finishTen,
      finishEarly,
      noDialog,
      unlocked,
      close,
      ticker,
      checkErrors,
    };
  }
  async function run(name, work) {
    if (
      process.env.UI_CASE_FILTER &&
      !new RegExp(process.env.UI_CASE_FILTER).test(name)
    ) {
      console.log(`SKIP ${name}`);
      return;
    }
    const started = Date.now();
    console.log(`RUN ${name}`);
    const evidence = await work();
    report.cases.push({
      name,
      passed: evidence?.notObserved ? null : true,
      status: evidence?.notObserved ? "not_observed" : "passed",
      milliseconds: Date.now() - started,
    });
    console.log(`${evidence?.notObserved ? "NOT OBSERVED" : "PASS"} ${name}`);
    fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  }
  try {
    for (const [size, viewport] of [
      ["mobile", { width: 390, height: 844 }],
      ["desktop", { width: 1440, height: 900 }],
    ]) {
      const s = await session(viewport),
        { page } = s;
      await run(
        `${size}: home and four ten-question → review → restart flows`,
        async () => {
          await s.go("/");
          assert.equal(await page.locator("footer").count(), 1);
          for (const path of [
            "/about",
            "/contact",
            "/privacy-policy",
            "/terms-of-service",
          ])
            assert.equal(
              await page.locator(`footer a[href="${path}"]`).count(),
              1,
            );
          for (const mode of Object.keys(mainPaths))
            assert(
              (await page.locator(`a[href*="mode=${mode}"]`).count()) >= 1,
              `${mode} home action is available`,
            );
          await s.shot(`${size}-home`);
          for (const mode of Object.keys(mainPaths)) {
            await s.go(mainPaths[mode]);
            assert.equal(
              await page.locator("[data-practice-mode]").inputValue(),
              mode,
            );
            assert.equal(
              await page.locator(".piano-keyboard").count(),
              0,
              "No disabled idle keyboard",
            );
            const beforePosts = s.api.posts.length;
            await s.start(mode);
            if (mode === "note") {
              await s.answer(mode, choices.note, true);
              // Pause while the next answer's feedback transition is still pending.
              await s
                .card()
                .getByRole("button", { name: "C#4", exact: true })
                .click();
              await s
                .card()
                .getByRole("button", { name: "Pause", exact: true })
                .click();
              await s.advance(1600);
              assert(
                await s
                  .card()
                  .getByRole("button", { name: "C#4", exact: true })
                  .isDisabled(),
              );
              await s
                .card()
                .getByRole("button", { name: "Resume", exact: true })
                .click();
              await s.advance();
            }
            await s.finishTen(mode);
            await s.shot(`${size}-${mode}-result`);
            await eventually(
              () =>
                Promise.resolve(
                  mode !== "note" || s.api.posts.length === beforePosts + 1,
                ),
              "Only ordinary eligible note session submits once",
            );
            const submitted = s.api.posts.length;
            const review = s
              .result()
              .getByRole("button", { name: en.review, exact: true });
            assert(
              await review.isEnabled(),
              "The test answers produce mistakes to review",
            );
            await review.click();
            await s.finishTen(mode);
            assert.equal(
              s.api.posts.length,
              submitted,
              "Review never resubmits country points",
            );
            await s.shot(`${size}-${mode}-review-result`);
            await s
              .result()
              .getByRole("button", { name: en.restart, exact: true })
              .click();
            await eventually(
              async () => (await s.progress())?.current === 0,
              "Same-settings restart is a fresh session",
            );
            await s.finishEarly(mode);
            await s.result().getByText("0/0", { exact: true }).waitFor();
            assert(
              await s
                .result()
                .getByRole("button", { name: en.review, exact: true })
                .isDisabled(),
              "No-answer sessions have no review",
            );
            await s
              .result()
              .getByRole("button", { name: en.change, exact: true })
              .click();
            await eventually(
              () =>
                page
                  .locator("[data-practice-mode]")
                  .evaluate((element) => element === document.activeElement),
              "Change practice returns focus to mode selector",
            );
          }
          assert(
            (await page.getByRole("table").count()) >= 1,
            "Visible local history records completed sessions",
          );
        },
      );
      await run(
        `${size}: accessible dialogs, retry and responsive settings`,
        async () => {
          s.api.mode = "slow";
          await s.go("/practice?leaderboard=open");
          const dialog = () => page.getByRole("dialog");
          await dialog().waitFor();
          assert.equal(await dialog().getAttribute("aria-modal"), "true");
          await dialog().getByRole("status").waitFor();
          await dialog().getByText(emptyText, { exact: true }).waitFor();
          assert(
            await s
              .close()
              .evaluate((element) => element === document.activeElement),
          );
          for (const key of ["Tab", "Shift+Tab", "Tab"]) {
            await page.keyboard.press(key);
            assert(
              await dialog().evaluate((element) =>
                element.contains(document.activeElement),
              ),
            );
          }
          await page.keyboard.press("Escape");
          await s.noDialog();
          await s.unlocked();
          s.api.mode = "error";
          await s.ticker().click();
          await dialog().getByRole("alert").waitFor();
          assert(!(await dialog().textContent()).includes(emptyText));
          s.api.mode = "rows";
          await dialog()
            .getByRole("button", { name: "Try again", exact: true })
            .click();
          await dialog()
            .getByText("🇰🇷 Country 10", { exact: true })
            .scrollIntoViewIfNeeded();
          await s.shot(`${size}-leaderboard`);
          await s.close().click();
          await s.noDialog();
          await s.unlocked();
          assert(
            await s
              .ticker()
              .evaluate((element) => element === document.activeElement),
          );
          const gets = s.api.gets;
          await s.ticker().click();
          await dialog().waitFor();
          await eventually(
            () => Promise.resolve(s.api.gets > gets),
            "Reopening refreshes rankings",
          );
          await page.mouse.click(2, 2);
          await s.noDialog();
          await s.unlocked();
          await s.go(mainPaths.chord);
          const settings = () =>
            s.card().getByRole("button", { name: "Settings", exact: true });
          if (size === "mobile") {
            await settings().click();
            await dialog().waitFor();
            for (let index = 0; index < 24; index++) {
              await page.keyboard.press("Tab");
              assert(
                await dialog().evaluate((element) =>
                  element.contains(document.activeElement),
                ),
              );
            }
            await s.shot(`${size}-settings`);
            await s.close().click();
            await s.noDialog();
            assert(
              await settings().evaluate(
                (element) => element === document.activeElement,
              ),
            );
            await settings().click();
            await dialog().waitFor();
            await page.keyboard.press("Escape");
            await s.noDialog();
            await s.unlocked();
            await settings().click();
            await dialog().waitFor();
            await page.mouse.click(2, 2);
            await s.noDialog();
            await settings().click();
            await dialog().waitFor();
            await page.setViewportSize({ width: 1440, height: 900 });
            await s.noDialog();
            await s.unlocked();
            await eventually(
              () => Promise.resolve(!page.url().includes("settings=open")),
              "Resize clears hidden settings query",
            );
            await page.setViewportSize(viewport);
            await s.ticker().click();
            await dialog().waitFor();
            await page.setViewportSize({ width: 1440, height: 900 });
            await dialog().waitFor();
            await page.keyboard.press("Escape");
            await s.noDialog();
            await s.unlocked();
            await page.setViewportSize(viewport);
          } else {
            await s.go("/practice?mode=chord&settings=open");
            await s.noDialog();
            await s.unlocked();
            await eventually(
              () => Promise.resolve(!page.url().includes("settings=open")),
              "Desktop uses the visible sidebar",
            );
          }
          await s.go("/practice?settings=open&leaderboard=open");
          await dialog().waitFor();
          await page.keyboard.press("Escape");
          await s.noDialog();
          await s.unlocked();
          await eventually(
            () => Promise.resolve(!page.url().includes("=open")),
            "Competing query params close to the page",
          );
          await page.evaluate(() => {
            const workspace = document.querySelector("[data-practice-scroll]");
            (workspace || window).scrollTo({ top: 100, behavior: "instant" });
          });
          await s
            .ticker()
            .evaluate((element) => element.focus({ preventScroll: true }));
          const y = await page.evaluate(
            () =>
              document.querySelector("[data-practice-scroll]")?.scrollTop ??
              window.scrollY,
          );
          await page.keyboard.press("Enter");
          await dialog().waitFor();
          await page.keyboard.press("Escape");
          await s.noDialog();
          await s.unlocked();
          assert.equal(
            await page.evaluate(
              () =>
                document.querySelector("[data-practice-scroll]")?.scrollTop ??
                window.scrollY,
            ),
            y,
          );
        },
      );
      await run(
        `${size}: synthetic ad geometry (not real creative verification)`,
        async () => {
          await s.go(mainPaths.note);
          await page.evaluate((mobile) => {
            const wrapper = document.createElement("div");
            wrapper.className = "adunitwrapper";
            wrapper.dataset.qaSyntheticAd = "true";
            wrapper.textContent = "Synthetic QA ad wrapper — no creative";
            Object.assign(
              wrapper.style,
              mobile
                ? {
                    position: "fixed",
                    bottom: "0",
                    left: "0",
                    width: "100%",
                    height: "220px",
                    background: "#d1d5db",
                    zIndex: "30",
                  }
                : {
                    position: "fixed",
                    top: "100px",
                    right: "0",
                    width: "300px",
                    height: "650px",
                    background: "#d1d5db",
                    zIndex: "30",
                  },
            );
            document.body.appendChild(wrapper);
          }, size === "mobile");
          const variable =
            size === "mobile" ? "--ad-bottom-inset" : "--ad-side-inset";
          await eventually(
            () =>
              page.evaluate(
                (name) =>
                  parseFloat(
                    document.documentElement.style.getPropertyValue(name),
                  ) > 200,
                variable,
              ),
            "Public wrapper geometry reserves space",
          );
          await s.ticker().click();
          const box = await page.getByRole("dialog").boundingBox();
          if (size === "mobile")
            assert(
              box.y + box.height <= viewport.height - 220,
              "Modal controls sit above synthetic bottom ad",
            );
          else
            assert(
              box.x + box.width <= viewport.width - 300,
              "Modal controls avoid synthetic side ad",
            );
          await s.shot(`${size}-synthetic-ad-modal`);
          await page.keyboard.press("Escape");
          await s.noDialog();
          if (size === "desktop") {
            const sidebar = await page
              .locator("aside")
              .filter({ visible: true })
              .boundingBox();
            assert(
              sidebar.x + sidebar.width <= viewport.width - 300,
              "Settings stay outside synthetic side ad",
            );
          } else {
            await s.start("note");
            const key = s
              .card()
              .getByRole("button", { name: "C4", exact: true });
            await key.scrollIntoViewIfNeeded();
            const keyBox = await key.boundingBox();
            assert(
              keyBox.y + keyBox.height <= viewport.height - 220,
              "Keyboard can scroll fully above synthetic bottom ad",
            );
            await s.shot(`${size}-synthetic-ad-keyboard`);
            await s.finishEarly("note");
          }
          await page
            .locator('[data-qa-synthetic-ad="true"]')
            .evaluateAll((elements) =>
              elements.forEach((element) => element.remove()),
            );
          await eventually(
            () =>
              page.evaluate(
                (name) =>
                  parseFloat(
                    document.documentElement.style.getPropertyValue(name),
                  ) < 100,
                variable,
              ),
            "Synthetic ad removal restores reserved space",
          );
          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
            "No horizontal page overflow",
          );
        },
      );
      await run(
        `${size}: observed live house-ad wrappers and visible controls`,
        async () => {
          await s.go(mainPaths.ear);
          await s.start("ear");
          await s.finishEarly("ear");
          const until =
            Date.now() + Number(process.env.UI_REAL_AD_WAIT_MS || 15000);
          let creativeCount = 0;
          do {
            creativeCount = await page
              .locator("a.grow-housead img")
              .evaluateAll(
                (images) =>
                  images.filter(
                    (image) =>
                      image.naturalWidth > 0 &&
                      image.getBoundingClientRect().width > 0,
                  ).length,
              );
            if (creativeCount) break;
            await pause(200);
          } while (Date.now() < until);
          if (!creativeCount) {
            report.liveHouseAdObservations.push({
              size,
              observed: false,
              reason:
                "No live house creative appeared; synthetic ad checks are separate.",
            });
            console.log(
              `NOT OBSERVED ${size}: live house creative; paid-ad overlap remains unverified`,
            );
            return { notObserved: true };
          }
          const adhesionHeight = await page
            .locator(".adhesion_wrapper,.adhesion_container")
            .evaluateAll((elements) =>
              Math.max(
                0,
                ...elements
                  .map((element) => element.getBoundingClientRect())
                  .filter(
                    (rect) =>
                      rect.width >= innerWidth * 0.55 &&
                      rect.height >= 40 &&
                      rect.top >= innerHeight * 0.5 &&
                      rect.bottom >= innerHeight - 8,
                  )
                  .map((rect) => rect.height),
              ),
            );
          if (adhesionHeight)
            await eventually(
              () =>
                page.evaluate(
                  (height) =>
                    parseFloat(
                      document.documentElement.style.getPropertyValue(
                        "--ad-bottom-inset",
                      ),
                    ) >=
                    height + 16,
                  adhesionHeight,
                ),
              "A visible live adhesion wrapper must reserve its actual bottom height",
            );
          const samples = [];
          for (const top of [0, 300, 600, 900, 1200]) {
            await page.evaluate(
              (value) =>
                (
                  document.querySelector("[data-practice-scroll]") || window
                ).scrollTo({ top: value, behavior: "instant" }),
              top,
            );
            await pause(250);
            const evidence = await page.evaluate(() => {
              const selector =
                ".adunitwrapper,[data-slot-id],[data-slotid],.mv-ad-box,.adhesion_wrapper,.adhesion_container";
              const workspaceRect = document
                .querySelector("[data-practice-scroll]")
                ?.getBoundingClientRect();
              const visibleBottom = Math.min(
                innerHeight,
                workspaceRect?.bottom ?? innerHeight,
              );
              const controls = [
                ...document.querySelectorAll(
                  "main button,main select,main input",
                ),
              ].filter((element) => {
                const r = element.getBoundingClientRect();
                return (
                  r.width > 0 &&
                  r.height > 0 &&
                  r.x + r.width / 2 > 0 &&
                  r.x + r.width / 2 < innerWidth &&
                  r.y + r.height / 2 > 0 &&
                  r.y + r.height / 2 < visibleBottom &&
                  !element.closest(selector)
                );
              });
              const overlaps = controls.flatMap((element) => {
                const rect = element.getBoundingClientRect(),
                  hit = document.elementFromPoint(
                    rect.x + rect.width / 2,
                    rect.y + rect.height / 2,
                  );
                const wrapper = hit?.closest(selector);
                return hit &&
                  hit !== element &&
                  !element.contains(hit) &&
                  wrapper
                  ? [
                      {
                        control:
                          element.getAttribute("aria-label") ||
                          element.textContent?.trim() ||
                          element.id,
                        controlRect: rect.toJSON(),
                        adId: wrapper.id,
                        adClass: wrapper.className,
                        adRect: wrapper.getBoundingClientRect().toJSON(),
                      },
                    ]
                  : [];
              });
              const cornerOverlaps = controls.flatMap((element) => {
                const rect = element.getBoundingClientRect();
                const points = [
                  [rect.left + 3, rect.top + 3],
                  [rect.right - 3, rect.top + 3],
                  [rect.left + 3, rect.bottom - 3],
                  [rect.right - 3, rect.bottom - 3],
                ];
                return points.flatMap(([x, y]) => {
                  if (x < 0 || x >= innerWidth || y < 0 || y >= visibleBottom)
                    return [];
                  const hit = document.elementFromPoint(x, y),
                    wrapper = hit?.closest(selector);
                  return hit &&
                    hit !== element &&
                    !element.contains(hit) &&
                    wrapper
                    ? [
                        {
                          control:
                            element.getAttribute("aria-label") ||
                            element.textContent?.trim() ||
                            element.id,
                          point: { x, y },
                          adId: wrapper.id,
                          adClass: wrapper.className,
                          inSettingsRail: !!wrapper.closest(
                            "[data-practice-settings]",
                          ),
                        },
                      ]
                    : [];
                });
              });
              return {
                scrollY:
                  document.querySelector("[data-practice-scroll]")?.scrollTop ??
                  scrollY,
                workspaceRect: workspaceRect?.toJSON(),
                checkedControls: controls.length,
                overlaps,
                cornerOverlaps,
              };
            });
            samples.push(evidence);
            assert.deepEqual(
              evidence.cornerOverlaps.filter(
                (overlap) => overlap.inSettingsRail,
              ),
              [],
              "Live sidebar rail must not cover any settings control corner",
            );
            if (evidence.overlaps.length) {
              await s.shot(`${size}-live-house-ad-overlap`);
              report.liveHouseAdObservations.push({
                size,
                observed: true,
                creativeCount,
                samples,
              });
              assert.deepEqual(
                evidence.overlaps,
                [],
                "Live house creative must not cover learning controls",
              );
            }
          }
          await s.ticker().click();
          await page.getByRole("dialog").waitFor();
          const dialogRect = await page.getByRole("dialog").boundingBox();
          const liveInsets = await page.evaluate(() => ({
            bottom:
              document.documentElement.style.getPropertyValue(
                "--ad-bottom-inset",
              ),
            side: document.documentElement.style.getPropertyValue(
              "--ad-dialog-side-inset",
            ),
          }));
          if (adhesionHeight)
            assert(
              dialogRect.y + dialogRect.height <=
                viewport.height - adhesionHeight,
              "Live adhesion leaves modal controls above its creative",
            );
          await s.shot(`${size}-live-house-ad-modal`);
          await page.keyboard.press("Escape");
          await s.noDialog();
          const legal = page.locator('footer a[href="/terms-of-service"]');
          await legal.scrollIntoViewIfNeeded();
          const footerSafe = await legal.evaluate((element) => {
            const r = element.getBoundingClientRect(),
              w = document
                .querySelector("[data-practice-scroll]")
                ?.getBoundingClientRect(),
              hit = document.elementFromPoint(
                r.x + r.width / 2,
                r.y + r.height / 2,
              );
            return {
              rect: r.toJSON(),
              workspace: w?.toJSON(),
              reachable:
                !!hit &&
                (hit === element || element.contains(hit)) &&
                r.bottom <= (w?.bottom ?? innerHeight),
            };
          });
          assert(
            footerSafe.reachable,
            "Common footer links remain reachable above a live bottom ad",
          );
          report.liveHouseAdObservations.push({
            size,
            observed: true,
            creativeCount,
            adhesionHeight,
            dialogRect,
            liveInsets,
            footerSafe,
            samples,
            scope:
              "Live Journey/Grow house image only; paid creatives and physical devices remain unverified.",
          });
          await s.shot(`${size}-live-house-ad-scroll`);
        },
      );
      s.checkErrors();
      await s.context.close();
    }

    const s = await session({ width: 1440, height: 900 }),
      { page } = s;
    await run("interval/chord audio and visual task variants", async () => {
      const variants = [
        [
          "interval",
          "level=beginner&task=direction&view=audio&focus=lower",
          "Higher",
        ],
        [
          "interval",
          "level=basic&task=interval&view=audio&direction=ascending",
          "Major third",
        ],
        [
          "interval",
          "level=basic&task=interval&view=audio&direction=descending",
          "Major third",
        ],
        [
          "interval",
          "level=advanced&task=interval&view=audio&direction=simultaneous&focus=TT",
          "Tritone",
        ],
        [
          "interval",
          "level=advanced&task=interval&view=visual&focus=d5",
          "Diminished fifth",
        ],
        ["chord", "level=beginner&task=quality&view=audio", "Major"],
        [
          "chord",
          "level=advanced&task=quality&view=visual&focus=min7",
          "Minor seventh",
        ],
        [
          "chord",
          "level=advanced&task=inversion&view=audio&focus=third",
          "Root position",
        ],
        [
          "chord",
          "level=basic&task=inversion&view=visual&focus=second",
          "Root position",
        ],
        [
          "chord",
          "level=basic&task=progression&view=audio&focus=I-IV-V-I",
          "I → vi → IV → V",
        ],
        [
          "chord",
          "level=basic&task=progression&view=visual&focus=I-vi-IV-V",
          "I → IV → V → I",
        ],
      ];
      for (const [mode, query, choice] of variants) {
        await s.go(`/practice?share=1&mode=${mode}&length=ten&${query}`);
        await s.start(mode);
        await s.answer(mode, choice);
        await s.finishEarly(mode);
        assert(
          await s
            .result()
            .getByText(/^[01]\/1$/, { exact: true })
            .isVisible(),
          "Variant answer is reflected in result",
        );
        await s.shot(
          `variant-${mode}-${query.replaceAll(/[^a-zA-Z0-9]/g, "-")}`,
        );
        const review = s
          .result()
          .getByRole("button", { name: en.review, exact: true });
        if (await review.isEnabled()) {
          await review.click();
          assert.equal(
            (await s.progress()).limit,
            1,
            "Variant review contains only its missed question",
          );
          await s.answer(mode, choice);
          await s.resultHeading().waitFor();
          await s.result().getByText("Completed", { exact: true }).waitFor();
        }
        await s
          .result()
          .getByRole("button", { name: en.restart, exact: true })
          .click();
        await eventually(
          async () => (await s.progress())?.limit === 10,
          "Variant restart returns to ten-question normal practice",
        );
        await s.finishEarly(mode);
      }
      assert.equal(
        s.api.posts.length,
        0,
        "New games do not contribute existing country points",
      );
    });
    await run(
      "note delayed score response cannot replace new empty result",
      async () => {
        await s.go(mainPaths.note);
        s.api.defer = true;
        await s.start("note");
        await s.finishTen("note");
        await eventually(
          () => Promise.resolve(s.api.pending.length === 1),
          "Eligible score fixture is pending",
        );
        await s
          .result()
          .getByRole("button", { name: en.restart, exact: true })
          .click();
        await s.finishEarly("note");
        await s.result().getByText("0/0", { exact: true }).waitFor();
        s.api.pending.shift()(54321);
        s.api.defer = false;
        await pause(250);
        assert(
          !(await s.result().textContent()).includes("54321"),
          "Old response must not overwrite current points",
        );
        await s
          .result()
          .getByText("Answer at least 10 questions to contribute points.", {
            exact: true,
          })
          .waitFor();
        await s.shot("note-stale-score-protection");
      },
    );
    await run(
      "timed ear boundary and mode change cancel old transitions",
      async () => {
        await s.go(mainPaths.ear);
        await page
          .getByRole("button", { name: "Reset learning history", exact: true })
          .click();
        await s.go(
          "/practice?share=1&mode=ear&length=timed&seconds=30&input=piano&notes=natural&sound=0",
        );
        await s.start("ear", false);
        await s.card().getByRole("button", { name: "C4", exact: true }).click();
        await s.advance(1000);
        await s.advance(30000);
        await s.resultHeading().waitFor();
        await s.result().getByText("30.0 sec", { exact: true }).waitFor();
        await s.result().getByText("Completed", { exact: true }).waitFor();
        const rows = await page.getByRole("table").locator("tbody tr").count();
        await s.advance(5000);
        assert.equal(
          await page.getByRole("table").locator("tbody tr").count(),
          rows,
          "Timed completion records only once",
        );
        await page.locator("[data-practice-mode]").selectOption("note");
        await s
          .card()
          .getByRole("button", { name: en.start, exact: true })
          .waitFor();
        await s.start("note");
        await s.card().getByRole("button", { name: "C4", exact: true }).click();
        await page.locator("[data-practice-mode]").selectOption("interval");
        await s.advance(2000);
        assert.equal(await s.resultHeading().count(), 0);
        assert(
          await s
            .card()
            .getByRole("button", { name: en.start, exact: true })
            .isVisible(),
        );
      },
    );
    s.checkErrors();
    await s.context.close();

    const daily = await session(),
      d = daily.page;
    await run(
      "daily question reproducibility, browser completion and replay dedupe",
      async () => {
        const path = "/practice?mode=interval&level=basic&daily=1";
        await daily.go(path);
        await daily.start("interval");
        const initial = await daily.answer("interval", "Major third");
        await daily.go(path);
        await daily.start("interval");
        const repeated = await daily.answer("interval", "Major third");
        assert.deepEqual(
          repeated,
          initial,
          "Reload reproduces first daily question",
        );
        const remaining = await daily.finishTen("interval", "Major third");
        const firstSet = [repeated, ...remaining];
        await d.getByText(en.dailyDone, { exact: true }).waitFor();
        assert.equal(await d.getByRole("table").locator("tbody tr").count(), 1);
        await daily.go(path);
        await d.getByText(en.dailyDone, { exact: true }).waitFor();
        await daily.start("interval");
        const nextSet = await daily.finishTen("interval", "Major third");
        assert.deepEqual(
          nextSet,
          firstSet,
          "Daily replay reproduces all ten question notations",
        );
        assert.equal(
          await d.getByRole("table").locator("tbody tr").count(),
          1,
          "Completed daily replay creates no duplicate record",
        );
        assert.equal(
          daily.api.posts.length,
          0,
          "Daily sessions never submit country points",
        );
        await daily
          .result()
          .getByRole("button", { name: en.change, exact: true })
          .click();
        await d
          .getByRole("button", { name: "Reset learning history", exact: true })
          .click();
        await d.getByText(en.noHistory, { exact: true }).waitFor();
        await daily.go(path);
        assert.equal(
          await d.getByText(en.dailyDone, { exact: true }).count(),
          0,
          "History reset also clears daily completion",
        );
        await daily.shot("daily-and-local-history");
      },
    );
    await run(
      "shared settings precedence, no auto start/audio and copy recovery",
      async () => {
        await daily.go(
          "/practice?share=1&mode=interval&level=basic&view=visual&direction=descending&task=interval&length=free",
        );
        const starts = await d.evaluate(() => window.__qaAudioStarts);
        await daily.advance(1000);
        assert.equal(
          await d.evaluate(() => window.__qaAudioStarts),
          starts,
          "Share entry does not play audio",
        );
        assert(
          await daily
            .card()
            .getByRole("button", { name: en.start, exact: true })
            .isVisible(),
        );
        await d
          .getByText("Preset · Difficulty · Copy practice link", {
            exact: true,
          })
          .click();
        await daily.context.grantPermissions(
          ["clipboard-read", "clipboard-write"],
          { origin: new URL(baseURL).origin },
        );
        await d
          .getByRole("button", { name: "Copy practice link", exact: true })
          .click();
        await d
          .getByText("Link copied. It shares settings only.", { exact: true })
          .waitFor();
        const copied = await d.evaluate(() => navigator.clipboard.readText());
        const shared = new URL(copied);
        assert.equal(shared.searchParams.get("mode"), "interval");
        assert.equal(shared.searchParams.get("view"), "visual");
        assert.equal(shared.searchParams.get("direction"), "descending");
        assert.equal(shared.searchParams.get("length"), "free");
        for (const key of shared.searchParams.keys())
          assert(
            !/answer|session|history|identity|complete|daily/i.test(key),
            "Only settings enter shared URL",
          );
        await d.evaluate(() =>
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
              writeText: async () => {
                throw new DOMException("Simulated denial");
              },
            },
          }),
        );
        await d
          .getByRole("button", { name: "Copy practice link", exact: true })
          .click();
        await d
          .getByText("Could not copy. Select and copy the link below.", {
            exact: true,
          })
          .waitFor();
        assert(
          (
            await d
              .getByRole("textbox", { name: "Copy practice link" })
              .inputValue()
          ).includes("share=1"),
        );
        await daily.go(
          "/practice?share=1&mode=bad&level=bad&above=999&seconds=1&min=8&max=0",
        );
        await d
          .getByText("Preset · Difficulty · Copy practice link", {
            exact: true,
          })
          .click();
        await d
          .getByText(
            "Some link settings were invalid and were replaced with safe defaults.",
            { exact: true },
          )
          .waitFor();
        assert.equal(
          await d.locator("[data-practice-mode]").inputValue(),
          "note",
        );
        assert.equal(await d.locator(".piano-keyboard").count(), 0);
        await daily.shot("malformed-share-safe-start");
        await daily.go(
          "/practice?share=1&mode=note&clef=bass&input=solfege&length=ten&sound=0",
        );
        await eventually(async () => {
          const text = await daily.card().textContent();
          return text.includes("Bass Clef") && text.includes("Solfege");
        }, "Shared bass/solfege settings become visible");
        await daily.go("/practice?mode=note");
        await eventually(async () => {
          const text = await daily.card().textContent();
          return text.includes("Bass Clef") && text.includes("Solfege");
        }, "Unshared entry preserves this browser's personal settings");
        await daily.go(
          "/practice?share=1&mode=note&clef=treble&input=piano&length=ten&sound=0",
        );
        await eventually(async () => {
          const text = await daily.card().textContent();
          return text.includes("Treble Clef") && text.includes("Piano Keys");
        }, "Explicit shared settings override saved personal settings");
        assert.equal(
          await d.locator(".piano-keyboard").count(),
          0,
          "The shared note settings still wait for user start",
        );
      },
    );
    daily.checkErrors();
    await daily.context.close();

    const midnight = await session(),
      m = midnight.page;
    await run(
      "daily UTC midnight preserves the active challenge until explicit next-day selection",
      async () => {
        assert(
          m.clock,
          "This regression requires Playwright browser-clock support",
        );
        await m.clock.setSystemTime(new Date("2026-10-31T23:59:50.000Z"));
        await midnight.go("/practice?mode=note&daily=1");
        await midnight.start("note");
        await midnight.answer("note", "C#4");
        const notation = await midnight
          .card()
          .locator("svg.staff-svg")
          .evaluate((element) => element.outerHTML);
        await midnight.advance(39000);
        await m.getByRole("heading", { name: /2026-10-31 UTC/ }).waitFor();
        assert.equal(
          (await midnight.progress()).current,
          1,
          "UTC rollover preserves current session answers",
        );
        assert.equal(
          await midnight
            .card()
            .locator("svg.staff-svg")
            .evaluate((element) => element.outerHTML),
          notation,
          "UTC rollover preserves the current question context",
        );
        const tomorrow = m.getByRole("button", {
          name: /Start today.s practice · 2026-11-01/,
        });
        await tomorrow.waitFor();
        await midnight.finishTen("note", "C#4");
        await m.getByText(en.dailyDone, { exact: true }).waitFor();
        assert(
          await midnight
            .result()
            .getByRole("button", { name: en.review, exact: true })
            .isEnabled(),
          "An old-day completion still offers its mistake review",
        );
        assert.equal(
          midnight.api.posts.length,
          0,
          "UTC-spanning daily completion submits no country points",
        );
        await tomorrow.click();
        await midnight
          .card()
          .getByRole("button", { name: en.start, exact: true })
          .waitFor();
        await m.getByRole("heading", { name: /2026-11-01 UTC/ }).waitFor();
        assert.equal(
          await m.getByText(en.dailyDone, { exact: true }).count(),
          0,
          "Completion is attached to the original daily key, not tomorrow",
        );
        // Hold the post-midnight wall-clock instant across the navigation fixture.
        const reloadInstant = await m.evaluate(() => Date.now());
        await m.clock.setFixedTime(new Date(reloadInstant));
        const previousGets = midnight.api.gets;
        await m.reload({ waitUntil: "domcontentloaded" });
        await m.locator("[data-practice-mode]").waitFor();
        await eventually(
          () => Promise.resolve(midnight.api.gets > previousGets),
          "Daily reload finishes client hydration",
        );
        await eventually(
          async () =>
            (await m.getByRole("table").locator("tbody tr").count()) === 1,
          "Stored old-day result reappears after hydration",
        );
        assert(
          (await m.evaluate(() => new Date().toISOString())).startsWith(
            "2026-11-01",
          ),
          "Reload keeps the fixture on the new UTC date",
        );
        assert.equal(
          await m.getByText(en.dailyDone, { exact: true }).count(),
          0,
          "Reload retains the new day's incomplete state",
        );
        assert.equal(
          await m.getByRole("table").locator("tbody tr").count(),
          1,
          "Only the old-day completion is recorded",
        );
        await midnight.shot("daily-utc-midnight");
      },
    );
    midnight.checkErrors();
    await midnight.context.close();

    const blocked = await session({ width: 390, height: 844 }, () =>
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("Simulated blocked storage");
        },
      }),
    );
    await run(
      "blocked browser storage still permits a full short practice",
      async () => {
        await blocked.go(mainPaths.interval);
        await blocked.page
          .getByText(
            "Browser storage is unavailable. Practice still works, but progress cannot be saved.",
            { exact: true },
          )
          .waitFor();
        await blocked.start("interval");
        await blocked.finishTen("interval");
        await blocked.resultHeading().waitFor();
        await blocked.shot("blocked-storage-result");
      },
    );
    blocked.checkErrors();
    await blocked.context.close();

    const silent = await session({ width: 390, height: 844 }, () => {
      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(window, "webkitAudioContext", {
        configurable: true,
        value: undefined,
      });
    });
    await run(
      "unsupported audio offers recovery into visual practice",
      async () => {
        await silent.go(mainPaths.ear);
        await silent
          .card()
          .getByRole("button", { name: en.earStart, exact: true })
          .click();
        await silent.page
          .getByRole("alert")
          .getByText(
            "Audio could not start. Check your sound settings and try again, or use visual practice.",
            { exact: true },
          )
          .waitFor();
        assert(
          await silent
            .card()
            .getByRole("button", { name: "Retry audio", exact: true })
            .isVisible(),
        );
        await silent.go(mainPaths.interval);
        await silent.start("interval");
        await silent.answer("interval");
        await silent.finishEarly("interval");
        await silent.resultHeading().waitFor();
        await silent.shot("unsupported-audio-visual-recovery");
      },
    );
    silent.checkErrors();
    await silent.context.close();

    const locales = await session(),
      l = locales.page;
    await run(
      "six-language small-screen settings and German desktop layout",
      async () => {
        const settingsNames = {
          en: "Settings",
          ko: "설정",
          ja: "設定",
          es: "Configuración",
          de: "Einstellungen",
          fr: "Paramètres",
        };
        for (const locale of Object.keys(settingsNames)) {
          await locales.go(mainPaths.chord);
          await l.locator("header select").first().selectOption(locale);
          const setting = locales
            .card()
            .getByRole("button", { name: settingsNames[locale], exact: true });
          await setting.click();
          const dialog = l.getByRole("dialog");
          await dialog.waitFor();
          assert.equal(
            await dialog
              .getByRole("heading", {
                name: settingsNames[locale],
                exact: true,
              })
              .count(),
            1,
          );
          assert(
            (
              await dialog
                .getByRole("button")
                .first()
                .getAttribute("aria-label")
            ).length > 0,
          );
          assert(
            await l.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          );
          await locales.shot(`locale-${locale}-mobile-settings`);
          await l.keyboard.press("Escape");
          await locales.noDialog();
        }
        await l.locator("header select").first().selectOption("de");
        await l.setViewportSize({ width: 1440, height: 900 });
        await locales.go(mainPaths.interval);
        assert(
          await l.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        );
        await locales.shot("locale-de-desktop");
        await l.setViewportSize({ width: 320, height: 640 });
        assert(
          await l.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        );
        await locales.shot("locale-de-small-screen");
      },
    );
    locales.checkErrors();
    await locales.context.close();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (activePage && !activePage.isClosed()) {
      await activePage
        .screenshot({ path: `${output}/failure.png` })
        .catch(() => {});
      console.error({ url: activePage.url() });
    }
    report.failed = String(error);
    console.error(error);
    fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
    throw error;
  } finally {
    const shutdown = setTimeout(() => {
      console.error(
        "Isolated regression browser teardown timed out; terminating this runner.",
      );
      process.exit(report.failed ? 1 : 0);
    }, 5000);
    shutdown.unref();
    await browser.close();
    clearTimeout(shutdown);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
