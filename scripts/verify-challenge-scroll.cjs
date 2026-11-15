/* eslint-disable @typescript-eslint/no-require-imports */
// Existing production server only; controlled stage-data fixtures are identified.
// No score/event injection, no operational API writes, no server/process control.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.UI_BASE_URL || "http://localhost:3013";
const output =
  process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-scroll-final/scroll";
const expectedBuild = process.env.EXPECTED_BUILD_ID;
const filter =
  process.env.UI_CASE_FILTER && new RegExp(process.env.UI_CASE_FILTER);
const report = {
  base,
  expectedBuild,
  startedAt: new Date().toISOString(),
  evidence:
    "Production Chromium DOM/real AudioContext with timed keyboard input; conditional navigation uses mutable in-memory stage data only, not a shipping route or result/event injection.",
  physicalDevice: false,
  physicalMicrophone: false,
  audibleOutput: false,
  realAds: false,
  leaderboardPosts: 0,
  blockedExternal: 0,
  cases: [],
};
const button = (p, name) => p.getByRole("button", { name, exact: true });
const at = (p, t) =>
  p.waitForFunction(
    (t) =>
      +document.querySelector("[data-challenge-phase]")?.dataset
        .elapsedSeconds >= t,
    t,
  );
const phase = (p, s) =>
  p.waitForFunction(
    (s) =>
      document.querySelector("[data-challenge-phase]")?.dataset
        .challengePhase === s,
    s,
  );
