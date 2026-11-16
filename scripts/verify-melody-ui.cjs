/* eslint-disable @typescript-eslint/no-require-imports */
// Existing production server only. Isolated Chromium; no external writes.
// Fake WAV exercises real getUserMedia/AudioWorklet, not an acoustic device.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.UI_BASE_URL || "http://localhost:3013";
const out = process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-melody-qa";
const report = {
  base,
  build: process.env.EXPECTED_BUILD_ID,
  realMicrophone: false,
  realAds: false,
  cases: [],
  errors: [],
  posts: 0,
};
const key = "note-quiz-melody-settings-v1";
const settings = {
  clef: "treble",
  keySignature: "C",
  minMidi: 60,
  maxMidi: 60,
  durations: [1],
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const button = (p, name) => p.getByRole("button", { name, exact: true });
async function reviewScore(page, mobile) {
  const score = page.locator('[data-score-review="true"]');
  await score.waitFor();
  const colors = await score.getAttribute("data-score-colors");
  assert.equal(await score.getAttribute("tabindex"), "0");
  assert.equal(
    await score.evaluate((node) => getComputedStyle(node).overflowX),
    "auto",
  );
  if (mobile) {
    assert.equal(
      await score.evaluate((node) => getComputedStyle(node).scrollbarWidth),
      "none",
    );
    await score.scrollIntoViewIfNeeded();
    const bounds = await score.boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
    const y = bounds.y + bounds.height / 2;
    const x = bounds.x + bounds.width - 30;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 6; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x - step * 25, y }],
      });
      await wait(30);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await until(
      () => score.evaluate((node) => node.scrollLeft > 20),
      "Finished score responds to horizontal touch gesture",
    );
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
    await cdp.detach();
  }
  await score.focus();
  const before = await score.evaluate((node) => node.scrollLeft);
  await page.keyboard.press("ArrowRight");
  await until(
    () =>
      score.evaluate((node) => node.scrollLeft).then((left) => left > before),
    "Finished score supports keyboard scrolling",
  );
  // Chromium can discard a wheel input while its keyboard scroll is settling.
  // Finish this gesture before switching input methods (also reproduced on plain HTML).
  await wait(350);
  await score.hover();
  await page.mouse.wheel(20000, 0);
  await until(
    () =>
      score.evaluate(
        (node) => node.scrollLeft >= node.scrollWidth - node.clientWidth - 2,
      ),
    "Review can reach the final bar",
  );
  await page.mouse.wheel(-20000, 0);
  await until(
    () => score.evaluate((node) => node.scrollLeft < 2),
    "Review can return to the first bar",
  );
  assert.equal(await score.getAttribute("data-score-colors"), colors);
  return { mobile, touch: mobile, keyboard: true, firstAndLastBar: true };
}
async function until(fn, message, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return;
    await wait(40);
  }
  throw new Error(message);
}
const phase = (p, value) =>
  p.waitForFunction(
    (v) =>
      document.querySelector("[data-melody-phase]")?.dataset.melodyPhase === v,
    value,
    { timeout: 45000 },
  );
