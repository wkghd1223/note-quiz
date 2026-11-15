/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated real React fixture. Instruments scorer calls in a temporary bundle only.
// No application server, microphone, storage or external request is used.
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
        import React, { useEffect, useState } from "react";
        import { createRoot } from "react-dom/client";
        import { useLiveResult } from "@/features/melody/hooks/useLiveResult";
        import { getScoringProfile } from "@/features/challenge/domain/instrument-profile";
        import { generateMelody } from "@/features/melody/domain/generator";
        import { defaultMelodySettings } from "@/features/melody/domain/settings";
        const profile = getScoringProfile(generateMelody(defaultMelodySettings, 1), "voice");
        function Fixture() {
          const [input, setInput] = useState({ active: true, events: [], profile, elapsed: 0, held: 0,
            targets: [{ stageEventId: "n1", targetConcertMidi: 60, startAudioSec: 0,
              endAudioSec: 1, kind: "note", requiresDistinctAttack: false }] });
          const result = useLiveResult(input.active, input.events, input.targets,
            input.profile, input.elapsed, input.held);
          useEffect(() => { window.fixture = { setInput, input, result }; });
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
    const inspect = () =>
      page.evaluate(() => ({
        calls: window.__scoreCalls,
        notes: window.fixture.result?.notes.map((note) => note.status) ?? null,
      }));
    assert.deepEqual(await inspect(), { calls: 1, notes: [] });
    // Each update is a separate browser paint, not a single React-batched loop.
    for (let tick = 1; tick <= 60; tick++) {
      await page.evaluate(
        (elapsed) => window.fixture.setInput((old) => ({ ...old, elapsed })),
        tick / 30,
      );
      await page.waitForFunction(
        (elapsed) => window.fixture.input.elapsed === elapsed,
        tick / 30,
      );
    }
    const clockOnly = await inspect();
    assert.deepEqual(clockOnly, { calls: 1, notes: ["missed"] });
    await page.evaluate(() =>
      window.fixture.setInput((old) => ({ ...old, held: 1 })),
    );
    await page.waitForFunction(() => window.fixture.input.held === 1);
    assert.deepEqual(await inspect(), { calls: 1, notes: [] });
    await page.evaluate(() =>
      window.fixture.setInput((old) => ({
        ...old,
        events: [
          {
            eventId: "input",
            inputMethod: "microphone",
            onsetAudioSec: 0,
            offsetAudioSec: 1,
            observedMidi: 60,
            medianCents: 0,
            validPitchRatio: 1,
            confidence: 1,
            attackConfidence: 1,
          },
        ],
      })),
    );
    await page.waitForFunction(
      () => window.fixture.result?.notes[0]?.status === "passed",
    );
    assert.deepEqual(await inspect(), { calls: 2, notes: ["passed"] });
    await page.evaluate(() =>
      window.fixture.setInput((old) => ({
        ...old,
        targets: old.targets.map((target) => ({
          ...target,
          targetConcertMidi: 62,
        })),
      })),
    );
    await page.waitForFunction(
      () => window.fixture.result?.notes[0]?.status === "failed",
    );
    assert.equal((await inspect()).calls, 3);
    await page.evaluate(() =>
      window.fixture.setInput((old) => ({
        ...old,
        profile: { ...old.profile, supported: false },
      })),
    );
    await page.waitForFunction(() => window.fixture.result?.unscorable);
    assert.equal((await inspect()).calls, 4);
    await page.evaluate(() =>
      window.fixture.setInput((old) => ({ ...old, active: false })),
    );
    await page.waitForFunction(() => window.fixture.result === null);
    assert.deepEqual(await inspect(), { calls: 4, notes: null });
    await page.evaluate(() =>
      window.fixture.setInput((old) => ({
        ...old,
        active: true,
        elapsed: 0,
        held: 0,
        events: [],
      })),
    );
    await page.waitForFunction(() => window.fixture.input.active);
    assert.deepEqual(await inspect(), { calls: 5, notes: [] });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify(
        {
          outcome: "passed",
          clockUpdates: 60,
          additionalClockScoringCalls: clockOnly.calls - 1,
          realReact: true,
          realScorer: true,
          inputTargetProfileAndRestartRecomputed: true,
          microphone: "not used",
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
