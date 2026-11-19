/* eslint-disable @typescript-eslint/no-require-imports */
// Exercise key and clef edits using the same pointer and keyboard controls as the player.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = new URL(process.env.UI_BASE_URL || "http://localhost:3000");
const note = (step) =>
  `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>`;
const key = (n) => `<key><fifths>${n}</fifths><mode>major</mode></key>`;
const harmony =
  "<harmony><root><root-step>C</root-step></root><kind>dominant</kind><degree><degree-value>9</degree-value><degree-alter>-1</degree-alter><degree-type>add</degree-type></degree></harmony>";
const xml = `<score-partwise version="4.0"><part-list><score-part id="P"><part-name>Piano</part-name></score-part></part-list><part id="P">${[
  "CDEF",
  "CEGA",
  "CDEF",
]
  .map(
    (notes, i) =>
      `<measure number="${i + 1}">${i === 0 ? "<attributes><divisions>1</divisions>" + key(0) + "<time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>" : i === 2 ? "<attributes>" + key(-1) + "</attributes>" : ""}${i === 0 ? harmony : ""}${[...notes].map(note).join("")}</measure>`,
  )
  .join("")}</part></score-partwise>`;
async function verify(browser, width) {
  const page = await browser.newPage({
    viewport: { width, height: 860 },
    hasTouch: width < 768,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const panel = page.locator("[data-edit-panel]");
  const bar = (i) => page.locator(`[data-edit-bar="${i}"]`);
  const pitches = (i) =>
    bar(i)
      .locator("[data-midi]")
      .evaluateAll((xs) => xs.map((x) => Number(x.dataset.midi)));
  const button = (el, label) =>
    el.getByRole("button", { name: label, exact: true });
  async function chooseKey(value, move) {
    await panel.locator("[data-key-field] select").selectOption(value);
    if (move) await panel.getByRole("checkbox").check();
    await button(panel, "적용").click();
    await panel.waitFor({ state: "hidden" });
  }
  try {
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === base.origin
        ? route.continue()
        : route.abort(),
    );
    await page.goto(new URL("/ko/melody/upload", base).href);
    // Next's local development indicator can cover the mobile sheet's first
    // button. Production has no such overlay.
    await page.addStyleTag({ content: "nextjs-portal { display: none }" });
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "keys.musicxml",
        mimeType: "application/xml",
        buffer: Buffer.from(xml),
      });
    await bar(0).waitFor();
    assert.equal(
      await bar(0).locator("[data-chord-label]").textContent(),
      "C7(♭9)",
    );
    await bar(1).locator('[data-edit-symbol="number"]').press("Enter");
    await button(panel, "조성").click();
    await chooseKey("major/1", false);
    assert.deepEqual(await pitches(1), [60, 64, 67, 69]);
    await bar(1).locator('[data-edit-symbol="key"]').click();
    assert.equal(await panel.locator("select").inputValue(), "major/1");
    await panel.locator("select").press("Escape");
    await button(page, "실행 취소").click();
    await bar(0)
      .locator('[data-edit-event="1"][data-edit-head="0"] [data-notehead-hit]')
      .click();
    await button(panel, "마디 기호").click();
    await button(panel, "조성").click();
    await chooseKey("major/2", true);
    assert.deepEqual(await pitches(0), [60, 64, 66, 67]);
    assert.deepEqual(await pitches(1), [62, 66, 69, 71]);
    // The third bar declares its own independent key.
    await page.locator("nav").locator("select").last().selectOption("2");
    assert.deepEqual(await pitches(2), [60, 62, 64, 65]);
    await page.locator("nav").locator("select").last().selectOption("0");
    await bar(0).locator('[data-edit-context="1"]').click();
    await button(panel, "음자리표").click();
    await panel.locator("select").selectOption("F:4");
    await button(panel, "적용").click();
    await button(page, "전체 보기").click();
    const full = page.locator('[data-full-score="ready"]');
    await full.waitFor();
    // Check actual ink from alphaTab in reading order. The new bass clef and
    // sharps belong after the first notehead, within the same written measure.
    await page.waitForFunction(() => {
      const ink = Array.from(
        document.querySelectorAll("[data-full-score] svg text"),
      ).map((n) => n.textContent);
      const note = ink.indexOf("\uE0A4");
      const clef = ink.indexOf("\uE062");
      return note >= 0 && clef > note && ink.indexOf("\uE262", clef) > clef;
    });
    assert.equal(
      await full.locator("[data-inline-signature-warning]").count(),
      0,
    );
    await full
      .getByRole("button", { name: /마디 1$/ })
      .first()
      .click();
    assert.deepEqual(await pitches(0), [60, 64, 66, 67]);
    await bar(0).locator('[data-edit-context="1"]').click();
    await button(panel, "음자리표").click();
    assert.equal(await panel.locator("select").inputValue(), "F:4");
    await panel.locator("select").press("Escape");
    await button(page, "실행 취소").click();
    await button(page, "실행 취소").click();
    assert.deepEqual(await pitches(0), [60, 62, 64, 65]);
    assert.equal(await bar(0).locator("[data-edit-context]").count(), 0);
    // A sustained second voice crosses the cut, so taking a shortcut in the
    // engraved overview would change the written rhythm. Keep the staff link.
    const twoVoices = xml
      .replace(
        "</measure>",
        "<backup><duration>4</duration></backup>" +
          "<note><pitch><step>A</step><octave>3</octave></pitch><duration>4</duration><voice>2</voice><type>whole</type></note></measure>",
      )
      .replace(
        note("D"),
        "<attributes><clef><sign>F</sign><line>4</line></clef></attributes>" +
          note("D"),
      );
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "overlap.musicxml",
        mimeType: "application/xml",
        buffer: Buffer.from(twoVoices),
      });
    await page
      .locator("[data-score-line]")
      .getByRole("heading")
      .filter({ hasText: "1/1" })
      .waitFor();
    await button(page, "전체 보기").click();
    await full.locator("[data-inline-signature-warning]").waitFor();
    await full.getByRole("button", { name: /마디 1 ·/ }).click();
    await bar(0).locator('[data-edit-context="1"]').waitFor();
    assert.deepEqual(errors, []);
    console.log(
      width +
        "px · bar and in-measure signature edits, independent next key, clef and undo passed",
    );
  } finally {
    await page.close();
  }
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH && {
      executablePath: process.env.BROWSER_PATH,
    }),
  });
  try {
    for (const width of [1280, 390]) await verify(browser, width);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
