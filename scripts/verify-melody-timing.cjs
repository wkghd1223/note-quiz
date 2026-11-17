/* eslint-disable @typescript-eslint/no-require-imports */
// Existing server + a new, visible Orca split tab. No clock/event/result injection.
// Input is a synthesized MediaStream, not an acoustic microphone; DOM glyphs,
// AudioContext, worklet/YIN, React commits and alphaTab rerenders remain real.
// Usage: UI_BASE_URL=http://localhost:3013 TIMING_SECONDS=20 node scripts/verify-melody-timing.cjs
// TIMING_TRANSPORT=playwright uses an existing PLAYWRIGHT_MODULE installation for a separate Chromium cadence comparison.
// Optional TIMING_SETTINGS_JSON temporarily supplies settings; exact prior origin storage is restored.
// TIMING_INPUT_MIDI=40 supplies E2 regardless of score pitch, to check low-voice capture without octave correction.
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const cli =
  process.env.ORCA_CLI_COMMAND ||
  (process.env.ORCA_DEV_REPO_ROOT ? "orca-dev" : "orca");
const base = process.env.UI_BASE_URL || "http://localhost:3013";
const output =
  process.env.TIMING_REPORT_PATH || "/tmp/note-quiz-melody-native-timing.json";
const seconds = Number(process.env.TIMING_SECONDS || 20);
if (!Number.isFinite(seconds) || seconds < 5 || seconds > 50)
  throw Error("TIMING_SECONDS must be 5..50");
const transport = process.env.TIMING_TRANSPORT || "orca";
const inputMidi =
  process.env.TIMING_INPUT_MIDI === undefined
    ? null
    : Number(process.env.TIMING_INPUT_MIDI);
if (
  inputMidi !== null &&
  (!Number.isInteger(inputMidi) || inputMidi < 36 || inputMidi > 84)
)
  throw Error("TIMING_INPUT_MIDI must be 36..84");
