/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = new URL(process.env.UI_BASE_URL || "http://localhost:3000");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));

const bars = ["CDEF", "GABC", "FEDC", "ABCD", "EFGA"].map((steps, i) => {
  const notes = [...steps]
    .map(
      (step) =>
        `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>`,
    )
    .join("");
  const attributes = i
    ? ""
    : "<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>";
  return `<measure number="${i + 1}">${attributes}${notes}</measure>`;
});
const xml = `<score-partwise version="4.0"><part-list><score-part id="p"><part-name>Piano</part-name></score-part></part-list><part id="p">${bars.join("")}</part></score-partwise>`;

async function run(browser, mobile) {
  const page = await browser.newPage({
    viewport: { width: mobile ? 390 : 1360, height: mobile ? 844 : 960 },
    hasTouch: mobile,
    isMobile: mobile,
    reducedMotion: "reduce",
  });
  try {
    await page.route("**/*", (r) =>
      new URL(r.request().url()).origin === base.origin
        ? r.continue()
        : r.abort(),
    );
    const cdp = await page.context().newCDPSession(page);
    const pointer = async (kind, p) => {
      if (mobile)
        await cdp.send("Input.dispatchTouchEvent", {
          type: {
            down: "touchStart",
            move: "touchMove",
            up: "touchEnd",
            cancel: "touchCancel",
          }[kind],
          touchPoints: p ? [p] : [],
        });
      else if (kind === "down") {
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
      } else if (kind === "move") await page.mouse.move(p.x, p.y);
      else await page.mouse.up();
    };
    await page.goto(new URL("/ko/melody/upload", base).href);
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "drag.musicxml",
        mimeType: "application/xml",
        buffer: Buffer.from(xml),
      });
    const line = page.locator("[data-edit-scroll]");
    const head = (bar, index) =>
      page.locator(
        `svg[data-edit-bar="${bar}"] [data-edit-event="${index}"][data-edit-head="0"]`,
      );
    const center = async (bar, i) => {
      const b = await head(bar, i).locator("[data-notehead-hit]").boundingBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    const scrollToBoundary = async () => {
      await line.scrollIntoViewIfNeeded();
      await head(0, 3).evaluate((el) => {
        const viewport = el.closest("[data-edit-scroll]");
        const svg = el.closest("svg");
        viewport.scrollLeft =
          svg.getBoundingClientRect().width - viewport.clientWidth / 2;
      });
    };
    await head(0, 0).waitFor();
    const undo = page.getByRole("button", { name: "실행 취소", exact: true });
    await scrollToBoundary();
    const grab = async () => {
      await pointer("down", await center(0, 3));
      await page
        .locator('svg[data-edit-bar="0"] [data-edit-event="3"][data-note-held]')
        .waitFor({ state: "attached", timeout: 3000 });
    };
    await grab();
    await pointer("move", await center(1, 0));
    await page
      .locator(
        'svg[data-edit-bar="1"] [data-edit-slot="0"][data-drop-state="ready"]',
      )
      .waitFor({ state: "attached" });
    await pointer("up");
    await page.waitForFunction(() =>
      document.querySelector(
        'svg[data-edit-bar="1"] [data-edit-event="0"][data-midi="65"]',
      ),
    );
    assert.equal(await head(0, 3).getAttribute("data-midi"), "67");
    await undo.click();
    assert.equal(await head(0, 3).getAttribute("data-midi"), "65");
    assert.equal(await head(1, 0).getAttribute("data-midi"), "67");
    assert.equal(await undo.isDisabled(), true);

    await scrollToBoundary();
    await grab();
    const limits = await line.boundingBox();
    const heldAt = await center(0, 3);
    const beforeEdge = await line.evaluate((el) => el.scrollLeft);
    await pointer("move", { x: limits.x + limits.width - 5, y: heldAt.y });
    await page.waitForFunction(
      (left) =>
        document.querySelector("[data-edit-scroll]").scrollLeft > left + 150,
      beforeEdge,
    );
    assert.equal(
      await page.locator("[data-note-held]").count(),
      1,
      "Source capture survives edge scrolling",
    );
    if (mobile) await pointer("cancel");
    else {
      await page.keyboard.press("Escape");
      await pointer("up");
    }
    assert.equal(await head(0, 3).getAttribute("data-midi"), "65");
    assert.equal(await undo.isDisabled(), true);
    assert.equal(
      await page.locator("[data-note-held], [data-drop-state]").count(),
      0,
    );
    await scrollToBoundary();
    const start = await center(0, 3);
    await pointer("down", start);
    await pointer("move", { x: start.x - 68, y: start.y });
    await pointer("up");
    const scrolled = await head(0, 3)
      .locator("[data-notehead-hit]")
      .boundingBox();
    assert.ok(
      scrolled.x + scrolled.width / 2 < start.x - 20,
      "Quick swipe scrolls without editing",
    );
    assert.equal(await undo.isDisabled(), true);

    await head(1, 0).focus();
    await page.keyboard.press("Shift+ArrowLeft");
    await page.waitForFunction(() =>
      document.querySelector(
        'svg[data-edit-bar="0"] [data-edit-event="3"][data-midi="67"]',
      ),
    );
    await undo.click();
    assert.equal(await head(0, 3).getAttribute("data-midi"), "65");
    console.log(
      "PASS hold, cross-bar drop, undo, edge scroll, cancellation, quick swipe and keyboard · " +
        (mobile ? "touch" : "mouse"),
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
    await run(browser, false);
    await run(browser, true);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
