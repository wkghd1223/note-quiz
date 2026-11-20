/* eslint-disable @typescript-eslint/no-require-imports */
// Use the mixed-duration engraved regression fixture and the app's normal file picker.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { gunzipSync } = require("node:zlib");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = new URL(process.env.UI_BASE_URL || "http://127.0.0.1:3000");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
function fixture(name) {
  const dir = path.join(
    __dirname,
    "../src/features/score-import/recognition/fixtures",
  );
  const pgm = gunzipSync(fs.readFileSync(path.join(dir, name + ".pgm.gz")));
  const header = /^P5\n(\d+) (\d+)\n255\n/.exec(pgm.toString("ascii", 0, 40));
  assert.ok(header, "expected an 8-bit grayscale PGM");
  return {
    width: Number(header[1]),
    height: Number(header[2]),
    gray: Array.from(pgm.subarray(header[0].length)),
  };
}
const marker = "recognition-private-fixture";

async function exercise(browser, width, format) {
  const page = await browser.newPage({
    viewport: { width, height: 850 },
    permissions: ["microphone"],
  });
  try {
    const errors = [],
      transfers = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.route("**/*", (route) => {
      const req = route.request();
      if (
        req.url().includes(marker) ||
        req.postDataBuffer()?.includes(marker) ||
        req.postDataBuffer()?.includes("<score-partwise")
      )
        transfers.push(req.url());
      return new URL(req.url()).origin === base.origin
        ? route.continue()
        : route.abort();
    });
    const dataUrl = await page.evaluate(
      ({ gray, width, height, format }) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        const image = ctx.createImageData(canvas.width, canvas.height);
        for (let i = 0; i < gray.length; i++) {
          image.data.set([gray[i], gray[i], gray[i], 255], i * 4);
        }
        ctx.putImageData(image, 0, 0);
        return canvas.toDataURL(format, 0.94);
      },
      {
        ...fixture(format === "image/jpeg" ? "rotate-mixed" : "mixed"),
        format,
      },
    );
    const file = Buffer.from(dataUrl.split(",")[1], "base64");
    page.on("request", (req) => {
      if (req.postDataBuffer()?.includes(file)) transfers.push(req.url());
    });
    await page.goto(new URL("/ko/melody/upload", base).href);
    const picker = page.locator('input[type="file"]').first();
    await picker.setInputFiles({
      name: marker + (format === "image/png" ? ".png" : ".jpg"),
      mimeType: format,
      buffer: file,
    });
    const button = (name) => page.getByRole("button", { name, exact: true });
    await button("선택한 오선 읽기").click();
    await button("확인한 음으로 편집 시작").waitFor();
    const rows = await page
      .locator("[data-recognition-review] ol li")
      .allTextContents();
    assert.equal(rows.length, 3);
    for (const [i, expected] of [
      ["E4", "F4", "G4"],
      ["C5", "A4", "B4"],
      ["D4"],
    ].entries())
      assert.deepEqual(rows[i].match(/[A-G][0-9]/g), expected);
    assert.deepEqual(
      await page
        .locator("[data-recognition-review] ol small")
        .allInnerTexts()
        .then((values) =>
          values.map((text) => text.trim().split(/\s+/).at(-1)),
        ),
      ["1/2", "1/4", "1/4", "1/4", "1/2", "1/4", "1"],
    );
    await button("확인한 음으로 편집 시작").click();
    const first = page
      .locator('[data-edit-bar="0"] [data-edit-event="0"][data-edit-head]')
      .first();
    assert.equal(await first.getAttribute("data-midi"), "64");
    await first.press("ArrowUp");
    await page
      .locator('[data-edit-event="0"][data-midi="65"]')
      .first()
      .waitFor();
    await first.press("Escape");
    await button("실행 취소").click();
    assert.equal(await first.getAttribute("data-midi"), "64");
    await page.locator("summary").filter({ hasText: "인쇄 원본" }).click();
    await page.getByAltText("인쇄 원본", { exact: true }).waitFor();
    await button("연습 시작").click();
    await page.locator('[data-import-phase="playing"]').waitFor();
    await page
      .locator('[data-import-phase="result"]')
      .waitFor({ timeout: 20000 });
    await page.reload();
    await page.locator("[data-score-drop-zone]").waitFor();
    assert.deepEqual(transfers, []);
    assert.deepEqual(errors, []);
    console.log(
      width,
      format,
      "recognized, edited, practiced, cleared on refresh",
    );
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || undefined,
    headless: true,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });
  try {
    await exercise(browser, 1280, "image/png");
    await exercise(browser, 390, "image/jpeg");
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