let browser, browserContext, browserPage;
async function orca(...args) {
  if (transport === "playwright") {
    if (args[0] === "tab" && args[1] === "create") {
      const { chromium } = require(
        process.env.PLAYWRIGHT_MODULE || "playwright",
      );
      browser = await chromium.launch({
        headless: process.env.TIMING_HEADFUL !== "1",
        ...(process.env.BROWSER_PATH
          ? { executablePath: process.env.BROWSER_PATH }
          : {}),
      });
      browserContext = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        locale: "en-US",
        reducedMotion:
          process.env.TIMING_REDUCED_MOTION === "reduce"
            ? "reduce"
            : "no-preference",
      });
      await browserContext.route("**/*", (route) => {
        const request = route.request();
        return new URL(request.url()).origin === new URL(base).origin &&
          ["GET", "HEAD"].includes(request.method())
          ? route.continue()
          : route.abort();
      });
      browserPage = await browserContext.newPage();
      await browserPage.goto(args[args.indexOf("--url") + 1]);
      return { browserPageId: "playwright-owned-native-timing" };
    }
    if (args[0] === "tab" && args[1] === "close") {
      await browser?.close();
      return { closed: true };
    }
    if (args[0] === "reload") {
      await browserPage.reload();
      return {};
    }
    if (args[0] === "eval")
      return {
        result: await browserPage.evaluate(
          args[args.indexOf("--expression") + 1],
        ),
      };
    if (args[0] === "snapshot") {
      const button = browserPage
        .getByRole("button", { name: /^Start\s/ })
        .first();
      return {
        refs: { start: { role: "button", name: await button.textContent() } },
      };
    }
    if (args[0] === "click") {
      await browserPage
        .getByRole("button", { name: /^Start\s/ })
        .first()
        .click();
      return {};
    }
    throw Error(`Unsupported timing transport action ${args[0]}`);
  }
  const value = JSON.parse(
    execFileSync(cli, [...args, "--json"], {
      encoding: "utf8",
      maxBuffer: 40 * 1024 * 1024,
      timeout: 75000,
    }),
  );
  if (!value.ok) throw Error(JSON.stringify(value));
  return value.result;
}
let page;
let previousSettings;
let changedSettings = false;
async function evaluate(fn, ...args) {
  const expression = `(${fn.toString()})(...${JSON.stringify(args)})`;
  const value = (await orca("eval", "--page", page, "--expression", expression))
    .result;
  return typeof value === "string" ? JSON.parse(value) : value;
}
function readActualView() {
  const host = document.querySelector("[data-score-viewport]");
  if (!host) return null;
  let root = host[Object.keys(host).find((k) => k.startsWith("__reactFiber"))];
  while (root?.return) root = root.return;
  const stack = [root?.stateNode?.current || root];
  let view, attempt;
  while (stack.length) {
    const f = stack.pop();
    if (!f) continue;
    if (f.child) stack.push(f.child);
    if (f.sibling) stack.push(f.sibling);
    if (f.memoizedProps?.stage?.id && f.memoizedProps.targets) view = f;
    for (let h = f.memoizedState; h && typeof h === "object"; h = h.next) {
      const s = h.memoizedState;
      if (s?.phase && Array.isArray(s.events) && s.attemptToken !== undefined)
        attempt = s;
    }
  }
  if (!view) return null;
  let bounds;
  for (let h = view.memoizedState; h; h = h.next) {
    const state = h.memoizedState;
    if (state?.events && typeof state.width === "number" && state.measures)
      bounds = state;
  }
  return { props: view.memoizedProps, attempt, bounds, host };
}
(async () => {
  try {
    page = (
      await orca(
        "tab",
        "create",
        "--url",
        `${base}/en/melody`,
        "--split",
        "right",
      )
    ).browserPageId;
    if (process.env.TIMING_SETTINGS_JSON) {
      const settings = JSON.parse(process.env.TIMING_SETTINGS_JSON);
      previousSettings = await evaluate(() =>
        JSON.stringify(localStorage.getItem("note-quiz-melody-settings-v1")),
      );
      changedSettings = true;
      await evaluate((settings) => {
        localStorage.setItem(
          "note-quiz-melody-settings-v1",
          JSON.stringify(settings),
        );
        return true;
      }, settings);
      await orca("reload", "--page", page);
    }
    // A snapshot establishes this new tab's controls; the coordinator tab is untouched.
    let snapshot = await orca("snapshot", "--page", page, "--interactive");
    const ready = await evaluate(async () => {
      for (let i = 0; i < 100; i++) {
        const button = [...document.querySelectorAll("button")].find((n) =>
          /^Start\s/.test(n.textContent.trim()),
        );
        if (
          button &&
          !button.disabled &&
          document.querySelector('[data-rendered="true"]')
        )
          return true;
        await new Promise((r) => setTimeout(r, 100));
      }
      return false;
    });
    if (!ready) throw Error("Rendered Start button did not become ready");
    const buildProof = await evaluate(async (expected) => {
      const html = await (
        await fetch(location.href, { cache: "no-store" })
      ).text();
      const normalized = html.replaceAll('\\"', '"');
      return {
        expected: expected || null,
        matchesExpected: expected ? html.includes(expected) : null,
        buildHint: normalized.match(/"b":"([^"]+)"/)?.[1] || null,
      };
    }, process.env.EXPECTED_BUILD_ID || null);
    if (buildProof.matchesExpected === false)
      throw Error("Expected production build identifier was not found");
    const reader = readActualView.toString();
    await evaluate((source) => {
      window.__readActualTimingView = new Function(`return (${source})`)();
      return true;
    }, reader);
    const baseline = await evaluate(async () => {
      const ticks = [];
      for (let i = 0; i < 14; i++)
        ticks.push(await new Promise((r) => requestAnimationFrame(r)));
      return {
        gaps: ticks.slice(1).map((v, i) => v - ticks[i]),
        visibility: document.visibilityState,
        focus: document.hasFocus(),
      };
    });
    const installed = await evaluate((inputMidi) => {
      const Native = window.AudioContext;
      const state = (window.__nativeMelodyTiming = {
        contexts: [],
        clicks: [],
        frames: [],
        commits: [],
        renders: [],
        source: null,
        scheduled: false,
      });
      window.AudioContext = class extends Native {
        constructor(...args) {
          super(...args);
          state.contexts.push(this);
        }
        createBufferSource() {
          const node = super.createBufferSource(),
            start = node.start.bind(node);
          node.start = (at) => {
            state.clicks.push({ at, duration: node.buffer?.duration });
            start(at);
          };
          return node;
        }
      };
      navigator.mediaDevices.getUserMedia = async () => {
        const context = state.contexts.at(-1);
        const sink = context.createMediaStreamDestination();
        state.source = { context, sink, Native };
        return sink.stream;
      };
      const sample = (destination = state.frames) => {
        const view = window.__readActualTimingView();
        const c = state.contexts.at(-1);
        const rail = document.querySelector("[data-score-rail]");
        const line = document
          .querySelector("[data-score-playhead]")
          ?.getBoundingClientRect();
        if (view && c && line && view.props.active) {
          const { props, host, attempt, bounds } = view;
          state.events = attempt?.events;
          const meter = props.stage.timeSignature;
          const pulses = meter[0] === 6 && meter[1] === 8 ? 2 : meter[0];
          const pulse = ((meter[1] === 8 ? 1.5 : 1) * 60) / props.stage.bpm;
          if (
            !state.scheduled &&
            state.source &&
            state.clicks.length >= pulses
          ) {
            state.scheduled = true;
            state.start = state.clicks[0].at + pulses * pulse;
            state.stage = props.stage;
            state.targets = props.targets;
            // Native virtual microphone PCM supplies measured judgments. Never
            // call addEvent, change results, override currentTime, or move glyphs.
            for (const target of props.targets) {
              if (target.kind !== "note") continue;
              const osc =
                state.source.Native.prototype.createOscillator.call(c);
              const gain = c.createGain();
              gain.gain.value = 0.2;
              osc.frequency.value =
                440 *
                2 ** (((inputMidi ?? target.targetConcertMidi) - 69) / 12);
              osc.connect(gain);
              gain.connect(state.source.sink);
              const start = state.start + target.startAudioSec;
              osc.start(start);
              osc.stop(
                start + 0.8 * (target.endAudioSec - target.startAudioSec),
              );
            }
          }
          const nodes = [...host.querySelectorAll("text")].filter((n) => {
            const code = n.textContent.codePointAt(0);
            return code >= 0xe0a0 && code <= 0xe0ff;
          });
          const notes = props.stage.events.filter((e) => e.kind === "note");
          const railRect = rail.getBoundingClientRect();
          const scale = railRect.width / rail.offsetWidth;
          const stamp = c.getOutputTimestamp?.();
          const perf = performance.now();
          const rendered = host.querySelector("[data-rendered]");
          destination.push({
            perf,
            audio: c.currentTime,
            presentedAudio:
              stamp?.contextTime > 0 &&
              stamp.performanceTime > 0 &&
              perf - stamp.performanceTime >= 0 &&
              perf - stamp.performanceTime < 250
                ? stamp.contextTime + (perf - stamp.performanceTime) / 1000
                : null,
            elapsed: props.elapsed,
            segmentStart: attempt?.segmentStartAudioSec,
            phase: attempt?.phase,
            visible: document.visibilityState,
            hasFocus: document.hasFocus(),
            rendered: rendered?.dataset.rendered,
            hiddenGlyphs: nodes[0]
              ? getComputedStyle(nodes[0]).visibility !== "visible"
              : true,
            colors: host.dataset.scoreColors,
            viewport: [innerWidth, innerHeight],
            currentLabel: document.querySelector("dl")?.textContent,
            pitchLabel: document.querySelector("[data-pitch-feedback]")
              ?.textContent,
            heads: nodes.map((node, i) => {
              const rect = node.getBoundingClientRect();
              return {
                id: notes[i]?.id,
                fill: getComputedStyle(node).fill,
                delta: rect.x + rect.width / 2 - line.x,
                localX: (rect.x + rect.width / 2 - railRect.x) / scale,
                anchor: bounds?.events.find((e) => e.id === notes[i]?.id)
                  ?.anchorX,
              };
            }),
          });
        }
      };
      const tick = () => {
        sample();
        state.raf = requestAnimationFrame(tick);
      };
      // Observe the real React DOM commit rather than reading the prior frame
      // from a diagnostic RAF registered before the application's own tick.
      state.observer = new MutationObserver(() => sample(state.commits));
      state.observer.observe(document.querySelector("[data-score-rail]"), {
        attributes: true,
        attributeFilter: ["style"],
      });
      state.renderObserver = new MutationObserver(() => {
        const host = document.querySelector(
          "[data-score-viewport] [data-rendered]",
        );
        const previous = state.renders.at(-1);
        const value = {
          perf: performance.now(),
          rendered: host?.dataset.rendered,
          visibility: host?.style.visibility,
        };
        if (
          !previous ||
          previous.rendered !== value.rendered ||
          previous.visibility !== value.visibility
        )
          state.renders.push(value);
      });
      state.renderObserver.observe(
        document.querySelector("[data-score-viewport]"),
        {
          subtree: true,
          attributes: true,
          attributeFilter: ["style", "data-rendered"],
        },
      );
      state.raf = requestAnimationFrame(tick);
      return {
        visibility: document.visibilityState,
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        viewport: [innerWidth, innerHeight],
      };
    }, inputMidi);
    snapshot = await orca("snapshot", "--page", page, "--interactive");
    const entry = Object.entries(snapshot.refs || {}).find(
      ([, value]) => value.role === "button" && /^Start\s/.test(value.name),
    );
    if (!entry) throw Error("Start control not found in snapshot");
    await orca("click", "--page", page, "--element", `@${entry[0]}`);
    const collected = await evaluate(async (seconds) => {
      await new Promise((r) => setTimeout(r, seconds * 1000));
      const s = window.__nativeMelodyTiming;
      cancelAnimationFrame(s.raf);
      s.observer.disconnect();
      s.renderObserver.disconnect();
      const context = s.contexts.at(-1);
      return JSON.stringify({
        installedClock: "native currentTime, never overridden",
        stage: s.stage,
        targets: s.targets,
        start: s.start,
        clicks: s.clicks,
        frames: s.frames,
        commits: s.commits,
        renders: s.renders,
        events: (s.events || []).map((event) => ({
          ...event,
          pitchSamples: undefined,
        })),
        baseLatency: context?.baseLatency,
        outputLatency: context?.outputLatency,
        sampleRate: context?.sampleRate,
      });
    }, seconds);
    const frames = collected.commits || [];
    const rafFrames = collected.frames || [];
    const committedGlyphs = new Map();
    const committedGlyphChanges = [];
    for (const frame of rafFrames)
      for (const head of frame.heads) {
        if (!head.id) continue;
        const prior = committedGlyphs.get(head.id);
        if (prior && prior !== head.fill)
          committedGlyphChanges.push({
            id: head.id,
            before: prior,
            after: head.fill,
            elapsed: frame.elapsed,
          });
        if (["rgb(21, 128, 61)", "rgb(185, 28, 28)"].includes(head.fill))
          committedGlyphs.set(head.id, head.fill);
      }
    const gaps = rafFrames.slice(1).map((f, i) => f.perf - rafFrames[i].perf);
    const crossings = [];
    for (const target of collected.targets || []) {
      if (target.kind !== "note") continue;
      const id = target.sourceEventId || target.stageEventId;
      for (let i = 1; i < frames.length; i++) {
        const a = frames[i - 1],
          b = frames[i],
          x = a.heads.find((h) => h.id === id),
          y = b.heads.find((h) => h.id === id);
        if (!x || !y || x.delta <= 0 || y.delta > 0) continue;
        const fraction = x.delta / (x.delta - y.delta);
        const startClock = a.presentedAudio ?? a.audio;
        const endClock = b.presentedAudio ?? b.audio;
        const audio = startClock + fraction * (endClock - startClock);
        crossings.push({
          id,
          expectedAudio: collected.start + target.startAudioSec,
          crossingAudio: audio,
          interpolatedErrorMs:
            (audio - collected.start - target.startAudioSec) * 1000,
          firstPostCrossingCommitErrorMs:
            (endClock - collected.start - target.startAudioSec) * 1000,
          renderClockErrorMs:
            (a.audio +
              fraction * (b.audio - a.audio) -
              collected.start -
              target.startAudioSec) *
            1000,
          interpretation:
            "Interpolation locates the crossing between commits; actual motion is sampled at frame cadence, so retain the bracketing interval.",
          glyphVisible: !a.hiddenGlyphs && !b.hiddenGlyphs,
          frameGapMs: b.perf - a.perf,
        });
        break;
      }
    }
    let maxAnchorError = 0,
      maxRerenderAnchorShift = 0,
      colorsChanged = 0;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i],
        previous = frames[i - 1];
      for (const head of f.heads) {
        if (Number.isFinite(head.anchor))
          maxAnchorError = Math.max(
            maxAnchorError,
            Math.abs(head.localX - head.anchor),
          );
        if (previous && previous.colors !== f.colors) {
          const before = previous.heads.find((h) => h.id === head.id);
          if (before)
            maxRerenderAnchorShift = Math.max(
              maxRerenderAnchorShift,
              Math.abs(head.localX - before.localX),
            );
        }
      }
      if (previous && previous.colors !== f.colors) colorsChanged++;
    }
    const hiddenSpansMs = [];
    let hiddenAt = null;
    for (const entry of collected.renders || []) {
      if (entry.visibility === "hidden" && hiddenAt === null)
        hiddenAt = entry.perf;
      if (entry.visibility !== "hidden" && hiddenAt !== null) {
        hiddenSpansMs.push(entry.perf - hiddenAt);
        hiddenAt = null;
      }
    }
    const leads = frames
      .filter((f) => f.presentedAudio !== null)
      .map((f) => (f.audio - f.presentedAudio) * 1000);
    const medianGap = gaps.slice().sort((a, b) => a - b)[
      Math.floor(gaps.length / 2)
    ];
    const foreground =
      frames.length > 10 && frames.every((f) => f.visible === "visible");
    const temporalResolutionSufficient =
      foreground && medianGap <= 34 && Math.max(0, ...gaps) < 100;
    const velocities = frames.slice(1).flatMap((frame, i) => {
      const previous = frames[i];
      const a = previous.heads[0],
        b = frame.heads[0];
      const dt = frame.elapsed - previous.elapsed;
      return previous.phase === "playing" &&
        frame.phase === "playing" &&
        dt > 0.005 &&
        a &&
        b
        ? [(a.delta - b.delta) / dt]
        : [];
    });
    const minVelocity = Math.min(...velocities),
      maxVelocity = Math.max(...velocities);
    const summary = {
      page,
      transport,
      seconds,
      installed,
      buildProof,
      baseline,
      rendererHiddenSpansMs: hiddenSpansMs,
      rafFrameCount: rafFrames.length,
      commitCount: frames.length,
      temporalResolutionSufficient,
      foregroundEvidence: foreground,
      medianFrameGapMs: medianGap,
      maxFrameGapMs: Math.max(0, ...gaps),
      crossings,
      pixelsPerSecond: [minVelocity, maxVelocity],
      velocityRatio: maxVelocity / minVelocity,
      colorsChanged,
      committedGlyphCount: committedGlyphs.size,
      committedGlyphChanges,
      judgmentHistoryPassed:
        committedGlyphs.size > 0 && committedGlyphChanges.length === 0,
      inputMidi,
      measuredInputPitches: [
        ...new Set((collected.events || []).map((event) => event.observedMidi)),
      ],
      observedPitchLabels: [
        ...new Set(rafFrames.map((frame) => frame.pitchLabel).filter(Boolean)),
      ],
      hiddenGlyphFrameCount: frames.filter((f) => f.hiddenGlyphs).length,
      maxLocalAnchorErrorPx: maxAnchorError,
      maxAnchorShiftAtColorChangePx: maxRerenderAnchorShift,
      outputRenderLeadMs: leads.length
        ? [Math.min(...leads), Math.max(...leads)]
        : null,
      physicalMicrophoneVerified: false,
      acousticOutputVerified: false,
      interpretation: temporalResolutionSufficient
        ? "Native-clock browser DOM evidence; input is a virtual synthesized stream and does not establish acoustic sync."
        : "Insufficient temporal resolution; visible-tab traces are retained, but coarse cadence cannot establish fine-grained perceptual synchronization.",
    };
    const temporalErrorBudgetMs =
      Math.max(0, ...gaps) + (1000 * 128) / collected.sampleRate;
    summary.temporalErrorBudgetMs = temporalErrorBudgetMs;
    summary.diagnosticPassed =
      temporalResolutionSufficient &&
      crossings.length >= 3 &&
      colorsChanged > 0 &&
      summary.judgmentHistoryPassed &&
      maxVelocity / minVelocity < 1.01 &&
      maxAnchorError <= 2 &&
      summary.hiddenGlyphFrameCount === 0 &&
      hiddenSpansMs.length === 0 &&
      crossings.every(
        (c) => Math.abs(c.interpolatedErrorMs) <= temporalErrorBudgetMs,
      ) &&
      (inputMidi === null || summary.measuredInputPitches.includes(inputMidi));
    // Healthy cadence alone must never pass a visually wrong crossing.
    if (!summary.diagnosticPassed) process.exitCode = 1;
    fs.writeFileSync(
      output,
      JSON.stringify({ summary, trace: collected }, null, 2),
    );
    process.stdout.write(
      JSON.stringify({ report: output, ...summary }, null, 2) + "\n",
    );
  } finally {
    if (page) {
      if (changedSettings)
        await evaluate((previous) => {
          if (previous === null)
            localStorage.removeItem("note-quiz-melody-settings-v1");
          else localStorage.setItem("note-quiz-melody-settings-v1", previous);
          return true;
        }, previousSettings);
      await orca("tab", "close", "--page", page);
    } else if (browser) await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
