/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { deflateSync, gunzipSync } = require("node:zlib");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const base = new URL(process.env.UI_BASE_URL || "http://127.0.0.1:3000");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
const marker = "private-pdf-recognition-fixture";

// The two pages exercise different PDF operations. The first draws a single
// bar with vector paths; the second paints an embedded grayscale scan twice.
function twoPagePdf() {
  const lines = [0, 1, 2, 3, 4].map(
    (i) => `20 ${70 + 10 * i} m 580 ${70 + 10 * i} l S`,
  );
  const quarters = [0, 2, 4, 6].map((step, i) => {
    const x = 110 + 100 * i,
      y = 70 + step * 5;
    return `q 6 0 0 4.5 ${x} ${y} cm
      -1 0 m -1 .55 -.55 1 0 1 c .55 1 1 .55 1 0 c
      1 -.55 .55 -1 0 -1 c -.55 -1 -1 -.55 -1 0 c f Q
      1.3 w ${x + 5.5} ${y} m ${x + 5.5} ${y + 32} l S`;
  });
  const vector = [
    "0 G 0 g 1 w",
    ...lines,
    ...quarters,
    "560 70 m 560 110 l S",
  ].join("\n");
  const pgm = gunzipSync(
    fs.readFileSync(
      path.join(
        __dirname,
        "../src/features/score-import/recognition/fixtures/mixed.pgm.gz",
      ),
    ),
  );
  const header = /^P5\n(\d+) (\d+)\n255\n/.exec(pgm.toString("ascii", 0, 40));
  assert.ok(header);
  const width = Number(header[1]),
    height = Number(header[2]);
  const pixels = pgm.subarray(header[0].length);
  assert.equal(pixels.length, width * height);
  function stream(data, attrs = "") {
    const bytes = Buffer.from(data);
    return Buffer.concat([
      Buffer.from(`<< ${attrs} /Length ${bytes.length} >>\nstream\n`),
      bytes,
      Buffer.from("\nendstream"),
    ]);
  }
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 2 /Kids [3 0 R 5 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 180] /Resources << >> /Contents 4 0 R >>",
    stream(vector),
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 670 360] /Resources << /XObject << /Scan 7 0 R >> >> /Contents 6 0 R >>",
    stream("q 670 0 0 99 0 225 cm /Scan Do Q\nq 670 0 0 99 0 36 cm /Scan Do Q"),
    stream(
      deflateSync(pixels),
      `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`,
    ),
  ];
  const chunks = [Buffer.from(`%PDF-1.4\n% ${marker}\n`)];
  let offset = chunks[0].length;
  const xref = ["0000000000 65535 f "];
  objects.forEach((object, index) => {
    xref.push(String(offset).padStart(10, "0") + " 00000 n ");
    const entry = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      Buffer.from(object),
      Buffer.from("\nendobj\n"),
    ]);
    chunks.push(entry);
    offset += entry.length;
  });
  chunks.push(
    Buffer.from(
      `xref\n0 ${xref.length}\n${xref.join("\n")}\ntrailer\n<< /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`,
    ),
  );
  return Buffer.concat(chunks);
}

