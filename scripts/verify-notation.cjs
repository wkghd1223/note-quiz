/* eslint-disable @typescript-eslint/no-require-imports -- Optional external Playwright runtime. */
/* Focused alphaTab dev-only fixture harness; no shipped test route or API writes.
 * PLAYWRIGHT_MODULE=/path/to/playwright BROWSER_PATH=/path/to/chrome
 * UI_BASE_URL=http://localhost:3012 UI_ARTIFACT_DIR=/tmp/notation node scripts/verify-notation.cjs
 * The fixture harness uses Next development module names. Production is verified
 * separately by the unchanged practice UI and equivalence runners.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.UI_BASE_URL || "http://localhost:3012";
const output = process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-alphatab";
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {}),
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const requests = [],
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (r) => {
    if (/Bravura|alphaTab_worker/.test(r.url()))
      requests.push({ url: r.url(), status: r.status() });
  });
  await page.addInitScript(() => {
    window.__workerLive = 0;
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        window.__workerLive++;
        this.__alive = true;
      }
      terminate() {
        if (this.__alive) {
          this.__alive = false;
          window.__workerLive--;
        }
        return super.terminate();
      }
    };
  });
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === new URL(baseURL).origin
      ? route.continue()
      : route.abort(),
  );
  await page.goto(`${baseURL}/practice?mode=note&sound=0`);
  await page.getByRole("button", { name: "Start Game", exact: true }).click();
  await page.waitForSelector("[data-rendered=true]");
  const baseWorkers = await page.evaluate(() => {
    window.webpackChunk_N_E.push([
      [Math.random()],
      {},
      (r) => (window.__nr = r),
    ]);
    const req = window.__nr;
    window.__React = req(
      "(app-pages-browser)/./node_modules/next/dist/compiled/react/index.js",
    );
    window.__View = req(
      "(app-pages-browser)/./src/components/notation/AlphaTabNotationView.tsx",
    ).default;
    window.__fixture = document.createElement("div");
    Object.assign(window.__fixture.style, {
      position: "fixed",
      inset: "0 auto auto 0",
      width: "390px",
      background: "white",
      zIndex: "99999",
    });
    document.body.append(window.__fixture);
    window.__root = req(
      "(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/client.js",
    ).createRoot(window.__fixture);
    window.__draw = (score) =>
      window.__root.render(
        window.__React.createElement(
          window.__React.StrictMode,
          null,
          window.__React.createElement(window.__View, {
            score,
            accessibleLabel: score.events[0]?.id,
            width: 620,
            height: 260,
            className: "w-full h-auto",
            onRender: (r) => (window.__result = r),
            onError: (e) => (window.__error = e.message),
          }),
        ),
      );
    return window.__workerLive;
  });
  let count = 0;
  const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const note = (step, octave, alter, explicitAccidental = null) => ({
    step,
    octave,
    alter,
    explicitAccidental,
    midi: (octave + 1) * 12 + semitones[step] + alter,
  });
  async function draw(clef, keySignature, notes, chord = true) {
    const id = `fixture-${++count}`;
    console.log("DRAW", id, clef, keySignature);
    const score = {
      clef,
      keySignature,
      events: chord
        ? [{ id, duration: 4, notes }]
        : notes.map((n, i) => ({
            id: i ? `${id}-${i}` : id,
            duration: 4,
            notes: [n],
          })),
    };
    await page.evaluate((s) => {
      window.__result = null;
      window.__draw(s);
    }, score);
    await page.waitForFunction(
      (id) => window.__result?.events[0]?.id === id || window.__error,
      id,
    );
    const result = await page.evaluate(() => ({
      result: window.__result,
      error: window.__error,
      live: window.__workerLive,
      pitches: window.__fixture.querySelector("[data-event-pitches]")?.dataset
        .eventPitches,
      glyphs: [...window.__fixture.querySelectorAll("text")].map(
        (node) => node.textContent,
      ),
    }));
    assert.equal(result.error, undefined);
    for (const b of result.result.events) {
      assert(b.x >= -1 && b.y >= -1);
      assert(b.x + b.width <= 621, JSON.stringify(b));
      assert(b.y + b.height <= 261, JSON.stringify(b));
    }
    assert.equal(result.live, baseWorkers + 1);
    const glyphs = result.glyphs.join("");
    assert(
      glyphs.includes(
        { treble: "\uE050", bass: "\uE062", alto: "\uE05C", tenor: "\uE05C" }[
          clef
        ],
      ),
      `Missing ${clef} glyph`,
    );
    assert.equal(
      [...glyphs].filter(
        (glyph) => glyph === (keySignature < 0 ? "\uE260" : "\uE262"),
      ).length >= Math.abs(keySignature),
      true,
      `Key signature ${keySignature} glyphs`,
    );
    assert.equal(
      result.pitches,
      score.events.map((e) => e.notes.map((n) => n.midi).join(",")).join(";"),
    );
    return score;
  }
  for (const clef of ["treble", "bass", "alto", "tenor"]) {
    for (let key = -7; key <= 7; key++)
      await draw(clef, key, [note("C", 4, 0)]);
    for (const n of [
      note("C", 0, -1, "flat"),
      note("B", 8, 1, "sharp"),
      note("F", 4, 0, "natural"),
      note("F", 4, 1, "sharp"),
      note("B", 4, -1, "flat"),
    ])
      await draw(clef, 1, [n]);
    await page.screenshot({ path: `${output}/${clef}.png` });
  }
  const chord = [
    note("C", 4, 0),
    note("E", 4, -1, "flat"),
    note("G", 4, 0),
    note("B", 4, -1, "flat"),
  ];
  await draw("treble", 0, chord);
  await draw("treble", 0, chord, false);
  await draw("treble", 0, [...chord].reverse(), false);
  await page.evaluate(() => {
    for (let i = 0; i < 100; i++)
      setTimeout(
        () =>
          window.__draw({
            clef: "treble",
            keySignature: 0,
            events: [
              {
                id: `rapid-${i}`,
                duration: 4,
                notes: [
                  {
                    step: "C",
                    octave: i % 9,
                    alter: 0,
                    explicitAccidental: null,
                    midi: ((i % 9) + 1) * 12,
                  },
                ],
              },
            ],
          }),
        i * 4,
      );
  });
  await page.waitForFunction(
    () => window.__result?.events[0]?.id === "rapid-99",
  );
  assert.equal(await page.evaluate(() => window.__workerLive), baseWorkers + 1);
  await page.evaluate(() => window.__root.unmount());
  await page.waitForFunction(
    (base) => window.__workerLive === base,
    baseWorkers,
  );
  assert.equal(
    await page.evaluate(() => window.__fixture.childElementCount),
    0,
  );
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert(requests.some((r) => /Bravura/.test(r.url) && r.status === 200));
  assert(requests.some((r) => /worker/.test(r.url) && r.status === 200));
  const report = {
    cases: count,
    rapidUpdates: 100,
    strictMode: true,
    unmountWorkerCleanup: true,
    errors,
    requests,
  };
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
