/* eslint-disable @typescript-eslint/no-require-imports */
// Run against a local Note Quiz server. Real capture worklet and judgment,
// with a controlled MediaStream in place of an acoustic microphone.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.UI_BASE_URL || "http://localhost:3000";
const uniqueTitle = "Local chord verification 97bf";
const notes = ["C", "E", "G"]
  .map(
    (step, index) =>
      `<note>${index ? "<chord/>" : ""}<pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>`,
  )
  .join("");
const xml = `<?xml version="1.0"?><score-partwise version="4.0">
<work><work-title>${uniqueTitle}</work-title></work>
<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>1</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<direction><sound tempo="60"/></direction>${notes}</measure></part></score-partwise>`;

function installInput() {
  let attempted = 0;
  window.inputPattern = "all";
  window.inputCalls = () => attempted;
  Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    configurable: true,
    value: async () => {
      attempted++;
      if (window.inputPattern === "denied")
        throw new DOMException("Test permission denied", "NotAllowedError");
      const audio = new AudioContext();
      await audio.resume();
      // Retain the destination and route only the test tones into its track.
      const output = audio.createMediaStreamDestination();
      const gains = [60, 64, 67].map((midi) => {
        const oscillator = audio.createOscillator();
        oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
        const gain = audio.createGain();
        gain.gain.value = 0;
        oscillator.connect(gain).connect(output);
        oscillator.start();
        return gain.gain;
      });
      window.soundNotes = () => {
        const now = audio.currentTime;
        for (let n = 0; n < gains.length; n++) {
          const gain = gains[n];
          if (window.inputPattern === "arpeggio") {
            gain.setValueAtTime(0.12, now + n * 0.24);
            gain.setValueAtTime(0, now + n * 0.24 + 0.19);
          } else if (
            window.inputPattern === "all" ||
            (window.inputPattern === "missing" && n !== 1)
          ) {
            gain.setValueAtTime(0.12, now);
          }
        }
      };
      window.closeInput = () => audio.close();
      return output.stream;
    },
  });
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH && {
      executablePath: process.env.BROWSER_PATH,
    }),
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--disable-background-timer-throttling",
    ],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1240, height: 900 },
    });
    const errors = [],
      leaked = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => {
      const req = route.request();
      if (
        (decodeURI(req.url()) + (req.postData() || "")).includes(uniqueTitle) ||
        req.url().includes("private-97bf") ||
        (req.postData() || "").includes("<score-partwise")
      )
        leaked.push(req.method());
      return new URL(req.url()).origin === new URL(base).origin
        ? route.continue()
        : route.abort();
    });
    await page.addInitScript(installInput);
    await page.goto(new URL("/ko/melody/upload", base).href);
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "private-97bf.musicxml",
        mimeType: "application/xml",
        buffer: Buffer.from(xml),
      });
    const phase = async (value) => {
      try {
        await page
          .locator(`[data-import-phase="${value}"]`)
          .waitFor({ timeout: 15000 });
      } catch {
        const current = await page
          .locator("[data-import-phase]")
          .getAttribute("data-import-phase");
        const messages = await page
          .locator('[role="alert"], [role="status"]')
          .allInnerTexts();
        throw new Error(
          `Expected ${value} but saw ${current}. ${messages.join(" ")} ${errors.join(" ")}`,
        );
      }
    };
    const button = (name) => page.getByRole("button", { name, exact: true });
    await phase("ready");
    await page.getByRole("heading", { name: uniqueTitle }).waitFor();
    await button("이 마디 듣기").click();
    await phase("preview");
    await phase("ready");
    assert.equal(
      await page.evaluate(() => window.inputCalls()),
      0,
      "Preview requested a microphone",
    );

    for (const [index, pattern] of [
      "all",
      "missing",
      "arpeggio",
      "silence",
    ].entries()) {
      await page.evaluate((mode) => (window.inputPattern = mode), pattern);
      await button(index === 0 ? "연습 시작" : "같은 멜로디 다시 연습").click();
      await phase("playing");
      await page.evaluate(() => window.soundNotes());
      await phase("result");
      const status = await page
        .locator('[data-import-phase="result"] [role="status"]')
        .last()
        .innerText();
      const expected = pattern === "all" ? "1 / 1" : "0 / 1";
      assert.ok(
        status.includes(expected),
        `${pattern}: expected ${expected}, saw ${status}`,
      );
      await page.evaluate(() => window.closeInput());
      console.log(pattern, expected);
    }
    await page.evaluate(() => (window.inputPattern = "denied"));
    await button("같은 멜로디 다시 연습").click();
    await phase("error");
    await page
      .getByRole("alert")
      .filter({ hasText: /마이크/ })
      .waitFor();
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "broken.xml",
        mimeType: "application/xml",
        buffer: Buffer.from("<score-partwise>"),
      });
    await page
      .getByRole("alert")
      .filter({ hasText: /악보를 읽을 수/ })
      .waitFor();
    await page.getByRole("heading", { name: uniqueTitle }).waitFor();
    // Finish the older read last. Its completion must not replace the open score.
    await page.evaluate(() => {
      const read = File.prototype.arrayBuffer;
      File.prototype.arrayBuffer = async function () {
        if (this.name === "slow-97bf.xml") {
          await new Promise((resolve) => {
            window.finishOlderRead = resolve;
          });
        }
        return read.call(this);
      };
    });
    const upload = page.locator('input[type="file"]').first();
    await upload.setInputFiles({
      name: "slow-97bf.xml",
      mimeType: "application/xml",
      buffer: Buffer.from(xml),
    });
    await page.waitForFunction(
      () => typeof window.finishOlderRead === "function",
    );
    const newerTitle = uniqueTitle + " B";
    await upload.setInputFiles({
      name: "private-97bf-b.xml",
      mimeType: "application/xml",
      buffer: Buffer.from(xml.replace(uniqueTitle, newerTitle)),
    });
    await page
      .getByRole("heading", { name: newerTitle, exact: true })
      .waitFor();
    await page.evaluate(async () => {
      window.finishOlderRead();
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
    assert.ok(
      await page
        .getByRole("heading", { name: newerTitle, exact: true })
        .isVisible(),
    );
    assert.deepEqual(
      leaked,
      [],
      "Score contents or filename appeared in a network request",
    );
    assert.deepEqual(errors, [], "Unexpected browser exceptions");
    console.log(
      "Microphone-free preview, permission denial, file recovery, concurrent replacement and local processing passed",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
