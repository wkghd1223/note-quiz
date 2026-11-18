/* eslint-disable @typescript-eslint/no-require-imports */
// Native Orca integration checks; device acquisition is synthetic WebAudio PCM.
// Existing production YIN, guards, stores, clocks and rendered UI remain real.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const qa = require("./verify-microphone-feedback.cjs");
const {
  orca,
  ev,
  action,
  install,
  tone,
  proof,
  navigate,
  pause,
  waitFor,
  snapshot,
  clickSelector,
  nativeSelect,
  noNumbers,
} = qa;
const base = process.env.UI_BASE_URL,
  out = process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-mic-final-qa/browser";
fs.mkdirSync(out, { recursive: true });
const report = {
  algorithm: "retained original YIN",
  nativeOrca: true,
  syntheticPCM: true,
  physicalMicrophone: false,
  cases: [],
  screenshots: [],
  base,
};
let page, storage;
function save() {
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2),
  );
}
async function test(name, run) {
  if (
    process.env.MIC_FINAL_CASES &&
    !new RegExp(process.env.MIC_FINAL_CASES).test(name)
  )
    return;
  console.log("CASE " + name);
  try {
    report.cases.push({ name, passed: true, proof: await run() });
  } catch (error) {
    let observed;
    try {
      observed = ev(() => ({
        focus: document.hasFocus(),
        hidden: document.hidden,
        body: document.body.innerText.slice(0, 700),
        continuous: document.querySelector("[data-microphone-continuous]")
          ?.outerHTML,
        held: document
          .querySelector("[data-microphone-hold]")
          ?.getAttribute("aria-pressed"),
        count: document.querySelector("[data-practice-stage] p.tabular-nums")
          ?.textContent,
        requests: window.__micQA?.requests,
        answerChanges: window.__micQA?.answerChanges,
      }));
      fs.writeFileSync(
        path.join(out, name.replace(/[^a-z0-9]/gi, "-") + "-failure.json"),
        JSON.stringify(proof(), null, 2),
      );
    } catch {}
    report.cases.push({ name, passed: false, error: error.stack, observed });
  }
  save();
}
function shot(name) {
  const r = qa.shot(name),
    file = path.join(out, name + ".png");
  fs.copyFileSync(r.path, file);
  report.screenshots.push({ name, path: file });
}
function count() {
  return ev(
    () =>
      document.querySelector("[data-practice-stage] p.tabular-nums")
        ?.textContent,
  );
}
function basicState() {
  return ev(() => ({
    count: document.querySelector("[data-practice-stage] p.tabular-nums")
      ?.textContent,
    focus: document.hasFocus(),
    hidden: document.hidden,
    continuous: document
      .querySelector("[data-microphone-continuous]")
      ?.getAttribute("aria-pressed"),
    disabled: document.querySelector("[data-microphone-hold]")?.disabled,
    requests: window.__micQA?.requests,
    resources: {
      contexts: window.__micQA?.contexts.length,
      streams: window.__micQA?.streams.length,
    },
    changes: window.__micQA?.answerChanges,
  }));
}
async function basic(rate = 48000, width = 1440, sound = 0) {
  await navigate(
    base +
      "/en/practice/note?share=1&length=ten&clef=treble&key=C&above=0&below=0&sound=" +
      sound +
      "&input=microphone",
    width,
  );
  install(rate);
  clickSelector("[data-practice-action=start]");
  await waitFor(
    () => !!document.querySelector("[data-microphone-hold]"),
    "basic mounted",
  );
  assert.equal(
    ev(() => document.hasFocus()),
    true,
    "Native document focus is required, never overridden",
  );
}
function gesture(type, key) {
  return ev(
    (type, key) => {
      const b = document.querySelector("[data-microphone-hold]");
      b.focus();
      b.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
      return true;
    },
    type,
    key,
  );
}
function geometry() {
  return ev(() => {
    const modal = document.querySelector("dialog[open]");
    const visible = (n) =>
      (!modal || modal.contains(n)) &&
      n.getBoundingClientRect().width > 0 &&
      getComputedStyle(n).visibility === "visible" &&
      !n.closest("[inert],[aria-hidden=true]") &&
      getComputedStyle(n).display !== "none";
    const roots = [
      ...document.querySelectorAll(
        "[data-practice-controller],[data-practice-mode],[data-practice-settings],[data-practice-settings-trigger],[data-microphone-controls],[data-practice-answer-options],[data-melody-result-review],[role=dialog]",
      ),
    ].filter(visible);
    const nodes = [
      ...new Set(
        roots.flatMap((n) =>
          n.matches("button")
            ? [n]
            : [
                ...n.querySelectorAll(
                  "button,.choice-segment,label:has(input[type=checkbox])",
                ),
              ],
        ),
      ),
    ].filter(visible);
    const parentIds = new Map();
    const controls = nodes.map((n) => {
      const parent =
        n.closest(
          "[data-practice-mode],[data-practice-answer-options],fieldset",
        ) || n.parentElement;
      if (!parentIds.has(parent)) parentIds.set(parent, parentIds.size);
      const r = n.getBoundingClientRect(),
        s = getComputedStyle(n),
        rects = [];
      const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const t = walker.currentNode;
        if (!t.textContent.trim() || !visible(t.parentElement)) continue;
        const range = document.createRange();
        range.selectNodeContents(t);
        for (const x of range.getClientRects())
          if (x.width > 0 && x.height > 0)
            rects.push({ x: x.x, y: x.y, width: x.width, height: x.height });
      }
      const ys = [];
      for (const t of rects)
        if (!ys.some((y) => Math.abs(y - t.y) < 2)) ys.push(t.y);
      return {
        text: n.innerText || n.textContent,
        parentId: parentIds.get(parent),
        tag: n.tagName,
        action: n.dataset.practiceAction,
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        font: parseFloat(s.fontSize),
        lineHeight: s.lineHeight,
        lines: ys.length,
        rects,
        overflowX: n.scrollWidth - n.clientWidth,
        overflowY: n.scrollHeight - n.clientHeight,
        textOverflow: s.textOverflow,
        clip: s.webkitLineClamp,
        inert: !!n.closest("[inert]"),
        group:
          n.closest("[data-practice-action-row]")?.dataset.practiceActionRow ||
          n.closest("[data-microphone-controls]")?.dataset.microphoneControls ||
          n.parentElement.className,
      };
    });
    const grouped = new Map();
    for (const c of controls) {
      if (c.height === 0) continue;
      const key = c.parentId + ":" + Math.round(c.top);
      const list = grouped.get(key) || [];
      list.push(c);
      grouped.set(key, list);
    }
    const visualRows = [...grouped].map(([top, buttons]) => ({
      top,
      heights: buttons.map((b) => b.height),
      texts: buttons.map((b) => b.text),
    }));
    const actionRows = [
      ...document.querySelectorAll(
        "[data-practice-action-row],[data-microphone-controls]",
      ),
    ]
      .filter(visible)
      .map((n) => {
        const b = [...n.querySelectorAll(":scope > button")].filter(visible);
        return {
          state: n.dataset.practiceActionRow || "microphone",
          heights: b.map((n) => n.getBoundingClientRect().height),
          texts: b.map((n) => n.innerText),
          height: n.getBoundingClientRect().height,
        };
      });
    return {
      url: location.href,
      width: innerWidth,
      coarse: matchMedia("(pointer:coarse)").matches,
      overflow: document.documentElement.scrollWidth - innerWidth,
      controls,
      visualRows,
      actionRows,
      frames: [...document.querySelectorAll("[data-practice-action-frame]")]
        .filter(visible)
        .map((n) => n.getBoundingClientRect().height),
    };
  });
}
function issues(g) {
  const errors = [];
  if (g.overflow > 0) errors.push({ kind: "pageOverflow", pixels: g.overflow });
  for (const row of g.actionRows)
    if (
      row.heights.length > 1 &&
      Math.max(...row.heights) - Math.min(...row.heights) > 1
    )
      errors.push({ kind: "unequalRow", ...row });
  for (const row of g.visualRows || [])
    if (
      row.heights.length > 1 &&
      Math.max(...row.heights) - Math.min(...row.heights) > 1
    )
      errors.push({ kind: "unequalVisibleRow", ...row });
  for (const c of g.controls) {
    if (c.overflowY > 2 || c.overflowX > 2)
      errors.push({ kind: "internalScroll", control: c });
    if (
      c.textOverflow === "ellipsis" ||
      (c.clip && c.clip !== "none" && c.clip !== "0")
    )
      errors.push({ kind: "hiddenText", control: c });
    if (g.width < 640 && (c.lines > 2 || c.height > 64))
      errors.push({ kind: "oversized", control: c });
  }
  return errors;
}
async function setLanguage(lang) {
  // UI handler activation avoids native-key retargeting when a dialog closes.
  // The actual menu, translation store and rendered labels remain production.
  ev(() => {
    document.querySelector(".language-selector > button").click();
    return true;
  });
  await waitFor(
    () => !!document.querySelector("dialog[open] [role=menuitemradio]"),
    "language menu",
  );
  ev((lang) => {
    const button = document
      .querySelector(
        'dialog[open] [role=menuitemradio] bdi[lang="' + lang + '"]',
      )
      ?.closest("button");
    if (!button) throw Error("Language " + lang);
    button.click();
    return true;
  }, lang);
  await waitFor(
    () => !document.querySelector("dialog[open] [role=menuitemradio]"),
    "language menu closed",
  );
}
async function layoutMatrix() {
  const matrix = [];
  const langs = process.env.MIC_LAYOUT_LANGS
    ? process.env.MIC_LAYOUT_LANGS.split(",")
    : [
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
  const measure = (route, lang, state) => {
    const g = geometry();
    matrix.push({ route, lang, state, ...g, issues: issues(g) });
  };
  const widths = process.env.MIC_LAYOUT_WIDTHS
    ? process.env.MIC_LAYOUT_WIDTHS.split(",").map(Number)
    : [320, 360, 390, 1440];
  const resize = (width) => {
    qa.viewport(width, 1000);
    ev(async (width) => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      if (innerWidth !== width)
        throw Error(
          "Viewport not applied: " + innerWidth + " expected " + width,
        );
      return true;
    }, width);
  };
  for (const route of process.env.MIC_LAYOUT_ROUTES
    ? process.env.MIC_LAYOUT_ROUTES.split(",")
    : ["note", "ear", "interval", "chord", "melody"]) {
    const query =
      route === "note"
        ? "share=1&length=ten&sound=0&input=microphone"
        : route === "ear"
          ? "share=1&length=ten&sound=0&input=piano"
          : "share=1&length=ten&view=visual&level=custom&task=" +
            (route === "chord" ? "quality" : "interval");
    await navigate(
      base +
        (route === "melody" ? "/melody" : "/practice/" + route + "?" + query),
      1440,
    );
    install();
    if (route === "melody")
      await waitFor(
        () => !!document.querySelector("[data-rendered=true]"),
        "melody rendered",
      );
    if (route === "melody" && process.env.MIC_LAYOUT_PHASES !== "result") {
      for (const lang of langs) {
        resize(1440);
        await setLanguage(lang);
        for (const width of widths.filter((w) => w < 640)) {
          resize(width);
          clickSelector("[data-melody-player] button[aria-haspopup=dialog]");
          await waitFor(
            () => !!document.querySelector("dialog[open]"),
            "landing settings",
          );
          measure(route, lang, "landingSettings");
          action("keypress", "--key", "Escape");
          await waitFor(
            () => !document.querySelector("dialog[open]"),
            "landing settings closed",
          );
        }
        fs.writeFileSync(
          path.join(out, "layout-matrix.json"),
          JSON.stringify(matrix, null, 2),
        );
      }
    }
    clickSelector("[data-practice-action=start]");
    if (route === "note")
      await waitFor(
        () => !!document.querySelector("[data-microphone-hold]"),
        "mic mounted",
      );
    if (route === "melody") clickSelector("[data-practice-action=pause]");
    if (process.env.MIC_LAYOUT_PHASES !== "result")
      for (const lang of langs) {
        resize(1440);
        await setLanguage(lang);
        for (const width of widths) {
          resize(width);
          measure(route, lang, route === "melody" ? "paused" : "playing");
          if (width === 320 && ["pt-BR", "ka"].includes(lang))
            shot(route + "-" + lang + "-320");
          if (route === "note" && lang === "ko" && width === 390)
            shot("note-ko-390");
          if (width < 640 && route !== "melody") {
            clickSelector(
              route === "melody"
                ? "[data-melody-player] button[aria-haspopup=dialog]"
                : "[data-practice-settings-trigger]",
            );
            await waitFor(
              () => !!document.querySelector("[role=dialog]"),
              "settings opened",
            );
            measure(route, lang, "settings");
            if (width === 320 && lang === "ka")
              shot(route + "-settings-ka-320");
            action("keypress", "--key", "Escape");
            await waitFor(
              () =>
                ![...document.querySelectorAll("[role=dialog]")].some(
                  (n) =>
                    n.getBoundingClientRect().width > 0 &&
                    getComputedStyle(n).visibility === "visible",
                ),
              "settings closed",
            );
          }
        }
        fs.writeFileSync(
          path.join(out, "layout-matrix.json"),
          JSON.stringify(matrix, null, 2),
        );
        console.log(
          "LAYOUT " +
            route +
            " " +
            lang +
            " " +
            matrix.filter((x) => x.route === route && x.lang === lang).length +
            " cases",
        );
      }
    resize(390);
    const initial = geometry();
    if (
      route !== "melody" &&
      ev(() =>
        [...document.querySelectorAll("[data-practice-action=pause]")].some(
          (n) =>
            getComputedStyle(n).visibility === "visible" &&
            !n.closest("[inert]"),
        ),
      )
    ) {
      clickSelector("[data-practice-action=pause]");
      measure(route, "eo", "paused");
      matrix.at(-1).beforeFrames = initial.frames;
      if (route !== "melody") clickSelector("[data-practice-action=resume]");
    }
    if (route !== "melody" && process.env.MIC_LAYOUT_PHASES !== "active") {
      clickSelector("[data-practice-action=end]");
      await waitFor(
        () => !!document.querySelector("[data-minimize-results]"),
        "real completed result",
      );
      ev(() => {
        document.querySelector("[data-minimize-results]").click();
        return true;
      });
      await waitFor(
        () => !document.querySelector("dialog[open][role=dialog]"),
        "result minimized",
      );
      for (const lang of langs) {
        resize(1440);
        await setLanguage(lang);
        for (const width of widths) {
          resize(width);
          measure(route, lang, "minimizedResult");
          if (width === 320 && lang === "pt-BR") shot(route + "-result-pt-320");
        }
      }
    } else {
      clickSelector("[data-practice-action=end]");
      await waitFor(
        () =>
          document.querySelector("[data-melody-phase]")?.dataset.melodyPhase ===
          "landing",
        "reset melody",
      );
    }
    fs.writeFileSync(
      path.join(out, "layout-matrix.json"),
      JSON.stringify(matrix, null, 2),
    );
  }
  return {
    cases: matrix.length,
    issues: matrix.flatMap((x) =>
      x.issues.map((issue) => ({
        route: x.route,
        lang: x.lang,
        width: x.width,
        state: x.state,
        ...issue,
      })),
    ),
    matrixFile: path.join(out, "layout-matrix.json"),
  };
}
(async () => {
  try {
    page =
      process.env.MIC_QA_PAGE ||
      orca("tab", "create", "--url", base + "/robots.txt").browserPageId;
    qa.setPage(page);
    report.page = page;
    storage = ev(() => ({
      local: Object.fromEntries(Object.entries(localStorage)),
      session: Object.fromEntries(Object.entries(sessionStorage)),
    }));
    report.storageBefore = storage;
    fs.writeFileSync(
      path.join(out, "storage-before.json"),
      JSON.stringify(storage, null, 2),
    );
    orca(
      "exec",
      "--page",
      page,
      "--command",
      "network route https://** --abort",
    );
    if (process.env.EXPECTED_BUILD_ID) {
      report.servedBuild = ev(async (expected) => {
        const html = await (
          await fetch("/en/melody", { cache: "no-store" })
        ).text();
        return { expected, matched: html.includes(expected) };
      }, process.env.EXPECTED_BUILD_ID);
      assert(report.servedBuild.matched);
    }
    await test("continuous native PCM 500ms latch quiet octave lock resources", async () => {
      await basic();
      tone("silence");
      clickSelector("[data-microphone-continuous]");
      await waitFor(
        () => !!window.__micQA.generator,
        "synthetic stream acquired",
      );
      assert.equal(basicState().continuous, "true");
      const observed = ev(async () => {
        const q = window.__micQA;
        q.set("tone", 440, 0.16);
        await new Promise((r) => setTimeout(r, 350));
        const early = document.querySelector(
          "[data-practice-stage] p.tabular-nums",
        ).textContent;
        await new Promise((r) => setTimeout(r, 420));
        return {
          early,
          after: document.querySelector("[data-practice-stage] p.tabular-nums")
            .textContent,
          focus: document.hasFocus(),
        };
      });
      assert.equal(observed.early, "0/10");
      assert.equal(observed.after, "1/10");
      await pause(1700);
      assert.equal(count(), "1/10");
      const owned = basicState();
      assert.equal(owned.requests, 1);
      const quiet = ev(async () => {
        const q = window.__micQA;
        q.set("silence");
        await new Promise((r) => setTimeout(r, 260));
        q.set("tone", 440, 0.16);
        await new Promise((r) => setTimeout(r, 350));
        const early = document.querySelector(
          "[data-practice-stage] p.tabular-nums",
        ).textContent;
        await new Promise((r) => setTimeout(r, 420));
        return {
          early,
          after: document.querySelector("[data-practice-stage] p.tabular-nums")
            .textContent,
        };
      });
      assert.equal(quiet.early, "1/10");
      assert.equal(quiet.after, "2/10");
      tone("tone", 880, 0.16);
      await pause(350);
      assert.equal(count(), "2/10", "feedback lock does not queue");
      await waitFor(
        () =>
          document.querySelector("[data-practice-stage] p.tabular-nums")
            ?.textContent === "3/10",
        "new octave fresh500",
      );
      await pause(1700);
      assert.equal(count(), "3/10");
      assert.deepEqual(basicState().resources, owned.resources);
      assert.equal(basicState().requests, 1);
      assert.equal(noNumbers().bad, null);
      shot("continuous-en-1440");
      tone("tone", 523.25113, 0.16);
      await waitFor(
        () =>
          document.querySelector("[data-practice-stage] p.tabular-nums")
            ?.textContent === "4/10",
        "new stable pitch",
      );
      assert.equal(
        ev(
          () => document.querySelector("[data-microphone-continuous]").disabled,
        ),
        false,
      );
      clickSelector("[data-microphone-continuous]");
      assert.equal(basicState().continuous, "false");
      await pause(250);
      const p = proof();
      assert(p.trackStates.every((s) => s.every((t) => t === "ended")));
      fs.writeFileSync(
        path.join(out, "continuous-real-pcm.json"),
        JSON.stringify(p, null, 2),
      );
      return {
        observed,
        quiet,
        owned,
        final: basicState(),
        changes: p.answerChanges,
        rates: p.rates,
      };
    });
    await test("continuous pending permission OFF and pause no restart", async () => {
      await basic();
      ev(() => {
        window.__micQA.permissionLatch = true;
        return true;
      });
      clickSelector("[data-microphone-continuous]");
      await waitFor(
        () => typeof window.__micQA.releasePermission === "function",
        "pending synthetic permission",
      );
      clickSelector("[data-microphone-continuous]");
      ev(() => {
        window.__micQA.releasePermission();
        window.__micQA.permissionLatch = false;
        return true;
      });
      await pause(350);
      assert.equal(basicState().continuous, "false");
      assert.equal(count(), "0/10");
      assert(proof().trackStates.every((s) => s.every((t) => t === "ended")));
      tone("silence");
      clickSelector("[data-microphone-continuous]");
      await waitFor(() => !!window.__micQA.generator, "reacquired");
      clickSelector("[data-practice-action=pause]");
      assert.equal(basicState().continuous, "false");
      const requests = basicState().requests;
      clickSelector("[data-practice-action=resume]");
      await pause(800);
      assert.equal(basicState().requests, requests);
      assert.equal(count(), "0/10");
      return basicState();
    });
    await test("continuous reference replay stops capture suppresses automatic output", async () => {
      await basic(48000, 1440, 1);
      tone("silence");
      clickSelector("[data-microphone-continuous]");
      await waitFor(() => !!window.__micQA.generator, "stream");
      const before = ev(() => ({
        starts: window.__micQA.oscillators.length,
        requests: window.__micQA.requests,
      }));
      tone("tone", 440, 0.16);
      await waitFor(
        () =>
          document.querySelector("[data-practice-stage] p.tabular-nums")
            ?.textContent === "1/10",
        "answer",
      );
      await pause(1300);
      assert.equal(
        ev(() => window.__micQA.oscillators.length),
        before.starts,
        "new question reference suppressed",
      );
      clickSelector("[data-practice-stage] button");
      assert.equal(basicState().continuous, "false");
      await pause(1100);
      assert.equal(basicState().continuous, "false");
      assert.equal(basicState().requests, before.requests);
      const p = proof();
      assert(p.oscillators.length > before.starts);
      assert(p.trackStates.every((s) => s.every((t) => t === "ended")));
      fs.writeFileSync(
        path.join(out, "reference-output.json"),
        JSON.stringify(p, null, 2),
      );
      return { before, after: basicState(), oscillators: p.oscillators };
    });
    await test("basic retained YIN real PCM hold rates and mobile focus", async () => {
      const cases = [];
      for (const rate of [44100, 48000, 96000]) {
        const width = rate === 48000 ? 390 : 1440;
        await basic(rate, width);
        tone("tone", 440, 0.16);
        gesture("keydown", " ");
        await waitFor(
          () =>
            document
              .querySelector("[data-microphone-quality]")
              ?.parentElement?.querySelector(".text-3xl")?.textContent === "A4",
          "YIN A4",
        );
        const before = basicState();
        gesture("keyup", " ");
        await waitFor(
          () =>
            document.querySelector("[data-practice-stage] p.tabular-nums")
              ?.textContent === "1/10",
          "hold release",
        );
        const p = proof();
        fs.writeFileSync(
          path.join(out, "hold-" + rate + ".json"),
          JSON.stringify(p, null, 2),
        );
        cases.push({
          rate,
          width,
          before,
          after: basicState(),
          actualRates: p.rates,
          trackSettings: p.settings,
          frames: p.basic.length,
        });
        if (width === 390) shot("hold-en-390");
      }
      return cases;
    });
    await test("hold early stable octave pointer desktop", async () => {
      await basic();
      tone("silence");
      gesture("keydown", " ");
      await waitFor(() => !!window.__micQA.generator, "hold stream");
      ev(async () => {
        window.__micQA.set("tone", 440, 0.16);
        await new Promise((r) => setTimeout(r, 120));
        const b = document.querySelector("[data-microphone-hold]");
        b.dispatchEvent(
          new KeyboardEvent("keyup", { key: " ", bubbles: true }),
        );
        return true;
      });
      await pause(250);
      assert.equal(count(), "0/10", "before220ms no submission");
      tone("tone", 440, 0.16);
      const point = ev(() => {
        const b = document.querySelector("[data-microphone-hold]");
        b.scrollIntoView({ behavior: "instant", block: "center" });
        const r = b.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      action("mouse", "move", "--x", String(point.x), "--y", String(point.y));
      action("mouse", "down");
      await waitFor(
        () =>
          document
            .querySelector("[data-microphone-quality]")
            ?.parentElement?.querySelector(".text-3xl")?.textContent === "A4",
        "native pointer A4",
      );
      action("mouse", "up");
      await waitFor(
        () =>
          document.querySelector("[data-practice-stage] p.tabular-nums")
            ?.textContent === "1/10",
        "native pointer release",
      );
      await waitFor(
        () =>
          document.querySelector("[data-microphone-hold]")?.disabled === false,
        "unlock",
      );
      gesture("keydown", "Enter");
      await waitFor(
        () =>
          document
            .querySelector("[data-microphone-quality]")
            ?.parentElement?.querySelector(".text-3xl")?.textContent === "A4",
        "confirmed original answer",
      );
      ev(async () => {
        window.__micQA.set("tone", 880, 0.16);
        await new Promise((r) => setTimeout(r, 100));
        document
          .querySelector("[data-microphone-hold]")
          .dispatchEvent(
            new KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
          );
        return true;
      });
      await waitFor(
        () =>
          document.querySelector("[data-practice-stage] p.tabular-nums")
            ?.textContent === "2/10",
        "old confirmed answer preserved",
      );
      assert.match(
        ev(
          () =>
            document.querySelector("[data-answer-toast-details]")?.textContent,
        ),
        /A4/,
      );
      return {
        earlyRejected: true,
        nativePointer: true,
        pendingOctavePreserved: true,
        after: basicState(),
        input: proof(),
      };
    });
    await test("Korean continuous native coarse controls", async () => {
      await navigate(
        base + "/ko/practice/note?share=1&length=ten&sound=0&input=microphone",
        390,
      );
      install();
      clickSelector("[data-practice-action=start]");
      await waitFor(
        () => !!document.querySelector("[data-microphone-continuous]"),
        "Korean row",
      );
      tone("silence");
      clickSelector("[data-microphone-continuous]");
      await waitFor(() => !!window.__micQA.generator, "Korean stream");
      tone("tone", 440, 0.16);
      await waitFor(
        () =>
          document.querySelector("[data-practice-stage] p.tabular-nums")
            ?.textContent === "1/10",
        "Korean continuous answer",
      );
      shot("continuous-ko-390");
      const g = geometry();
      const row = g.actionRows.find((r) => r.state === "microphone");
      assert(row);
      assert(Math.max(...row.heights) - Math.min(...row.heights) <= 1);
      assert.equal(noNumbers().bad, null);
      clickSelector("[data-microphone-continuous]");
      return {
        Korean: basicState(),
        geometry: g,
      };
    });
    await test("normal all-rest bar review and real preparation cancellation branches", async () => {
      const cases = [];
      for (const cancel of [
        "restSelection",
        "summary",
        "new",
        "retry",
        "unmount",
      ]) {
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
                bpm: 180,
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
        if (cancel === "restSelection") tone("tone", 261.625565, 0.16);
        await waitFor(
          () => !!document.querySelector("[data-rendered=true]"),
          "normal whole note melody",
        );
        clickSelector("[data-practice-action=start]");
        await waitFor(
          () =>
            document.querySelector("[data-melody-phase]")?.dataset
              .melodyPhase === "result",
          "real normal result",
          25000,
        );
        clickSelector("[data-minimize-results]");
        const actual = ev(() => {
          const v = window.__qaRead();
          return {
            review: v.review.events,
            stage: v.props.stage,
            result: v.attempt.result,
            elapsed: v.props.elapsed,
            requests: window.__micQA.requests,
            scroll: v.host.scrollLeft,
          };
        });
        const note = actual.review.find(
          (r) =>
            actual.stage.events.find((e) => e.id === r.sourceEventId)?.kind ===
            "note",
        );
        assert(note);
        const rest = actual.review.find(
          (r) =>
            actual.stage.events.find((e) => e.id === r.sourceEventId)?.kind ===
            "rest",
        );
        if (cancel === "restSelection") {
          assert(rest, "actual voiced all-rest violation");
          nativeSelect("[data-melody-result-review] select", rest.stageEventId);
          assert.equal(
            ev(
              () =>
                document.querySelectorAll("[data-melody-result-review] button")
                  .length,
            ),
            0,
            "all-rest bar has no play",
          );
          assert.match(
            ev(
              () =>
                document.querySelector("[data-melody-result-review]").innerText,
            ),
            /rest/i,
          );
        }
        nativeSelect("[data-melody-result-review] select", note.stageEventId);
        ev(() => {
          const native = window.fetch.bind(window);
          window.fetch = async (url, ...args) => {
            if (String(url).includes("sonivox.sf2"))
              await new Promise((resolve) => {
                window.__micQA.releaseFont = resolve;
              });
            return native(url, ...args);
          };
          return true;
        });
        clickSelector("[data-melody-result-review] button");
        await waitFor(
          () => typeof window.__micQA.releaseFont === "function",
          "held real font preparation",
        );
        assert.equal(
          ev(() => window.__micQA.piano.length),
          0,
        );
        if (cancel === "restSelection")
          nativeSelect("[data-melody-result-review] select", rest.stageEventId);
        if (cancel === "summary")
          clickSelector("[data-practice-action=results]");
        if (cancel === "new") clickSelector("[data-melody-player] > button");
        if (cancel === "retry") clickSelector("[data-practice-action=retry]");
        if (cancel === "unmount") {
          const s = snapshot(),
            link = Object.entries(s.refs).find(
              ([, v]) => v.role === "link" && v.name === "Basic practice",
            );
          assert(link);
          action("click", "--element", "@" + link[0]);
        }
        const canceled = ev(() => {
          const v = window.__qaRead();
          return {
            stage: v?.props.stage.id,
            phase: v?.attempt?.phase,
            result: v?.attempt?.result,
            elapsed: v?.props.elapsed,
            scroll: v?.host.scrollLeft,
            requests: window.__micQA.requests,
          };
        });
        ev(() => {
          window.__micQA.releaseFont();
          return true;
        });
        await pause(750);
        assert.equal(
          ev(() => window.__micQA.piano.length),
          0,
          "late preparation never restores sound " + cancel,
        );
        const after = ev(() => {
          const v = window.__qaRead();
          return {
            stage: v?.props.stage.id,
            phase: v?.attempt?.phase,
            result: v?.attempt?.result,
            elapsed: v?.props.elapsed,
            scroll: v?.host.scrollLeft,
            requests: window.__micQA.requests,
          };
        });
        if (cancel === "restSelection" || cancel === "summary")
          assert.deepEqual(after, canceled);
        if (cancel === "new") {
          assert.equal(after.phase, "landing");
          assert.notEqual(after.stage, actual.stage.id);
          assert.equal(after.result, null);
        }
        if (cancel === "retry") {
          assert(["countIn", "playing"].includes(after.phase));
          assert.equal(after.result, null);
          assert.equal(after.requests, 2);
        }
        if (cancel === "unmount") assert(!after.stage);
        cases.push({
          cancel,
          normalStage: actual.stage.id,
          rest,
          finalizedReasons: note.reasons,
          canceled,
          after,
        });
      }
      return cases;
    });
    await test("diagnostic native startup calibration original PCM", async () => {
      const observations = [];
      for (const startBeforeCountIn of [true, false]) {
        ev(() => {
          localStorage.removeItem("note-quiz-melody-settings-v1");
          return true;
        });
        await navigate(base + "/en/melody");
        install();
        ev(() => {
          window.__micQA.captureWindows = true;
          return true;
        });
        if (startBeforeCountIn) tone("tone", 261.625565, 0.16);
        await waitFor(
          () => !!document.querySelector("[data-rendered=true]"),
          "diagnostic render",
        );
        clickSelector("[data-practice-action=start]");
        await waitFor(
          () =>
            document.querySelector("[data-melody-phase]")?.dataset
              .melodyPhase === "playing",
          "diagnostic playing",
        );
        if (!startBeforeCountIn) tone("tone", 261.625565, 0.16);
        await pause(1200);
        const p = proof();
        fs.writeFileSync(
          path.join(out, "startup-" + startBeforeCountIn + ".json"),
          JSON.stringify(p, null, 2),
        );
        observations.push({
          startBeforeCountIn,
          audio: p.audioDiagnostic,
          frames: p.frames.slice(-5),
          hops: p.hops.length,
        });
        clickSelector("[data-practice-action=end]");
      }
      return observations;
    });
    await test("mobile multilingual actual button geometry matrix", async () => {
      const p = await layoutMatrix();
      report.layoutSummary = p;
      assert.equal(
        p.issues.length,
        0,
        "Concrete layout issues saved in layout-matrix.json",
      );
      return p;
    });
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
        report.storageAfter = ev(() => ({
          local: Object.fromEntries(Object.entries(localStorage)),
          session: Object.fromEntries(Object.entries(sessionStorage)),
        }));
        assert.deepEqual(report.storageAfter, storage);
        report.storageRestored = true;
        if (!process.env.MIC_QA_KEEP_PAGE) {
          orca("tab", "close", "--page", page);
          report.pageClosed = true;
        } else report.pageRetained = true;
      } catch (e) {
        report.cleanupError = e.stack;
      }
    }
    report.actions = qa.report.actions;
    report.outcome =
      report.fatal || report.cleanupError || report.cases.some((c) => !c.passed)
        ? "failed"
        : "passed selected checks";
    save();
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
    if (report.outcome === "failed") process.exitCode = 1;
  }
})();