async function goto(p, url) {
  const r = await p.goto(base + url);
  if (expectedBuild)
    assert.ok(
      (await r.text()).includes(expectedBuild),
      "Expected announced production build",
    );
}
async function ready(p) {
  await p.waitForFunction(
    () => !!document.querySelector("[data-rendered=true]"),
  );
}
async function source(p) {
  return p.evaluate(() => {
    const node = document.querySelector("[data-score-viewport]");
    let fiber =
        node[Object.keys(node).find((k) => k.startsWith("__reactFiber"))],
      view,
      attempt;
    while (fiber.return) fiber = fiber.return;
    // Host DOM can retain the alternate fiber pointer after a commit. Inspect the
    // root's current tree so read-only bounds/result observations are not stale.
    const stack = [fiber.stateNode?.current || fiber];
    while (stack.length) {
      const f = stack.pop();
      if (f.child) stack.push(f.child);
      if (f.sibling) stack.push(f.sibling);
      if (f.memoizedProps?.stage?.id && f.memoizedProps.targets) view = f;
      for (let h = f.memoizedState; h && typeof h === "object"; h = h.next) {
        const v = h.memoizedState;
        if (v?.phase && Array.isArray(v.events) && v.attemptToken !== undefined)
          attempt = v;
      }
    }
    if (!view) throw Error("Actual ScoreViewport fiber not found");
    let render;
    for (let h = view.memoizedState; h; h = h.next) {
      const v = h.memoizedState;
      if (v?.events && typeof v.width === "number" && v.measures) render = v;
    }
    return {
      stage: {
        id: view.memoizedProps.stage.id,
        events: view.memoizedProps.stage.events,
        measures: view.memoizedProps.stage.measures,
        bpm: view.memoizedProps.stage.bpm,
        barNavigation: view.memoizedProps.stage.barNavigation,
      },
      targets: view.memoizedProps.targets,
      transitions: view.memoizedProps.transitions,
      render,
      result: view.memoizedProps.result,
      copy: {
        start: view.memoizedProps.c.start,
        rehearsal: view.memoizedProps.c.rehearsal,
        startRehearsal: view.memoizedProps.c.startRehearsal,
      },
      attempt: attempt
        ? {
            phase: attempt.phase,
            events: attempt.events.map((e) => ({
              id: e.eventId,
              onset: e.onsetAudioSec,
              offset: e.offsetAudioSec,
              midi: e.observedMidi,
            })),
          }
        : null,
    };
  });
}
async function geometry(p) {
  return p.evaluate(() => {
    const root = document.querySelector("[data-challenge-phase]"),
      rail = document.querySelector("[data-score-rail]"),
      view = document.querySelector("[data-score-viewport]"),
      head = document.querySelector("[data-score-playhead]");
    const heads = [...rail.querySelectorAll("text")].filter((n) => {
      const c = n.textContent?.codePointAt(0);
      return c >= 0xe0a0 && c <= 0xe0ff;
    });
    return {
      phase: root.dataset.challengePhase,
      elapsed: +root.dataset.elapsedSeconds,
      railX: rail.getBoundingClientRect().x,
      railWidth: rail.getBoundingClientRect().width,
      playheadX: head?.getBoundingClientRect().x,
      viewportWidth: view.clientWidth,
      viewportScroll: view.scrollLeft,
      pageWidth: innerWidth,
      pageScroll: document.documentElement.scrollWidth,
      bar: +view.dataset.scoreBar,
      rewinding: view.dataset.scoreRewinding,
      colors: JSON.parse(view.dataset.scoreColors),
      heads: heads.map((n) => ({
        x: n.getBoundingClientRect().x,
        width: n.getBoundingClientRect().width,
        fill: n.getAttribute("fill") || getComputedStyle(n).fill,
      })),
      oscillators: window.__oscillatorCount,
    };
  });
}
async function waitColors(p, expected) {
  await p.waitForFunction((expected) => {
    const colors = JSON.parse(
      document.querySelector("[data-score-viewport]").dataset.scoreColors,
    );
    if (Object.keys(expected).length === 0) {
      const heads = [
        ...document.querySelectorAll("[data-score-rail] text"),
      ].filter((n) => {
        const c = n.textContent?.codePointAt(0);
        return c >= 0xe0a0 && c <= 0xe0ff;
      });
      if (
        heads.some((n) =>
          /15803d|b91c1c|21, 128, 61|185, 28, 28/i.test(
            n.getAttribute("fill") || getComputedStyle(n).fill,
          ),
        )
      )
        return false;
    }
    return (
      Object.entries(expected).every(([id, color]) => colors[id] === color) &&
      document.querySelector("[data-rendered=true]")
    );
  }, expected);
}
const keys = { 60: "a", 62: "s", 64: "d", 65: "f", 67: "g" };
async function playTargets(p, targets, wrongAfter = Infinity) {
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t.kind === "rest") continue;
    await at(p, t.startAudioSec + 0.045);
    const key =
      keys[
        i >= wrongAfter
          ? t.targetConcertMidi === 60
            ? 62
            : 60
          : t.targetConcertMidi
      ];
    await p.keyboard.down(key);
    await at(p, t.endAudioSec - 0.045);
    await p.keyboard.up(key);
  }
}
async function installFixture(p, kind) {
  await goto(p, "/challenge/play/w1-s1");
  await ready(p);
  const data = {
    repeat: {
      pitches: [60, 62],
      nav: [
        { barIndex: 0, repeatStart: true },
        { barIndex: 1, repeatCount: 2 },
      ],
    },
    dcFine: {
      pitches: [60, 62],
      nav: [
        { barIndex: 0, directions: ["fine"] },
        { barIndex: 1, directions: ["daCapoAlFine"] },
      ],
    },
    dsFine: {
      pitches: [60, 62, 64],
      nav: [
        { barIndex: 0, directions: ["segno"] },
        { barIndex: 1, directions: ["fine"] },
        { barIndex: 2, directions: ["dalSegnoAlFine"] },
      ],
    },
    dsCoda: {
      pitches: [60, 62, 64, 67],
      nav: [
        { barIndex: 0, directions: ["segno"] },
        { barIndex: 1, directions: ["toCoda"] },
        { barIndex: 2, directions: ["dalSegnoAlCoda"] },
        { barIndex: 3, directions: ["coda"] },
      ],
    },
  }[kind];
  await p.evaluate(
    ({ data, kind }) => {
      const node = document.querySelector("[data-score-viewport]");
      let fiber =
        node[Object.keys(node).find((k) => k.startsWith("__reactFiber"))];
      for (; fiber; fiber = fiber.return)
        if (
          fiber.memoizedProps?.stage?.id === "w1-s1" &&
          fiber.memoizedProps.targets
        )
          break;
      if (!fiber) throw Error("Stage source not found");
      const stage = fiber.memoizedProps.stage;
      stage.bpm = 120;
      stage.measures = data.pitches.length;
      stage.barNavigation = data.nav;
      stage.events = data.pitches.map((midi, i) => ({
        id: `fixture-${kind}-bar-${i}`,
        kind: "note",
        startBeat: i * 4,
        durationBeats: 4,
        writtenMidi: midi,
        writtenSpelling: { 60: "C4", 62: "D4", 64: "E4", 67: "G4" }[midi],
      }));
    },
    { data, kind },
  );
  await p.locator('header a[href="/challenge"]').click();
  await p.locator('a[href="/challenge/play/w1-s1"]').first().click();
  await ready(p);
  // A cached page can briefly expose a prior render marker while the resized
  // renderer remounts. Wait for this fixture's actual native mark, not a timer.
  const mark = {
    repeat: "\uE044",
    dcFine: "D.C. al Fine",
    dsFine: "D.S. al Fine",
    dsCoda: "D.S. al Coda",
  }[kind];
  await p.waitForFunction(
    (mark) =>
      [
        ...document.querySelectorAll(
          "[data-score-rail] [data-rendered=true] text",
        ),
      ].some((n) => n.textContent.includes(mark)),
    mark,
  );
  await button(p, "Start challenge").waitFor();
  assert.equal(await button(p, "Start challenge").isEnabled(), true);
  return source(p);
}
async function snapshot(p, name) {
  const file = path.join(output, name + ".png");
  await p.screenshot({ path: file, fullPage: true });
  return file;
}
async function isolated(browser, options) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 390, height: 844 },
    locale: "en-US",
    reducedMotion: options.reduced ? "reduce" : "no-preference",
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    window.__oscillatorCount = 0;
    window.addEventListener(
      "keyup",
      (event) => {
        if (
          window.__dropNextControlRelease &&
          (event.key === " " || event.key === "Enter")
        ) {
          window.__dropNextControlRelease = false;
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true,
    );
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      window.__oscillatorCount++;
      return create.apply(this, args);
    };
  });
  await context.route("**/*", (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith("/api/")) {
      if (u.pathname.includes("leaderboard") && r.request().method() === "POST")
        report.leaderboardPosts++;
      return r.fulfill({
        json: { entries: [], viewerCountry: null, periodDate: "2026-11-14" },
      });
    }
    if (u.origin !== new URL(base).origin) {
      report.blockedExternal++;
      return r.abort();
    }
    return ["GET", "HEAD"].includes(r.request().method())
      ? r.continue()
      : r.abort();
  });
  if (options.seed)
    await context.addInitScript(() => {
      const records = {};
      for (let i = 1; i <= 5; i++) {
        const id = `w1-s${i}`;
        records[`${id}:touch-keyboard:touch:v1`] = {
          stageId: id,
          scoringVersion: 1,
          inputProfileId: "touch-keyboard",
          inputMethod: "touch",
          bestScore: 100,
          bestStars: 3,
          attempts: 1,
          lastCompletedAt: "2026-11-14T00:00:00Z",
        };
      }
      localStorage.setItem(
        "note-quiz-challenge-v1",
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
    });
  const page = await context.newPage();
  page.setDefaultTimeout(18000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, errors };
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {}),
  });
  async function test(name, run, options = {}) {
    if (filter && !filter.test(name)) return;
    const f = await isolated(browser, options),
      entry = {
        name,
        classification: options.fixture
          ? "controlled in-memory production stage data; actual keyboard/audio/scoring"
          : options.seed
            ? "authored production stage; five prerequisite local records seeded, current attempt scored from actual keyboard/audio"
            : "authored production stage with actual keyboard/audio/scoring",
        status: "running",
      };
    report.cases.push(entry);
    try {
      entry.evidence = await run(f.page);
      assert.deepEqual(f.errors, []);
      entry.status = "pass";
      console.log("PASS", name);
    } catch (e) {
      entry.status = "fail";
      entry.error = e.stack;
      entry.pageErrors = f.errors;
      console.error("FAIL", name, e.message);
    } finally {
      entry.screenshot = await snapshot(
        f.page,
        `${report.cases.length}-${name.replace(/[^a-z0-9]+/gi, "-")}`,
      ).catch(() => null);
      await f.context.close();
      fs.writeFileSync(
        path.join(output, "report.json"),
        JSON.stringify(report, null, 2),
      );
    }
  }
  try {
    for (const [width, height] of [
      [360, 800],
      [390, 844],
      [1024, 768],
      [1440, 900],
    ])
      await test(
        `${width}px single rail, actual engraving moves past fixed playhead`,
        async (p) => {
          await goto(p, "/challenge/play/w1-s6");
          await ready(p);
          const initial = await source(p);
          assert.equal(initial.render.events.length, 4);
          assert.equal(initial.render.measures.length, 2);
          assert.equal(await p.locator("[data-score-rail]").count(), 1);
          assert.equal(await p.locator("[data-challenge-measure]").count(), 0);
          assert.equal(await button(p, "1/2").count(), 0);
          const reading = await p
            .locator("[data-score-viewport]")
            .evaluate((e) => {
              e.scrollLeft = 100;
              return {
                left: e.scrollLeft,
                width: e.clientWidth,
                scrollWidth: e.scrollWidth,
              };
            });
          if (reading.scrollWidth > reading.width + 1)
            assert.ok(reading.left > 0);
          else
            assert.equal(
              reading.left,
              0,
              "Wide viewport already fits the written rail",
            );
          await button(p, "Start challenge").click();
          await phase(p, "playing");
          await at(p, 0.1);
          await p.keyboard.down("a");
          const a = await geometry(p);
          await at(p, 0.7);
          const b = await geometry(p);
          assert.ok(Math.abs(a.playheadX - b.playheadX) < 0.6);
          assert.ok(b.railX < a.railX - 10);
          assert.ok(b.heads[0].x < a.heads[0].x - 10);
          assert.ok(
            Math.abs(b.heads[0].x - a.heads[0].x - (b.railX - a.railX)) < 1,
          );
          // The renderer floors its measured host width to a whole CSS pixel.
          assert.ok(a.railWidth >= a.viewportWidth - 1.01);
          assert.ok(a.heads[0].width > 8);
          assert.equal(a.viewportScroll, 0);
          assert.ok(b.pageScroll <= b.pageWidth + 1);
          const activeScreenshot = await snapshot(
            p,
            `${width}-active-playhead`,
          );
          await at(p, (2 * 60) / 70 - 0.04);
          await p.keyboard.up("a");
          await at(p, (2 * 60) / 70 + 0.04);
          await p.keyboard.down("s");
          await at(p, (4 * 60) / 70 - 0.04);
          await p.keyboard.up("s");
          await at(p, (4 * 60) / 70 + 0.04);
          await p.keyboard.down("d");
          await at(p, (6 * 60) / 70 - 0.04);
          await p.keyboard.up("d");
          await at(p, (6 * 60) / 70 + 0.04);
          await p.keyboard.down("g");
          await at(p, (8 * 60) / 70 - 0.04);
          await p.keyboard.up("g");
          await phase(p, "result");
          const end = await source(p);
          assert.equal(
            end.result.notes.filter((n) => n.status === "passed").length,
            4,
          );
          const finished = await geometry(p);
          assert.ok(
            finished.heads.every((n) => /15803d|21, 128, 61/i.test(n.fill)),
          );
          const review = await p
            .locator("[data-score-viewport]")
            .evaluate((e) => {
              e.scrollLeft = 180;
              return e.scrollLeft;
            });
          if (reading.scrollWidth > reading.width + 1) assert.ok(review > 0);
          return {
            initialBounds: initial.render,
            reading,
            a,
            b,
            activeScreenshot,
            finished,
            review,
            score: end.result.score,
          };
        },
        { viewport: { width, height }, seed: true },
      );
    for (const activation of ["click", "keyboard"])
      await test(`390px Korean lower-page ${activation} start brings the whole staff into view`, async (p) => {
        await goto(p, "/ko/challenge/play/w4-s6");
        await ready(p);
        const copy = (await source(p)).copy;
        await p
          .getByRole("radio", { name: copy.rehearsal, exact: true })
          .check();
        const control = button(p, copy.startRehearsal);
        await control.scrollIntoViewIfNeeded();
        const before = await p.evaluate(() => ({
          y: scrollY,
          score: document
            .querySelector("[data-score-viewport]")
            .getBoundingClientRect()
            .toJSON(),
        }));
        assert.ok(
          before.score.top < 0,
          "Reproduce a start control below the score",
        );
        if (activation === "keyboard") {
          await control.focus();
          await p.keyboard.press("Enter");
        } else await control.click();
        await phase(p, "countIn");
        // No scroll/focus helper after activation: the application owns recovery.
        await p.waitForFunction(() => {
          const r = document
            .querySelector("[data-score-viewport]")
            .getBoundingClientRect();
          return r.top >= 0 && r.bottom <= innerHeight;
        });
        const countIn = await p.evaluate(() => ({
          y: scrollY,
          score: document
            .querySelector("[data-score-viewport]")
            .getBoundingClientRect()
            .toJSON(),
        }));
        await phase(p, "playing");
        const playing = await p.evaluate(() => ({
          y: scrollY,
          height: innerHeight,
          score: document
            .querySelector("[data-score-viewport]")
            .getBoundingClientRect()
            .toJSON(),
        }));
        assert.ok(
          playing.score.top >= 0 && playing.score.bottom <= playing.height,
        );
        return { before, countIn, playing, scrolledByHarnessAfterStart: false };
      });
    await test(
      "repeat marks, independent pass results, gap input excluded and color reset",
      async (p) => {
        const fixture = await installFixture(p, "repeat");
        assert.deepEqual(
          fixture.targets.map((t) => t.sourceBarIndex),
          [0, 1, 0, 1],
        );
        assert.equal(fixture.transitions.length, 1);
        const gap = fixture.transitions[0];
        const glyphs = await p
          .locator("[data-score-rail] text")
          .allTextContents();
        assert.ok(
          glyphs.some((g) => g.includes("\uE044")),
          "Native repeat dots",
        );
        await button(p, "Start challenge").click();
        await phase(p, "playing");
        await playTargets(p, fixture.targets.slice(0, 2));
        await at(p, gap.startAudioSec + 0.08);
        await waitColors(p, {
          "fixture-repeat-bar-0": "#15803d",
          "fixture-repeat-bar-1": "#15803d",
        });
        const before = await geometry(p),
          beforeSource = await source(p);
        assert.ok(
          before.heads.every((n) => /15803d|21, 128, 61/i.test(n.fill)),
        );
        await p.keyboard.down("g");
        await at(p, gap.startAudioSec + 0.25);
        await p.keyboard.up("g");
        const during = await geometry(p),
          duringSource = await source(p);
        assert.equal(during.rewinding, "true");
        assert.equal(
          during.oscillators,
          before.oscillators,
          "Gap keyboard input cannot create a held touch tone",
        );
        if (beforeSource.attempt && duringSource.attempt)
          assert.equal(
            duringSource.attempt.events.length,
            beforeSource.attempt.events.length,
          );
        const rewindShot = await snapshot(p, "repeat-during-rewind");
        await at(p, gap.endAudioSec + 0.02);
        await waitColors(p, {});
        const reset = await geometry(p);
        assert.deepEqual(reset.colors, {});
        assert.ok(reset.heads.every((n) => /0f172a|15, 23, 42/i.test(n.fill)));
        assert.ok(
          reset.railX > before.railX + 20,
          "Rail visibly returns to earlier written music",
        );
        await playTargets(p, fixture.targets.slice(2), 0);
        await phase(p, "result");
        const end = await source(p);
        assert.deepEqual(
          end.result.notes.map((n) => n.status),
          ["passed", "passed", "failed", "failed"],
        );
        assert.equal(
          new Set(end.result.notes.map((n) => n.stageEventId)).size,
          4,
        );
        assert.ok(
          end.result.notes
            .slice(2)
            .every((n) => n.reasons.includes("wrongPitch")),
        );
        assert.equal(
          await p.locator("[data-challenge-score] ol li").count(),
          4,
        );
        const final = await geometry(p);
        assert.ok(final.heads.every((n) => /b91c1c|185, 28, 28/i.test(n.fill)));
        return {
          fixture,
          before,
          during,
          reset,
          final,
          rewindShot,
          result: end.result,
          rows: await p
            .locator("[data-challenge-score] ol li")
            .allTextContents(),
          gapStoreRead:
            beforeSource.attempt && duringSource.attempt
              ? {
                  before: beforeSource.attempt.events,
                  after: duringSource.attempt.events,
                }
              : null,
        };
      },
      { fixture: true },
    );
    for (const [kind, bars, label] of [
      ["dcFine", [0, 1, 0], "D.C. al Fine"],
      ["dsFine", [0, 1, 2, 0, 1], "D.S. al Fine"],
      ["dsCoda", [0, 1, 2, 0, 1, 3], "D.S. al Coda"],
    ])
      await test(
        `${kind} engraved marks and actual return transport`,
        async (p) => {
          const fixture = await installFixture(p, kind);
          assert.deepEqual(
            fixture.targets.map((t) => t.sourceBarIndex),
            bars,
          );
          assert.ok(
            (await p.locator("[data-score-rail] text").allTextContents()).some(
              (s) => s.includes(label),
            ),
          );
          await button(p, "Start challenge").click();
          await phase(p, "playing");
          const playing = playTargets(p, fixture.targets);
          const gap = fixture.transitions[0];
          await at(p, gap.startAudioSec + 0.08);
          const before = await geometry(p);
          await at(p, gap.startAudioSec + 0.36);
          const after = await geometry(p);
          assert.equal(after.rewinding, "true");
          assert.ok(
            after.railX > before.railX + 10,
            "Smooth actual return must move the rail right",
          );
          const screenshot = await snapshot(p, kind + "-return");
          await playing;
          await phase(p, "result");
          const end = await source(p);
          assert.ok(end.result.notes.every((n) => n.status === "passed"));
          assert.equal(end.result.notes.length, bars.length);
          return { fixture, before, after, screenshot, result: end.result };
        },
        { fixture: true },
      );
    await test(
      "pause resume and restart retain completed colors and rewind unfinished cursor",
      async (p) => {
        const fixture = await installFixture(p, "repeat");
        await button(p, "Start challenge").click();
        await phase(p, "playing");
        await playTargets(p, fixture.targets.slice(0, 1));
        await at(p, 2.4);
        await waitColors(p, { "fixture-repeat-bar-0": "#15803d" });
        await button(p, "Pause").click();
        await phase(p, "paused");
        const paused = await geometry(p);
        await p.waitForTimeout(250);
        assert.equal((await geometry(p)).elapsed, paused.elapsed);
        assert.equal(paused.elapsed, 2);
        assert.equal(paused.colors["fixture-repeat-bar-0"], "#15803d");
        await button(p, "Resume from this note").click();
        await phase(p, "countIn");
        await phase(p, "playing");
        assert.ok((await geometry(p)).elapsed <= 2.1);
        await button(p, "Restart").click();
        await phase(p, "countIn");
        const restarted = await geometry(p);
        assert.equal(restarted.elapsed, 0);
        assert.deepEqual(restarted.colors, {});
        return { paused, restarted };
      },
      { fixture: true },
    );
    for (const controlKey of ["Enter", "Space"])
      await test(
        `${controlKey} touch control held into rewind releases on BODY and can be pressed again`,
        async (p) => {
          const fixture = await installFixture(p, "repeat");
          const gap = fixture.transitions[0];
          await button(p, "Start challenge").click();
          await phase(p, "playing");
          await at(p, 0.05);
          await button(p, "C4").focus();
          await p.keyboard.down(controlKey);
          await at(p, gap.startAudioSec + 0.1);
          const duringGap = await geometry(p);
          assert.equal(duringGap.rewinding, "true");
          assert.equal(await button(p, "C4").isDisabled(), true);
          const releasedOn = await p.evaluate(
            () => document.activeElement.tagName,
          );
          await p.keyboard.up(controlKey);
          const released = await source(p);
          assert.ok(
            released.attempt,
            "Read actual attempt state without mutation",
          );
          assert.equal(
            released.attempt.events.length,
            1,
            "BODY keyup must finalize the held control note",
          );
          assert.ok(
            released.attempt.events[0].offset > gap.startAudioSec + 0.05,
            "Keep the physical release time rather than clipping at rewind start",
          );
          await at(p, gap.endAudioSec + 0.05);
          await button(p, "C4").focus();
          const beforePress = await geometry(p);
          await p.keyboard.down(controlKey);
          const afterPress = await geometry(p);
          assert.equal(
            afterPress.oscillators,
            beforePress.oscillators + 1,
            "New pass must accept a fresh control-key note down",
          );
          await at(p, fixture.targets[2].endAudioSec - 0.04);
          await p.keyboard.up(controlKey);
          await at(p, fixture.targets[3].startAudioSec + 0.05);
          await p.keyboard.down("s");
          await at(p, fixture.targets[3].endAudioSec - 0.04);
          await p.keyboard.up("s");
          await phase(p, "result");
          const end = await source(p);
          assert.deepEqual(
            end.result.notes.slice(2).map((n) => n.status),
            ["passed", "passed"],
          );
          assert.ok(end.result.notes[0].reasons.includes("tooLong"));
          return {
            releasedOn,
            duringGap,
            releasedEvents: released.attempt.events,
            beforePress,
            afterPress,
            result: end.result,
          };
        },
        { fixture: true },
      );
    for (const controlKey of ["Enter", "Space"])
      await test(
        `${controlKey} cancelled hold with missing window keyup accepts the first fresh press`,
        async (p) => {
          await installFixture(p, "repeat");
          await button(p, "Start challenge").click();
          await phase(p, "playing");
          await at(p, 0.08);
          await button(p, "C4").focus();
          await p.keyboard.down(controlKey);
          await button(p, "Pause").click();
          await phase(p, "paused");
          // Simulate the keyup being lost outside the window. This blocks only
          // DOM delivery; all session state, note input and audio remain real.
          await p.evaluate(() => {
            window.__dropNextControlRelease = true;
          });
          await p.keyboard.up(controlKey);
          await button(p, "Resume from this note").click();
          await phase(p, "playing");
          await at(p, 0.06);
          await button(p, "C4").focus();
          const before = await geometry(p);
          await p.keyboard.down(controlKey);
          const after = await geometry(p);
          assert.equal(after.oscillators, before.oscillators + 1);
          assert.equal(
            await button(p, "C4").getAttribute("aria-pressed"),
            "true",
          );
          await p.keyboard.up(controlKey);
          return {
            before,
            after,
            missingRelease:
              "captured and suppressed once before app listeners; no score/state injection",
          };
        },
        { fixture: true },
      );
    await test(
      "reduced motion snaps during same unscored gap without changing target times",
      async (p) => {
        const fixture = await installFixture(p, "repeat");
        assert.deepEqual(
          fixture.targets.map((t) => [t.startAudioSec, t.endAudioSec]),
          [
            [0, 2],
            [2, 4],
            [4.5, 6.5],
            [6.5, 8.5],
          ],
        );
        await button(p, "Start challenge").click();
        await phase(p, "playing");
        await at(p, 0.15);
        const first = await geometry(p);
        await at(p, 0.7);
        const second = await geometry(p);
        assert.ok(Math.abs(first.railX - second.railX) < 1);
        await at(p, 4.08);
        const a = await geometry(p);
        await at(p, 4.32);
        const b = await geometry(p);
        assert.equal(b.rewinding, "true");
        assert.ok(Math.abs(a.railX - b.railX) < 1);
        return {
          targets: fixture.targets,
          transitions: fixture.transitions,
          first,
          second,
          a,
          b,
        };
      },
      { fixture: true, reduced: true },
    );
    await test("missed attempt paints native notehead red at result", async (p) => {
      await goto(p, "/challenge/play/w1-s1");
      await ready(p);
      await button(p, "Start challenge").click();
      await phase(p, "result");
      const end = await source(p),
        g = await geometry(p);
      assert.equal(end.result.notes[0].status, "missed");
      assert.ok(/b91c1c|185, 28, 28/i.test(g.heads[0].fill));
      return { result: end.result, g };
    });
    for (const locale of ["en", "ko", "ja", "es", "de", "fr", "zh"])
      await test(
        `${locale} 360px single rail labels and touch controls have no page overflow`,
        async (p) => {
          await goto(p, `/${locale}/challenge/play/w1-s1`);
          await ready(p);
          await button(p, (await source(p)).copy.start).click();
          await phase(p, "playing");
          const result = await p.evaluate(() => ({
            lang: document.documentElement.lang,
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            labels: [...document.querySelectorAll("[data-score-viewport]")].map(
              (n) => n.getAttribute("aria-label"),
            ),
            texts: document.querySelector("[data-score-viewport]").parentElement
              .textContent,
            keys: [...document.querySelectorAll("button[data-midi]")].map(
              (n) => {
                const b = n.getBoundingClientRect();
                return { width: b.width, height: b.height, y: b.y };
              },
            ),
          }));
          assert.ok(result.scrollWidth <= result.width + 1);
          assert.ok(result.labels[0]);
          assert.equal(result.keys.length, 7);
          assert.ok(
            result.keys.every((key) => key.width >= 44 && key.height >= 44),
            JSON.stringify(result.keys),
          );
          assert.ok(
            Math.max(...result.keys.map((key) => key.y)) -
              Math.min(...result.keys.map((key) => key.y)) <
              1,
          );
          return result;
        },
        { viewport: { width: 360, height: 800 } },
      );
  } finally {
    await browser.close();
    report.finishedAt = new Date().toISOString();
    report.passed = report.cases.filter((c) => c.status === "pass").length;
    report.failed = report.cases.filter((c) => c.status === "fail").length;
    fs.writeFileSync(
      path.join(output, "report.json"),
      JSON.stringify(report, null, 2),
    );
    assert.equal(report.leaderboardPosts, 0);
    console.log(
      JSON.stringify({
        passed: report.passed,
        failed: report.failed,
        report: path.join(output, "report.json"),
      }),
    );
    if (report.failed) process.exitCode = 1;
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
