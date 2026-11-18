/* eslint-disable @typescript-eslint/no-require-imports */
// Run against the local Next server with the same optional Playwright setup as
// verify-imported-score.cjs. The score is generated here and stays in Chromium.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.UI_BASE_URL || "http://localhost:3000";
const notes = [..."CEGB"]
  .map(
    (step) =>
      `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>`,
  )
  .join("");
const xml = `<score-partwise version="4.0"><part-list><score-part id="p"><part-name>Piano</part-name></score-part></part-list><part id="p"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>${notes}</measure></part></score-partwise>`;

async function verify(browser, width, height) {
  const mobile = width < 768;
  const page = await browser.newPage({
    viewport: { width, height },
    hasTouch: mobile,
    isMobile: mobile,
    reducedMotion: "reduce",
  });
  try {
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === new URL(base).origin
        ? route.continue()
        : route.abort(),
    );
    await page.goto(new URL("/ko/melody/upload", base).href, {
      waitUntil: "networkidle",
    });
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "score-tools.xml",
        mimeType: "application/xml",
        buffer: Buffer.from(xml),
      });

    const editor = page.locator("[data-score-editor]");
    const hit = (index) =>
      editor.locator(
        `[data-edit-event="${index}"][data-edit-head="0"] [data-notehead-hit]`,
      );
    const press = (target) => (mobile ? target.tap() : target.click());
    const panel = page.locator("[data-edit-panel]");
    await hit(0).scrollIntoViewIfNeeded();
    const before = await editor.boundingBox();
    await press(hit(0));
    await panel.waitFor();
    const after = await editor.boundingBox();
    assert.equal(
      after.height,
      before.height,
      "Opening the note tools resized the score",
    );
    const box = await panel.boundingBox();
    assert(
      box.x >= 0 &&
        box.x + box.width <= width + 1 &&
        box.y >= 0 &&
        box.y + box.height <= height + 1,
    );
    if (mobile)
      assert(
        Math.abs(height - box.y - box.height) < 2,
        "Mobile sheet must sit at viewport bottom",
      );

    await press(hit(1));
    assert.match(await panel.innerText(), /E4/);
    await press(editor.getByRole("button", { name: "겹음 추가", exact: true }));
    assert.equal(
      await editor.locator('[data-edit-event="1"][data-edit-head]').count(),
      2,
    );
    await page.keyboard.press("Escape");

    const meter = editor.locator('[data-edit-symbol="meter"]');
    await meter.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() =>
      document.activeElement?.closest("[data-edit-panel=meter]"),
    );
    await page.keyboard.press("Escape");
    assert(
      await meter.evaluate((el) => el === document.activeElement),
      "Return focus to the chosen symbol",
    );

    if (mobile) {
      await press(hit(0));
      await page.evaluate(() => {
        const ad = document.createElement("div");
        ad.dataset.slotId = "synthetic-tool-test";
        ad.style.cssText = "position:fixed;bottom:0;left:0;right:0;height:92px";
        document.body.appendChild(ad);
      });
      await page.waitForFunction(
        () =>
          parseInt(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--ad-bottom-inset",
            ),
          ) >= 92,
      );
      const dock = await panel.boundingBox();
      assert(dock.y + dock.height <= height - 92);
      const head = await hit(0).boundingBox();
      assert(
        head.y + head.height <= dock.y,
        "Sheet moved over the selected note",
      );
      const touch = await page.context().newCDPSession(page);
      const slide = async (x, y, delta) => {
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: y + delta }],
        });
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      };
      await slide(head.x + head.width / 2, head.y + head.height / 2, -12);
      await page.waitForFunction(() => {
        const head = document.querySelector('[data-edit-event="0"][data-edit-head="0"]');
        return head && Number(head.getAttribute("data-midi")) > 60;
      });
      const header = await panel.locator("header").boundingBox();
      await slide(header.x + 40, header.y + 8, 65);
      await panel.waitFor({ state: "detached" });
    }
    console.log(`PASS score tools at ${width}×${height}`);
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
    for (const [width, height] of [
      [1360, 960],
      [390, 844],
      [320, 568],
    ])
      await verify(browser, width, height);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
