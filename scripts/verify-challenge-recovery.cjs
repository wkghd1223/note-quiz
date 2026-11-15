/* eslint-disable @typescript-eslint/no-require-imports */
// Run against an already-running production server; never starts/stops servers.
// Isolated Chromium contexts, local-only fixtures. No operational API writes.
// UI_CASE_FILTER selects cases; UI_FAKE_MIC=0 skips the separate WAV integration.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.UI_BASE_URL || "http://localhost:3013";
const output =
  process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-challenge-recovery";
const filter =
  process.env.UI_CASE_FILTER && new RegExp(process.env.UI_CASE_FILTER);
const key = "note-quiz-challenge-v1";
const report = {
  baseURL,
  expectedBuild: process.env.EXPECTED_BUILD_ID || null,
  startedAt: new Date().toISOString(),
  evidence:
    "Browser automation; mocks and real Chromium fake-WAV capture are identified per case.",
  physicalDeviceVerified: false,
  audibleOutputVerified: false,
  physicalMicrophoneVerified: false,
  realAdsVerified: false,
  leaderboardPosts: 0,
  blockedExternalRequests: 0,
  cases: [],
};
const launch = {
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const button = (page, name) => page.getByRole("button", { name, exact: true });
const root = (page) => page.locator("[data-challenge-phase]");
async function phase(page, value) {
  await page.waitForFunction(
    (expected) =>
      document.querySelector("[data-challenge-phase]")?.dataset
        .challengePhase === expected,
    value,
  );
}
async function enabled(locator) {
  await locator.waitFor();
  for (let i = 0; i < 200; i++) {
    if (await locator.isEnabled()) return;
    await wait(50);
  }
  throw new Error(`Control stayed disabled: ${await locator.textContent()}`);
}
async function stage(page, id = "w1-s1") {
  const response = await page.goto(`${baseURL}/challenge/play/${id}`);
  if (process.env.EXPECTED_BUILD_ID)
    assert.ok(
      (await response.text()).includes(process.env.EXPECTED_BUILD_ID),
      "Expected production source build",
    );
  await root(page).waitFor();
  await enabled(button(page, "Start challenge"));
}
async function start(page, label = "Start challenge") {
  await enabled(button(page, label));
  await button(page, label).click();
  await phase(page, "playing");
}
async function finishC4(page, label = "Start challenge") {
  await start(page, label);
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector("[data-challenge-phase]")?.dataset
          .elapsedSeconds,
      ) >= 0.06,
  );
  await page.keyboard.down("a");
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector("[data-challenge-phase]")?.dataset
          .elapsedSeconds,
      ) >= 3.92,
  );
  await page.keyboard.up("a");
  await phase(page, "result");
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
  };
}
async function fits(page) {
  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    buttons: [...document.querySelectorAll("main button")]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .map((e) => ({
        text: e.textContent.trim(),
        width: e.getBoundingClientRect().width,
        height: e.getBoundingClientRect().height,
      })),
  }));
  assert.ok(
    geometry.scrollWidth <= geometry.width + 1,
    JSON.stringify(geometry),
  );
  assert.ok(
    geometry.buttons.every((b) => b.height >= 44),
    `Small touch target: ${JSON.stringify(geometry.buttons)}`,
  );
  return geometry;
}
async function isolated(browser, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 390, height: 844 },
    locale: "en-US",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    ...(options.isMobile ? { isMobile: true, hasTouch: true } : {}),
    ...(options.permissions ? { permissions: options.permissions } : {}),
  });
  await context.addInitScript(() => {
    window.__rendererWorkers = [];
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        this.__record = { url: String(args[0]), live: true };
        window.__rendererWorkers.push(this.__record);
      }
      terminate() {
        this.__record.live = false;
        return super.terminate();
      }
    };
  });
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.startsWith("/api/leaderboard")) {
      if (request.method() === "POST") report.leaderboardPosts++;
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
    if (url.origin !== new URL(baseURL).origin) {
      report.blockedExternalRequests++;
      return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) return route.abort();
    return route.continue();
  });
  if (options.init) await context.addInitScript(options.init, options.arg);
  const page = await context.newPage();
  page.setDefaultTimeout(18000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return { page, context, errors };
}
// Discover versioned renderer URLs from the served build, never hard-code hashes.
async function rendererAssets(browser) {
  const fixture = await isolated(browser);
  const scripts = [];
  const workers = [];
  const responses = [];
  fixture.page.on("worker", (worker) => workers.push(worker.url()));
  fixture.page.on("response", (response) => {
    if (new URL(response.url()).pathname.endsWith(".js")) {
      responses.push(
        response.text().then((body) => {
          if (body.includes("Failed to create worker for background rendering"))
            scripts.push(response.url());
        }),
      );
    }
  });
  try {
    await stage(fixture.page);
    await Promise.all(responses);
    assert.deepEqual(fixture.errors, []);
    assert.ok(scripts.length > 0, "Find the real alphaTab module chunk");
    const lifecycle = await fixture.page.evaluate(() => ({
      created: window.__rendererWorkers.length,
      live: window.__rendererWorkers.filter((worker) => worker.live).length,
    }));
    assert.equal(
      lifecycle.live,
      1,
      "Healthy rail must retain one live renderer worker",
    );
    assert.ok(workers.length >= 1, "Actual renderer worker was created");
    return { module: scripts[0], worker: workers.at(-1), lifecycle };
  } finally {
    await fixture.context.close();
  }
}
async function injectAds(page, width) {
  return page.evaluate((width) => {
    const specs = [
      {
        id: "qa-bottom-ad",
        className: "adhesion_wrapper",
        css: { left: "0", bottom: "0", width: "100%", height: "120px" },
      },
      ...(width >= 1024
        ? [
            {
              id: "qa-side-ad",
              className: "adunitwrapper",
              css: { right: "0", top: "80px", width: "300px", height: "500px" },
            },
          ]
        : []),
    ];
    for (const spec of specs) {
      const element = document.createElement("aside");
      element.id = spec.id;
      element.className = spec.className;
      element.dataset.qaAd = "true";
      element.textContent = "Synthetic public ad wrapper";
      Object.assign(element.style, {
        position: "fixed",
        zIndex: "10000",
        background: "rgb(254, 240, 138)",
        color: "black",
        ...spec.css,
      });
      document.body.append(element);
    }
    return specs;
  }, width);
}
async function adGeometry(page, controls, expectedPhase) {
  const evidence = [];
  for (const control of controls) {
    await control.scrollIntoViewIfNeeded();
    const item = await control.evaluate((element) => {
      const bounds = (rect) => ({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      });
      const r = element.getBoundingClientRect();
      const scroller = element
        .closest("[data-challenge-scroll]")
        .getBoundingClientRect();
      const ads = [...document.querySelectorAll("[data-qa-ad]")].map((ad) => {
        const rect = ad.getBoundingClientRect(),
          style = getComputedStyle(ad);
        return {
          id: ad.id,
          ...bounds(rect),
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          hit:
            document.elementFromPoint(
              rect.left + rect.width / 2,
              rect.top + rect.height / 2,
            ) === ad,
        };
      });
      const x = r.left + r.width / 2,
        y = r.top + r.height / 2;
      return {
        text: element.textContent.trim(),
        phase: document.querySelector("[data-challenge-phase]").dataset
          .challengePhase,
        elapsed: Number(
          document.querySelector("[data-challenge-phase]").dataset
            .elapsedSeconds,
        ),
        ...bounds(r),
        scroller: bounds(scroller),
        ads,
        hit: element.contains(document.elementFromPoint(x, y)),
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
      };
    });
    assert.equal(
      item.phase,
      expectedPhase,
      "Geometry must be measured in the intended phase",
    );
    assert.ok(item.scrollWidth <= item.viewportWidth + 1, JSON.stringify(item));
    assert.ok(
      item.hit,
      `Control center must remain reachable: ${JSON.stringify(item)}`,
    );
    assert.ok(
      item.top >= item.scroller.top - 1 &&
        item.bottom <= item.scroller.bottom + 1,
      JSON.stringify(item),
    );
    for (const ad of item.ads) {
      assert.ok(
        ad.display !== "none" &&
          ad.visibility === "visible" &&
          ad.opacity === "1" &&
          ad.hit,
        `Ad must remain visible and unobscured: ${JSON.stringify(ad)}`,
      );
      const overlap =
        item.left < ad.right &&
        item.right > ad.left &&
        item.top < ad.bottom &&
        item.bottom > ad.top;
      assert.equal(
        overlap,
        false,
        `Control/ad overlap: ${JSON.stringify(item)}`,
      );
    }
    evidence.push(item);
  }
  return evidence;
}
function writeWav(file, kind) {
  const rate = 48000,
    seconds = 12,
    length = rate * seconds;
  const bytes = Buffer.alloc(44 + length * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) {
    const t = i / rate;
    const on = t >= 4.1 && t < (kind === "short" ? 4.8 : 8.1);
    const hz = kind === "wrong" ? 329.627557 : 261.625565;
    const envelope = on
      ? Math.min(
          1,
          (t - 4.1) / 0.01,
          ((kind === "short" ? 4.8 : 8.1) - t) / 0.01,
        )
      : 0;
    bytes.writeInt16LE(
      Math.round(0.2 * envelope * Math.sin(2 * Math.PI * hz * t) * 32767),
      44 + i * 2,
    );
  }
  fs.writeFileSync(file, bytes);
  return {
    sampleRate: rate,
    duration: seconds,
    toneStart: 4.1,
    toneEnd: kind === "short" ? 4.8 : 8.1,
    pitch: kind === "wrong" ? "E4" : "C4",
  };
}
async function instrumentCapture(context) {
  await context.addInitScript(() => {
    window.__capture = {
      streams: [],
      workletFrames: 0,
      requests: 0,
      contexts: [],
    };
    const get = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (...args) => {
      window.__capture.requests++;
      const stream = await get(...args);
      window.__capture.streams.push(stream);
      return stream;
    };
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) {
        super(...args);
        window.__capture.contexts.push(this);
      }
    };
    const NativeWorkletNode = window.AudioWorkletNode;
    window.AudioWorkletNode = class extends NativeWorkletNode {
      constructor(...args) {
        super(...args);
        this.port.addEventListener("message", (event) => {
          if (event.data.type === "frame") window.__capture.workletFrames++;
        });
      }
    };
  });
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch(launch);
  async function test(name, run, options = {}) {
    if (filter && !filter.test(name)) return;
    const fixture = await isolated(browser, options);
    const entry = {
      name,
      kind: options.kind || "browser interaction",
      status: "running",
    };
    report.cases.push(entry);
    try {
      entry.evidence = await run(fixture.page, fixture.context);
      assert.deepEqual(fixture.errors, [], "Application page exceptions");
      entry.status = "pass";
      console.log(`PASS ${name}`);
    } catch (error) {
      entry.status = "fail";
      entry.error = error.stack;
      entry.pageErrors = fixture.errors;
      console.error(`FAIL ${name}: ${error.message}`);
    } finally {
      const filename = `${String(report.cases.length).padStart(2, "0")}-${name.replace(/[^a-z0-9]+/gi, "-")}.png`;
      await fixture.page
        .screenshot({ path: path.join(output, filename), fullPage: true })
        .catch(() => {});
      entry.screenshot = filename;
      await fixture.context.close();
      fs.writeFileSync(
        path.join(output, "report.json"),
        JSON.stringify(report, null, 2),
      );
    }
  }
  try {
    await test("native Space activates focused Pause and Resume; restart clears held input", async (page) => {
      await stage(page);
      await start(page);
      await page.keyboard.down("a");
      await button(page, "Pause").focus();
      await page.keyboard.press("Space");
      await phase(page, "paused");
      const frozen = await root(page).getAttribute("data-elapsed-seconds");
      await wait(300);
      assert.equal(
        await root(page).getAttribute("data-elapsed-seconds"),
        frozen,
      );
      await page.keyboard.up("a");
      await button(page, "Resume from this note").focus();
      await page.keyboard.press("Space");
      await phase(page, "countIn");
      await phase(page, "playing");
      await button(page, "Restart").click();
      await phase(page, "countIn");
      assert.equal(
        Number(await root(page).getAttribute("data-elapsed-seconds")),
        0,
      );
      await phase(page, "result");
      assert.equal(
        Number(
          await page
            .locator("[data-challenge-stars]")
            .getAttribute("data-challenge-stars"),
        ),
        0,
      );
      return { frozenElapsed: frozen, staleHeldInputAwardedStars: false };
    });
    await test(
      "background visibility and blur pause without completing attempt",
      async (page) => {
        await stage(page);
        await start(page);
        await page.evaluate(() => {
          Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true,
          });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await phase(page, "paused");
        await page.evaluate(() => delete document.hidden);
        await button(page, "Resume from this note").click();
        await phase(page, "playing");
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await phase(page, "paused");
        assert.equal(await page.locator("[data-challenge-stars]").count(), 0);
        return {
          events: [
            "mock document.hidden + visibilitychange",
            "synthetic window blur",
          ],
          resultWritten: false,
        };
      },
      {
        kind: "browser with simulated visibility/blur events; not OS backgrounding",
      },
    );
    await test(
      "Chromium browser permission denial reaches real getUserMedia fallback",
      async (page, context) => {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Browser.setPermission", {
          permission: { name: "microphone" },
          setting: "denied",
          origin: new URL(baseURL).origin,
        });
        await stage(page);
        await page.locator("#challenge-input").selectOption("voice");
        await button(page, "Check microphone").click();
        await page
          .getByRole("alert")
          .filter({ hasText: "Microphone permission was denied." })
          .waitFor();
        await button(page, "Touch keyboard").click();
        await enabled(button(page, "Start challenge"));
        await cdp.detach();
        return {
          permission: "denied by Chromium permission controller",
          getUserMediaMocked: false,
        };
      },
      {
        kind: "browser permission policy; no physical permission dialog interaction",
      },
    );
    for (const [name, message] of [
      ["NotAllowedError", "Microphone permission was denied."],
      ["NotFoundError", "No microphone is available."],
      ["NotReadableError", "The microphone could not start."],
    ]) {
      await test(
        `mock ${name} exposes explanation and touch fallback`,
        async (page) => {
          await stage(page);
          await page.locator("#challenge-input").selectOption("voice");
          await button(page, "Check microphone").click();
          await page.getByRole("alert").filter({ hasText: message }).waitFor();
          assert.equal(await page.evaluate(() => window.__permissionCalls), 1);
          await button(page, "Touch keyboard").click();
          assert.equal(
            await page.locator("#challenge-input").inputValue(),
            "touch-keyboard",
          );
          await start(page);
          await button(page, "Pause").click();
          await phase(page, "paused");
          return { requestCount: 1, fallback: "touch started and paused" };
        },
        {
          kind: "mocked getUserMedia failure",
          init: (errorName) => {
            window.__permissionCalls = 0;
            navigator.mediaDevices.getUserMedia = async () => {
              window.__permissionCalls++;
              throw new DOMException("QA device fixture", errorName);
            };
          },
          arg: name,
        },
      );
    }
    await test(
      "pending microphone permission is cancelled on navigation; late stream stopped",
      async (page) => {
        await stage(page);
        await page.locator("#challenge-input").selectOption("voice");
        await button(page, "Check microphone").click();
        await page.waitForFunction(
          () => typeof window.__resolvePermission === "function",
        );
        await page.getByRole("button", { name: /First Notes/ }).click();
        await page.waitForURL("**/challenge/world/w1");
        await page.evaluate(() =>
          window.__resolvePermission({
            getTracks: () => [{ stop: () => window.__lateTrackStopped++ }],
          }),
        );
        await page.waitForFunction(() => window.__lateTrackStopped === 1);
        return {
          lateTracksStopped: await page.evaluate(
            () => window.__lateTrackStopped,
          ),
        };
      },
      {
        kind: "mocked unresolved getUserMedia and late track",
        init: () => {
          window.__lateTrackStopped = 0;
          navigator.mediaDevices.getUserMedia = () =>
            new Promise((resolve) => {
              window.__resolvePermission = resolve;
            });
        },
      },
    );
    await test("unsupported profiles cannot start and touch restores eligibility", async (page) => {
      await stage(page);
      for (const value of ["piano-mic", "guitar-mic", "percussion-mic"]) {
        await page.locator("#challenge-input").selectOption(value);
        await page
          .getByText(
            "This input cannot reliably measure the required pitch and hold time. Use the touch keyboard.",
            { exact: true },
          )
          .waitFor();
        assert.equal(await button(page, "Start challenge").isEnabled(), false);
      }
      await page.locator("#challenge-input").selectOption("touch-keyboard");
      await enabled(button(page, "Start challenge"));
      return { refusedProfiles: ["piano-mic", "guitar-mic", "percussion-mic"] };
    });
    for (const blocked of [true, false]) {
      await test(
        `${blocked ? "blocked" : "corrupt"} storage preserves in-memory clear across routes`,
        async (page) => {
          await stage(page);
          await page.getByText(/Progress cannot be saved/).waitFor();
          const result = await finishC4(page);
          assert.ok(result.stars >= 1, JSON.stringify(result));
          await page.getByRole("link", { name: /Next stage/ }).click();
          await page.waitForURL("**/challenge/play/w1-s2");
          await enabled(button(page, "Start challenge"));
          if (!blocked)
            assert.equal(
              await page.evaluate((k) => localStorage.getItem(k), key),
              "{unreadable-fixture",
            );
          return {
            ...result,
            nextStageUnlockedInMemory: true,
            unreadableDataPreserved: !blocked,
          };
        },
        {
          kind: blocked
            ? "mock blocked localStorage"
            : "corrupt localStorage fixture",
          arg: { blocked, key },
          init: ({ blocked, key }) => {
            if (blocked)
              Object.defineProperty(window, "localStorage", {
                configurable: true,
                get() {
                  throw new DOMException("QA storage blocked", "SecurityError");
                },
              });
            else if (!sessionStorage.getItem("qa-corrupt-seeded")) {
              localStorage.setItem(key, "{unreadable-fixture");
              sessionStorage.setItem("qa-corrupt-seeded", "1");
            }
          },
        },
      );
    }
    await test("perfect rehearsal never writes official records or unlocks next stage", async (page) => {
      await stage(page);
      await page.getByRole("radio", { name: "Rehearsal", exact: true }).check();
      await button(page, "100%").click();
      const result = await finishC4(page, "Start rehearsal");
      assert.ok(result.score >= 95, JSON.stringify(result));
      assert.equal(result.stars, 0);
      const saved = await page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)),
        key,
      );
      assert.equal(Object.keys(saved.records).length, 0);
      await page.goto(`${baseURL}/challenge/play/w1-s2`);
      await page
        .getByText("Clear the previous stage first.", { exact: true })
        .waitFor();
      assert.equal(await button(page, "Start challenge").isEnabled(), false);
      return { ...result, records: saved.records, nextStageLocked: true };
    });
    await test(
      "CDP device rotation pauses and rewinds without consuming scored time",
      async (page, context) => {
        const cdp = await context.newCDPSession(page);
        const metrics = (width, height, type, angle) =>
          cdp.send("Emulation.setDeviceMetricsOverride", {
            width,
            height,
            mobile: true,
            deviceScaleFactor: 1,
            screenOrientation: { type, angle },
          });
        await metrics(390, 844, "portraitPrimary", 0);
        await stage(page);
        await page.evaluate(() => {
          window.__rotations = [];
          window.addEventListener("orientationchange", () =>
            window.__rotations.push("orientationchange"),
          );
          screen.orientation.addEventListener("change", () =>
            window.__rotations.push("screen.orientation.change"),
          );
        });
        await start(page);
        await page.waitForFunction(
          () =>
            Number(
              document.querySelector("[data-challenge-phase]").dataset
                .elapsedSeconds,
            ) >= 0.2,
        );
        await page.keyboard.down("a");
        await page.waitForFunction(
          () =>
            Number(
              document.querySelector("[data-challenge-phase]").dataset
                .elapsedSeconds,
            ) >= 1.2,
        );
        const before = Number(
          await root(page).getAttribute("data-elapsed-seconds"),
        );
        await metrics(844, 390, "landscapePrimary", 90);
        await phase(page, "paused");
        const rewound = Number(
          await root(page).getAttribute("data-elapsed-seconds"),
        );
        assert.equal(
          rewound,
          0,
          "Incomplete first target rewinds to its start",
        );
        assert.equal(
          await button(page, "C4").getAttribute("aria-pressed"),
          "false",
        );
        await page.keyboard.up("a");
        await wait(650);
        assert.equal(
          Number(await root(page).getAttribute("data-elapsed-seconds")),
          rewound,
        );
        assert.equal(await page.locator("[data-challenge-stars]").count(), 0);
        await button(page, "Resume from this note").click();
        await phase(page, "countIn");
        await phase(page, "playing");
        await page.waitForFunction(
          () =>
            Number(
              document.querySelector("[data-challenge-phase]").dataset
                .elapsedSeconds,
            ) >= 0.2,
        );
        const resumed = Number(
          await root(page).getAttribute("data-elapsed-seconds"),
        );
        assert.ok(
          resumed < 1,
          "Resume excludes rotated/paused wall-clock time",
        );
        await metrics(390, 844, "portraitPrimary", 0);
        await phase(page, "paused");
        const events = await page.evaluate(() => window.__rotations);
        assert.ok(
          events.includes("orientationchange") &&
            events.includes("screen.orientation.change"),
          JSON.stringify(events),
        );
        await cdp.detach();
        return {
          before,
          rewound,
          resumed,
          events,
          pausedWallClockMs: 650,
          scoreOrResultWritten: false,
          physicalRotation: false,
        };
      },
      {
        isMobile: true,
        kind: "actual Chromium orientation events via CDP device emulation; real session clock and pause, not physical device rotation",
      },
    );
    await test(
      "all Bravura font asset formats fail and retry reloads usable notation",
      async (page, context) => {
        let fail = true;
        const blocked = [],
          recovered = [];
        await context.route(`${baseURL}/alphatab/font/**`, (route) => {
          if (
            !/Bravura\.(woff2?|otf)$/.test(
              new URL(route.request().url()).pathname,
            )
          )
            return route.fallback();
          if (fail) {
            blocked.push(route.request().url());
            return route.abort("failed");
          }
          recovered.push(route.request().url());
          return route.fallback();
        });
        await page.goto(`${baseURL}/challenge/play/w1-s1`);
        await page
          .getByRole("alert")
          .filter({ hasText: "The score could not load." })
          .waitFor();
        assert.deepEqual(
          [
            ...new Set(
              blocked.map((url) => new URL(url).pathname.split(".").at(-1)),
            ),
          ].sort(),
          ["otf", "woff", "woff2"],
          "Every Bravura font format actually failed",
        );
        assert.equal(await button(page, "Start challenge").isEnabled(), false);
        fail = false;
        await button(page, "Try again").click();
        await enabled(button(page, "Start challenge"));
        assert.ok(
          recovered.length > 0,
          "Retry must perform a fresh font asset request",
        );
        await page
          .locator('[data-rendered="true"][data-event-pitches="60"]')
          .waitFor();
        assert.equal(
          await page
            .getByRole("alert")
            .filter({ hasText: "The score could not load." })
            .count(),
          0,
        );
        await start(page);
        await button(page, "Pause").click();
        await phase(page, "paused");
        return { blocked, recovered, realFontAssetsLoadedOnRetry: true };
      },
      {
        kind: "all real Bravura network font formats blocked, then real asset retry; no FontFace or renderer mocks",
      },
    );
    let assets;
    for (const asset of ["module", "worker"]) {
      const name = `real renderer ${asset} asset failure blocks start and retry restores notation`;
      if (filter && !filter.test(name)) continue;
      assets ??= await rendererAssets(browser);
      await test(
        name,
        async (page, context) => {
          let fail = true;
          const blocked = [],
            recovered = [];
          await context.route(assets[asset], (route) => {
            if (fail) {
              blocked.push(route.request().url());
              return route.abort("failed");
            }
            recovered.push(route.request().url());
            return route.fallback();
          });
          await page.goto(`${baseURL}/challenge/play/w1-s1`);
          await page
            .getByRole("alert")
            .filter({ hasText: "The score could not load." })
            .waitFor();
          assert.ok(
            blocked.length >= 1,
            "Actual renderer asset request must fail",
          );
          assert.equal(
            await button(page, "Start challenge").isEnabled(),
            false,
          );
          fail = false;
          await button(page, "Try again").click();
          await enabled(button(page, "Start challenge"));
          assert.ok(
            recovered.length >= 1,
            "Retry must request the real asset again",
          );
          await page.locator('[data-rendered="true"]').waitFor();
          assert.equal(
            await page
              .getByRole("alert")
              .filter({ hasText: "The score could not load." })
              .count(),
            0,
          );
          await start(page);
          await button(page, "Pause").click();
          await phase(page, "paused");
          return { assets, blocked, recovered, notationRetry: true };
        },
        {
          kind: "actual network asset failure and real alphaTab retry; no Worker or renderer mocks",
        },
      );
    }
    for (const width of [390, 1440]) {
      await test(
        `${width}px synthetic ad wrappers preserve active paused result geometry`,
        async (page) => {
          await stage(page);
          const wrappers = await injectAds(page, width);
          await page.waitForFunction(
            (side) =>
              parseInt(
                document.documentElement.style.getPropertyValue(
                  "--ad-bottom-inset",
                ),
              ) >= 136 &&
              (!side ||
                parseInt(
                  document.documentElement.style.getPropertyValue(
                    "--ad-side-inset",
                  ),
                ) >= 316),
            width >= 1024,
          );
          await start(page);
          await page.waitForFunction(
            () =>
              Number(
                document.querySelector("[data-challenge-phase]").dataset
                  .elapsedSeconds,
              ) >= 0.1,
          );
          const active = await adGeometry(
            page,
            [
              ...["C4", "D4", "E4", "F4", "G4", "A4", "B4"].map((note) =>
                button(page, note),
              ),
              button(page, "Pause"),
              button(page, "Restart"),
            ],
            "playing",
          );
          await page.screenshot({
            path: path.join(output, `ads-${width}-active.png`),
            fullPage: true,
          });
          await button(page, "Pause").click();
          await phase(page, "paused");
          const paused = await adGeometry(
            page,
            [button(page, "Resume from this note"), button(page, "Restart")],
            "paused",
          );
          await page.screenshot({
            path: path.join(output, `ads-${width}-paused.png`),
            fullPage: true,
          });
          await button(page, "Restart").click();
          await phase(page, "result");
          const result = await adGeometry(
            page,
            [
              button(page, "Try again"),
              button(page, "Practice this pattern slowly"),
              button(page, "Input"),
            ],
            "result",
          );
          return { wrappers, active, paused, result, realAdCreative: false };
        },
        {
          viewport: { width, height: width === 390 ? 844 : 900 },
          kind: "synthetic fixed ad wrappers with real AdLayoutObserver; no ad hiding or app stacking override",
        },
      );
    }
    const entryTitles = {
      en: "Stage Challenge",
      ko: "스테이지 챌린지",
      ja: "ステージチャレンジ",
      es: "Reto por etapas",
      de: "Etappen-Challenge",
      fr: "Défis par étapes",
      zh: "关卡挑战",
    };
    for (const [locale, title] of Object.entries(entryTitles)) {
      await test(`${locale} home and practice ChallengeLink entries preserve localized navigation`, async (page) => {
        const href = `/${locale}/challenge`;
        await page.goto(`${baseURL}/${locale}`);
        const home = page.getByRole("link", { name: title, exact: true });
        await home.waitFor();
        assert.equal(await home.getAttribute("href"), href);
        await home.click();
        await page.waitForURL(`${baseURL}${href}`);
        await page.goto(`${baseURL}/${locale}/practice`);
        const entry = page.getByRole("link", {
          name: title,
          exact: true,
          includeHidden: true,
        });
        await entry.waitFor({ state: "attached" });
        const details = page.locator("details").filter({ has: entry });
        assert.equal(
          await details.count(),
          1,
          "Practice entry belongs to preset/difficulty/share details",
        );
        assert.equal(await details.evaluate((e) => e.open), false);
        await details.locator("summary").click();
        await entry.waitFor({ state: "visible" });
        assert.equal(await entry.getAttribute("href"), href);
        await entry.click();
        await page.waitForURL(`${baseURL}${href}`);
        return {
          locale,
          title,
          homeHref: href,
          practiceHref: href,
          practiceDetailsExpanded: true,
        };
      });
    }
    await test(
      "390px w1-s6 single rail is ready before start and scrolls into its second bar",
      async (page) => {
        await stage(page, "w1-s6");
        assert.equal(await page.locator("[data-score-rail]").count(), 1);
        assert.equal(await button(page, "1/2").count(), 0);
        assert.equal(await button(page, "2/2").count(), 0);
        assert.equal(
          await page.locator('[data-rendered="true"]').count(),
          1,
          "All written bars share one ready alphaTab renderer",
        );
        await start(page);
        const before = await page
          .locator("[data-score-rail]")
          .evaluate((element) => element.getBoundingClientRect().x);
        const events = [
          ["a", 0],
          ["s", 2],
          ["d", 4],
          ["g", 6],
        ];
        for (let i = 0; i < events.length; i++) {
          const [key, beat] = events[i];
          await page.waitForFunction(
            (seconds) =>
              Number(
                document.querySelector("[data-challenge-phase]")?.dataset
                  .elapsedSeconds,
              ) >= seconds,
            (beat * 60) / 70 + 0.04,
          );
          if (i > 0) await page.keyboard.up(events[i - 1][0]);
          await page.keyboard.down(key);
          if (i === 2) {
            await page.waitForFunction(
              () =>
                document.querySelector("[data-score-viewport]")?.dataset
                  .scoreBar === "2",
            );
            const after = await page
              .locator("[data-score-rail]")
              .evaluate((element) => element.getBoundingClientRect().x);
            assert.ok(
              after < before - 20,
              "Actual rail must move left into the second written bar",
            );
          }
        }
        await page.waitForFunction(
          () =>
            Number(
              document.querySelector("[data-challenge-phase]")?.dataset
                .elapsedSeconds,
            ) >=
            (8 * 60) / 70 - 0.06,
        );
        await page.keyboard.up("g");
        await phase(page, "result");
        const stars = Number(
          await page
            .locator("[data-challenge-stars]")
            .getAttribute("data-challenge-stars"),
        );
        assert.ok(stars >= 1);
        return {
          presetPrerequisiteRecords: 5,
          scoreInjected: false,
          readyRails: 1,
          noBarPager: true,
          automaticallyScrolledIntoSecondBar: true,
          stars,
        };
      },
      {
        kind: "synthetic prerequisite local records and timed DOM key input; real score rendering and session scoring",
        init: (key) => {
          const records = {};
          for (let i = 1; i <= 5; i++) {
            const stageId = `w1-s${i}`;
            records[`${stageId}:touch-keyboard:touch:v1`] = {
              stageId,
              scoringVersion: 1,
              inputProfileId: "touch-keyboard",
              inputMethod: "touch",
              bestScore: 100,
              bestStars: 3,
              attempts: 1,
              lastCompletedAt: "2026-11-14T00:00:00.000Z",
            };
          }
          localStorage.setItem(
            key,
            JSON.stringify({
              version: 1,
              selectedInstrumentProfileId: "touch-keyboard",
              settings: {
                reducedMotion: false,
                metronomeEnabled: false,
                inputOffsetMs: 0,
              },
              records,
            }),
          );
        },
        arg: key,
      },
    );
    for (const width of [360, 390]) {
      await test(
        `${width}px styles, keyboard focus, reduced motion and 200 percent text zoom`,
        async (page) => {
          await stage(page);
          const color = await button(page, "Start challenge").evaluate((e) => ({
            background: getComputedStyle(e).backgroundColor,
            color: getComputedStyle(e).color,
          }));
          assert.equal(
            color.background,
            "rgb(91, 33, 182)",
            "Primary action must have visible violet background",
          );
          await page.getByText("Controls", { exact: true }).click();
          await page
            .getByRole("checkbox", {
              name: "Reduce visual motion",
              exact: true,
            })
            .check();
          await button(page, "Start challenge").focus();
          assert.equal(
            await button(page, "Start challenge").evaluate(
              (e) => e === document.activeElement,
            ),
            true,
          );
          await page.keyboard.press("Enter");
          await phase(page, "playing");
          const regular = await fits(page);
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "200%";
          });
          await fits(page);
          await button(page, "Pause").click();
          await phase(page, "paused");
          const stored = await page.evaluate(
            (k) => JSON.parse(localStorage.getItem(k)),
            key,
          );
          assert.equal(stored.settings.reducedMotion, true);
          return {
            color,
            regular,
            zoom: "root font-size 200%; browser zoom is a separate GUI check",
          };
        },
        { viewport: { width, height: width === 360 ? 800 : 844 } },
      );
    }
  } finally {
    await browser.close();
  }
  if (process.env.UI_FAKE_MIC !== "0") {
    for (const kind of ["correct", "wrong", "short"]) {
      const name = `real Chromium fake WAV ${kind} capture to Worklet to stage result`;
      if (filter && !filter.test(name)) continue;
      const file = path.join(output, `capture-${kind}.wav`),
        oracle = writeWav(file, kind);
      const micBrowser = await chromium.launch({
        ...launch,
        args: [
          "--use-fake-device-for-media-stream",
          "--use-fake-ui-for-media-stream",
          `--use-file-for-fake-audio-capture=${file}`,
        ],
      });
      const fixture = await isolated(micBrowser, {
        permissions: ["microphone"],
      });
      await instrumentCapture(fixture.context);
      const entry = {
        name,
        kind: "real Chromium fake WAV; no getUserMedia/audio-data mocks or score injection",
        oracle,
        status: "running",
      };
      report.cases.push(entry);
      const samples = [];
      try {
        await stage(fixture.page);
        await fixture.page.locator("#challenge-input").selectOption("voice");
        await button(fixture.page, "Start challenge").click();
        for (let i = 0; i < 120; i++) {
          const sample = await fixture.page.evaluate(() => ({
            phase: document.querySelector("[data-challenge-phase]")?.dataset
              .challengePhase,
            elapsed: document.querySelector("[data-challenge-phase]")?.dataset
              .elapsedSeconds,
            signal: Number(document.querySelector("meter")?.value || 0),
            text:
              document
                .querySelector("[data-challenge-phase]")
                ?.innerText.match(/\d+\.\d Hz/)?.[0] || null,
          }));
          samples.push(sample);
          if (sample.phase === "result" || sample.phase === "error") break;
          await wait(100);
        }
        await phase(fixture.page, "result");
        const score = Number(
          await fixture.page
            .locator("[data-challenge-score]")
            .getAttribute("data-challenge-score"),
        );
        const stars = Number(
          await fixture.page
            .locator("[data-challenge-stars]")
            .getAttribute("data-challenge-stars"),
        );
        const capture = await fixture.page.evaluate(() => ({
          requests: window.__capture.requests,
          frames: window.__capture.workletFrames,
          tracks: window.__capture.streams.flatMap((s) =>
            s.getTracks().map((t) => t.readyState),
          ),
          contexts: window.__capture.contexts.map((c) => c.state),
        }));
        assert.ok(capture.frames > 50, JSON.stringify(capture));
        assert.ok(
          samples.some((s) => s.signal > 0.01),
          "Tone must produce measured signal",
        );
        assert.ok(
          samples.some((s) => s.signal < 0.001),
          "Silence must produce quiet signal",
        );
        if (kind === "correct")
          assert.ok(
            stars >= 1,
            `Expected clear; score=${score}, stars=${stars}`,
          );
        else assert.equal(stars, 0, `Invalid ${kind} WAV must not clear`);
        assert.ok(
          capture.tracks.every((s) => s === "ended"),
          "Capture tracks released at result",
        );
        assert.deepEqual(fixture.errors, []);
        entry.evidence = { score, stars, capture, samples };
        entry.status = "pass";
        console.log(`PASS ${name}`);
      } catch (error) {
        entry.status = "fail";
        entry.error = error.stack;
        entry.samples = samples;
        entry.pageErrors = fixture.errors;
        console.error(`FAIL ${name}: ${error.message}`);
      } finally {
        await fixture.page
          .screenshot({
            path: path.join(output, `capture-${kind}-result.png`),
            fullPage: true,
          })
          .catch(() => {});
        await fixture.context.close();
        await micBrowser.close();
        fs.writeFileSync(
          path.join(output, "report.json"),
          JSON.stringify(report, null, 2),
        );
      }
    }
  }
  report.finishedAt = new Date().toISOString();
  report.passed = report.cases.filter((c) => c.status === "pass").length;
  report.failed = report.cases.filter((c) => c.status === "fail").length;
  fs.writeFileSync(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  assert.equal(
    report.leaderboardPosts,
    0,
    "Challenge must never post to legacy leaderboard",
  );
  console.log(
    JSON.stringify({
      passed: report.passed,
      failed: report.failed,
      leaderboardPosts: report.leaderboardPosts,
      report: path.join(output, "report.json"),
    }),
  );
  if (report.failed) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  fs.writeFileSync(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  process.exitCode = 1;
});
