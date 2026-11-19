/* eslint-disable @typescript-eslint/no-require-imports */
// Run against an existing local Note Quiz server; no real microphone or file transfer.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = new URL(process.env.UI_BASE_URL || "http://localhost:3001");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));

const title = "마디 편집 확인";
const notes = ["C", "D", "E", "F"].map(
  (step) =>
    `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note>`,
);
const score = `<score-partwise version="4.0"><work><work-title>${title}</work-title></work>
<part-list><score-part id="P"><part-name>Piano</part-name></score-part></part-list>
<part id="P"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key>
<time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
${notes.join("")}</measure></part></score-partwise>`;

async function check(browser, viewport) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: "reduce",
    hasTouch: viewport.width < 500,
  });
  try {
    await context.route("**/*", (route) => {
      const req = route.request();
      if (
        !["GET", "HEAD"].includes(req.method()) ||
        new URL(req.url()).origin !== base.origin
      )
        return route.abort();
      if (new URL(req.url()).pathname === "/api/leaderboard")
        return route.fulfill({ json: { entries: [], viewerCountry: null } });
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    const generated = "/ko/melody/generated",
      upload = "/ko/melody/upload";
    const nav = page.locator("[data-melody-sources]");
    const source = (path) => nav.locator(`a[href="${path}"]`);
    const urlIs = async (path) => {
      await page.waitForURL((url) => url.pathname === path);
      await nav.locator(`a[href="${path}"][aria-current="page"]`).waitFor();
      await page.waitForFunction(
        (url) => document.querySelector("link[rel=canonical]")?.href === url,
        "https://note-quiz.com" + path,
      );
    };
    const legacy = await context.request.get(
      new URL("/ko/melody?tempo=80", base).href,
      { maxRedirects: 0 },
    );
    assert.equal(legacy.status(), 308);
    assert.equal(
      new URL(legacy.headers().location, base).pathname +
        new URL(legacy.headers().location, base).search,
      generated + "?tempo=80",
    );
    await page.goto(new URL(generated, base).href);
    await page.locator("[data-melody-phase]").waitFor();
    await page.getByRole("button", { name: "악보 편집", exact: true }).click();
    const generatedHead = page
      .locator('[data-edit-bar="0"] [data-edit-head="0"]')
      .first();
    const firstMidi = Number(await generatedHead.getAttribute("data-midi"));
    await generatedHead.press("ArrowUp");
    await page.waitForFunction(
      (pitch) =>
        Number(
          document.querySelector('[data-edit-bar="0"] [data-edit-head="0"]')
            .dataset.midi,
        ) > pitch,
      firstMidi,
    );
    const editedMidi = Number(await generatedHead.getAttribute("data-midi"));
    await generatedHead.press("Escape");
    await page
      .getByRole("button", { name: "이 마디 듣기", exact: true })
      .click();
    await page.locator("[data-import-phase=preview]").waitFor();
    await page.locator("[data-import-phase=ready]").waitFor();
    await page.getByRole("button", { name: "생성 원본 보기" }).click();
    await page.getByRole("button", { name: "편집한 악보 열기" }).click();
    assert.equal(
      Number(await generatedHead.getAttribute("data-midi")),
      editedMidi,
    );
    await source(upload).click();
    await urlIs(upload);
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "owned.musicxml",
        mimeType: "application/xml",
        buffer: Buffer.from(score),
      });
    await page.getByRole("heading", { name: title }).waitFor();
    const head = page.locator(
      '[data-selected-bar] [data-edit-event="0"][data-edit-head="0"]',
    );
    assert.equal(await head.getAttribute("data-midi"), "60");
    const region = page.locator("[data-edit-scroll]").locator("..");
    const originalHeight = (await region.boundingBox()).height;
    const hit = head.locator("[data-notehead-hit]");
    if (viewport.width < 500) await hit.tap();
    else await hit.click();
    const tools = page.locator("[data-edit-panel=note]");
    await tools.waitFor();
    assert.equal(
      (await region.boundingBox()).height,
      originalHeight,
      "Opening tools must not move the score",
    );
    await head.press("ArrowUp");
    await page
      .locator('[data-edit-event="0"][data-midi="62"]')
      .first()
      .waitFor();
    await head.press("Escape");
    await source(generated).click();
    await urlIs(generated);
    assert.equal(
      Number(await generatedHead.getAttribute("data-midi")),
      editedMidi,
    );
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    assert.equal(
      Number(await generatedHead.getAttribute("data-midi")),
      firstMidi,
    );
    await page.goBack();
    await urlIs(upload);
    await page.getByRole("heading", { name: title }).waitFor();
    assert.equal(
      await head.getAttribute("data-midi"),
      "62",
      "Back must restore the edited document",
    );
    await page.goForward();
    await urlIs(generated);
    await source(upload).click();
    await urlIs(upload);
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    assert.equal(
      await head.getAttribute("data-midi"),
      "60",
      "Source switching must preserve undo",
    );
    assert.equal(
      await page.locator("link[hreflang=de]").getAttribute("href"),
      "https://note-quiz.com/de/melody/upload",
    );
    if (viewport.width < 500)
      await page.getByRole("button", { name: "설정", exact: true }).click();
    const settings = page.locator("[data-import-settings]:visible");
    const tempo = settings.getByRole("spinbutton", { name: "빠르기 (BPM)" });
    await tempo.fill("96");
    await tempo.press("Tab");
    assert.equal(await tempo.inputValue(), "96");
    for (const name of ["매 박자 메트로놈", "마디 시작에 종소리"]) {
      const control = settings.getByRole("checkbox", { name });
      const checked = await control.isChecked();
      await control.click();
      assert.equal(await control.isChecked(), !checked);
    }
    await settings
      .getByRole("combobox", { name: "박자", exact: true })
      .selectOption("3/4");
    if (viewport.width < 500) await page.keyboard.press("Escape");
    const bar = page.getByRole("combobox", { name: "마디", exact: true });
    assert.equal(
      await bar.locator("option").count(),
      2,
      "Overflow must create a second measure",
    );
    const pitches = () =>
      page
        .locator("[data-selected-bar] [data-edit-head]")
        .evaluateAll((heads) => heads.map((h) => Number(h.dataset.midi)));
    assert.deepEqual(await pitches(), [60, 62, 64]);
    await bar.selectOption("1");
    assert.deepEqual(await pitches(), [65]);
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    assert.equal(await bar.locator("option").count(), 1);
    assert.deepEqual(await pitches(), [60, 62, 64, 65]);
    await head.press("ArrowUp");
    assert.deepEqual(await pitches(), [62, 62, 64, 65]);
    await head.press("Escape");
    await page
      .locator("header .language-selector button[aria-haspopup=dialog]")
      .click();
    await page
      .getByRole("menuitemradio", { name: "Deutsch", exact: true })
      .click();
    await urlIs("/de/melody/upload");
    assert.equal(await page.locator("html").getAttribute("lang"), "de");
    await page.getByRole("heading", { name: title }).waitFor();
    assert.deepEqual(
      await pitches(),
      [62, 62, 64, 65],
      "Changing language must preserve the edited score",
    );
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.deepEqual(
      await pitches(),
      [60, 62, 64, 65],
      "The edit made before changing language must still be undoable",
    );
    assert.deepEqual(errors, []);
    console.log(
      `${viewport.width}×${viewport.height} · generated score editing, preview, independent histories, source links, undo, editor height, settings, meter overflow, language switch and SEO passed`,
    );
  } finally {
    await context.close();
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
    for (const viewport of [
      { width: 1360, height: 960 },
      { width: 390, height: 844 },
    ])
      await check(browser, viewport);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
