/* eslint-disable @typescript-eslint/no-require-imports -- Optional local Playwright runner. */
/*
 * Geometry regression against an ALREADY RUNNING isolated server. Never starts or
 * restarts a server, touches build output, or attaches to an existing browser.
 * UI_BASE_URL is required; PLAYWRIGHT_MODULE/BROWSER_PATH select existing tools.
 * Idle checks default to all eight locales; feedback checks default to en,de.
 * UI_LAYOUT_IDLE_ONLY=1 runs only idle/preview/settings coverage.
 * UI_LAYOUT_LOCALES and UI_LAYOUT_IDLE_LOCALES can narrow their respective matrix.
 * Synthetic Math.random/audio/clock and leaderboard fixtures are labelled below.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.UI_BASE_URL;
assert(baseURL, "Pass UI_BASE_URL for the coordinator's isolated server");
const output = process.env.UI_ARTIFACT_DIR || "/tmp/note-quiz-layout-qa";
const locales = (process.env.UI_LAYOUT_LOCALES || "en,de").split(",");
const idleLocales = (
  process.env.UI_LAYOUT_IDLE_LOCALES || "en,ko,ja,es,de,fr,zh,pt"
).split(",");
const startLabels = {
  en: "Start practice",
  ko: "연습 시작",
  ja: "練習を開始",
  es: "Empezar práctica",
  de: "Übung starten",
  fr: "Commencer",
  zh: "开始练习",
  pt: "Iniciar prática",
};
const viewports = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];
const cases = [
  {
    id: "note",
    mode: "note",
    params: "clef=treble&key=C&above=0&below=0&sound=0&input=piano",
  },
  {
    id: "ear",
    mode: "ear",
    params: "notes=natural&min=4&max=4&sound=0&input=piano",
    audio: true,
  },
  ...["visual", "audio"].flatMap((view) => [
    {
      id: `interval-${view}`,
      mode: "interval",
      params: `level=custom&task=interval&view=${view}&intervals=P5&focus=P5`,
      audio: view === "audio",
    },
    {
      id: `chord-${view}`,
      mode: "chord",
      params: `level=custom&task=quality&view=${view}&chords=minor&focus=minor`,
      audio: view === "audio",
    },
    {
      id: `inversion-${view}`,
      mode: "chord",
      params: `level=custom&task=inversion&view=${view}&chords=major&inversions=0,1&focus=root`,
      audio: view === "audio",
    },
    {
      id: `progression-${view}`,
      mode: "chord",
      params: `level=custom&task=progression&view=${view}&focus=I-IV-V-I`,
      audio: view === "audio",
      progression: true,
    },
  ]),
  {
    id: "direction-audio",
    mode: "interval",
    params: "task=direction&view=audio&focus=higher",
    audio: true,
  },
];
const idleCases = cases.filter(({ id }) =>
  [
    "note",
    "ear",
    "interval-audio",
    "chord-audio",
    "progression-audio",
  ].includes(id),
);
const matrix = [
  ...idleLocales.flatMap((locale) =>
    viewports.flatMap((viewport) =>
      idleCases.map((test) => ({ locale, viewport, test, idleOnly: true })),
    ),
  ),
  ...(process.env.UI_LAYOUT_IDLE_ONLY === "1"
    ? []
    : locales.flatMap((locale) =>
        viewports.flatMap((viewport) =>
          cases.map((test) => ({ locale, viewport, test, idleOnly: false })),
        ),
      )),
];
const report = {
  baseURL,
  fixtures: [
    "Math.random=0",
    "virtual clock",
    "silent Web Audio",
    "leaderboard responses",
  ],
  measuredReactRenders: false,
  cases: [],
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function geometry(page) {
  return page.evaluate(() => {
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      const workspace = element.closest("[data-practice-scroll]");
      return {
        x: rect.x + scrollX + (workspace?.scrollLeft || 0),
        y: rect.y + scrollY + (workspace?.scrollTop || 0),
        width: rect.width,
        height: rect.height,
      };
    };
    const boxes = (selector) =>
      [...document.querySelectorAll(selector)].map(box);
    return {
      stage: boxes("[data-practice-stage]"),
      prompt: boxes("[data-practice-prompt]"),
      notation: boxes("[data-practice-stage] [data-practice-notation]"),
      explanation: boxes("[data-practice-explanation]"),
      input: boxes("[data-practice-input]"),
      answers: boxes("[data-practice-input] button"),
    };
  });
}
function sameGeometry(before, after, label) {
  for (const key of Object.keys(before)) {
    assert.equal(
      after[key].length,
      before[key].length,
      `${label}: ${key} count`,
    );
    before[key].forEach((box, index) => {
      for (const axis of ["x", "y", "width", "height"])
        assert(
          Math.abs(box[axis] - after[key][index][axis]) <= 1,
          `${label}: ${key}[${index}].${axis}: ${box[axis]} -> ${after[key][index][axis]}`,
        );
    });
  }
}
async function blankIsSecret(page, count) {
  const state = await page
    .locator("[data-practice-stage]")
    .evaluate((stage) => {
      const surfaces = [...stage.querySelectorAll("[data-practice-notation]")];
      return surfaces.map((surface) => ({
        revealed: surface.dataset.answerRevealed,
        labels: [...surface.querySelectorAll("[aria-label]")].map((node) =>
          node.getAttribute("aria-label"),
        ),
        blankVisible: !surface.querySelector("[data-notation-placeholder]")
          .hidden,
        nativeEmpty:
          !!surface.querySelector('[data-rendered="true"]') &&
          [...surface.querySelectorAll("[data-event-pitches]")].every(
            (node) => node.getAttribute("data-event-pitches") === "",
          ),
        fallbackEmpty:
          !!surface.firstElementChild.querySelector(
            "svg[data-notation-fallback]",
          ) &&
          surface.firstElementChild.querySelectorAll("ellipse").length === 0,
        blankNotes: surface
          .querySelector("[data-notation-placeholder]")
          .querySelectorAll("ellipse").length,
        staffLines: surface
          .querySelector("[data-notation-placeholder]")
          .querySelectorAll("line").length,
      }));
    });
  assert.equal(state.length, count, "Reserve every staff before response");
  for (const surface of state) {
    assert.equal(surface.revealed, "false");
    assert(
      (surface.blankVisible || surface.nativeEmpty || surface.fallbackEmpty) &&
        surface.blankNotes === 0 &&
        surface.staffLines >= 5,
      "Unrevealed staff has no noteheads",
    );
    assert(
      surface.labels.every((label) => !/[A-G](?:#|b)?[0-8]/.test(label)),
      "Unrevealed aria labels contain no answer notes",
    );
  }
}
async function scrollState(page) {
  return page.evaluate(() => {
    const workspace = document.querySelector("[data-practice-scroll]");
    return {
      windowX: scrollX,
      windowY: scrollY,
      workspaceTop: workspace?.scrollTop || 0,
      workspaceLeft: workspace?.scrollLeft || 0,
      workspaceMax: workspace
        ? workspace.scrollHeight - workspace.clientHeight
        : 0,
    };
  });
}
function sameScroll(before, after, label) {
  for (const key of ["windowX", "windowY", "workspaceTop", "workspaceLeft"])
    assert(
      Math.abs(before[key] - after[key]) <= 1,
      `${label}: ${key} ${before[key]} -> ${after[key]}`,
    );
}
async function endEvidence(
  page,
  beforeGeometry,
  beforeScroll,
  label,
  { blank = false } = {},
) {
  await page
    .locator('[data-practice-stage][data-practice-phase="finished"]')
    .waitFor();
  await notationReady(page);
  await delay(50);
  const finished = await geometry(page),
    scroll = await scrollState(page);
  sameGeometry(
    {
      stage: beforeGeometry.stage,
      notation: beforeGeometry.notation,
      input: beforeGeometry.input,
    },
    {
      stage: finished.stage,
      notation: finished.notation,
      input: finished.input,
    },
    label,
  );
  sameScroll(beforeScroll, scroll, label);
  assert.equal(
    await page
      .locator('[data-practice-feedback][data-feedback-visible="true"]')
      .count(),
    0,
    "Finished never leaves a judgment popup",
  );
  assert.equal(
    await page.locator("[data-practice-result]").count(),
    1,
    "Results use the shared separate panel without replacing the score",
  );
  assert.equal(
    await page.evaluate(() => window.__layoutResultScrollCalls),
    0,
    "Basic results do not call scrollIntoView",
  );
  const presentation = await page
    .locator("[data-practice-result]")
    .getAttribute("data-result-presentation");
  let popupLifecycle = null;
  if (presentation === "dialog") {
    await page.getByRole("dialog").waitFor();
    assert(
      await page
        .getByRole("dialog")
        .evaluate((dialog) => dialog.contains(document.activeElement)),
      "Result modal owns accessible focus",
    );
    popupLifecycle = await resultPopupLifecycle(page);
  } else
    assert(
      await page
        .locator("[data-practice-result] h2")
        .evaluate((heading) => document.activeElement === heading),
      "Inline result heading receives preventScroll focus",
    );
  if (blank) await blankIsSecret(page, finished.notation.length);
  return {
    finished,
    scroll,
    noResultScrollIntoView: true,
    presentation,
    popupLifecycle,
  };
}
async function resultPopupLifecycle(page) {
  const value = await page.locator("[data-practice-result]").textContent();
  const position = await scrollState(page);
  await page
    .locator("[data-minimize-results]")
    .evaluate((button) => button.click());
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  const restore = page.locator('[data-practice-action="view-results"]:visible');
  await restore.waitFor();
  assert(
    await restore.evaluate((button) => document.activeElement === button),
    "Minimize returns focus to the visible restore action",
  );
  assert.equal(
    await page.locator("[data-practice-result]").textContent(),
    value,
    "Minimize preserves result data and actions",
  );
  sameScroll(
    position,
    await scrollState(page),
    "Minimize preserves workspace scroll",
  );
  await restore.evaluate((button) => button.click());
  await page.getByRole("dialog").waitFor();
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press("Tab");
    assert(
      await page
        .getByRole("dialog")
        .evaluate((dialog) => dialog.contains(document.activeElement)),
      "Result modal traps keyboard focus",
    );
  }
  await page.keyboard.press("Escape");
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  assert(
    await restore.evaluate((button) => document.activeElement === button),
    "Escape minimizes to the restore action",
  );
  sameScroll(
    position,
    await scrollState(page),
    "Escape restores ordinary modal scroll state",
  );
  await restore.evaluate((button) => button.click());
  await page.getByRole("dialog").waitFor();
  assert.equal(
    await page.locator("[data-practice-result]").textContent(),
    value,
  );
  return {
    minimizedDataRetained: true,
    restoreFocus: true,
    focusTrap: true,
    escapeMinimizes: true,
  };
}
async function resultViewportTransitions(page) {
  const original = page.viewportSize(),
    value = await page.locator("[data-practice-result] section").textContent();
  const other =
    original.width < 1024
      ? { width: 1440, height: 900 }
      : { width: 390, height: 844 };
  for (const viewport of [other, original]) {
    await page.setViewportSize(viewport);
    await page
      .locator('[data-result-presentation="dialog"]')
      .waitFor({ state: "attached" });
    await page.getByRole("dialog").waitFor();
    assert.equal(
      await page.locator("[data-practice-result] section").textContent(),
      value,
      "Viewport change preserves results",
    );
  }
  return {
    desktopDialog: true,
    mobileDialog: true,
    resultRetained: true,
    cleanup: true,
  };
}

async function finishAndRestart(page, test) {
  // This is an explicit test scroll fixture, never a product-side scroll correction.
  await page.evaluate(() => {
    const workspace = document.querySelector("[data-practice-scroll]");
    if (workspace) workspace.scrollTop = workspace.scrollHeight;
  });
  const before = await geometry(page),
    scrollBefore = await scrollState(page);
  await page
    .locator("[data-practice-actions] button:visible")
    .last()
    .evaluate((button) => button.click());
  const manual = await endEvidence(
    page,
    before,
    scrollBefore,
    `${test.id}/manual-finish`,
  );
  await page
    .locator("[data-practice-result] button")
    .filter({ hasText: /./ })
    .evaluateAll((buttons) =>
      buttons
        .find((button) => button.className.includes("bg-[#5b21b6]"))
        ?.click(),
    );
  await page.locator('[data-practice-phase="active"]').waitFor();
  await settleAudio(page);
  await notationReady(page);
  sameGeometry(
    { stage: before.stage, notation: before.notation },
    {
      stage: (await geometry(page)).stage,
      notation: (await geometry(page)).notation,
    },
    `${test.id}/restart`,
  );
  sameScroll(scrollBefore, await scrollState(page), `${test.id}/restart`);
  assert(
    await page
      .locator("[data-practice-prompt]")
      .evaluate((node) => document.activeElement === node),
    "Restart returns keyboard focus to the question without scrolling",
  );
  // Restarted ten-question session: the final answer must complete naturally.
  for (let index = 0; index < 10; index++) {
    await page
      .locator("[data-practice-input] button")
      .first()
      .evaluate((button) => button.click());
    if (index < 9) {
      await page.clock.fastForward(1000);
      await settleAudio(page);
    }
  }
  await page.evaluate(() => {
    const workspace = document.querySelector("[data-practice-scroll]");
    if (workspace) workspace.scrollTop = workspace.scrollHeight;
  });
  const finalAnswer = await geometry(page),
    finalScroll = await scrollState(page);
  await page.clock.fastForward(1000);
  const automatic = await endEvidence(
    page,
    finalAnswer,
    finalScroll,
    `${test.id}/automatic-finish`,
  );
  // Also cover an early end with no accepted answers after a fresh restart.
  await page
    .locator("[data-practice-result] button")
    .filter({ hasText: /./ })
    .evaluateAll((buttons) =>
      buttons
        .find((button) => button.className.includes("bg-[#5b21b6]"))
        ?.click(),
    );
  await page.locator('[data-practice-phase="active"]').waitFor();
  await settleAudio(page);
  await notationReady(page);
  const unanswered = await geometry(page),
    unansweredScroll = await scrollState(page);
  await page
    .locator("[data-practice-actions] button:visible")
    .last()
    .evaluate((button) => button.click());
  const empty = await endEvidence(
    page,
    unanswered,
    unansweredScroll,
    `${test.id}/unanswered-finish`,
    { blank: true },
  );
  const viewportPresentation = await resultViewportTransitions(page);
  // Leave a live question and judgment for the existing mode-exit regression.
  await page
    .locator("[data-practice-result] button")
    .filter({ hasText: /./ })
    .evaluateAll((buttons) =>
      buttons
        .find((button) => button.className.includes("bg-[#5b21b6]"))
        ?.click(),
    );
  await page.locator('[data-practice-phase="active"]').waitFor();
  await settleAudio(page);
  return {
    manual,
    automatic,
    empty,
    viewportPresentation,
    restartGeometryStable: true,
  };
}

async function actionGeometry(page) {
  return page.locator("[data-practice-actions]").evaluate((area) => {
    const rect = area.parentElement.getBoundingClientRect();
    const layers = [...area.querySelectorAll("[data-action-state]")];
    const clipped = [...area.querySelectorAll("button span")]
      .filter(
        (span) =>
          span.scrollWidth > span.clientWidth + 1 ||
          span.scrollHeight > span.clientHeight + 1,
      )
      .map((span) => span.textContent);
    const inert = layers
      .filter((layer) => layer.getAttribute("aria-hidden") === "true")
      .every((layer) => layer.inert);
    const refs = [
      ...area.querySelectorAll("[data-practice-action=view-results]"),
    ].length;
    return {
      height: rect.height,
      layers: layers.length,
      clipped,
      inactiveInert: inert,
      restoreButtons: refs,
    };
  });
}
async function pauseFeedback(page) {
  await page
    .locator("[data-practice-input] button")
    .first()
    .evaluate((button) => button.click());
  const message = await page.locator("[data-practice-feedback]").innerText();
  assert(message, "Pause fixture first accepts an answer");
  const before = await geometry(page);
  await page
    .locator('[data-action-state="playing"] button')
    .first()
    .evaluate((button) => button.click());
  assert.equal(
    await page
      .locator("[data-practice-feedback]")
      .getAttribute("data-feedback-visible"),
    "false",
    "Paused hides judgment immediately",
  );
  await page.clock.fastForward(5000);
  assert.equal(
    await page
      .locator("[data-practice-feedback]")
      .getAttribute("data-feedback-visible"),
    "false",
    "Paused never leaves a stale judgment",
  );
  sameGeometry(before, await geometry(page), "pause preserves frame");
  await page
    .locator('[data-action-state="paused"] button')
    .first()
    .evaluate((button) => button.click());
  assert.equal(
    await page.locator("[data-practice-feedback]").innerText(),
    message,
    "Resume restores store feedback while its remaining transition runs",
  );
  await page.clock.fastForward(1000);
  await settleAudio(page);
  assert.equal(
    await page
      .locator("[data-practice-feedback]")
      .getAttribute("data-feedback-visible"),
    "false",
    "Authoritative transition clears resumed feedback",
  );
}

async function noteActionStates(page, entryURL, locale, test) {
  // A fresh piano/sound=0 entry avoids exercising microphone access after idle settings edits.
  await page.goto(entryURL);
  await page.locator('[data-practice-phase="idle"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await idleIsPassive(
    page,
    page.locator("[data-practice-actions] button:visible").first(),
    locale,
    test,
  );
  const idle = await actionGeometry(page),
    idleFrame = await geometry(page);
  const observe = async (label) => {
    const action = await actionGeometry(page);
    assert.equal(
      action.height,
      idle.height,
      `${label}: action footprint is unchanged`,
    );
    assert.deepEqual(
      action.clipped,
      [],
      `${label}: all translated state labels fit`,
    );
    const frame = await geometry(page);
    sameGeometry(
      { stage: idleFrame.stage, notation: idleFrame.notation },
      { stage: frame.stage, notation: frame.notation },
      label,
    );
    return action;
  };
  await page.locator("[data-practice-actions] button:visible").first().click();
  await page.locator('[data-practice-phase="active"]').waitFor();
  const playing = await observe("note playing");
  await page
    .locator('[data-action-state="playing"] button')
    .first()
    .evaluate((button) => button.click());
  const paused = await observe("note paused");
  await page
    .locator('[data-action-state="paused"] button')
    .first()
    .evaluate((button) => button.click());
  const resumed = await observe("note resumed");
  await page
    .locator("[data-practice-actions] button:visible")
    .last()
    .evaluate((button) => button.click());
  await page.locator('[data-practice-phase="finished"]').waitFor();
  const finished = await observe("note finished");
  return { idle, playing, paused, resumed, finished };
}

async function idleIsPassive(page, start, locale, test) {
  await page
    .locator('[data-practice-stage][data-practice-phase="idle"]')
    .waitFor();
  assert.equal(
    (await start.innerText()).trim(),
    startLabels[locale],
    "Every mode uses the shared translated start action",
  );
  await blankIsSecret(page, test.progression ? 4 : 1);
  assert.equal(
    await page.locator("[data-practice-input]").count(),
    0,
    "Idle never mounts music/microphone answer input",
  );
  await page.clock.fastForward(1000);
  await delay(50);
  const requests = await page.evaluate(() => ({
    audioGains: window.__layoutAudioGains,
    audioStarts: window.__layoutAudioStarts,
    microphones: window.__layoutMicrophones,
  }));
  assert.deepEqual(
    requests,
    { audioGains: 0, audioStarts: 0, microphones: 0 },
    "Idle must not initialize audio, play or request a microphone",
  );
}
async function changeIdleSettings(page, card, viewport) {
  const original = await geometry(page);
  if (viewport.width < 1024) {
    await card
      .locator('[data-practice-control-dock] [aria-haspopup="dialog"]')
      .click();
    await page.waitForURL((url) => url.searchParams.get("settings") === "open");
    await page.getByRole("dialog").waitFor();
  }
  const settings =
    viewport.width < 1024
      ? page.getByRole("dialog")
      : page.locator("aside[data-practice-settings]");
  const key = settings.locator('select:has(option[value="Bb"])');
  await key.selectOption("Bb");
  await page.waitForURL(
    (url) =>
      url.searchParams.get("key") === "Bb" &&
      (viewport.width >= 1024 || url.searchParams.get("settings") === "open"),
  );
  await settings.locator("fieldset").first().locator("button").nth(2).click();
  await page.waitForURL(
    (url) =>
      url.searchParams.get("clef") === "bass" &&
      url.searchParams.get("key") === "Bb",
  );
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-practice-phase="idle"]');
    return (
      stage?.dataset.previewClef === "bass" &&
      stage?.dataset.previewKey === "Bb Major"
    );
  });
  assert.equal(
    await page
      .locator(
        '[data-practice-stage] [data-notation-placeholder] image[href="/bass-clef.svg"]',
      )
      .count(),
    1,
  );
  assert.equal(
    await page
      .locator(
        '[data-practice-stage] [data-notation-placeholder] image[href="/flat-sign.svg"]',
      )
      .count(),
    2,
  );
  await key.selectOption("random");
  await page.waitForURL(
    (url) =>
      url.searchParams.get("key") === "random" &&
      (viewport.width >= 1024 || url.searchParams.get("settings") === "open"),
  );
  await settings.locator("fieldset").first().locator("button").first().click();
  await page.waitForURL((url) => url.searchParams.get("clef") === "random");
  // Selecting microphone input while idle must still not mount or request it.
  await settings.locator("fieldset").nth(1).locator("button").nth(2).click();
  await page.waitForURL(
    (url) => url.searchParams.get("input") === "microphone",
  );
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-practice-phase="idle"]');
    return (
      stage?.dataset.previewClef === "treble" &&
      stage?.dataset.previewKey === "C Major"
    );
  });
  assert.equal(
    await page
      .locator(
        '[data-practice-stage] [data-notation-placeholder] image[href="/g-clef.svg"]',
      )
      .count(),
    1,
  );
  assert.equal(
    await page
      .locator(
        '[data-practice-stage] [data-notation-placeholder] image[href="/flat-sign.svg"]',
      )
      .count(),
    0,
  );
  if (viewport.width < 1024) {
    await settings.locator("button").first().click();
    await page.waitForURL((url) => !url.searchParams.has("settings"));
    await settings.waitFor({ state: "hidden" });
  }
  const changed = await geometry(page);
  sameGeometry(
    { notation: original.notation },
    { notation: changed.notation },
    "Idle clef/key settings preserve notation geometry",
  );
  return {
    configuredClef: "bass",
    configuredKey: "Bb Major",
    randomClef: "treble",
    randomKey: "C Major",
    microphoneStayedIdle: true,
  };
}

async function assertOverlay(page) {
  const state = await page
    .locator("[data-practice-feedback]")
    .evaluate((overlay) => {
      const rect = overlay.getBoundingClientRect(),
        stage = overlay.closest("[data-practice-stage]");
      const parent = stage.getBoundingClientRect();
      const overlap = [
        ...stage.querySelectorAll("[data-practice-notation], button"),
      ].some((node) => {
        const box = node.getBoundingClientRect();
        return (
          rect.left < box.right &&
          rect.right > box.left &&
          rect.top < box.bottom &&
          rect.bottom > box.top
        );
      });
      return {
        pointerEvents: getComputedStyle(overlay).pointerEvents,
        position: getComputedStyle(overlay).position,
        role: overlay.getAttribute("role"),
        live: overlay.getAttribute("aria-live"),
        inside: rect.top >= parent.top && rect.bottom <= parent.bottom,
        overlap,
        focused: overlay.contains(document.activeElement),
        inPromptBand: (() => {
          const band = overlay
            .closest("[data-practice-prompt-band]")
            ?.getBoundingClientRect();
          return (
            !!band &&
            rect.top >= band.top - 1 &&
            rect.bottom <= band.bottom + 1 &&
            rect.left >= band.left - 1 &&
            rect.right <= band.right + 1
          );
        })(),
      };
    });
  assert.deepEqual(state, {
    pointerEvents: "none",
    position: "absolute",
    role: "status",
    live: "polite",
    inside: true,
    overlap: false,
    focused: false,
    inPromptBand: true,
  });
}

async function settleAudio(page) {
  // Web Audio onended follows AudioContext.currentTime, not Playwright's clock.
  // Flush the React/audio-start turn, then wait on real time without fast-forwarding it.
  await page.clock.runFor(32);
  const deadline = Date.now() + 20000;
  let observation;
  do {
    observation = await page.evaluate(() => ({
      enabled:
        !!document.querySelector("[data-practice-input] button") &&
        !document.querySelector("[data-practice-input] button").disabled,
      phase: document.querySelector("[data-practice-stage]")?.dataset
        .practicePhase,
      contexts: (window.__layoutContexts || []).map((context) => ({
        state: context.state,
        currentTime: context.currentTime,
      })),
    }));
    if (observation.enabled) return;
    await delay(40);
  } while (Date.now() < deadline);
  throw new Error(
    `Automatic audio did not release answer controls: ${JSON.stringify(observation)}`,
  );
}

async function notationReady(page) {
  // Placeholder SVGs also carry data-notation-fallback. Observe the actual
  // renderer layer and its covered/uncovered state, never the loading staff.
  // Native engraving completes in real time; keep authoritative feedback frozen.
  await page.clock.runFor(32);
  const deadline = Date.now() + 15000;
  let observation;
  do {
    observation = await page
      .locator("[data-practice-stage] [data-practice-notation]")
      .evaluateAll((surfaces) =>
        surfaces.map((surface) => ({
          uncovered: surface.querySelector("[data-notation-placeholder]")
            .hidden,
          native: !!surface.firstElementChild.querySelector(
            '[data-rendered="true"]',
          ),
          fallback: !!surface.firstElementChild.querySelector(
            "[data-notation-fallback]",
          ),
        })),
      );
    if (
      observation.length &&
      observation.every(
        ({ uncovered, native, fallback }) => uncovered && (native || fallback),
      )
    )
      return;
    await delay(50);
  } while (Date.now() < deadline);
  throw new Error(
    `Notation never uncovered its finished renderer: ${JSON.stringify(observation)}`,
  );
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {}),
  });
  try {
    for (const { locale, viewport, test, idleOnly } of matrix) {
      const context = await browser.newContext({
        viewport,
        locale: `${locale}-${locale.toUpperCase()}`,
        reducedMotion: "reduce",
      });
      await context.addInitScript(() => {
        Math.random = () => 0;
        window.__layoutResultScrollCalls = 0;
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = function (...args) {
          if (this.matches("[data-practice-result] h2"))
            window.__layoutResultScrollCalls++;
          return originalScrollIntoView.apply(this, args);
        };
        window.__layoutContexts = [];
        window.__layoutAudioGains = 0;
        window.__layoutAudioStarts = 0;
        window.__layoutMicrophones = 0;
        if (navigator.mediaDevices?.getUserMedia) {
          const original = navigator.mediaDevices.getUserMedia.bind(
            navigator.mediaDevices,
          );
          navigator.mediaDevices.getUserMedia = (...args) => {
            window.__layoutMicrophones++;
            return original(...args);
          };
        }
        // Preserve initialization/playback lifecycle, suppress audible test output.
        const Constructor = window.AudioContext || window.webkitAudioContext;
        if (Constructor) {
          const originalOscillator = Constructor.prototype.createOscillator;
          Constructor.prototype.createOscillator = function (...args) {
            const oscillator = originalOscillator.apply(this, args);
            const start = oscillator.start.bind(oscillator);
            oscillator.start = (...values) => {
              window.__layoutAudioStarts++;
              return start(...values);
            };
            return oscillator;
          };
          const original = Constructor.prototype.createGain;
          Constructor.prototype.createGain = function (...args) {
            if (!window.__layoutContexts.includes(this))
              window.__layoutContexts.push(this);
            window.__layoutAudioGains++;
            const gain = original.apply(this, args);
            const connect = gain.connect.bind(gain);
            gain.connect = (...values) => {
              return values[0] === this.destination
                ? values[0]
                : connect(...values);
            };
            return gain;
          };
        }
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/leaderboard**", (route) =>
        route.fulfill({
          json: {
            viewerCountry: null,
            periodDate: "2026-11-15",
            entries: [],
            sessionPoints: 0,
            submissionStatus: "ineligible",
          },
        }),
      );
      await page.clock.install();
      const entryURL = new URL(
        `/${locale}/practice/${test.mode}?share=1&mode=${test.mode}&length=ten&${test.params}`,
        baseURL,
      ).href;
      await page.goto(entryURL);
      await page.evaluate(() => document.fonts.ready);
      const card = page
        .locator("section")
        .filter({ has: page.locator("[data-practice-mode]") })
        .first();
      const start = card
        .locator("[data-practice-actions] button:visible")
        .first();
      await idleIsPassive(page, start, locale, test);
      const idleGeometry = await geometry(page);
      const idleActions = await actionGeometry(page);
      assert(
        idleActions.inactiveInert,
        "Inactive control groups never accept keyboard/pointer input",
      );
      if (viewport.width < 1024) {
        const rows = await page
          .locator("[data-practice-metrics] dd")
          .evaluateAll((values) =>
            values.map((value) => value.getBoundingClientRect().top),
          );
        assert.equal(rows.length, 3, "Mobile shows time/correct/accuracy");
        assert(
          Math.max(...rows) - Math.min(...rows) <= 1,
          "Mobile metrics occupy one readable line",
        );
      }
      assert.deepEqual(
        idleActions.clipped,
        [],
        "Every translated action label fits without clipping",
      );
      await page.screenshot({
        path: `${output}/${locale}-${viewport.width}-${test.id}-idle.png`,
      });
      if (idleOnly) {
        const settings =
          test.mode === "note"
            ? await changeIdleSettings(page, card, viewport)
            : null;
        await idleIsPassive(page, start, locale, test);
        const actionStates =
          test.mode === "note"
            ? await noteActionStates(page, entryURL, locale, test)
            : null;
        assert.deepEqual(errors, [], "No idle browser errors");
        report.cases.push({
          locale,
          viewport,
          id: test.id,
          idleOnly: true,
          sharedStartLabel: startLabels[locale],
          idleGeometry,
          emptyStaves: test.progression ? 4 : 1,
          passivePreview: true,
          settings,
          actionStates,
        });
        await context.close();
        continue;
      }
      await start.click();
      await page
        .locator('[data-practice-stage][data-practice-phase="active"]')
        .waitFor();
      await settleAudio(page);
      await notationReady(page);
      await page.clock.pauseAt(
        new Date(await page.evaluate(() => Date.now() + 100)),
      );
      const before = await geometry(page);
      const activeActions = await actionGeometry(page);
      assert.equal(
        activeActions.height,
        idleActions.height,
        "Idle/playing action footprint is stable",
      );
      assert.deepEqual(activeActions.clipped, [], "Playing action labels fit");
      assert.equal(before.notation.length, test.progression ? 4 : 1);
      sameGeometry(
        { stage: idleGeometry.stage, notation: idleGeometry.notation },
        { stage: before.stage, notation: before.notation },
        `${test.id}/idle-to-start`,
      );
      if (test.audio) await blankIsSecret(page, test.progression ? 4 : 1);
      await assertOverlay(page);
      const prompt = await page.locator("[data-practice-prompt]").innerText();
      // Renderer DOM changes are an observable boundary check, not React render counts.
      await page.evaluate(() => {
        window.__layoutNotationMutations = 0;
        const observer = new MutationObserver((records) => {
          window.__layoutNotationMutations += records.length;
        });
        for (const node of document.querySelectorAll(
          "[data-practice-stage] [data-practice-notation]",
        ))
          observer.observe(node, {
            subtree: true,
            childList: true,
            attributes: true,
          });
        window.__layoutNotationObserver = observer;
      });
      await page.clock.runFor(500);
      const clockMutations = await page.evaluate(() => {
        window.__layoutNotationObserver.disconnect();
        return window.__layoutNotationMutations;
      });
      assert.equal(
        clockMutations,
        0,
        "Clock ticks must not update notation DOM",
      );
      const snapshots = { answer: before };
      let previousCorrectSpan;
      let previousCorrectText;
      for (const [index, judgment] of [
        "correct",
        "correct",
        "incorrect",
      ].entries()) {
        const inputs = page.locator("[data-practice-input] button");
        let choice;
        if (test.mode === "note") {
          const pitches = await page
            .locator("[data-practice-notation] [data-event-pitches]")
            .first()
            .getAttribute("data-event-pitches");
          assert(
            pitches,
            "Sight-reading engraving must finish before selecting the answer",
          );
          const names = [
            "C",
            "C#",
            "D",
            "D#",
            "E",
            "F",
            "F#",
            "G",
            "G#",
            "A",
            "A#",
            "B",
          ];
          const correct = `${names[Number(pitches.split(/[;,]/)[0]) % 12]}4`;
          choice =
            judgment === "correct"
              ? page
                  .locator("[data-practice-input]")
                  .getByRole("button", { name: correct, exact: true })
              : page.locator("[data-practice-input]").getByRole("button", {
                  name: correct === "C4" ? "D4" : "C4",
                  exact: true,
                });
        } else if (test.mode === "ear") {
          choice = page.locator("[data-practice-input]").getByRole("button", {
            name: judgment === "correct" ? "C4" : "D4",
            exact: true,
          });
        } else choice = inputs.nth(judgment === "correct" ? 0 : 1);
        assert(
          await choice.isEnabled(),
          "Answer must be available before submission",
        );
        await page.locator("[data-practice-prompt]").evaluate((node) => {
          node.tabIndex = -1;
          node.focus();
        });
        await choice.evaluate((button) => button.click());
        assert.equal(
          await page
            .locator("[data-practice-feedback]")
            .getAttribute("data-feedback-visible"),
          "true",
        );
        // Give asynchronous engraving workers real time; feedback clock stays paused.
        await page.clock.runFor(32);
        await notationReady(page);
        await assertOverlay(page);
        assert.equal(
          await page.locator("[data-practice-prompt]").innerText(),
          prompt,
        );
        assert(
          await page
            .locator("[data-practice-prompt]")
            .evaluate((node) => document.activeElement === node),
          "Feedback must not take focus",
        );
        const text = await page.locator("[data-practice-feedback]").innerText();
        const toast = page.locator("[data-answer-toast]");
        assert.equal(
          await toast.getAttribute("data-correct"),
          String(judgment === "correct"),
        );
        assert.equal(await toast.getAttribute("data-visible"), "true");
        assert.equal(await toast.getAttribute("aria-hidden"), "false");
        if (judgment === "correct") {
          if (previousCorrectSpan) {
            assert.equal(
              text,
              previousCorrectText,
              "Consecutive correct judgments use the same translated text",
            );
            assert(
              await previousCorrectSpan.evaluate((node) => !node.isConnected),
              "Consecutive identical feedback replaces the announcement node",
            );
          }
          previousCorrectSpan = await page
            .locator("[data-answer-toast]")
            .elementHandle();
          previousCorrectText = text;
        }

        const colors = await toast.evaluate((node) => ({
          color: getComputedStyle(node).color,
          background: getComputedStyle(node).backgroundColor,
        }));
        assert(
          colors.color !== colors.background,
          `Judgment remains readable: ${text}`,
        );
        const feedback = await geometry(page);
        sameGeometry(
          before,
          feedback,
          `${locale}/${viewport.width}/${test.id}/${judgment}`,
        );
        snapshots[`${judgment}-${index}`] = feedback;
        await page.screenshot({
          path: `${output}/${locale}-${viewport.width}-${test.id}-${judgment}-${index}.png`,
        });
        await page.clock.fastForward(1000);
        await settleAudio(page);
        await notationReady(page);
        assert.equal(
          await page
            .locator("[data-practice-feedback]")
            .getAttribute("data-feedback-visible"),
          "false",
        );
        sameGeometry(before, await geometry(page), `${test.id}/next`);
        if (test.audio) await blankIsSecret(page, test.progression ? 4 : 1);
      }
      if (test.mode === "note") await pauseFeedback(page);
      const completion = await finishAndRestart(page, test);
      // Exit through the public mode control while feedback is visible.
      const inputs = page.locator("[data-practice-input] button");
      await inputs.first().evaluate((button) => button.click());
      const nextMode = test.mode === "note" ? "ear" : "note";
      const link = page
        .locator(
          `[data-practice-mode] a[href*="/practice/${nextMode}"], [data-practice-mode] input[value="${nextMode}"]`,
        )
        .first();
      await link.evaluate((anchor) => anchor.click());
      await page.waitForURL((url) =>
        url.pathname.endsWith(`/practice/${nextMode}`),
      );
      assert.equal(
        await page
          .locator('[data-practice-feedback][data-feedback-visible="true"]')
          .count(),
        0,
        "Mode exit clears stale overlay",
      );
      assert.deepEqual(errors, [], "No browser errors");
      report.cases.push({
        locale,
        viewport,
        id: test.id,
        clockNotationMutations: clockMutations,
        snapshots,
        idleGeometry,
        idleToStartStable: true,
        completion,
        geometryStable: true,
        focusPreserved: true,
        exitClearsFeedback: true,
      });
      await context.close();
    }
  } finally {
    fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