function wav(file) {
  const rate = 48000,
    seconds = 36,
    length = rate * seconds,
    data = Buffer.alloc(44 + length * 2);
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) {
    const t = i / rate,
      beat = (t - 3.43) / (60 / 72),
      index = Math.floor(beat),
      part = beat - index;
    const on =
      index >= 0 && index < 32 && ![7, 15, 23].includes(index) && part < 0.82;
    const envelope = on ? Math.min(1, part * 100, (0.82 - part) * 100) : 0;
    data.writeInt16LE(
      Math.round(
        0.22 *
          envelope *
          Math.sin(2 * Math.PI * (index === 1 ? 329.627557 : 261.625565) * t) *
          32767,
      ),
      44 + i * 2,
    );
  }
  fs.writeFileSync(file, data);
}
async function context(browser, viewport, init) {
  const c = await browser.newContext({
    viewport,
    permissions: ["microphone"],
    locale: "en-US",
    reducedMotion: "reduce",
  });
  await c.route("**/*", (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.method() === "POST") report.posts++;
    if (url.pathname.startsWith("/api/leaderboard"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          entries: [],
          viewerCountry: null,
          periodDate: "2026-11-14",
        }),
      });
    if (
      url.origin !== new URL(base).origin ||
      !["GET", "HEAD"].includes(request.method())
    )
      return route.abort();
    return route.continue();
  });
  await c.addInitScript(
    ({ key, settings }) => {
      localStorage.setItem(key, JSON.stringify(settings));
      window.__mic = {
        streams: [],
        contexts: [],
        requests: 0,
        tones: [],
        cues: [],
        piano: [],
      };
      const nativeGet = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      navigator.mediaDevices.getUserMedia = async (...args) => {
        window.__mic.requests++;
        const stream = await nativeGet(...args);
        window.__mic.streams.push(stream);
        return stream;
      };
      const Native = window.AudioContext;
      window.AudioContext = class extends Native {
        constructor(...args) {
          super(...args);
          window.__mic.contexts.push(this);
        }
        createBufferSource() {
          const node = super.createBufferSource(),
            start = node.start.bind(node);
          node.start = (at) => {
            const record = { at, duration: node.buffer?.duration };
            if (node.buffer?.numberOfChannels === 2) {
              let peak = 0;
              for (let channel = 0; channel < 2; channel++)
                for (const value of node.buffer.getChannelData(channel)) {
                  if (!Number.isFinite(value))
                    throw Error("Nonfinite piano PCM");
                  peak = Math.max(peak, Math.abs(value));
                }
              window.__mic.piano.push({ ...record, peak });
            } else window.__mic.cues.push(record);
            start(at);
          };
          return node;
        }
        createOscillator() {
          const o = super.createOscillator(),
            start = o.start.bind(o);
          o.start = (at) => {
            window.__mic.tones.push({ at, hz: o.frequency.value });
            start(at);
          };
          return o;
        }
      };
    },
    { key, settings },
  );
  if (init) await c.addInitScript(init);
  const p = await c.newPage();
  p.setDefaultTimeout(20000);
  p.on("pageerror", (e) => report.errors.push(e.message));
  return { c, p };
}
async function open(p, path = "/en/melody") {
  const response = await p.goto(base + path);
  if (report.build)
    assert.ok(
      (await response.text()).includes(report.build),
      "Expected production build",
    );
  await until(() => button(p, "Start practice").isEnabled(), "Renderer ready");
  assert.equal(
    (await p.locator('[data-notation-renderer="alphaTab"] svg').count()) > 0,
    true,
  );
}
async function clean(p) {
  return p.evaluate(
    () =>
      window.__mic.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ) && window.__mic.contexts.every((c) => c.state === "closed"),
  );
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const file = out + "/melody-c4.wav";
  wav(file);
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${file}`,
    ],
  });
  async function test(name, run) {
    if (
      process.env.UI_CASE_FILTER &&
      !new RegExp(process.env.UI_CASE_FILTER).test(name)
    )
      return;
    console.log("RUN", name);
    try {
      const evidence = await run();
      report.cases.push({ name, passed: true, evidence });
      console.log("PASS", name);
    } catch (error) {
      report.cases.push({ name, passed: false, error: String(error) });
      console.log("FAIL", name, String(error));
    }
    fs.writeFileSync(out + "/report.json", JSON.stringify(report, null, 2));
  }
  for (const [size, viewport] of [
    ["mobile", { width: 390, height: 844 }],
    ["desktop", { width: 1440, height: 900 }],
  ]) {
    await test(`${size} settings, canonical routes and radio keyboard`, async () => {
      const { c, p } = await context(browser, viewport);
      try {
        await open(p, "/melody");
        assert.equal(await p.title(), "Melody Practice | Note Quiz");
        assert.equal(await p.getByRole("contentinfo").count(), 1);
        assert.equal(
          await p
            .getByText(/Worlds|Stage Challenge|Touch keyboard/, { exact: true })
            .count(),
          0,
        );
        const notation = p.locator('[data-score-rail] [role="img"]');
        const original = await notation.getAttribute("aria-label");
        if (size === "mobile") {
          await button(p, "Settings").click();
          await p.getByRole("dialog").waitFor();
        }
        const scope =
          size === "mobile"
            ? p.getByRole("dialog")
            : p.locator("[data-practice-settings]");
        await scope.getByText("Bass Clef", { exact: true }).click();
        await scope
          .getByRole("combobox", { name: "Highest note", exact: true })
          .selectOption("67");
        await scope
          .getByRole("checkbox", { name: "Eighth", exact: true })
          .check();
        // A newly selected eighth-note palette must not silently change the BPM.
        await scope.getByRole("spinbutton", { name: "Tempo (BPM)" }).fill("60");
        await scope.getByRole("button", { name: "Apply", exact: true }).click();
        await until(
          () => button(p, "Start practice").isEnabled(),
          "Applied score ready",
        );
        assert.notEqual(await notation.getAttribute("aria-label"), original);
        const saved = await p.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)),
          key,
        );
        assert.equal(saved.clef, "bass");
        assert.ok(saved.durations.includes(0.5));
        if (size === "mobile") {
          await button(p, "Settings").click();
          await p.keyboard.press("Escape");
          assert.equal(
            await button(p, "Settings").evaluate(
              (e) => e === document.activeElement,
            ),
            true,
          );
          await button(p, "Settings").click();
          await p.setViewportSize({ width: 1440, height: 900 });
          await until(
            () =>
              p
                .getByRole("dialog")
                .count()
                .then((n) => n === 0),
            "Dialog closes at desktop",
          );
          assert.notEqual(
            await p.evaluate(() => getComputedStyle(document.body).overflowY),
            "hidden",
          );
          await p.setViewportSize(viewport);
        }
        const nav = p.getByRole("navigation", { name: "Main navigation" });
        assert.equal(
          await nav
            .getByRole("link", { name: "Melody practice" })
            .getAttribute("aria-current"),
          "page",
        );
        const scoreViewport = p.locator("[data-score-viewport]");
        assert.equal(
          await scoreViewport.evaluate((e) => getComputedStyle(e).overflowX),
          "auto",
        );
        await scoreViewport.evaluate((e) => (e.scrollLeft = 500));
        assert(
          (await scoreViewport.evaluate((e) => e.scrollLeft)) > 0,
          "Ready melody permits manual score review",
        );
        await p.screenshot({ path: `${out}/${size}-melody-settings.png` });
        for (const old of [
          "/challenge",
          "/challenge/world/w1",
          "/challenge/play/w1-s1",
        ]) {
          await p.goto(base + "/ko" + old);
          assert.equal(new URL(p.url()).pathname, "/ko/melody");
        }
        await p.goto(base + "/en/practice?mode=note");
        await p.locator("[data-practice-mode] input:checked").waitFor();
        await p.locator("[data-practice-mode] input:checked").focus();
        await p.keyboard.press("ArrowRight");
        await until(
          () =>
            p
              .locator("[data-practice-mode] input:checked")
              .inputValue()
              .then((v) => v === "ear"),
          "Arrow changes mode",
        );
        await until(
          () => Promise.resolve(p.url().includes("mode=ear")),
          "Mode URL follows the radio selection",
        );
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          true,
        );
        return { saved, nativeArrowSelection: true };
      } finally {
        await c.close();
      }
    });
  }
  await test("meters, dotted notes, triplets and full tempo range", async () => {
    const evidence = [];
    const { c, p } = await context(browser, { width: 390, height: 844 });
    try {
      await open(p);
      for (const meter of ["2/4", "3/4", "4/4", "6/8"]) {
        await button(p, "Settings").click();
        const scope = p.getByRole("dialog");
        await scope.getByText(meter, { exact: true }).click();
        await scope
          .getByRole("checkbox", { name: "Include dotted notes", exact: true })
          .check();
        await scope
          .getByRole("checkbox", { name: "Eighth-note triplets", exact: true })
          .check();
        const tempo = scope.getByRole("spinbutton", {
          name: "Tempo (BPM)",
          exact: true,
        });
        await tempo.fill("181");
        assert.equal(
          await scope
            .getByRole("button", { name: "Apply", exact: true })
            .isEnabled(),
          false,
        );
        await scope.getByRole("alert").waitFor();
        await tempo.fill("72");
        assert.equal(await scope.getByRole("alert").count(), 0);
        await scope.getByRole("button", { name: "Apply", exact: true }).click();
        await until(
          () => button(p, "Start practice").isEnabled(),
          "Rhythm score ready",
        );
        const saved = await p.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)),
          key,
        );
        assert.deepEqual(saved.timeSignature, meter.split("/").map(Number));
        assert.equal(saved.dotted, true);
        assert.equal(saved.triplets, true);
        assert.equal(saved.bpm, 72);
        const before = await p.evaluate(() => window.__mic.cues.length);
        await button(p, "Start practice").click();
        await phase(p, "countIn");
        const count = meter === "6/8" ? 2 : Number(meter[0]),
          gap = (60 / 72) * (meter === "6/8" ? 1.5 : 1);
        await until(
          () =>
            p
              .evaluate((before) => window.__mic.cues.length - before, before)
              .then((n) => n === count),
          "Meter count-in pulses",
        );
        const tones = await p.evaluate(
          (before) => window.__mic.cues.slice(before),
          before,
        );
        for (let i = 1; i < tones.length; i++)
          assert.ok(Math.abs(tones[i].at - tones[i - 1].at - gap) < 0.001);
        const bounds = await p.evaluate(() => {
          const workspace = document
            .querySelector("[data-practice-scroll]")
            .getBoundingClientRect();
          return [
            ...document.querySelectorAll(
              "[data-melody-player] button:not(:disabled),[data-microphone-signal]",
            ),
          ]
            .filter((e) => e.getBoundingClientRect().width)
            .map((e) => ({
              text: e.textContent,
              top: e.getBoundingClientRect().top,
              bottom: e.getBoundingClientRect().bottom,
              availableBottom: workspace.bottom,
            }));
        });
        assert.ok(
          bounds.every((b) => b.top >= 0 && b.bottom <= b.availableBottom),
          "Player controls and microphone visible together",
        );
        await phase(p, "playing");
        await button(p, "End Game").click();
        await phase(p, "landing");
        assert.equal(await clean(p), true);
        evidence.push({ meter, saved, tones, bounds });
      }
      return evidence;
    } finally {
      await c.close();
    }
  });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await test(`${viewport.width} preview clock, independent beat sounds and cleanup`, async () => {
      const { c, p } = await context(browser, viewport);
      try {
        await open(p);
        if (viewport.width < 1024) await button(p, "Settings").click();
        const panel =
          viewport.width < 1024
            ? p.getByRole("dialog")
            : p.locator("[data-practice-settings]");
        const metronome = panel.getByRole("checkbox", {
          name: "Metronome on each beat",
          exact: true,
        });
        const bell = panel.getByRole("checkbox", {
          name: "Bell at the start of each measure",
          exact: true,
        });
        assert.equal(await metronome.isChecked(), false);
        assert.equal(await bell.isChecked(), false);
        await metronome.check();
        await bell.check();
        await panel.getByRole("button", { name: "Apply", exact: true }).click();
        await until(
          () => button(p, "Start practice").isEnabled(),
          "New score ready",
        );
        const geometry = await p
          .locator("[data-score-viewport]")
          .evaluate((host) => {
            let f =
              host[Object.keys(host).find((k) => k.startsWith("__reactFiber"))];
            while (f && !f.memoizedProps?.stage) f = f.return;
            const notes = f.memoizedProps.stage.events.filter(
              (e) => e.kind === "note",
            );
            const heads = [...host.querySelectorAll("text")].filter((n) => {
              const c = n.textContent.codePointAt(0);
              return c >= 0xe0a0 && c <= 0xe0ff;
            });
            const positions = heads.map((n) => {
              const r = n.getBoundingClientRect();
              return r.x + r.width / 2;
            });
            return positions
              .slice(1)
              .map(
                (x, i) =>
                  (x - positions[i]) /
                  (notes[i + 1].startBeat - notes[i].startBeat),
              );
          });
        assert.ok(
          Math.max(...geometry) / Math.min(...geometry) < 1.002,
          "Actual noteheads use equal distance per quarter, including bar boundaries",
        );
        await button(p, "Play example").click();
        await until(
          () => button(p, "Stop example").isVisible(),
          "Preview started",
        );
        assert.equal(await p.evaluate(() => window.__mic.requests), 0);
        assert.equal(await p.locator("[data-microphone-signal]").count(), 0);
        // Stop is available while loading; motion begins after sample preparation.
        await p.locator("[data-score-playhead]").waitFor({ state: "visible" });
        const samples = [];
        for (let i = 0; i < 3; i++) {
          samples.push(
            await p.evaluate(() => ({
              t: window.__mic.contexts.at(-1).currentTime,
              x: document
                .querySelector("[data-score-rail] text")
                .getBoundingClientRect().x,
            })),
          );
          await wait(350);
        }
        assert.ok(
          samples[2].x < samples[0].x - 20,
          "Preview moves real engraving",
        );
        const cues = await p.evaluate(() => window.__mic.cues);
        const piano = await p.evaluate(() => window.__mic.piano);
        assert.ok(piano.length > 0, "Preview schedules sampled stereo piano");
        assert.ok(piano.every((note) => note.peak > 0.01 && note.peak < 1));
        assert.equal(await p.evaluate(() => window.__mic.tones.length), 0);
        assert.equal(cues.length, 32);
        assert.ok(Math.abs(piano[0].at - cues[0].at) < 0.00001);
        for (let i = 1; i < cues.length; i++)
          assert.ok(Math.abs(cues[i].at - cues[i - 1].at - 60 / 72) < 0.001);
        assert.notEqual(
          cues[0].duration,
          cues[1].duration,
          "Bell and beat have distinct cues",
        );
        await p.screenshot({
          path: `${out}/${viewport.width}-preview-clock.png`,
        });
        await button(p, "Stop example").click();
        await until(() => clean(p), "Preview sources disposed");
        assert.equal(
          await p.locator("[data-score-playhead]").isVisible(),
          false,
        );
        assert.equal(await button(p, "New melody").isEnabled(), true);
        const saved = await p.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)),
          key,
        );
        assert.equal(saved.metronome, true);
        assert.equal(saved.barBell, true);
        return {
          viewport,
          geometryRange: [Math.min(...geometry), Math.max(...geometry)],
          samples,
          cues: cues.length,
          pianoNotes: piano.length,
          pianoPeakRange: [
            Math.min(...piano.map((n) => n.peak)),
            Math.max(...piano.map((n) => n.peak)),
          ],
          microphoneRequests: 0,
          cleanup: true,
        };
      } finally {
        await c.close();
      }
    });
  }
  await test("piano loading cancellation and failed download retry", async () => {
    const evidence = [];
    for (const scenario of ["cancel", "retry"]) {
      const { c, p } = await context(browser, { width: 390, height: 844 });
      let release = () => {};
      try {
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        await c.route("**/sonivox.sf2", async (route) => {
          await gate;
          await route.abort().catch(() => {});
        });
        await open(p);
        await button(p, "Play example").click();
        await p
          .getByRole("status")
          .filter({ hasText: "Preparing piano sound" })
          .waitFor();
        if (scenario === "cancel") {
          await button(p, "Stop example").click();
          release();
          await until(() => clean(p), "Cancelled loading context closes");
          assert.equal(await p.evaluate(() => window.__mic.piano.length), 0);
        } else {
          release();
          await p
            .getByRole("alert")
            .filter({ hasText: "Could not play the example" })
            .waitFor();
          await c.unroute("**/sonivox.sf2");
          await button(p, "Try again").click();
          await until(
            () => p.evaluate(() => window.__mic.piano.length > 0),
            "Retry loads piano",
          );
          await button(p, "Stop example").click();
          await until(() => clean(p), "Retried preview closes");
        }
        assert.equal(await p.evaluate(() => window.__mic.requests), 0);
        evidence.push({ scenario, microphoneRequests: 0, cleanup: true });
      } finally {
        release();
        await c.close();
      }
    }
    return evidence;
  });
  await test("compact melody controls in nine locales", async () => {
    const evidence = [];
    for (const width of [390, 1440]) {
      const { c, p } = await context(browser, {
        width,
        height: width === 390 ? 844 : 900,
      });
      try {
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
          await p.goto(`${base}/${locale}/melody`);
          const controls = await p
            .locator(
              "[data-melody-player] [data-practice-controller] button:visible",
            )
            .evaluateAll((buttons) =>
              buttons.map((b) => {
                const r = b.getBoundingClientRect();
                return {
                  text: b.textContent,
                  x: r.x,
                  y: r.y,
                  width: r.width,
                  height: r.height,
                  font: getComputedStyle(b).fontSize,
                  overflow: b.scrollWidth > b.clientWidth,
                };
              }),
            );
          assert.equal(controls.length, 2);
          assert.ok(Math.abs(controls[0].y - controls[1].y) < 1);
          assert.ok(controls[0].x + controls[0].width <= controls[1].x);
          assert.ok(
            controls.every(
              (b) => b.font === "14px" && b.height >= 44 && !b.overflow,
            ),
          );
          if (width === 390) {
            const settings = await p
              .locator("[data-melody-player] button[aria-haspopup=dialog]")
              .evaluate((b) => ({
                font: getComputedStyle(b).fontSize,
                height: b.getBoundingClientRect().height,
              }));
            assert.equal(settings.font, "14px");
            assert.equal(settings.height, 44);
          }
          if (locale === "ko")
            await p.screenshot({
              path: `${out}/${width}-compact-controls.png`,
            });
          evidence.push({ locale, width, controls });
        }
      } finally {
        await c.close();
      }
    }
    return evidence;
  });
  await test("voice WAV: four-beat approach, answers, result, retry and new melody", async () => {
    const { c, p } = await context(browser, { width: 390, height: 844 });
    try {
      await open(p);
      const reviewReady = await reviewScore(p, true);
      const notation = p.locator('[data-score-rail] [role="img"]'),
        original = await notation.getAttribute("aria-label");
      await p.evaluate(() => {
        window.__pitchStates = [];
        window.__answerToasts = [];
        const seenToasts = new WeakSet();
        new MutationObserver(() => {
          const toast = document.querySelector(
            '[data-answer-toast][data-visible="true"]',
          );
          if (!toast || seenToasts.has(toast)) return;
          seenToasts.add(toast);
          const band = toast
            .closest("[data-practice-feedback]")
            .getBoundingClientRect();
          const score = document
            .querySelector("[data-score-viewport]")
            .getBoundingClientRect();
          window.__answerToasts.push({
            text: toast.textContent,
            correct: toast.dataset.correct,
            outsideScore: band.top >= score.bottom - 1,
          });
        }).observe(document.querySelector("[data-melody-player]"), {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["data-visible"],
        });
        const surface = document.querySelector("[data-score-viewport]");
        new MutationObserver(() => {
          const value = surface.getAttribute("data-score-provisional");
          if (window.__pitchStates.at(-1) !== value)
            window.__pitchStates.push(value);
        }).observe(surface, {
          attributes: true,
          attributeFilter: ["data-score-provisional"],
        });
      });
      await button(p, "Start practice").click();
      await phase(p, "countIn");
      await until(
        () => p.evaluate(() => window.__mic.cues.length >= 4),
        "Four count clicks",
      );
      const tones = await p.evaluate(() => window.__mic.cues.slice(-4));
      assert.equal(tones.length, 4);
      for (let i = 1; i < 4; i++)
        assert.ok(Math.abs(tones[i].at - tones[i - 1].at - 60 / 72) < 0.001);
      const x1 = await p
        .locator("[data-score-rail]")
        .evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m41);
      await wait(250);
      const x2 = await p
        .locator("[data-score-rail]")
        .evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m41);
      assert.ok(x2 < x1, "Score approaches line during count-in");
      await phase(p, "playing");
      await until(
        () =>
          p
            .locator('[data-microphone-signal] [role="img"]')
            .getAttribute("aria-label")
            .then((v) => /sound detected/i.test(v)),
        "Actual microphone activity visible",
      );
      await until(
        () =>
          p
            .locator("[data-pitch-feedback]")
            .textContent()
            .then((text) => /261\.\d Hz/.test(text)),
        "Known C4 WAV displays measured frequency",
      );
      const measuredPitch = await p
        .locator("[data-pitch-feedback]")
        .textContent();
      await p.screenshot({ path: out + "/microphone-playing.png" });
      await p.keyboard.press("a");
      await p.keyboard.press("s");
      assert.equal(
        await p.locator(".piano-keyboard, [data-touch-keyboard]").count(),
        0,
      );
      await phase(p, "result");
      const colors = JSON.parse(
        await p
          .locator("[data-score-viewport]")
          .getAttribute("data-score-colors"),
      );
      assert.ok(
        Object.keys(colors).length >= 29,
        "All melody notes receive judgments",
      );
      assert.ok(
        Object.values(colors).filter((color) => color === "#15803d").length > 3,
        "Real fake-WAV capture produces matched notes",
      );
      assert.ok(
        Object.values(colors).includes("#b91c1c"),
        "The wrong second pitch receives red feedback",
      );
      assert.equal(await clean(p), true);
      const pitchStates = await p.evaluate(() => window.__pitchStates);
      assert.ok(
        pitchStates.includes("matched"),
        "Live reliable correct pitch turns green",
      );
      assert.ok(
        pitchStates.includes("incorrect"),
        "Live reliable wrong pitch turns red",
      );
      assert.ok(
        pitchStates.includes("neutral"),
        "Silence and completed notes clear provisional feedback",
      );
      const answerToasts = await p.evaluate(() => window.__answerToasts);
      assert.deepEqual(
        answerToasts,
        [],
        "Melody uses note colors without transient answer toasts",
      );
      assert.equal(await p.locator("[data-answer-toast]").count(), 0);
      const dialog = p.getByRole("dialog");
      await dialog.waitFor();
      assert.equal(await dialog.getAttribute("aria-modal"), "true");
      assert.equal(
        await dialog
          .getByRole("button", { name: "New melody", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await dialog
          .getByRole("button", { name: "Repeat this melody", exact: true })
          .count(),
        0,
      );
      await p.screenshot({ path: out + "/voice-result.png" });
      await p.locator("[data-minimize-results]").click();
      await until(() => dialog.isVisible().then((v) => !v), "Minimize results");
      const reopen = p.locator('[data-practice-action="results"]:visible');
      const retry = p.locator('[data-practice-action="retry"]:visible');
      assert.equal(
        (await reopen.boundingBox()).y,
        (await retry.boundingBox()).y,
        "Result and retry are outside the dialog in one mobile row",
      );
      assert.equal(
        await reopen.evaluate((e) => document.activeElement === e),
        true,
      );
      assert.notEqual(
        await p.evaluate(() => getComputedStyle(document.body).overflowY),
        "hidden",
      );
      const reviewMobile = await reviewScore(p, true);
      await reopen.click();
      await dialog.waitFor();
      await p.keyboard.press("Escape");
      await until(() => dialog.isVisible().then((v) => !v), "Escape results");
      await reopen.click();
      await dialog.waitFor();
      await p.setViewportSize({ width: 1440, height: 900 });
      await dialog.waitFor();
      await p.keyboard.press("Escape");
      await until(
        () => dialog.isVisible().then((v) => !v),
        "Desktop results close",
      );
      assert.notEqual(
        await p.evaluate(() => getComputedStyle(document.body).overflowY),
        "hidden",
      );
      const reviewDesktop = await reviewScore(p, false);
      await reopen.click();
      await dialog.waitFor();
      await p.setViewportSize({ width: 390, height: 844 });
      await dialog.waitFor();
      await p.keyboard.press("Escape");
      await until(
        () => dialog.isVisible().then((v) => !v),
        "Close results before retry",
      );
      await retry.click();
      await phase(p, "countIn");
      assert.equal(
        await p
          .locator("[data-score-viewport]")
          .evaluate((node) => node.scrollLeft),
        0,
        "Retry clears the manual review offset",
      );
      assert.equal(await p.locator('[data-score-review="true"]').count(), 0);
      assert.equal(await notation.getAttribute("aria-label"), original);
      await button(p, "Pause").click();
      await phase(p, "paused");
      assert.equal(await clean(p), true);
      const reviewPaused = await reviewScore(p, true);
      await button(p, "Resume from this note").click();
      await phase(p, "countIn");
      assert.equal(
        await p
          .locator("[data-score-viewport]")
          .evaluate((node) => node.scrollLeft),
        0,
      );
      await button(p, "End Game").click();
      await phase(p, "landing");
      assert.equal(await clean(p), true);
      // Broaden range before checking random content, since one-pitch/one-length scores intentionally look identical.
      await button(p, "Settings").click();
      const settingsDialog = p.getByRole("dialog");
      await settingsDialog
        .getByRole("combobox", { name: "Highest note", exact: true })
        .selectOption("67");
      await settingsDialog
        .getByRole("button", { name: "Apply", exact: true })
        .click();
      await until(
        () => button(p, "Start practice").isEnabled(),
        "New score ready",
      );
      const first = await notation.getAttribute("aria-label");
      await button(p, "New melody").click();
      await until(
        async () => (await notation.getAttribute("aria-label")) !== first,
        "Next generates fresh melody",
      );
      return {
        measuredPitch,
        pitchStates,
        answerToasts,
        reviewScroll: {
          ready: reviewReady,
          paused: reviewPaused,
          result: [reviewMobile, reviewDesktop],
        },
        resultMinimizeReopenResize: true,
        fourClicks: tones,
        prerollX: [x1, x2],
        judged: Object.keys(colors).length,
        matched: Object.values(colors).filter((c) => c === "#15803d").length,
        cleanup: true,
      };
    } finally {
      await c.close();
    }
  });
  await test("notation failure pauses and blocks resume until engraving recovers", async () => {
    const { c, p } = await context(browser, { width: 390, height: 844 });
    try {
      await open(p);
      await button(p, "Start practice").click();
      await phase(p, "playing");
      // Inject the documented renderer failure callback, not session/scoring state.
      await p.evaluate(() => {
        const node = document.querySelector("[data-score-viewport]");
        let fiber =
          node[Object.keys(node).find((k) => k.startsWith("__reactFiber"))];
        while (fiber && !fiber.memoizedProps?.stage) fiber = fiber.return;
        if (!fiber?.memoizedProps.onError)
          throw Error("Score failure callback absent");
        fiber.memoizedProps.onError(new Error("test renderer unavailable"));
      });
      await phase(p, "paused");
      assert.equal(await button(p, "Resume from this note").isEnabled(), false);
      assert.equal(await clean(p), true);
      const recovery = p
        .getByRole("alert")
        .getByRole("button", { name: "Try again", exact: true });
      await recovery.click();
      await until(
        () => button(p, "Resume from this note").isEnabled(),
        "Renderer recovery enables resume",
      );
      assert.ok((await p.locator('[data-rendered="true"]').count()) > 0);
      await button(p, "Resume from this note").click();
      await phase(p, "countIn");
      await button(p, "End Game").click();
      await phase(p, "landing");
      assert.equal(await clean(p), true);
      return {
        pausedOnFailure: true,
        blockedWithoutNotation: true,
        recoveredBeforeResume: true,
      };
    } finally {
      await c.close();
    }
  });
  await test("microphone permission refusal never offers another input", async () => {
    const { c, p } = await context(browser, { width: 390, height: 844 }, () => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("denied", "NotAllowedError");
      };
    });
    try {
      await open(p);
      await button(p, "Start practice").click();
      await phase(p, "error");
      await p
        .getByRole("alert")
        .filter({ hasText: "Allow microphone access" })
        .waitFor();
      assert.equal(await p.getByText(/touch keyboard|piano|MIDI/i).count(), 0);
      await button(p, "Try again").click();
      await phase(p, "error");
      return { errorVisible: true, retryAvailable: true };
    } finally {
      await c.close();
    }
  });
  await test("eleven locale melody routes and SEO alternatives", async () => {
    const { c, p } = await context(browser, { width: 390, height: 844 });
    try {
      const titles = {};
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
        await p.goto(`${base}/${locale}/melody`);
        await p.locator("[data-melody-scroll]").waitFor();
        titles[locale] = await p.locator("h1").textContent();
        assert.equal(
          await p.locator('link[rel="canonical"]').getAttribute("href"),
          `https://note-quiz.com/${locale}/melody`,
        );
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          true,
        );
      }
      assert.equal(new Set(Object.values(titles)).size, 11);
      return titles;
    } finally {
      await c.close();
    }
  });
  await test("melody ad reservations, dialog reachability and reduced motion", async () => {
    const evidence = [];
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      const { c, p } = await context(browser, viewport);
      try {
        await open(p);
        await p.evaluate((desktop) => {
          document.body.style.paddingBottom = "150px";
          const ad = document.createElement("div");
          ad.className = "adhesion_wrapper";
          ad.dataset.fixtureAd = "bottom";
          ad.style.cssText =
            "position:fixed;left:0;right:0;bottom:0;height:90px;background:gray";
          document.body.append(ad);
          if (desktop) {
            const side = document.createElement("div");
            side.className = "adunitwrapper";
            side.dataset.fixtureAd = "side";
            side.style.cssText =
              "position:fixed;right:0;top:100px;width:220px;height:500px;background:gray";
            document.body.append(side);
          }
        }, viewport.width > 1024);
        await until(
          () =>
            p.evaluate(
              () =>
                parseFloat(
                  getComputedStyle(document.documentElement).getPropertyValue(
                    "--ad-bottom-inset",
                  ),
                ) >= 106,
            ),
          "Ad reserved",
        );
        await p.evaluate(() =>
          window.scrollTo({ top: 9999, behavior: "instant" }),
        );
        const initial = await p.evaluate(() => {
          const workspace = document
              .querySelector("[data-practice-scroll]")
              .getBoundingClientRect(),
            ad = document
              .querySelector('[data-fixture-ad="bottom"]')
              .getBoundingClientRect();
          return {
            scrollY,
            width: innerWidth,
            docWidth: document.documentElement.scrollWidth,
            workspaceBottom: workspace.bottom,
            adTop: ad.top,
          };
        });
        assert.equal(initial.scrollY, 0);
        assert.ok(initial.docWidth <= initial.width + 1);
        assert.ok(initial.workspaceBottom < initial.adTop);
        if (viewport.width < 1024) await button(p, "Settings").click();
        const scope =
          viewport.width < 1024
            ? p.getByRole("dialog")
            : p.locator("[data-practice-settings]");
        const apply = scope.getByRole("button", { name: "Apply", exact: true });
        await apply.scrollIntoViewIfNeeded();
        const action = await apply.evaluate((element) => {
          const r = element.getBoundingClientRect();
          return {
            rect: r.toJSON(),
            hit: element.contains(
              document.elementFromPoint(
                r.left + r.width / 2,
                r.top + r.height / 2,
              ),
            ),
            ad: document
              .querySelector('[data-fixture-ad="bottom"]')
              .getBoundingClientRect()
              .toJSON(),
          };
        });
        assert.equal(action.hit, true);
        assert.ok(action.rect.bottom < action.ad.top);
        if (viewport.width < 1024) {
          await p.keyboard.press("Escape");
          assert.equal(
            await button(p, "Settings").evaluate(
              (e) => e === document.activeElement,
            ),
            true,
          );
        }
        await p
          .locator('footer a[href="/terms-of-service"]')
          .scrollIntoViewIfNeeded();
        const footer = await p
          .locator("footer")
          .evaluate((e) => e.getBoundingClientRect().toJSON());
        assert.ok(footer.bottom < action.ad.top);
        await p.screenshot({ path: `${out}/melody-ad-${viewport.width}.png` });
        await p.goto(base + "/en");
        const card = p.locator(".home-practice-card").first();
        await card.hover();
        assert.equal(
          await card.evaluate((e) => getComputedStyle(e).transform),
          "none",
        );
        assert.equal(
          await card.evaluate((e) => getComputedStyle(e).transitionDuration),
          "0s",
        );
        await p.emulateMedia({ reducedMotion: "no-preference" });
        await card.hover();
        await wait(220);
        assert.notEqual(
          await card.evaluate((e) => getComputedStyle(e).transform),
          "none",
        );
        evidence.push({
          viewport,
          initial,
          action,
          footer,
          reducedMotion: true,
          ordinaryHover: true,
        });
      } finally {
        await c.close();
      }
    }
    return evidence;
  });
  await browser.close();
  assert.equal(report.posts, 0, "No score posts");
  assert.deepEqual(report.errors, [], "No browser runtime errors");
  fs.writeFileSync(out + "/report.json", JSON.stringify(report, null, 2));
  if (report.cases.some((c) => !c.passed)) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  fs.writeFileSync(
    out + "/report.json",
    JSON.stringify({ ...report, fatal: String(error) }, null, 2),
  );
  process.exitCode = 1;
});
