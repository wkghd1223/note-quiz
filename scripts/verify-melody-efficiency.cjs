/* eslint-disable @typescript-eslint/no-require-imports */
// Real React + Zustand + production scorer in an isolated bundle. Capture
// progress is explicit synthetic metadata; no microphone or acoustic claims.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { build } = require("esbuild");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");
(async () => {
  const bundle = await build({
    stdin: {
      resolveDir: root,
      loader: "tsx",
      contents: `
        import React, { useEffect } from "react";
        import { createRoot } from "react-dom/client";
        import { createChallengeStore } from "@/features/challenge/store/challengeStore";
        import { generateMelody } from "@/features/melody/domain/generator";
        import { defaultMelodySettings } from "@/features/melody/domain/settings";
        const melody = generateMelody({ ...defaultMelodySettings, bpm: 60,
          durations: [1], minMidi: 60, maxMidi: 60 }, 1);
        const store = createChallengeStore(melody);
        function Fixture() {
          const result = store(state => state.liveResult);
          globalThis.__renders = (globalThis.__renders || 0) + 1;
          useEffect(() => { window.fixture = { store, melody, result }; });
          return <output>{JSON.stringify(result?.notes ?? null)}</output>;
        }
        createRoot(document.getElementById("root")).render(<Fixture />);
      `,
    },
    alias: { "@": path.join(root, "src") },
    bundle: true,
    write: false,
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "count-real-scorer-calls",
        setup(builder) {
          builder.onLoad(
            { filter: /[/\\]domain[/\\]scoring\.ts$/ },
            async ({ path: file }) => {
              const source = fs.readFileSync(file, "utf8");
              const pattern =
                /(export function scoreAttempt\([\s\S]*?\): AttemptResult \{)/;
              assert.match(source, pattern);
              return {
                loader: "ts",
                contents: source.replace(
                  pattern,
                  "$1\n globalThis.__scoreCalls = (globalThis.__scoreCalls || 0) + 1;",
                ),
              };
            },
          );
        },
      },
    ],
  });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH,
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.waitForFunction(() => !!window.fixture);
    await page.evaluate(() => {
      const { store, melody } = window.fixture;
      const options = {
        stageId: melody.id,
        profileId: "voice",
        inputMethod: "microphone",
        mode: "challenge",
      };
      const token = store.getState().startAttempt(options);
      store.getState().beginPlaying(token, 10);
      const segment = store.getState().segmentToken;
      store.getState().addEvent(token, segment, {
        eventId: "first",
        inputMethod: "microphone",
        onsetAudioSec: 10,
        offsetAudioSec: 11,
        observedMidi: 60,
        medianCents: 0,
        validPitchRatio: 1,
        confidence: 1,
        attackConfidence: 1,
      });
      window.attempt = { token, segment, options };
    });
    for (let tick = 1; tick <= 60; tick++) {
      await page.evaluate((tick) => {
        const { token, segment } = window.attempt;
        // The first input is closed. The next sound is still open at 11.01;
        // output/RAF time alone must not declare it missed or rejudge history.
        window.fixture.store
          .getState()
          .advanceJudgments(token, segment, 10 + tick / 30, 11.01);
      }, tick);
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    await page.waitForFunction(() => window.fixture.result?.notes.length === 1);
    const afterClock = await page.evaluate(() => ({
      calls: window.__scoreCalls || 0,
      renders: window.__renders,
      statuses: window.fixture.result.notes.map((note) => note.status),
    }));
    assert.deepEqual(afterClock, {
      calls: 1,
      renders: 2,
      statuses: ["passed"],
    });
    const lifecycle = await page.evaluate(() => {
      const { store } = window.fixture;
      const { token, segment, options } = window.attempt;
      const first = store.getState().liveResult.notes[0];
      store.getState().pause(token, 11.2);
      const pausePreserved = store.getState().liveResult.notes[0] === first;
      store.getState().resume(token);
      store.getState().beginPlaying(token, 50);
      const beforeStale = store.getState().liveResult;
      store.getState().advanceJudgments(token, segment, 999, 999);
      const staleIgnored = store.getState().liveResult === beforeStale;
      const result = store.getState().finish(token);
      const finalPreserved = result.notes[0] === first;
      store.getState().startAttempt(options);
      return {
        pausePreserved,
        staleIgnored,
        finalPreserved,
        retryCleared: store.getState().liveResult === null,
      };
    });
    assert.deepEqual(lifecycle, {
      pausePreserved: true,
      staleIgnored: true,
      finalPreserved: true,
      retryCleared: true,
    });
    await page.waitForFunction(() => window.fixture.result === null);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify(
        {
          outcome: "passed",
          clockUpdates: 60,
          wholeAttemptRejudgments: 0,
          committedWindowScoringCalls: afterClock.calls,
          judgmentRenders: afterClock.renders - 1,
          realReact: true,
          realScorer: true,
          capture: "synthetic progress metadata",
          ...lifecycle,
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