async function exercise(browser, width, file) {
  const page = await browser.newPage({
    viewport: { width, height: 850 },
    permissions: ["microphone"],
    serviceWorkers: "block",
  });
  try {
    const errors = [],
      transfers = [];
    const workerUrls = [];
    page.on("worker", (worker) => workerUrls.push(new URL(worker.url())));
    let processingFile = false;
    page.on("pageerror", (err) => errors.push(err.message));
    await page.context().route("**/*", (route) => {
      const req = route.request();
      const body = req.postDataBuffer();
      if (
        (processingFile && !["GET", "HEAD"].includes(req.method())) ||
        req.url().includes(marker) ||
        body?.includes(marker) ||
        body?.includes("%PDF-") ||
        body?.includes("<score-partwise")
      )
        transfers.push(req.method());
      return new URL(req.url()).origin === base.origin
        ? route.continue()
        : route.abort();
    });
    await page.goto(new URL("/ko/melody/upload", base).href);
    const picker = () => page.locator("input[type=file]").first();
    const upload = (buffer) =>
      picker().setInputFiles({
        name: marker + ".pdf",
        mimeType: "application/pdf",
        buffer,
      });
    assert.ok(
      (await picker().getAttribute("accept")).split(",").includes(".pdf"),
    );
    const review = page.locator("[data-recognition-review]");
    const pages = review.getByRole("combobox");
    const read = review.getByRole("button", { name: "선택한 오선 읽기" });
    const accept = review.getByRole("button", {
      name: "확인한 음으로 편집 시작",
    });
    const phase = (value) =>
      page.locator(`[data-import-phase="${value}"]`).waitFor();
    const button = (name) => page.getByRole("button", { name, exact: true });
    const readBars = async () => {
      await read.click();
      const error = review.getByRole("alert");
      await accept.or(error).waitFor();
      if (await error.isVisible()) throw new Error(await error.innerText());
      return (await review.locator("ol li").allTextContents()).map((text) =>
        text.match(/[A-G]\d/g),
      );
    };
    // A broken local PDF must leave the picker usable.
    processingFile = true;
    await upload(Buffer.from("%PDF-1.4\ntruncated\n"));
    await review.getByRole("alert").filter({ hasText: "PDF" }).waitFor();
    await review.getByRole("button", { name: "취소", exact: true }).click();
    await page.locator("[data-score-drop-zone]").waitFor();
    await upload(file);
    await pages.waitFor();
    assert.equal(await pages.locator("option").count(), 2);
    // Switch quickly before reading; old renders and results must not win.
    await pages.selectOption("2");
    await pages.selectOption("1");
    assert.deepEqual(await readBars(), [["E4", "G4", "B4", "D5"]]);
    await pages.selectOption("2");
    await accept.waitFor({ state: "hidden" });
    await read.click();
    await review.getByRole("alert").waitFor(); // two staves until the crop is set
    await review.getByRole("slider", { name: /위쪽 경계/ }).fill("50");
    assert.deepEqual(await readBars(), [
      ["E4", "F4", "G4"],
      ["C5", "A4", "B4"],
      ["D4"],
    ]);
    const lengths = await review.locator("ol small").allInnerTexts();
    assert.deepEqual(
      lengths.map((v) => v.trim().split(/\s+/).at(-1)),
      ["1/2", "1/4", "1/4", "1/4", "1/2", "1/4", "1"],
    );
    await accept.click();
    const firstNote = page
      .locator('[data-edit-bar="0"] [data-edit-event="0"][data-edit-head]')
      .first();
    assert.equal(await firstNote.getAttribute("data-midi"), "64");
    // A replacement can be cancelled without losing the accepted result.
    await upload(file);
    await pages.waitFor();
    await review.getByRole("button", { name: "취소", exact: true }).click();
    await review.waitFor({ state: "hidden" });
    const excerpt = page.locator("summary").filter({ hasText: "인쇄 원본" });
    assert.match(await excerpt.innerText(), /쪽\s*2/);
    await excerpt.click();
    await page.getByAltText("인쇄 원본", { exact: true }).waitFor();
    await button("이 마디 듣기").click();
    await phase("preview");
    await phase("ready");
    await button("연습 시작").click();
    await phase("playing");
    await phase("result");
    await page.reload();
    await page.locator("[data-score-drop-zone]").waitFor();
    assert.deepEqual(errors, []);
    assert.deepEqual(transfers, []);
    assert.ok(
      workerUrls.some(
        (url) =>
          url.origin === base.origin &&
          url.pathname.endsWith("pdf.worker.min.mjs"),
      ),
      "PDF renderer should run in a worker from the app’s own origin",
    );
    console.log(
      width,
      "PDF: vector and scanned notes matched, selected page practiced, local file cleared on refresh",
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
    const pdf = twoPagePdf();
    await exercise(browser, 1280, pdf);
    await exercise(browser, 390, pdf);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
