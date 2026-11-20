/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const base = new URL(process.env.UI_BASE_URL || "http://127.0.0.1:3000");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
const fixtureDir = path.join(__dirname, "fixtures/harmonica");

// Independent ABCJS 6.7.3 engravings, including the original ABC below.
// Expected pitches are sounding pitches, including bar-scoped accidentals.
const scores = [
  {
    name: "sharp-triple",
    // M:3/4 L:1/8 K:G   "G7"F3 G A2 | "C"=FF z2 F2 | F2 E2 D2 |]
    headers: ["G", "1", "3/4"],
    pitches: [
      ["F♯4", "G4", "A4"],
      ["F4", "F4", "", "F4"],
      ["F♯4", "E4", "D4"],
    ],
    durations: [
      "1/4·",
      "1/8",
      "1/4",
      "1/8",
      "1/8",
      "1/4",
      "1/4",
      "1/4",
      "1/4",
      "1/4",
    ],
  },
  {
    name: "flat-compound",
    // M:6/8 L:1/8 K:F   Bcd e2d | c3 B2z |]
    headers: ["G", "-1", "6/8"],
    pitches: [
      ["B♭4", "C5", "D5", "E5", "D5"],
      ["C5", "B♭4", ""],
    ],
    durations: ["1/8", "1/8", "1/8", "1/4", "1/8", "1/4·", "1/4", "1/8"],
  },
  {
    name: "bass-cut",
    // M:2/2 L:1/4 K:C clef=bass   G,,2 A,,2 | B,,2 C,2 |]
    headers: ["F", "0", "2/2"],
    pitches: [
      ["G2", "A2"],
      ["B2", "C3"],
    ],
    durations: ["1/2", "1/2", "1/2", "1/2"],
  },
  {
    name: "choose-chord",
    // M:4/4 L:1/4 K:C   [EGB]2 z2 |]
    headers: ["G", "0", "4/4"],
    durations: ["1/2", "1/2"],
  },
];

// Observe the scheduled piano samples independently of the visible preview
// label. Identify which chord pitch fits the waveform’s fundamental period.
function installAudioProbe() {
  if (window !== window.top) return;
  window.previewNotes = [];
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    const buffer = this.buffer;
    if (buffer && buffer.duration > 0.12) {
      const pcm = buffer.getChannelData(0);
      const candidates = [64, 67, 71].map((midi) => {
        const lag = Math.round(
          buffer.sampleRate / (440 * 2 ** ((midi - 69) / 12)),
        );
        let error = 0;
        for (
          let i = Math.floor(0.05 * buffer.sampleRate);
          i < 0.12 * buffer.sampleRate;
          i++
        )
          error += (pcm[i] - pcm[i + lag]) ** 2;
        return { midi, error };
      });
      candidates.sort((a, b) => a.error - b.error);
      window.previewNotes.push(candidates[0].midi);
    }
    return start.apply(this, args);
  };

  Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    configurable: true,
    value: async () => {
      const context = new AudioContext();
      await context.resume();
      const destination = context.createMediaStreamDestination();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      window.playTestPitch = (midi) => {
        oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
        gain.gain.value = 0.12;
      };
      window.stopTestPitch = () => {
        gain.gain.value = 0;
      };
      window.closeTestInput = () => context.close();
      return destination.stream;
    },
  });
}

async function testSelection(page, review) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  const accept = button("확인한 음으로 편집 시작");
  const select = review.locator("[data-recognition-chord]");
  assert.equal(await accept.isEnabled(), false);
  const pitches = (await select.locator("option").allTextContents())
    .filter((text) => /^[A-G]\d$/.test(text))
    .sort();
  assert.deepEqual(pitches, ["B4", "E4", "G4"]);
  await select.selectOption({ label: "G4" });
  await accept.click();
  const phase = (name) => page.locator(`[data-import-phase="${name}"]`);
  const midis = await phase("ready")
    .locator('[data-edit-bar="0"] [data-edit-event="0"][data-edit-head]')
    .evaluateAll((heads) =>
      heads.map((h) => Number(h.dataset.midi)).sort((a, b) => a - b),
    );
  assert.deepEqual(midis, [64, 67, 71]);
  await button("이 마디 듣기").click();
  await phase("preview").getByText(/· G4$/).waitFor();
  await phase("ready").waitFor();
  assert.deepEqual(await page.evaluate(() => window.previewNotes), [67]);
  for (const [midi, result] of [
    [67, "2 / 2"],
    [71, "1 / 2"],
  ]) {
    // Align the synthetic microphone to the actual on-screen note/rest
    // transitions. Playwright's polling interval can exceed a short beat.
    await page.evaluate((note) => {
      const observer = new MutationObserver(() => {
        const playing = document.querySelector(
          '[data-import-phase="playing"] span.tabular-nums',
        );
        if (!playing) return;
        if (/· G4$/.test(playing.textContent)) window.playTestPitch(note);
        if (/· 쉼/.test(playing.textContent)) {
          window.stopTestPitch();
          observer.disconnect();
        }
      });
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    }, midi);
    await button(midi === 67 ? "연습 시작" : "같은 멜로디 다시 연습").click();
    await phase("result").waitFor();
    const status = await phase("result").getByRole("status").last().innerText();
    const details = await phase("result")
      .locator("details li")
      .allTextContents();
    assert.ok(
      status.includes(result),
      `input ${midi}: ${status} (${details.join(", ")})`,
    );
    await page.evaluate(() => window.closeTestInput());
  }
}

