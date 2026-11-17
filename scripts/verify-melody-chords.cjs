/* eslint-disable @typescript-eslint/no-require-imports */
// Actual production UI/alphaTab/audio evidence in owned, isolated contexts.
// Only seed and microphone PCM are synthetic; generation, clocks, YIN,
// playback buffers, targets and judgments remain production code.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { buildSync } = require("esbuild");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.UI_BASE_URL || "http://localhost:3013";
const out = process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-melody-chords";
const key = "note-quiz-melody-settings-v1";
const defaults = {
  clef: "treble",
  tonalityId: "C-major",
  progressionId: "none",
  minMidi: 60,
  maxMidi: 67,
  durations: [1, 2],
  bpm: 180,
  timeSignature: [4, 4],
  dotted: false,
  triplets: false,
  metronome: false,
  barBell: false,
};
const report = {
  base,
  build: process.env.EXPECTED_BUILD_ID,
  cases: [],
  errors: [],
  externalRequestsBlocked: 0,
  postsBlocked: 0,
  physicalMicrophoneVerified: false,
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const button = (page, name) => page.getByRole("button", { name, exact: true });
function reader() {
  const host = document.querySelector("[data-score-viewport]");
  if (!host) return null;
  let root =
    host[Object.keys(host).find((key) => key.startsWith("__reactFiber"))];
  while (root?.return) root = root.return;
  const stack = [root?.stateNode?.current || root];
  let view, notation, attempt;
  while (stack.length) {
    const fiber = stack.pop();
    if (!fiber) continue;
    if (fiber.child) stack.push(fiber.child);
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.memoizedProps?.stage?.id && fiber.memoizedProps.targets)
      view = fiber;
    if (
      fiber.memoizedProps?.score?.events &&
      fiber.memoizedProps.horizontalScale
    )
      notation = fiber.memoizedProps;
    for (
      let hook = fiber.memoizedState;
      hook && typeof hook === "object";
      hook = hook.next
    ) {
      const value = hook.memoizedState;
      if (
        value?.phase &&
        Array.isArray(value.events) &&
        value.attemptToken !== undefined
      )
        attempt = value;
    }
  }
  if (!view) return null;
  let bounds;
  for (let hook = view.memoizedState; hook; hook = hook.next) {
    const value = hook.memoizedState;
    if (value?.events && typeof value.width === "number" && value.measures)
      bounds = value;
  }
  const rail = host.querySelector("[data-score-rail]"),
    railRect = rail.getBoundingClientRect();
  const labels = [...host.querySelectorAll("[data-score-chord]")].map(
    (node) => ({
      barIndex: Number(node.dataset.barIndex),
      label: node.textContent,
      x: node.getBoundingClientRect().x - railRect.x,
      y: node.getBoundingClientRect().y - railRect.y,
      height: node.getBoundingClientRect().height,
    }),
  );
  const heads = [...host.querySelectorAll("text")].filter((node) => {
    const code = node.textContent.codePointAt(0);
    return code >= 0xe0a0 && code <= 0xe0ff;
  });
  return {
    stage: view.memoizedProps.stage,
    targets: view.memoizedProps.targets,
    elapsed: view.memoizedProps.elapsed,
    scorePreRoll: view.memoizedProps.scorePreRoll,
    bounds,
    labels,
    phase: document.querySelector("[data-melody-phase]").dataset.melodyPhase,
    active: view.memoizedProps.active,
    notation: notation
      ? {
          score: notation.score,
          height: notation.height,
          horizontalScale: notation.horizontalScale,
        }
      : null,
    headCount: heads.length,
    // SVG text DOM boxes describe the whole music font em (220px), not
    // painted note ink. Native beat/note bounds own the visible note geometry.
    headBounds:
      bounds?.events.map(({ id, y, height }) => ({
        id,
        top: y,
        bottom: y + height,
      })) ?? [],
    railX: railRect.x,
    railHeight: railRect.height,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    attemptEvents: attempt?.events,
    attemptResult: attempt?.result,
    colors: JSON.parse(host.dataset.scoreColors || "{}"),
  };
}
async function snapshot(page) {
  return page.evaluate(() => window.__chordReader());
}
async function ready(page) {
  await page.waitForFunction(
    () => {
      const view = window.__chordReader?.();
      return (
        view?.bounds?.measures?.length === 8 &&
        document.querySelector('[data-rendered="true"]') &&
        [...document.querySelectorAll("button")].some(
          (node) =>
            node.textContent.trim() === "Start practice" && !node.disabled,
        )
      );
    },
    null,
    { timeout: 30000 },
  );
}
function check(view, harmony = true) {
  assert.ok(
    view.bounds?.measures?.length === 8,
    "Native eight-measure render bounds",
  );
  assert.equal(view.overflow, false, "No document overflow");
  assert.equal(view.notation.height, 176);
  assert.equal(view.notation.horizontalScale, 0.85);
  assert.equal(
    view.headCount,
    view.stage.events.filter((event) => event.kind === "note").length,
    "No lost or extra rendered noteheads",
  );
  const errors = [];
  if (harmony) {
    assert.equal(view.labels.length, 8);
    assert.equal(view.railHeight, 200);
    for (const label of view.labels) {
      const bar = view.bounds.measures.find(
        (bar) => bar.index === label.barIndex,
      );
      assert.ok(Number.isFinite(bar.timeStartX));
      errors.push(Math.abs(label.x - bar.timeStartX));
      assert.equal(label.label, view.stage.harmony.bars[label.barIndex].label);
      assert.equal(label.height, 24);
      assert.equal(label.y, 0);
    }
    assert.ok(
      Math.max(...errors) <= 2,
      `Chord label/native bar start errors: ${errors}`,
    );
  } else {
    assert.equal(view.labels.length, 0);
    assert.equal(view.railHeight, 176);
  }
  const barBeats =
    (view.stage.timeSignature[0] * 4) / view.stage.timeSignature[1];
  for (const event of view.stage.events) {
    if (event.kind !== "note") continue;
    const target = view.targets.find(
      (target) => (target.sourceEventId || target.stageEventId) === event.id,
    );
    assert.equal(
      target.targetConcertMidi,
      event.writtenMidi,
      "Target preserves written sounding MIDI for voice",
    );
    const notationEvent = view.notation.score.events.find(
        (note) => note.id === event.id,
      ),
      note = notationEvent.notes[0];
    const match = /^([A-G])([#b]?)(\d+)$/.exec(event.writtenSpelling),
      natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    assert.equal(
      (Number(match[3]) + 1) * 12 +
        natural[match[1]] +
        (match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0),
      event.writtenMidi,
    );
    assert.deepEqual(
      [note.step, note.octave, note.alter, note.midi],
      [
        match[1],
        Number(match[3]),
        match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0,
        event.writtenMidi,
      ],
    );
    if (harmony) {
      const bar =
        view.stage.harmony.bars[
          Math.floor((event.startBeat + 1e-9) / barBeats)
        ];
      const pcs = bar.tones.map(
        (tone) =>
          (natural[tone.name] +
            (tone.accidental === "sharp"
              ? 1
              : tone.accidental === "flat"
                ? -1
                : 0) +
            12) %
          12,
      );
      assert.ok(
        pcs.includes(event.writtenMidi % 12),
        `Outside-chord note ${event.writtenSpelling} in ${bar.label}`,
      );
    }
  }
  return {
    id: view.stage.id,
    phase: view.phase,
    labels: view.labels.map(({ barIndex, label, x }) => ({
      barIndex,
      label,
      x,
    })),
    maxLabelErrorPx: Math.max(0, ...errors),
    headCount: view.headCount,
    railHeight: view.railHeight,
  };
}
async function panel(page) {
  if (page.viewportSize().width < 1024) {
    await button(page, "Settings").click();
    return page.getByRole("dialog");
  }
  return page.locator("[data-practice-settings]");
}
async function closePanel(page) {
  if (page.viewportSize().width < 1024) await page.keyboard.press("Escape");
}
async function clean(page) {
  return page.evaluate(
    () =>
      window.__chordAudio.contexts.every(
        (context) => context.state === "closed",
      ) &&
      window.__chordAudio.streams.every((stream) =>
        stream.getTracks().every((track) => track.readyState === "ended"),
      ),
  );
}
async function makePage(
  browser,
  width,
  settings = { ...defaults },
  legacy = false,
) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    locale: "en-US",
    reducedMotion: "no-preference",
  });
  await context.route("**/*", (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      report.postsBlocked++;
      return route.abort();
    }
    if (url.origin !== new URL(base).origin) {
      report.externalRequestsBlocked++;
      return route.abort();
    }
    return route.continue();
  });
  await context.addInitScript(
    ({ key, settings, legacy, source }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(
          key,
          JSON.stringify(legacy ? settings : { version: 2, settings }),
        );
      const nativeRandom = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = (array) => {
        nativeRandom(array);
        if (array instanceof Uint32Array && array.length === 1) array[0] = 7;
        return array;
      };
      window.__chordReader = new Function(`return (${source})`)();
      const audio = (window.__chordAudio = {
        contexts: [],
        streams: [],
        cues: [],
        piano: [],
        scheduled: false,
        raf: 0,
        frames: [],
        committed: {},
        historyChanges: [],
        renderChanges: [],
      });
      const Native = window.AudioContext;
      window.AudioContext = class extends Native {
        constructor(...args) {
          super(...args);
          audio.contexts.push(this);
        }
        createBufferSource() {
          const node = super.createBufferSource(),
            start = node.start.bind(node);
          node.start = (at) => {
            if (node.buffer?.numberOfChannels === 2) {
              const samples = node.buffer.getChannelData(0),
                offset = Math.round(node.buffer.sampleRate * 0.08);
              audio.piano.push({
                at,
                rate: node.buffer.sampleRate,
                pcm: Array.from(samples.subarray(offset, offset + 2048)),
              });
            } else audio.cues.push({ at });
            start(at);
          };
          return node;
        }
      };
      navigator.mediaDevices.getUserMedia = async () => {
        const context = audio.contexts.at(-1),
          sink = context.createMediaStreamDestination();
        audio.streams.push(sink.stream);
        audio.sink = sink;
        audio.native = Native;
        audio.scheduled = false;
        audio.cues = [];
        return sink.stream;
      };
      function tick() {
        const view = window.__chordReader(),
          context = audio.contexts.at(-1);
        if (view?.active && context && audio.sink && !audio.scheduled) {
          const pulses =
            view.stage.timeSignature[0] === 6 ? 2 : view.stage.timeSignature[0];
          if (audio.cues.length >= pulses) {
            audio.scheduled = true;
            const pulse =
                ((view.stage.timeSignature[1] === 8 ? 1.5 : 1) * 60) /
                view.stage.bpm,
              start = audio.cues[0].at + pulses * pulse;
            const baseElapsed =
              view.scorePreRoll?.baseElapsedSec ?? view.elapsed;
            for (const target of view.targets) {
              if (target.kind !== "note" || target.endAudioSec <= baseElapsed)
                continue;
              const oscillator =
                  audio.native.prototype.createOscillator.call(context),
                gain = context.createGain();
              oscillator.frequency.value =
                440 * 2 ** ((target.targetConcertMidi - 69) / 12);
              gain.gain.value = 0.2;
              oscillator.connect(gain);
              gain.connect(audio.sink);
              oscillator.start(
                Math.max(
                  context.currentTime,
                  start + Math.max(0, target.startAudioSec - baseElapsed),
                ),
              );
              oscillator.stop(
                Math.max(
                  context.currentTime + 0.005,
                  start +
                    Math.max(0, target.startAudioSec - baseElapsed) +
                    (target.endAudioSec -
                      Math.max(baseElapsed, target.startAudioSec)) *
                      0.85,
                ),
              );
            }
          }
        }
        if (view?.active) {
          audio.frames.push({
            phase: view.phase,
            elapsed: view.elapsed,
            railX: view.railX,
            labels: view.labels,
            bars: view.bounds?.measures,
            colors: view.colors,
          });
          for (const [id, color] of Object.entries(audio.committed))
            if (view.colors[id] !== color)
              audio.historyChanges.push({
                id,
                before: color,
                after: view.colors[id],
              });
          Object.assign(audio.committed, view.colors);
        }
        audio.raf = requestAnimationFrame(tick);
      }
      audio.raf = requestAnimationFrame(tick);
    },
    { key, settings, legacy, source: reader.toString() },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  const response = await page.goto(base + "/en/melody");
  if (report.build)
    assert.ok(
      (await response.text()).includes(report.build),
      "Exact production build",
    );
  await ready(page);
  return { context, page };
}
async function saveReport() {
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2),
  );
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const pitchBundle = buildSync({
    entryPoints: [path.join(__dirname, "../src/lib/music/estimatePitch.ts")],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
  });
  const pitchModule = new Module("melody-qa-yin");
  pitchModule._compile(pitchBundle.outputFiles[0].text, "melody-qa-yin.cjs");
  const { estimatePitch, frequencyPitch } = pitchModule.exports;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH,
  });
  async function test(name, run) {
    if (
      process.env.UI_CASE_FILTER &&
      !new RegExp(process.env.UI_CASE_FILTER).test(name)
    )
      return;
    console.log("RUN", name);
    try {
      report.cases.push({ name, passed: true, evidence: await run() });
      console.log("PASS", name);
    } catch (error) {
      report.cases.push({
        name,
        passed: false,
        error: String(error),
        stack: error.stack,
      });
      console.log("FAIL", name, String(error));
    }
    await saveReport();
  }
  try {
    for (const width of [1440, 390]) {
      await test(`${width} tonality, progression, migration, auto-save and fixed/random reroll`, async () => {
        const old = {
          clef: "bass",
          keySignature: "Eb",
          minMidi: 48,
          maxMidi: 84,
          durations: [0.5, 2],
          bpm: 180,
          timeSignature: [4, 4],
          dotted: false,
          triplets: false,
          metronome: false,
          barBell: false,
        };
        const { context, page } = await makePage(browser, width, old, true);
        try {
          let scope = await panel(page);
          assert.equal(
            await scope
              .getByRole("combobox", { name: "Tonality", exact: true })
              .inputValue(),
            "Eb-major",
          );
          assert.equal(
            await scope
              .getByRole("combobox", { name: "Chord progression", exact: true })
              .inputValue(),
            "none",
          );
          assert.equal(
            await scope
              .getByRole("button", { name: "Apply", exact: true })
              .count(),
            0,
          );
          await scope
            .getByRole("combobox", { name: "Tonality", exact: true })
            .selectOption("C-major");
          await scope
            .getByRole("combobox", { name: "Chord progression", exact: true })
            .selectOption("major-two-five");
          await closePanel(page);
          await ready(page);
          const first = await snapshot(page);
          assert.deepEqual(
            first.stage.harmony.bars.map((bar) => bar.label),
            ["C", "Am", "Dm", "G", "C", "F", "G", "C"],
          );
          check(first);
          await button(page, "New melody").click();
          await ready(page);
          const second = await snapshot(page);
          assert.notEqual(second.stage.id, first.stage.id);
          assert.equal(second.stage.harmony.patternId, "major-two-five");
          scope = await panel(page);
          await scope
            .getByRole("combobox", { name: "Tonality", exact: true })
            .selectOption("G-major");
          assert.equal(
            await scope
              .getByRole("combobox", { name: "Chord progression", exact: true })
              .inputValue(),
            "major-two-five",
          );
          await scope
            .getByRole("combobox", { name: "Tonality", exact: true })
            .selectOption("A-minor");
          assert.equal(
            await scope
              .getByRole("combobox", { name: "Chord progression", exact: true })
              .inputValue(),
            "random",
          );
          await closePanel(page);
          await ready(page);
          const selected = [];
          for (let i = 0; i < 8; i++) {
            const current = await snapshot(page);
            selected.push(current.stage.harmony.patternId);
            check(current);
            await button(page, "New melody").click();
            await ready(page);
          }
          assert.ok(
            new Set(selected).size > 1,
            "Random rerolls select multiple compatible patterns in this seeded sequence",
          );
          const saved = await page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)),
            key,
          );
          assert.equal(saved.version, 2);
          assert.equal(saved.settings.tonalityId, "A-minor");
          assert.equal(saved.settings.progressionId, "random");
          assert.equal(Object.hasOwn(saved.settings, "keySignature"), false);
          await page.reload();
          await ready(page);
          scope = await panel(page);
          assert.equal(
            await scope
              .getByRole("combobox", { name: "Tonality", exact: true })
              .inputValue(),
            "A-minor",
          );
          assert.equal(
            await scope
              .getByRole("combobox", { name: "Chord progression", exact: true })
              .inputValue(),
            "random",
          );
          const selectGeometry = await scope
            .locator("select")
            .evaluateAll((nodes) =>
              nodes.map((node) => ({
                width: node.getBoundingClientRect().width,
                overflow: node.scrollWidth > node.clientWidth,
              })),
            );
          assert.ok(selectGeometry.every((item) => !item.overflow));
          await closePanel(page);
          await page.screenshot({
            path: path.join(out, `${width}-chords-settings.png`),
          });
          return {
            initialMigration: "Eb-major + none",
            fixedIds: [first.stage.id, second.stage.id],
            randomPatterns: selected,
            saved,
            selectGeometry,
            geometry: check(await snapshot(page)),
          };
        } finally {
          await context.close();
        }
      });
      await test(`${width} full-rest exemption, one-candidate repetition and impossible draft retention`, async () => {
        const { context, page } = await makePage(browser, width, {
          ...defaults,
          minMidi: 60,
          maxMidi: 62,
          durations: [4],
          progressionId: "major-descending",
        });
        try {
          const valid = await snapshot(page);
          check(valid);
          assert.equal(valid.stage.events[3].kind, "rest");
          assert.equal(valid.stage.harmony.bars[3].label, "Em");
          assert.deepEqual(
            valid.stage.events
              .filter((event) => event.kind === "note")
              .map((event) => event.writtenMidi),
            [60, 62, 60, 62, 62, 60, 60],
          );
          const saved = await page.evaluate(
            (key) => localStorage.getItem(key),
            key,
          );
          const scope = await panel(page);
          assert.equal(await scope.getByRole("alert").count(), 0);
          await scope
            .getByRole("checkbox", { name: "Quarter", exact: true })
            .check();
          await scope
            .getByRole("checkbox", { name: "Whole", exact: true })
            .uncheck();
          await scope.getByRole("alert").waitFor();
          assert.equal(await scope.getByRole("alert").count(), 1);
          assert.match(
            await scope.getByRole("alert").textContent(),
            /No Em chord tone/,
          );
          assert.equal((await snapshot(page)).stage.id, valid.stage.id);
          assert.equal(
            await page.evaluate((key) => localStorage.getItem(key), key),
            saved,
          );
          await page.screenshot({
            path: path.join(out, `${width}-impossible-draft.png`),
          });
          await scope
            .getByRole("checkbox", { name: "Whole", exact: true })
            .check();
          await scope
            .getByRole("checkbox", { name: "Quarter", exact: true })
            .uncheck();
          assert.equal(await scope.getByRole("alert").count(), 0);
          await closePanel(page);
          await ready(page);
          await page.screenshot({
            path: path.join(out, `${width}-full-rest.png`),
          });
          await page.locator("[data-score-viewport]").evaluate((host) => {
            const label = host.querySelector(
              '[data-score-chord][data-bar-index="3"]',
            );
            host.scrollLeft = parseFloat(label.style.left) - 40;
          });
          await page.screenshot({
            path: path.join(out, `${width}-full-rest-bar4.png`),
          });
          return {
            fullRestBar: 4,
            chord: "Em",
            noteMidis: valid.stage.events
              .filter((event) => event.kind === "note")
              .map((event) => event.writtenMidi),
            retainedId: valid.stage.id,
            oneActionableIssue: true,
            persistedUnchanged: true,
            geometry: check(await snapshot(page)),
          };
        } finally {
          await context.close();
        }
      });
    }
    for (const clef of ["treble", "bass", "alto", "tenor"]) {
      await test(`${clef} notation preserves supported pitch extremes and B#/Cb written octave`, async () => {
        const evidence = [];
        for (const [tonalityId, midi, spelling] of [
          ["C-major", 48, "C3"],
          ["C-major", 84, "C6"],
          ["C#-major", 60, "B#3"],
          ["Cb-major", 59, "Cb4"],
        ]) {
          const { context, page } = await makePage(browser, 390, {
            ...defaults,
            clef,
            tonalityId,
            minMidi: midi,
            maxMidi: midi,
            durations: [1],
          });
          try {
            const view = await snapshot(page);
            check(view, false);
            assert.ok(
              view.stage.events
                .filter((event) => event.kind === "note")
                .every(
                  (event) =>
                    event.writtenMidi === midi &&
                    event.writtenSpelling === spelling,
                ),
            );
            assert.ok(
              view.headBounds.every(
                (rect) => rect.top >= -1 && rect.bottom <= 177,
              ),
              `Clipped notes in ${clef} ${spelling}: ${JSON.stringify(view.headBounds)}`,
            );
            if (midi === 84)
              await page.screenshot({
                path: path.join(out, `390-${clef}-C6.png`),
              });
            evidence.push({
              tonalityId,
              midi,
              spelling,
              geometry: check(view, false),
              headBounds: view.headBounds,
            });
          } finally {
            await context.close();
          }
        }
        const harmonic = await makePage(browser, 390, {
          ...defaults,
          clef,
          tonalityId: "C-minor",
          progressionId: "minor-basic",
          minMidi: 48,
          maxMidi: 84,
        });
        try {
          const view = await snapshot(harmonic.page);
          evidence.push({ harmonic: true, geometry: check(view) });
          await harmonic.page.screenshot({
            path: path.join(out, `390-${clef}-harmonic.png`),
          });
        } finally {
          await harmonic.context.close();
        }
        return evidence;
      });
    }
    for (const [tonalityId, chord, third, pc] of [
      ["A-minor", "E", "G#", 8],
      ["C-minor", "G", "B", 11],
    ]) {
      await test(`${tonalityId} raised dominant is present in notation, targets and sampled piano PCM`, async () => {
        const { context, page } = await makePage(browser, 1440, {
          ...defaults,
          tonalityId,
          progressionId: "minor-basic",
          minMidi: 48,
          maxMidi: 84,
          durations: [0.5],
          bpm: 72,
        });
        try {
          const view = await snapshot(page);
          check(view);
          assert.equal(view.stage.harmony.bars[2].label, chord);
          const raised = view.stage.events.filter(
            (event) =>
              event.kind === "note" &&
              event.startBeat >= 8 &&
              event.startBeat < 12 &&
              event.writtenMidi % 12 === pc,
          );
          assert.ok(raised.length, `Actual seeded UI generates ${third}`);
          assert.ok(
            raised.every((event) => event.writtenSpelling.startsWith(third)),
          );
          await button(page, "Play example").click();
          await page.waitForFunction(
            () => window.__chordAudio.piano.length > 0,
          );
          const piano = await page.evaluate(() => window.__chordAudio.piano);
          const notes = view.stage.events.filter(
            (event) => event.kind === "note",
          );
          assert.equal(piano.length, notes.length);
          const pitches = piano.map((note, index) => {
            const estimate = estimatePitch(
                Float32Array.from(note.pcm),
                note.rate,
              ),
              measured = estimate.hz ? frequencyPitch(estimate.hz)?.midi : null;
            assert.equal(
              measured,
              notes[index].writtenMidi,
              `Actual piano buffer ${index} expected ${notes[index].writtenSpelling}, got ${estimate.hz}Hz`,
            );
            return {
              writtenSpelling: notes[index].writtenSpelling,
              midi: measured,
              hz: estimate.hz,
              at: note.at,
            };
          });
          await button(page, "Stop example").click();
          await page.waitForFunction(() =>
            window.__chordAudio.contexts.every(
              (context) => context.state === "closed",
            ),
          );
          return {
            third,
            raised: raised.map((event) => ({
              spelling: event.writtenSpelling,
              midi: event.writtenMidi,
            })),
            geometry: check(view),
            piano: pitches,
            cleanup: await clean(page),
          };
        } finally {
          await context.close();
        }
      });
    }
    for (const width of [1440, 390]) {
      await test(`${width} preview, synthetic play, pause/review, resize, finish and same-exercise retry`, async () => {
        const { context, page } = await makePage(browser, width, {
          ...defaults,
          tonalityId: "A-minor",
          progressionId: "minor-fifths",
          minMidi: 60,
          maxMidi: 76,
          durations: [1],
        });
        try {
          const initial = await snapshot(page),
            geometry = [check(initial)];
          await button(page, "Play example").click();
          await page
            .locator("[data-score-playhead]")
            .waitFor({ state: "visible" });
          await delay(350);
          geometry.push(check(await snapshot(page)));
          await button(page, "Stop example").click();
          await page.waitForFunction(() =>
            window.__chordAudio.contexts.every(
              (context) => context.state === "closed",
            ),
          );
          await button(page, "Start practice").click();
          await page.waitForFunction(
            () =>
              document.querySelector("[data-melody-phase]").dataset
                .melodyPhase === "playing",
          );
          await delay(550);
          geometry.push(check(await snapshot(page)));
          await button(page, "Pause").click();
          await page.waitForFunction(
            () =>
              document.querySelector("[data-melody-phase]").dataset
                .melodyPhase === "paused",
          );
          assert.equal(await clean(page), true);
          geometry.push(check(await snapshot(page)));
          await page.locator("[data-score-viewport]").evaluate((host) => {
            host.scrollLeft = host.scrollWidth;
          });
          geometry.push(check(await snapshot(page)));
          await page.setViewportSize({
            width: width === 390 ? 1440 : 390,
            height: 900,
          });
          await delay(250);
          geometry.push(check(await snapshot(page)));
          assert.equal((await snapshot(page)).stage.id, initial.stage.id);
          await button(page, "Resume from this note").click();
          await page.waitForFunction(
            () =>
              document.querySelector("[data-melody-phase]").dataset
                .melodyPhase === "playing",
          );
          await page.waitForFunction(
            () =>
              document.querySelector("[data-melody-phase]").dataset
                .melodyPhase === "result",
            null,
            { timeout: 25000 },
          );
          await page.getByRole("dialog").waitFor();
          await page.keyboard.press("Escape");
          await page.getByRole("dialog").waitFor({ state: "hidden" });
          geometry.push(check(await snapshot(page)));
          const completed = await snapshot(page);
          fs.writeFileSync(
            path.join(out, `${width}-completed-diagnostic.json`),
            JSON.stringify(
              {
                completed,
                audio: await page.evaluate(() => ({
                  cues: window.__chordAudio.cues,
                  frames: window.__chordAudio.frames,
                  scheduled: window.__chordAudio.scheduled,
                })),
              },
              null,
              2,
            ),
          );
          assert.equal(completed.stage.id, initial.stage.id);
          assert.ok(
            Object.keys(completed.colors).length >= initial.stage.events.length,
          );
          assert.ok(
            Object.values(completed.colors).some(
              (color) => color === "#15803d",
            ),
            "Real worklet/YIN synthetic input produces accepted notes",
          );
          assert.equal(await clean(page), true);
          const audio = await page.evaluate(() => ({
            historyChanges: window.__chordAudio.historyChanges,
            frames: window.__chordAudio.frames,
            measuredEvents: window.__chordReader().attemptEvents,
          }));
          assert.deepEqual(audio.historyChanges, []);
          const errors = audio.frames.flatMap((frame) =>
            frame.labels.map((label) =>
              Math.abs(
                label.x -
                  frame.bars.find((bar) => bar.index === label.barIndex)
                    .timeStartX,
              ),
            ),
          );
          assert.ok(Math.max(...errors) <= 2);
          await button(page, "Repeat this melody").click();
          await page.waitForFunction(
            () =>
              document.querySelector("[data-melody-phase]").dataset
                .melodyPhase === "countIn",
          );
          assert.equal((await snapshot(page)).stage.id, initial.stage.id);
          geometry.push(check(await snapshot(page)));
          await button(page, "End Game").click();
          await page.waitForFunction(
            () =>
              document.querySelector("[data-melody-phase]").dataset
                .melodyPhase === "landing",
          );
          assert.equal(await clean(page), true);
          await page.screenshot({
            path: path.join(out, `${width}-chord-review.png`),
          });
          return {
            id: initial.stage.id,
            geometry,
            maxFrameLabelErrorPx: Math.max(...errors),
            frames: audio.frames.length,
            committedColors: Object.keys(completed.colors).length,
            measuredInput: audio.measuredEvents.map(
              ({ observedMidi, onsetAudioSec, offsetAudioSec }) => ({
                observedMidi,
                onsetAudioSec,
                offsetAudioSec,
              }),
            ),
            historyChanges: audio.historyChanges,
            retryPreserved: true,
            cleanup: true,
          };
        } finally {
          await context.close();
        }
      });
    }
    assert.deepEqual(report.errors, [], "No browser runtime errors");
  } finally {
    await browser.close();
    await saveReport();
  }
  if (report.cases.some((test) => !test.passed)) process.exitCode = 1;
  console.log(
    JSON.stringify(
      {
        report: path.join(out, "report.json"),
        passed: report.cases.filter((test) => test.passed).length,
        failed: report.cases.filter((test) => !test.passed).length,
        errors: report.errors,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
