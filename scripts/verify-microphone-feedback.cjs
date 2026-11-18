/* eslint-disable @typescript-eslint/no-require-imports */
// Native Orca QA only: owned origin/page, synthetic WebAudio MediaStream, real
// production Analyser/YIN and Worklet/YIN. Never requests an acoustic device.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const cli =
  process.env.ORCA_CLI_COMMAND ||
  (process.env.ORCA_DEV_REPO_ROOT ? "orca-dev" : "orca");
const base = process.env.UI_BASE_URL;
if (!base || !process.env.MIC_QA_OWNED_ORIGIN)
  throw Error(
    "Explicit unique owned UI_BASE_URL and MIC_QA_OWNED_ORIGIN=1 required",
  );
const out =
  process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-mic-integration-qa/browser";
fs.mkdirSync(out, { recursive: true });
const report = {
  base,
  nativeOrca: true,
  physicalMicrophone: false,
  syntheticPCM: true,
  cases: [],
  actions: [],
  limitations: [],
  screenshots: [],
};
let page, storage;
function orca(...args) {
  let raw;
  try {
    raw = execFileSync(cli, [...args, "--json"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      timeout: 75000,
    });
  } catch (error) {
    throw Error(String(error) + "\n" + error.stdout + "\n" + error.stderr);
  }
  const result = JSON.parse(raw);
  if (!result.ok) throw Error(JSON.stringify(result));
  return result.result;
}
function ev(fn, ...args) {
  let r = orca(
    "eval",
    "--page",
    page,
    "--expression",
    `(${fn.toString()})(...${JSON.stringify(args)})`,
  ).result;
  if (typeof r !== "string") return r;
  try {
    return JSON.parse(r);
  } catch {
    return r;
  }
}
async function waitFor(fn, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (ev(fn)) return;
    await new Promise((r) => setTimeout(r, 120));
  }
  throw Error(label);
}
async function test(name, fn) {
  if (
    process.env.MIC_QA_CASES &&
    !new RegExp(process.env.MIC_QA_CASES).test(name)
  )
    return;
  console.log("CASE " + name);
  try {
    const proof = await fn();
    report.cases.push({ name, passed: true, proof });
  } catch (e) {
    report.cases.push({ name, passed: false, error: e.stack });
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2),
    );
  }
}
function action(...args) {
  const r = orca(...args, "--page", page);
  report.actions.push({ args, effects: r.effects });
  return r;
}
function viewport(width, height = width === 390 ? 844 : 1000) {
  action(
    "viewport",
    "--width",
    String(width),
    "--height",
    String(height),
    "--scale",
    "1",
    ...(width < 640 ? ["--mobile"] : []),
  );
  let actual = ev(() => ({
    width: innerWidth,
    height: innerHeight,
    dpr: devicePixelRatio,
  }));
  if (width >= 640 && Math.abs(actual.width - width) > 1) {
    action(
      "viewport",
      "--width",
      String(Math.round((width * width) / actual.width)),
      "--height",
      String(Math.round((height * height) / actual.height)),
      "--scale",
      "1",
    );
    actual = ev(() => ({
      width: innerWidth,
      height: innerHeight,
      dpr: devicePixelRatio,
    }));
  }
  report.viewportProof ??= [];
  report.viewportProof.push({ requested: [width, height], actual });
  return actual;
}
function shot(name) {
  const r = orca("screenshot", "--page", page);
  report.screenshots.push({ name, result: r });
  return r;
}
function snapshot() {
  return orca("snapshot", "--page", page, "--interactive");
}
function clickSelector(selector) {
  snapshot();
  if (ev(() => matchMedia("(pointer: coarse)").matches)) {
    ev((selector) => {
      const n = [...document.querySelectorAll(selector)].find(
        (n) => !n.disabled && getComputedStyle(n).visibility === "visible",
      );
      n.focus();
      return true;
    }, selector);
    return action("keypress", "--key", "Space");
  }
  const box = ev((selector) => {
    const node = [...document.querySelectorAll(selector)].find(
      (n) =>
        !n.disabled &&
        getComputedStyle(n).visibility === "visible" &&
        n.getBoundingClientRect().width > 0,
    );
    if (!node) throw Error("Visible button absent " + selector);
    node.scrollIntoView({ block: "center", behavior: "instant" });
    const r = node.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, selector);
  action("mouse", "move", "--x", String(box.x), "--y", String(box.y));
  action("mouse", "down");
  return action("mouse", "up");
}
function nativeSelect(selector, value) {
  const label = ev((sel) => {
    const n = document.querySelector(sel);
    return (
      n.closest("label")?.childNodes[0]?.textContent.trim() ||
      n.getAttribute("aria-label")
    );
  }, selector);
  const s = snapshot();
  const entry = Object.entries(s.refs || {}).find(
    ([, v]) => v.role === "combobox" && v.name === label,
  );
  if (!entry) throw Error("No select ref " + label);
  return action("select", "--element", "@" + entry[0], "--value", value);
}
function readView() {
  const host = document.querySelector("[data-score-viewport]");
  if (!host) return null;
  let root = host[Object.keys(host).find((k) => k.startsWith("__reactFiber"))];
  while (root?.return) root = root.return;
  const stack = [root?.stateNode?.current || root];
  let view, attempt, review, frame, audio;
  while (stack.length) {
    const f = stack.pop();
    if (!f) continue;
    if (f.child) stack.push(f.child);
    if (f.sibling) stack.push(f.sibling);
    if (f.memoizedProps?.stage?.id && f.memoizedProps.targets) view = f;
    if (
      f.memoizedProps?.events &&
      f.memoizedProps?.m &&
      "selectedId" in f.memoizedProps
    )
      review = f.memoizedProps;
    for (let h = f.memoizedState; h && typeof h === "object"; h = h.next) {
      const s = h.memoizedState;
      if (s?.current?.context && Array.isArray(s.current.calibration))
        audio = {
          noiseFloor: s.current.noiseFloor,
          calibration: [...s.current.calibration],
          collectAfter: s.current.collectAfter,
          collectionStarted: s.current.collectionStarted,
        };
      if (s && typeof s.audioTimeSec === "number" && "detectedHz" in s)
        frame = s;
      if (s?.phase && Array.isArray(s.events) && s.attemptToken !== undefined)
        attempt = s;
    }
  }
  if (!view) return null;
  let bounds;
  for (let h = view.memoizedState; h; h = h.next) {
    const s = h.memoizedState;
    if (s?.events && typeof s.width === "number" && s.measures) bounds = s;
  }
  return {
    props: view.memoizedProps,
    attempt,
    bounds,
    review,
    frame,
    audio,
    host,
  };
}
function install(rate = 48000) {
  return ev(
    (source, requested) => {
      window.__qaRead = new Function("return (" + source + ")")();
      const Native = window.AudioContext,
        NativeWorklet = window.AudioWorkletNode;
      const q = (window.__micQA = {
        contexts: [],
        frames: [],
        streams: [],
        requests: 0,
        answerChanges: [],
        cues: [],
        piano: [],
        oscillators: [],
        hops: [],
        analysis: [],
        ui: [],
        raf: [],
        basic: [],
        mode: "silence",
        hz: 440,
        amplitude: 0.12,
        requested,
        settings: [],
        start: null,
        schedule: false,
      });
      window.AudioContext = class extends Native {
        constructor(options) {
          super({ ...options, sampleRate: requested });
          q.contexts.push(this);
        }
        createAnalyser() {
          const a = super.createAnalyser(),
            get = a.getFloatTimeDomainData.bind(a),
            freq = a.getFloatFrequencyData.bind(a);
          a.getFloatTimeDomainData = (b) => {
            get(b);
            q.basic.push({
              at: performance.now(),
              rate: this.sampleRate,
              size: b.length,
              audio: this.currentTime,
              peak: Math.max(...b.map(Math.abs)),
            });
            q.analysisStart = performance.now();
          };
          a.getFloatFrequencyData = (b) => {
            freq(b);
            if (q.analysisStart) {
              q.analysis.push(performance.now() - q.analysisStart);
              q.analysisStart = null;
            }
          };
          return a;
        }
        createOscillator() {
          const n = super.createOscillator(),
            start = n.start.bind(n),
            stop = n.stop.bind(n);
          n.start = (at, ...args) => {
            const r = {
              at,
              frequency: n.frequency.value,
              when: performance.now(),
              stops: [],
            };
            q.oscillators.push(r);
            n.stop = (...a) => {
              r.stops.push(a);
              return stop(...a);
            };
            return start(at, ...args);
          };
          return n;
        }
        createBufferSource() {
          const n = super.createBufferSource(),
            start = n.start.bind(n),
            stop = n.stop.bind(n);
          n.start = (at, ...args) => {
            const r = {
              at,
              duration: n.buffer?.duration,
              when: performance.now(),
              stops: [],
              sampleRate: n.buffer?.sampleRate,
              channels: n.buffer?.numberOfChannels,
              samples:
                n.buffer?.duration >= 0.1
                  ? Array.from(
                      n.buffer
                        .getChannelData(0)
                        .slice(
                          Math.floor(0.15 * this.sampleRate),
                          Math.floor(0.15 * this.sampleRate) + 2048,
                        ),
                    )
                  : undefined,
            };
            (r.duration < 0.1 ? q.cues : q.piano).push(r);
            n.stop = (...a) => {
              r.stops.push(a);
              return stop(...a);
            };
            return start(at, ...args);
          };
          return n;
        }
      };
      window.AudioWorkletNode = class extends NativeWorklet {
        constructor(...args) {
          super(...args);
          const port = this.port;
          Object.defineProperty(port, "onmessage", {
            configurable: true,
            set(handler) {
              port.addEventListener("message", (e) => {
                if (e.data.type !== "frame") return handler(e);
                const d = e.data,
                  t = performance.now(),
                  clock = args[0].currentTime;
                const rec = {
                  at: t,
                  sampleRate: d.sampleRate,
                  index: d.streamSampleIndex,
                  audio: d.audioTimeSec,
                  pitch: d.pitchAudioTimeSec,
                  dropped: d.droppedHops,
                  queueMs: (clock - d.audioTimeSec) * 1000,
                  rms: d.rms,
                };
                if (q.captureWindows && q.hops.length < 12)
                  rec.pcm = Array.from(new Float32Array(d.buffer));
                handler(e);
                rec.processingMs = performance.now() - t;
                q.hops.push(rec);
              });
              port.start();
            },
          });
        }
      };
      navigator.mediaDevices.getUserMedia = async () => {
        q.requests++;
        if (q.permissionLatch)
          await new Promise((resolve) => {
            q.releasePermission = resolve;
          });
        const previous = q.contexts.at(-1);
        const context =
          previous && previous.state !== "closed"
            ? previous
            : new window.AudioContext();
        const sink = context.createMediaStreamDestination();
        const source = context.createBufferSource();
        void source;
        await context.audioWorklet.addModule(
          URL.createObjectURL(
            new Blob(
              [
                `class QAPCM extends AudioWorkletProcessor{constructor(){super();this.mode='silence';this.hz=440;this.amplitude=.12;this.phase=0;this.seed=13;this.port.onmessage=e=>Object.assign(this,e.data)}process(i,o){const c=o[0][0];for(let n=0;n<c.length;n++){this.phase+=2*Math.PI*this.hz/sampleRate;this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;const noise=2*this.seed/4294967295-1;c[n]=this.mode==='silence'?0:this.mode==='noise'?noise*this.amplitude:this.mode==='clip'?(Math.sin(this.phase)>0?1:-1):Math.sin(this.phase)*this.amplitude;}return true;}}registerProcessor('qa-pcm',QAPCM);`,
              ],
              { type: "text/javascript" },
            ),
          ),
        );
        const node = new NativeWorklet(context, "qa-pcm");
        node.connect(sink);
        q.generator = node;
        q.sourceContext = context;
        q.sink = sink;
        const stream = sink.stream;
        q.streams.push(stream);
        q.settings.push(stream.getAudioTracks()[0]?.getSettings());
        node.port.postMessage({
          mode: q.mode,
          hz: q.hz,
          amplitude: q.amplitude,
        });
        await context.resume();
        return stream;
      };
      q.set = (mode, hz = q.hz, amplitude = q.amplitude) => {
        q.mode = mode;
        q.hz = hz;
        q.amplitude = amplitude;
        q.generator?.port.postMessage({ mode, hz, amplitude });
      };
      q.observer = new MutationObserver(() => {
        const count = document.querySelector(
          "[data-practice-stage] p.tabular-nums",
        )?.textContent;
        if (count && q.answerChanges.at(-1)?.count !== count)
          q.answerChanges.push({
            count,
            at: performance.now(),
            audio: q.contexts.at(-1)?.currentTime,
          });
        const status = document.querySelector("[data-pitch-feedback]");
        if (status)
          q.ui.push({ at: performance.now(), text: status.textContent });
      });
      q.observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
      });
      const tick = (t) => {
        q.raf.push(t);
        const v = window.__qaRead();
        if (v?.frame && q.frames?.at(-1)?.audio !== v.frame.audioTimeSec)
          q.frames.push({
            at: t,
            audio: v.frame.audioTimeSec,
            hz: v.frame.detectedHz,
            quality: v.frame.inputQuality,
            confidence: v.frame.confidence,
            isVoiced: v.frame.isVoiced,
            rms: v.frame.rms,
          });
        if (
          q.schedule &&
          !q.scheduled &&
          v?.attempt?.phase === "countIn" &&
          q.cues.length >= 4 &&
          q.sink
        ) {
          q.scheduled = true;
          q.start = q.cues[0].at + (4 * 60) / v.props.stage.bpm;
          for (const target of v.props.targets) {
            if (target.kind !== "note") continue;
            const osc = Native.prototype.createOscillator.call(q.sourceContext),
              g = q.sourceContext.createGain();
            g.gain.value = 0.16;
            osc.frequency.value =
              440 * 2 ** ((target.targetConcertMidi - 69) / 12);
            osc.connect(g).connect(q.sink);
            const start = q.start + target.startAudioSec;
            osc.start(start);
            osc.stop(start + 0.8 * (target.endAudioSec - target.startAudioSec));
          }
        }
        q.rafId = requestAnimationFrame(tick);
      };
      q.rafId = requestAnimationFrame(tick);
      return {
        requested,
        agent: navigator.userAgent,
        visibility: document.visibilityState,
      };
    },
    readView.toString(),
    rate,
  );
}
function tone(mode, hz, amplitude) {
  return ev(
    (m, h, a) => {
      window.__micQA.set(m, h, a);
      return true;
    },
    mode,
    hz,
    amplitude,
  );
}
function proof() {
  return ev(() => {
    const q = window.__micQA,
      v = window.__qaRead();
    return {
      requests: q.requests,
      answerChanges: q.answerChanges,
      contextStates: q.contexts.map((c) => c.state),
      trackStates: q.streams.map((s) => s.getTracks().map((t) => t.readyState)),
      rates: q.contexts.map((c) => c.sampleRate),
      settings: q.settings,
      hops: q.hops,
      frames: q.frames,
      viewport: [innerWidth, innerHeight, devicePixelRatio],
      coarse: matchMedia("(pointer: coarse)").matches,
      analysis: q.analysis,
      ui: q.ui,
      raf: q.raf,
      basic: q.basic,
      piano: q.piano,
      oscillators: q.oscillators,
      stage: v?.props.stage,
      targets: v?.props.targets,
      audioDiagnostic: v?.audio,
      result: v?.attempt?.result,
      events: v?.attempt?.events,
      phase: v?.attempt?.phase,
      elapsed: v?.props.elapsed,
      colors: v?.host.dataset.scoreColors,
      scroll: v?.host.scrollLeft,
      feedback: document.querySelector("[data-pitch-feedback]")?.textContent,
    };
  });
}
async function navigate(url, width = 1440) {
  action("goto", "--url", url);
  viewport(width);
  await waitFor(() => document.readyState === "complete", "page ready");
  await pause(300);
}
function noNumbers() {
  return ev(() => {
    const text =
      document.body.innerText +
      " " +
      [...document.querySelectorAll("[title],[aria-label],[aria-valuetext]")]
        .map((n) =>
          [
            n.title,
            n.getAttribute("aria-label"),
            n.getAttribute("aria-valuetext"),
          ].join(" "),
        )
        .join(" ");
    return {
      bad: text.match(
        /\b\d+(?:\.\d+)?\s*(?:Hz|cents?|¢)\b|confidence\s*:?\s*\d+%/gi,
      ),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}
async function pause(ms) {
  await new Promise((r) => setTimeout(r, ms));
}
async function run() {
  try {
    report.tabsBefore = orca("tab", "list");
    page =
      process.env.MIC_QA_PAGE ||
      orca("tab", "create", "--url", base + "/robots.txt").browserPageId;
    report.page = page;
    orca(
      "exec",
      "--page",
      page,
      "--command",
      "network route https://** --abort",
    );
    storage = ev(() => ({
      local: Object.fromEntries(Object.entries(localStorage)),
      session: Object.fromEntries(Object.entries(sessionStorage)),
    }));
    report.rawStorageBefore = storage;
    fs.writeFileSync(
      path.join(out, "storage-before.json"),
      JSON.stringify(storage, null, 2),
    );
    await test("served production build matches snapshot", async () => {
      const x = ev(async (expected) => {
        const html = await (
          await fetch("/en/melody", { cache: "no-store" })
        ).text();
        return { expected, match: html.includes(expected) };
      }, process.env.EXPECTED_BUILD_ID);
      assert.equal(x.match, true);
      return x;
    });
    for (const width of [1440, 390]) {
      await test("basic PCM hold/release and quality " + width, async () => {
        await navigate(
          base +
            "/en/practice/note?share=1&length=ten&clef=treble&key=C&above=0&below=0&sound=0&input=microphone",
          width,
        );
        if (width === 390 && process.env.MIC_QA_NARROW_POINTER)
          action("viewport", "--width", "390", "--height", "844");
        install();
        clickSelector("[data-practice-action=start]");
        await waitFor(
          () => !!document.querySelector("[data-microphone-hold]"),
          "microphone mounted",
        );
        const press = (type, key) =>
          ev(
            (type, key) => {
              const b = document.querySelector("[data-microphone-hold]");
              b.focus();
              b.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
              return true;
            },
            type,
            key,
          );
        press("keydown", " ");
        tone("silence");
        await waitFor(
          () =>
            document.querySelector("[data-microphone-quality]")?.dataset
              .microphoneQuality === "weak",
          "weak original PCM",
        );
        tone("noise", 440, 0.18);
        await waitFor(
          () =>
            document.querySelector("[data-microphone-quality]")?.dataset
              .microphoneQuality === "uncertain",
          "uncertain noise PCM",
        );
        tone("tone", 440, 0.16);
        await waitFor(
          () =>
            document
              .querySelector("[data-microphone-quality]")
              ?.parentElement?.querySelector(".text-3xl")?.textContent === "A4",
          "real PCM YIN A4",
        );
        const observed = ev(() => {
          const n = document.querySelector("[data-microphone-quality]");
          return {
            quality: n.dataset.microphoneQuality,
            label: n.parentElement.querySelector(".text-3xl").textContent,
          };
        });
        assert.equal(observed.quality, "stable");
        tone("clip");
        await waitFor(
          () =>
            document.querySelector("[data-microphone-quality]")?.dataset
              .microphoneQuality === "clipping",
          "sustained clipped original PCM",
        );
        tone("tone", 440, 0.16);
        await waitFor(
          () =>
            document.querySelector("[data-microphone-quality]")?.dataset
              .microphoneQuality === "stable",
          "stable recovery",
        );
        shot("basic-" + width);
        const visual = noNumbers();
        assert.equal(visual.bad, null);
        assert.equal(visual.overflow, 0);
        fs.writeFileSync(
          path.join(out, "basic-pre-release-" + width + ".json"),
          JSON.stringify(
            ev(() => ({
              focus: document.hasFocus(),
              hidden: document.hidden,
              label: document
                .querySelector("[data-microphone-quality]")
                ?.parentElement?.querySelector(".text-3xl")?.textContent,
              held: document
                .querySelector("[data-microphone-hold]")
                ?.getAttribute("aria-pressed"),
            })),
            null,
            2,
          ),
        );
        if (width === 390) action("keypress", "--key", "Shift");
        press("keyup", " ");
        await waitFor(
          () =>
            !!document.querySelector("[data-answer-toast][data-visible=true]"),
          "key release answer",
        );
        const first = ev(
          () =>
            document.querySelector("[data-answer-toast-details]")?.textContent,
        );
        assert.match(first, /A4/);
        await waitFor(
          () =>
            document.querySelector("[data-microphone-hold]")?.disabled ===
            false,
          "next question",
        );
        // SR detail=0 uses the production click toggle, not a pitch/result mock.
        ev(() => {
          document.querySelector("[data-microphone-hold]").click();
          return true;
        });
        tone("tone", 880, 0.16);
        await waitFor(
          () =>
            document
              .querySelector("[data-microphone-quality]")
              ?.parentElement?.querySelector(".text-3xl")?.textContent === "A5",
          "octave A5",
        );
        ev(() => {
          document.querySelector("[data-microphone-hold]").click();
          return true;
        });
        await waitFor(
          () =>
            /A5/.test(
              document.querySelector("[data-answer-toast-details]")
                ?.textContent,
            ),
          "SR release A5",
        );
        await waitFor(
          () =>
            document.querySelector("[data-microphone-hold]")?.disabled ===
            false,
          "next question after SR",
        );
        press("keydown", "Enter");
        tone("tone", 440, 0.16);
        await pause(800);
        press("keydown", "Escape");
        const before = ev(
          () =>
            document.querySelector("[data-practice-stage] p.tabular-nums")
              ?.textContent,
        );
        await pause(300);
        assert.equal(
          ev(
            () =>
              document.querySelector("[data-practice-stage] p.tabular-nums")
                ?.textContent,
          ),
          before,
        );
        const p = proof();
        assert(p.basic.some((b) => b.peak > 0.98));
        assert(p.basic.some((b) => b.peak === 0));
        fs.writeFileSync(
          path.join(out, "basic-" + width + ".json"),
          JSON.stringify(p, null, 2),
        );
        return {
          observed,
          first,
          visual,
          rates: p.rates,
          requests: p.requests,
          pcmFrames: p.basic.length,
          keyboard: true,
          srClick: true,
          escape: true,
          physicalPointerUnverified: true,
        };
      });
    }
    await test("native default empty melody and bar review boundary", async () => {
      await navigate(base + "/en/melody");
      install();
      await waitFor(
        () => !!document.querySelector("[data-rendered=true]"),
        "notation",
      );
      clickSelector("[data-practice-action=start]");
      await waitFor(
        () =>
          document.querySelector("[data-melody-phase]")?.dataset.melodyPhase ===
          "countIn",
        "count-in",
      );
      assert.equal(
        ev(() => document.querySelector("[data-pitch-feedback]")?.textContent),
        "",
      );
      await waitFor(
        () =>
          document.querySelector("[data-melody-phase]")?.dataset.melodyPhase ===
          "result",
        "real empty melody complete",
        60000,
      );
      const before = proof();
      assert(before.result);
      assert(before.result.notes.some((r) => r.status === "missed"));
      fs.writeFileSync(
        path.join(out, "empty-result.json"),
        JSON.stringify(before, null, 2),
      );
      // Result dialog minimize uses its native button discovered from snapshot.
      report.resultSnapshot = snapshot();
      clickSelector("[data-minimize-results]");
      await waitFor(
        () => !!document.querySelector("[data-melody-result-review] select"),
        "review select",
      );
      const options = ev(() =>
        [
          ...document.querySelector("[data-melody-result-review] select")
            .options,
        ].map((o) => ({ value: o.value, label: o.textContent })),
      );
      assert(options.length > 2);
      assert.equal(new Set(options.map((o) => o.label)).size, options.length);
      const actual = ev(() => {
        const v = window.__qaRead();
        return {
          review: v.review?.events,
          stage: v.props.stage,
          targets: v.props.targets,
          bounds: v.bounds,
        };
      });
      const beat6 =
        actual.review.find(
          (r) =>
            actual.stage.events.find(
              (e) => e.id === (r.sourceEventId || r.stageEventId),
            )?.startBeat === 6,
        ) ||
        actual.review.find((r) => r.barIndex === 1) ||
        actual.review[0];
      nativeSelect("[data-melody-result-review] select", beat6.stageEventId);
      const invariants = () =>
        ev(() => {
          const v = window.__qaRead();
          return {
            result: v.attempt.result,
            events: v.attempt.events,
            elapsed: v.props.elapsed,
            scroll: v.host.scrollLeft,
            colors: v.host.dataset.scoreColors,
            requests: window.__micQA.requests,
          };
        });
      const inv = invariants();
      shot("review-desktop");
      assert.equal(noNumbers().bad, null);
      clickSelector("[data-melody-result-review] button");
      await waitFor(
        () => window.__micQA.piano.length > 0,
        "real prepared piano schedules selected bar",
        20000,
      );
      await pause(4500);
      assert.deepEqual(invariants(), inv);
      const played = proof();
      assert(played.piano.every((p) => p.duration >= 0.02));
      fs.writeFileSync(
        path.join(out, "review-piano.json"),
        JSON.stringify(played, null, 2),
      );
      // Natural completion returns the button to Listen. Explicit stop also preserves records.
      await waitFor(
        () =>
          !/stop/i.test(
            document.querySelector("[data-melody-result-review] button")
              ?.textContent,
          ),
        "natural bar end",
        12000,
      );
      clickSelector("[data-melody-result-review] button");
      await pause(350);
      clickSelector("[data-melody-result-review] button");
      assert.deepEqual(invariants(), inv);
      viewport(390);
      shot("review-mobile");
      assert.equal(noNumbers().overflow, 0);
      const selected = ev(() => {
        const n = document.querySelector("[data-score-review-selection]");
        return n
          ? {
              box: n.getBoundingClientRect().toJSON(),
              style: n.getAttribute("style"),
            }
          : null;
      });
      assert(selected);
      fs.writeFileSync(
        path.join(out, "default-review-geometry.json"),
        JSON.stringify(actual, null, 2),
      );
      return {
        notes: before.result.notes.length,
        options,
        selected,
        selection: beat6,
        piano: played.piano,
        source: "actual normal completed synthetic empty attempt",
        invariantsPreserved: true,
      };
    });
    await test("native mixed melody Worklet PCM YIN and final scoring", async () => {
      await navigate(base + "/en/melody");
      install();
      ev(() => {
        window.__micQA.schedule = true;
        return true;
      });
      await waitFor(
        () => !!document.querySelector("[data-rendered=true]"),
        "notation",
      );
      clickSelector("[data-practice-action=start]");
      await waitFor(
        () =>
          document.querySelector("[data-melody-phase]")?.dataset.melodyPhase ===
          "result",
        "mixed attempt complete",
        60000,
      );
      const p = proof();
      fs.writeFileSync(
        path.join(out, "mixed-result.json"),
        JSON.stringify(p, null, 2),
      );
      assert(p.hops.length > 100);
      assert.equal(
        p.hops.reduce((s, h) => s + h.dropped, 0),
        0,
      );
      assert(p.result.notes.some((n) => n.pitchPass));
      assert(p.events.length > 0);
      assert.equal(noNumbers().bad, null);
      fs.writeFileSync(
        path.join(out, "mixed-result.json"),
        JSON.stringify(p, null, 2),
      );
      return {
        rates: p.rates,
        requests: p.requests,
        hops: p.hops.length,
        events: p.events.length,
        passedPitch: p.result.notes.filter((n) => n.pitchPass).length,
        missed: p.result.notes.filter((n) => n.status === "missed").length,
        zeroDroppedHops: true,
      };
    });
    await test("all 11 locale layout matrix both surfaces", async () => {
      const matrix = [];
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
      ])
        for (const width of [390, 1440])
          for (const route of [
            "melody",
            "practice/note?share=1&length=ten&sound=0&input=microphone",
          ]) {
            await navigate(base + "/" + locale + "/" + route, width);
            if (route.startsWith("practice")) {
              install();
              clickSelector("[data-practice-action=start]");
              await waitFor(
                () => !!document.querySelector("[data-microphone-hold]"),
                "localized mic",
              );
            }
            const p = noNumbers();
            assert.equal(p.bad, null, locale + " numeric diagnostics");
            assert.equal(
              p.overflow,
              0,
              locale + " " + width + " " + route + " overflow",
            );
            matrix.push({ locale, width, route, ...p });
            if (["de", "eo", "ko"].includes(locale) && width === 390)
              shot(locale + "-" + route.split("/")[0] + "-" + width);
          }
      return matrix;
    });
    await test("chord review selection keyboard cancellation and 11 review locales", async () => {
      ev(() => {
        localStorage.setItem(
          "note-quiz-melody-settings-v1",
          JSON.stringify({
            version: 2,
            settings: {
              clef: "treble",
              tonalityId: "C-major",
              progressionId: "major-basic",
              minMidi: 60,
              maxMidi: 72,
              durations: [1, 2],
              bpm: 72,
              timeSignature: [4, 4],
              dotted: false,
              triplets: false,
              metronome: false,
              barBell: false,
            },
          }),
        );
        return true;
      });
      await navigate(base + "/melody");
      install();
      action("set", "media", "--reduced-motion", "reduce");
      await waitFor(
        () => !!document.querySelector("[data-rendered=true]"),
        "chord render",
      );
      assert(ev(() => !!window.__qaRead().props.stage.harmony));
      clickSelector("[data-practice-action=start]");
      await waitFor(
        () =>
          document.querySelector("[data-melody-phase]")?.dataset.melodyPhase ===
          "result",
        "chord empty result",
        60000,
      );
      clickSelector("[data-minimize-results]");
      await waitFor(
        () => !!document.querySelector("[data-melody-result-review] select"),
        "chord review",
      );
      const actual = ev(() => {
        const v = window.__qaRead();
        return {
          stage: v.props.stage,
          bounds: v.bounds,
          review: v.review.events,
          result: v.attempt.result,
        };
      });
      fs.writeFileSync(
        path.join(out, "chord-result-geometry.json"),
        JSON.stringify(actual, null, 2),
      );
      const first = actual.review[0],
        second = actual.review[1];
      nativeSelect("[data-melody-result-review] select", first.stageEventId);
      const geometry = ev((id) => {
        const v = window.__qaRead(),
          b = v.bounds.events.find((e) => e.id === id),
          n = document.querySelector("[data-score-review-selection]");
        return {
          bound: b,
          selection: {
            top: parseFloat(n.style.top),
            left: parseFloat(n.style.left),
            width: parseFloat(n.style.width),
            height: parseFloat(n.style.height),
          },
          colors: v.host.dataset.scoreColors,
        };
      }, first.sourceEventId);
      assert(Math.abs(geometry.selection.top - geometry.bound.y - 24) < 1e-6);
      assert.equal(geometry.selection.left, geometry.bound.x);
      shot("chord-band-desktop");
      const colors = geometry.colors;
      nativeSelect("[data-melody-result-review] select", second.stageEventId);
      assert.deepEqual(
        ev(() => window.__qaRead().host.dataset.scoreColors),
        JSON.parse(colors),
      );
      // Actual rendered rail/bounds projected once; native desktop pointer tap.
      const point = ev((id) => {
        const v = window.__qaRead(),
          b = v.bounds.events.find((e) => e.id === id);
        v.host.scrollLeft = 0;
        v.host.scrollIntoView({ block: "center", behavior: "instant" });
        const r = document
          .querySelector("[data-score-rail]")
          .getBoundingClientRect();
        return { x: r.x + b.x + b.width / 2, y: r.y + b.y + 24 + b.height / 2 };
      }, first.sourceEventId);
      action("mouse", "move", "--x", String(point.x), "--y", String(point.y));
      action("mouse", "down");
      action("mouse", "up");
      assert.equal(
        ev(
          () =>
            document.querySelector("[data-melody-result-review] select").value,
        ),
        first.stageEventId,
      );
      action("mouse", "move", "--x", String(point.x), "--y", String(point.y));
      action("mouse", "down");
      action(
        "mouse",
        "move",
        "--x",
        String(point.x + 30),
        "--y",
        String(point.y),
      );
      action("mouse", "up");
      assert.equal(
        ev(
          () =>
            document.querySelector("[data-melody-result-review] select").value,
        ),
        first.stageEventId,
        "drag does not select",
      );
      ev(() => {
        window.__qaRead().host.focus();
        return true;
      });
      const scroll = ev(() => window.__qaRead().host.scrollLeft);
      action("keypress", "--key", "ArrowRight");
      await pause(350);
      assert(
        ev(() => window.__qaRead().host.scrollLeft) > scroll,
        "native score keyboard scroll",
      );
      const invariant = ev(() => {
        const v = window.__qaRead();
        return {
          result: v.attempt.result,
          elapsed: v.props.elapsed,
          events: v.attempt.events,
          requests: window.__micQA.requests,
        };
      });
      clickSelector("[data-melody-result-review] button");
      await pause(250);
      nativeSelect("[data-melody-result-review] select", second.stageEventId);
      assert(
        !ev(() =>
          /stop/i.test(
            document.querySelector("[data-melody-result-review] button")
              ?.textContent,
          ),
        ),
        "selection cancels sound",
      );
      clickSelector("[data-melody-result-review] button");
      await pause(250);
      clickSelector("[data-practice-action=results]");
      assert(
        !ev(() => !!document.querySelector("[data-melody-result-review]")),
        "summary hides review",
      );
      clickSelector("[data-minimize-results]");
      assert.equal(
        ev(
          () =>
            document.querySelector("[data-melody-result-review] select").value,
        ),
        "",
        "summary clears selection",
      );
      nativeSelect("[data-melody-result-review] select", first.stageEventId);
      const localeMatrix = [];
      const langs = [
        "en",
        "ko",
        "ja",
        "es",
        "de",
        "fr",
        "zh-Hans",
        "pt-BR",
        "ru",
        "ka",
        "eo",
      ];
      for (const lang of langs) {
        clickSelector(".language-selector > button");
        const point = ev((lang) => {
          const n = document
            .querySelector('[role=menuitemradio] bdi[lang="' + lang + '"]')
            ?.closest("button");
          n.scrollIntoView({ block: "nearest", behavior: "instant" });
          const r = n.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, lang);
        action("mouse", "move", "--x", String(point.x), "--y", String(point.y));
        action("mouse", "down");
        action("mouse", "up");
        await pause(100);
        for (const width of [1440, 390]) {
          viewport(width);
          const p = noNumbers();
          assert.equal(p.bad, null);
          assert.equal(p.overflow, 0, lang + " review overflow");
          const text = ev(
            () =>
              document.querySelector("[data-melody-result-review]").innerText,
          );
          assert(text.length > 20);
          localeMatrix.push({ lang, width, text, ...p });
          if (width === 390 && ["de", "ka", "eo"].includes(lang))
            shot("review-" + lang + "-mobile");
        }
        viewport(1440);
      }
      const after = ev(() => {
        const v = window.__qaRead();
        return {
          result: v.attempt.result,
          elapsed: v.props.elapsed,
          events: v.attempt.events,
          requests: window.__micQA.requests,
        };
      });
      assert.deepEqual(after, invariant);
      shot("chord-band-mobile");
      return {
        geometry,
        point,
        nativePointerTap: true,
        dragRejected: true,
        nativeKeyboardScroll: true,
        selectionAndSummaryCancel: true,
        localeMatrix,
        invariant,
      };
    });
    await test("melody original PCM quality direction neutral pause preview suppression", async () => {
      ev(() => {
        localStorage.setItem(
          "note-quiz-melody-settings-v1",
          JSON.stringify({
            version: 2,
            settings: {
              clef: "treble",
              tonalityId: "C-major",
              progressionId: "none",
              minMidi: 60,
              maxMidi: 60,
              durations: [4],
              bpm: 40,
              timeSignature: [4, 4],
              dotted: false,
              triplets: false,
              metronome: false,
              barBell: false,
            },
          }),
        );
        return true;
      });
      await navigate(base + "/en/melody");
      install();
      await waitFor(
        () => !!document.querySelector("[data-rendered=true]"),
        "long note render",
      );
      clickSelector("[data-practice-action=start]");
      await waitFor(
        () =>
          document.querySelector("[data-melody-phase]")?.dataset.melodyPhase ===
          "countIn",
        "count in",
      );
      assert.equal(
        ev(() => document.querySelector("[data-pitch-feedback]")?.textContent),
        "",
      );
      await waitFor(
        () =>
          document.querySelector("[data-melody-phase]")?.dataset.melodyPhase ===
          "playing",
        "play after count",
        15000,
      );
      const statuses = [];
      async function status(mode, hz, amp, pattern) {
        tone(mode, hz, amp);
        await waitFor(() => {
          const t =
            document.querySelector("[data-pitch-feedback]")?.textContent || "";
          return t.length > 0;
        }, "feedback");
        await pause(450);
        const text = ev(
          () => document.querySelector("[data-pitch-feedback]")?.textContent,
        );
        statuses.push({ mode, hz, text });
        assert.match(text, pattern);
      }
      await status("silence", 261.625565, 0.16, /small|quiet|weak/i);
      await status(
        "noise",
        261.625565,
        0.18,
        /checking|check|confirm|finding/i,
      );
      await status("tone", 261.625565, 0.16, /match|right|correct|in tune/i);
      await status("tone", 293.664768, 0.16, /high/i);
      await status("tone", 233.081881, 0.16, /low/i);
      ev(() => {
        const q = window.__micQA;
        let high = false;
        q.alternator = setInterval(() => {
          high = !high;
          q.set("tone", high ? 293.664768 : 233.081881, 0.16);
        }, 35);
        return true;
      });
      await pause(700);
      const alternating = ev(() => ({
        text: document.querySelector("[data-pitch-feedback]")?.textContent,
        provisional: document.querySelector("[data-score-viewport]").dataset
          .scoreProvisional,
      }));
      ev(() => {
        clearInterval(window.__micQA.alternator);
        return true;
      });
      tone("clip");
      await pause(450);
      const clip = ev(
        () => document.querySelector("[data-pitch-feedback]")?.textContent,
      );
      assert.match(clip, /loud|distort|clip|level/i);
      clickSelector("[data-practice-action=pause]");
      await waitFor(
        () =>
          document.querySelector("[data-melody-phase]")?.dataset.melodyPhase ===
          "paused",
        "pause",
      );
      assert.equal(
        ev(() => document.querySelector("[data-pitch-feedback]")?.textContent),
        "",
      );
      clickSelector("[data-practice-action=end]");
      await waitFor(
        () =>
          document.querySelector("[data-melody-phase]")?.dataset.melodyPhase ===
          "landing",
        "reset",
      );
      clickSelector("[data-practice-action=preview]");
      await pause(600);
      assert(
        !ev(() =>
          /small|weak|loud|checking/i.test(
            document.querySelector("[data-pitch-feedback]")?.textContent || "",
          ),
        ),
      );
      clickSelector("[data-practice-action=preview]");
      const p = proof();
      fs.writeFileSync(
        path.join(out, "live-quality-direction.json"),
        JSON.stringify(p, null, 2),
      );
      return {
        statuses,
        alternating,
        clip,
        rates: p.rates,
        hops: p.hops.length,
        dropped: p.hops.reduce((n, h) => n + h.dropped, 0),
        pauseSuppressed: true,
        previewSuppressed: true,
        numeric: noNumbers(),
      };
    });
    await test("native Worklet adapter supported-rate throughput", async () => {
      const rates = [];
      for (const rate of [44100, 48000, 96000]) {
        await navigate(base + "/en/melody");
        install(rate);
        tone("tone", 261.625565, 0.16);
        await waitFor(
          () => !!document.querySelector("[data-rendered=true]"),
          "render rate " + rate,
        );
        clickSelector("[data-practice-action=start]");
        await waitFor(
          () =>
            document.querySelector("[data-melody-phase]")?.dataset
              .melodyPhase === "playing",
          "rate running " + rate,
          15000,
        );
        await pause(2500);
        const p = proof();
        assert(p.hops.length > 100);
        assert.equal(
          p.hops.reduce((n, h) => n + h.dropped, 0),
          0,
        );
        assert(p.frames.some((f) => f.hz > 260 && f.hz < 263));
        fs.writeFileSync(
          path.join(out, "pipeline-" + rate + ".json"),
          JSON.stringify(p, null, 2),
        );
        clickSelector("[data-practice-action=end]");
        rates.push({
          requested: rate,
          actual: p.rates,
          trackSettings: p.settings,
          hops: p.hops.length,
          uiFrames: p.frames.length,
          dropped: 0,
        });
      }
      return rates;
    });
    await test("exact default seed1 beat6 real piano failure stale preparation recovery", async () => {
      ev(() => {
        localStorage.removeItem("note-quiz-melody-settings-v1");
        return true;
      });
      await navigate(base + "/en/practice/note");
      ev(() => {
        const native = crypto.getRandomValues.bind(crypto);
        crypto.getRandomValues = (values) =>
          values instanceof Uint32Array && values.length === 1
            ? ((values[0] = 1), values)
            : native(values);
        return true;
      });
      const nav = snapshot();
      const link = Object.entries(nav.refs).find(
        ([, v]) => v.role === "link" && v.name === "Melody practice",
      );
      assert(link);
      action("click", "--element", "@" + link[0]);
      await waitFor(
        () => !!document.querySelector("[data-rendered=true]"),
        "seed1 SPA melody",
      );
      install();
      const stage = ev(() => window.__qaRead().props.stage);
      assert(
        stage.id.startsWith("melody-1-treble-C-major-none-v1-60-67-1_2-72-4_4"),
      );
      const event = stage.events.find((e) => e.startBeat === 6);
      assert.equal(event.writtenSpelling, "G4");
      clickSelector("[data-practice-action=start]");
      await waitFor(
        () =>
          document.querySelector("[data-melody-phase]")?.dataset.melodyPhase ===
          "result",
        "seed1 empty attempt",
        60000,
      );
      clickSelector("[data-minimize-results]");
      nativeSelect("[data-melody-result-review] select", event.id);
      const invariant = ev(() => {
        const v = window.__qaRead();
        return {
          result: v.attempt.result,
          elapsed: v.props.elapsed,
          events: v.attempt.events,
          requests: window.__micQA.requests,
          scroll: v.host.scrollLeft,
        };
      });
      ev(() => {
        const native = window.fetch.bind(window);
        let requests = 0;
        window.fetch = async (url, ...args) => {
          if (String(url).includes("sonivox.sf2")) {
            requests++;
            if (requests === 1) return new Response("", { status: 503 });
            if (requests === 2)
              await new Promise((r) => {
                window.__micQA.releaseFont = r;
              });
          }
          return native(url, ...args);
        };
        return true;
      });
      clickSelector("[data-melody-result-review] button");
      await waitFor(
        () =>
          !!document.querySelector("[data-melody-result-review] [role=alert]"),
        "local real soundfont failure",
      );
      assert.equal(
        ev(
          () =>
            document.querySelector("[data-melody-phase]").dataset.melodyPhase,
        ),
        "result",
      );
      assert.equal(
        ev(() => window.__micQA.piano.length),
        0,
      );
      clickSelector("[data-melody-result-review] button");
      await waitFor(
        () => typeof window.__micQA.releaseFont === "function",
        "controlled pending font request",
      );
      const other = stage.events.find(
        (e) => e.kind === "note" && e.id !== event.id,
      );
      nativeSelect("[data-melody-result-review] select", other.id);
      ev(() => {
        window.__micQA.releaseFont();
        return true;
      });
      await pause(700);
      assert.equal(
        ev(() => window.__micQA.piano.length),
        0,
        "stale font completion schedules no tone",
      );
      nativeSelect("[data-melody-result-review] select", event.id);
      clickSelector("[data-melody-result-review] button");
      await waitFor(
        () => window.__micQA.piano.length > 0,
        "seed1 repaired real piano schedules",
        20000,
      );
      await pause(3800);
      const p = proof();
      fs.writeFileSync(
        path.join(out, "exact-seed1-real-piano.json"),
        JSON.stringify(p, null, 2),
      );
      const expected = stage.events.filter(
        (e) => e.kind === "note" && e.startBeat >= 4 && e.startBeat < 8,
      );
      assert.equal(p.piano.length, expected.length);
      const start = p.piano[0].at;
      for (let i = 0; i < expected.length; i++) {
        assert(
          Math.abs(
            p.piano[i].at -
              start -
              ((expected[i].startBeat - expected[0].startBeat) * 60) / 72,
          ) < 1e-7,
        );
        assert(p.piano[i].samples.length === 2048);
        assert(
          Math.abs(
            p.piano[i].duration -
              (((expected[i].durationBeats * 60) / 72) * 0.95 +
                Math.min(
                  0.035,
                  (((expected[i].durationBeats * 60) / 72) * 0.95) / 20,
                )),
          ) <
            1 / 48000,
        );
      }
      const after = ev(() => {
        const v = window.__qaRead();
        return {
          result: v.attempt.result,
          elapsed: v.props.elapsed,
          events: v.attempt.events,
          requests: window.__micQA.requests,
          scroll: v.host.scrollLeft,
        };
      });
      assert.deepEqual(after, invariant);
      shot("seed1-bar2-real-piano");
      return {
        stage: stage.id,
        event,
        expected,
        piano: p.piano.map(({ samples, ...p }) => ({
          ...p,
          pcmSamples: samples.length,
        })),
        invariant,
        errorRetry: true,
        stalePreparationCanceled: true,
      };
    });
    report.limitations.push(
      "Original YIN is retained by user decision; this QA makes no new pitch-accuracy or acoustic-device claim.",
      "Synthetic key/SR events are production handlers; a screen-reader device is not implied. Mobile native focus/touch limitations are reported separately.",
      "Additional cancellation/stale decode/error/all-rest/chord-band interaction and 44.1/96 kHz benchmark coverage require explicit cases; absent cases are not passed.",
    );
  } catch (e) {
    report.fatal = e.stack;
  } finally {
    if (page) {
      try {
        ev(() => {
          const q = window.__micQA;
          q?.observer?.disconnect();
          if (q?.rafId) cancelAnimationFrame(q.rafId);
          for (const s of q?.streams || [])
            s.getTracks().forEach((t) => t.stop());
          for (const c of q?.contexts || []) void c.close();
          return true;
        });
        action("goto", "--url", base + "/robots.txt");
        ev((s) => {
          localStorage.clear();
          sessionStorage.clear();
          for (const [k, v] of Object.entries(s.local))
            localStorage.setItem(k, v);
          for (const [k, v] of Object.entries(s.session))
            sessionStorage.setItem(k, v);
          return true;
        }, storage);
        report.rawStorageAfter = ev(() => ({
          local: Object.fromEntries(Object.entries(localStorage)),
          session: Object.fromEntries(Object.entries(sessionStorage)),
        }));
        assert.deepEqual(report.rawStorageAfter, storage);
        report.storageRestored = true;
        if (!process.env.MIC_QA_KEEP_PAGE) {
          orca("tab", "close", "--page", page);
          report.pageClosed = true;
        } else report.pageRetained = true;
      } catch (e) {
        report.cleanupError = e.stack;
      }
    }
    report.tabsAfter = orca("tab", "list");
    report.outcome =
      !report.fatal &&
      !report.cleanupError &&
      report.cases.every((c) => c.passed)
        ? "passed"
        : "partial/failed";
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify(
        {
          outcome: report.outcome,
          cases: report.cases.map((c) => ({
            name: c.name,
            passed: c.passed,
            error: c.error,
          })),
          fatal: report.fatal,
          cleanupError: report.cleanupError,
        },
        null,
        2,
      ),
    );
    if (report.outcome !== "passed") process.exitCode = 1;
  }
}
if (require.main === module) run();
module.exports = {
  orca,
  ev,
  action,
  viewport,
  shot,
  snapshot,
  clickSelector,
  nativeSelect,
  readView,
  install,
  tone,
  proof,
  navigate,
  noNumbers,
  pause,
  waitFor,
  report,
  setPage(value) {
    page = value;
  },
};