async function asScannedPdf(page, png) {
  const w = png.readUInt32BE(16) / 2;
  const h = png.readUInt32BE(20) / 2;
  await page.setContent(
    `<style>@page{size:${w}px ${h}px;margin:0}body{margin:0}img{display:block;width:${w}px;height:${h}px}</style><img src="data:image/png;base64,${png.toString("base64")}">`,
  );
  await page.locator("img").evaluate((img) => img.decode());
  return page.pdf({ preferCSSPageSize: true, printBackground: true });
}

async function exercise(browser, score) {
  const pdf = score.name === "flat-compound";
  const width = pdf || score.name === "choose-chord" ? 390 : 1280;
  const page = await browser.newPage({ viewport: { width, height: 850 } });
  try {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.stack ?? err.message));
    if (score.name === "choose-chord")
      await page.addInitScript(installAudioProbe);
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === base.origin
        ? route.continue()
        : route.abort(),
    );
    const png = await fs.readFile(path.join(fixtureDir, score.name + ".png"));
    const buffer = pdf ? await asScannedPdf(page, png) : png;
    await page.goto(new URL("/ko/melody/upload", base).href);
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: score.name + (pdf ? ".pdf" : ".png"),
        mimeType: pdf ? "application/pdf" : "image/png",
        buffer,
      });
    const review = page.locator("[data-recognition-review]");
    const read = review.getByRole("button", { name: "선택한 오선 읽기" });
    const error = review.getByRole("alert");
    await read.or(error).first().waitFor();
    if (await error.isVisible()) throw new Error(await error.innerText());
    await read.click();
    await review.locator("[data-recognition-clef]").or(error).first().waitFor();
    if (await error.isVisible()) throw new Error(await error.innerText());
    const headers = await Promise.all(
      ["clef", "key", "meter"].map((name) =>
        review.locator(`[data-recognition-${name}]`).inputValue(),
      ),
    );
    assert.deepEqual(headers, score.headers);
    const durationTexts = await review
      .locator("[data-recognition-event] small")
      .allTextContents();
    assert.deepEqual(
      durationTexts.map(
        (v) => v.replace(/\s/g, "").match(/(?:1\/(?:2|4|8)|1)·?$/)?.[0],
      ),
      score.durations,
    );
    if (score.pitches) {
      const bars = [];
      for (const bar of await review.locator("ol > li").all()) {
        const pitches = await bar
          .locator("[data-recognition-event]")
          .allTextContents();
        bars.push(
          pitches.map(
            (text) =>
              text.match(/[A-G][♭♯]?\d/)?.[0] ??
              (text.includes("쉼") ? "" : text),
          ),
        );
      }
      assert.deepEqual(bars, score.pitches);
      await review
        .getByRole("button", { name: "확인한 음으로 편집 시작" })
        .click();
      await page.locator('[data-import-phase="ready"]').waitFor();
    } else {
      await testSelection(page, review);
    }
    assert.deepEqual(errors, []);
    console.log(
      score.name,
      width,
      pdf ? "PDF" : "PNG",
      headers.join(" "),
      score.durations.length,
      "events verified",
    );
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || undefined,
    headless: true,
  });
  try {
    const failures = [];
    for (const score of scores) {
      try {
        await exercise(browser, score);
      } catch (err) {
        failures.push(new Error(score.name, { cause: err }));
      }
    }
    if (failures.length)
      throw new AggregateError(failures, "Harmonica recognition");
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
