/* eslint-disable @typescript-eslint/no-require-imports */
// Run with a local Note Quiz server, Playwright, Chrome, and Python 3 (fixture ZIPs).
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = new URL(process.env.UI_BASE_URL || "http://localhost:3000");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname));

const marker = "private-format-d3c1";
const musicXml = `<score-partwise version="4.0">
<work><work-title>${marker}</work-title></work>
<part-list><score-part id="P"><part-name>Piano</part-name></score-part></part-list>
<part id="P"><measure number="1">
<attributes><divisions>1</divisions><time><beats>2</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
${["C", "E", "D"].map((step, i) => `<note>${i === 1 ? "<chord/>" : ""}<pitch><step>${step}</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note>`).join("")}
</measure></part></score-partwise>`;
const native = `<museScore version="4.50"><programVersion>4.5.0</programVersion>
<Score><Division>480</Division><metaTag name="workTitle">${marker}</metaTag>
<Part><Staff id="1"><StaffType group="pitched"/></Staff><trackName>Piano</trackName><Instrument id="keyboard.piano"><longName>Piano</longName></Instrument></Part>
<Staff id="1"><Measure><voice>
<TimeSig><sigN>2</sigN><sigD>4</sigD></TimeSig>
<Chord><durationType>quarter</durationType><Note><pitch>60</pitch><tpc>14</tpc></Note><Note><pitch>64</pitch><tpc>18</tpc></Note></Chord>
<Chord><durationType>quarter</durationType><Note><pitch>62</pitch><tpc>16</tpc></Note></Chord>
</voice></Measure></Staff></Score></museScore>`;

function zip(entries) {
  // An independent ZIP writer exercises the browser's actual decompression path.
  const script = [
    "import io, json, sys, zipfile",
    "output = io.BytesIO()",
    "with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:",
    "    for path, text in json.load(sys.stdin).items(): archive.writestr(path, text)",
    "sys.stdout.buffer.write(output.getvalue())",
  ].join("\n");
  return execFileSync("python3", ["-c", script], {
    input: JSON.stringify(entries),
  });
}

const manifest = (...paths) =>
  "<container><rootfiles>" +
  paths.map((path) => '<rootfile full-path="' + path + '"/>').join("") +
  "</rootfiles></container>";
const mxl = zip({
  "META-INF/container.xml": manifest("Score/main.musicxml"),
  "Score/main.musicxml": musicXml,
});
const mscz = zip({
  "META-INF/container.xml": manifest(
    "score_style.mss",
    "score.mscx",
    "Excerpts/Flute/Flute.mscx",
  ),
  "score_style.mss": "<museScore><Style/></museScore>",
  "Excerpts/Flute/Flute.mscx": native.replace("<pitch>60", "<pitch>72"),
  "score.mscx": native,
});
const swingMscz = zip({
  "META-INF/container.xml": manifest("score_style.mss", "score.mscx"),
  "score_style.mss":
    "<museScore><Style><swingUnit>eighth</swingUnit><swingRatio>70</swingRatio></Style></museScore>",
  "score.mscx": native,
});

function midi(format) {
  const metadata = [
    0, 0xff, 0x51, 3, 7, 0xa1, 0x20, 0, 0xff, 0x58, 4, 2, 2, 24, 8,
  ];
  // Two notes at tick 0, followed by D4 at tick 96. Exercise running status.
  const notes = [
    0, 0x90, 60, 90, 0, 64, 90, 96, 0x80, 60, 0, 0, 64, 0, 0, 0x90, 62, 90, 96,
    0x80, 62, 0,
  ];
  const tracks = format === 0 ? [[...metadata, ...notes]] : [metadata, notes];
  const header = Buffer.from([
    0x4d,
    0x54,
    0x68,
    0x64,
    0,
    0,
    0,
    6,
    0,
    format,
    0,
    tracks.length,
    0,
    96,
  ]);
  return Buffer.concat([
    header,
    ...tracks.flatMap((events) => {
      const body = Buffer.from([...events, 0, 0xff, 0x2f, 0]);
      const length = Buffer.alloc(4);
      length.writeUInt32BE(body.length);
      return [Buffer.from("MTrk"), length, body];
    }),
  ]);
}

// The pitched E4 and unpitched display-E4 share a staff position. The
// unpitched note without display metadata belongs on the middle line (B4).
const mixedHeads = `<score-partwise version="4.0"><part-list><score-part id="P"><part-name>Voice</part-name></score-part></part-list>
<part id="P"><measure number="1"><attributes><divisions>1</divisions><time><beats>5</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
${[
  ["<pitch><step>C</step><octave>4</octave></pitch>", ""],
  [
    "<chord/><pitch><step>E</step><octave>4</octave></pitch>",
    "<notehead>x</notehead>",
  ],
  [
    "<unpitched><display-step>E</display-step><display-octave>4</display-octave></unpitched>",
    "<notehead>x</notehead>",
  ],
  ["<unpitched/>", '<notehead filled="no" parentheses="yes">x</notehead>'],
  ["<pitch><step>B</step><octave>4</octave></pitch>", ""],
  ["<rest/>", ""],
]
  .map(
    ([sound, shape]) =>
      `<note>${sound}<duration>1</duration><voice>1</voice><type>quarter</type>${shape}</note>`,
  )
  .join("")}
</measure></part></score-partwise>`;

async function verifyWrittenHeads(browser, width, name, source) {
  const mobile = width < 500;
  const page = await browser.newPage({
    viewport: { width, height: mobile ? 844 : 900 },
    hasTouch: mobile,
    reducedMotion: "reduce",
  });
  try {
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === base.origin
        ? route.continue()
        : route.abort(),
    );
    await page.goto(new URL("/ko/melody/upload", base).href);
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name,
        mimeType: "application/octet-stream",
        buffer: Buffer.from(source),
      });
    const bar = page.locator('[data-edit-bar="0"]');
    const button = (label) =>
      page.getByRole("button", { name: label, exact: true });
    const heads = bar.locator("[data-edit-head]");
    const rest = bar.locator('[data-edit-event="4"]');
    const select = page.locator("[data-notehead-select]");
    const press = (locator) => (mobile ? locator.tap() : locator.click());

    async function line(expected) {
      await bar.locator("[data-notehead-shape]").first().waitFor();
      const ink = await bar
        .locator("[data-notehead-shape]")
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            shape: node.tagName === "ellipse" ? "default" : node.textContent,
            y: Number(
              node.getAttribute(node.tagName === "ellipse" ? "cy" : "y"),
            ),
          })),
        );
      assert.deepEqual(
        ink.map((head) => head.shape),
        expected,
        name + " written head shapes",
      );
      const centers = ink.map((head) => head.y);
      const parentheses = await heads.nth(3).evaluate((head) => {
        const glyph = head.querySelector("[data-notehead-shape]");
        const x = Number(
          glyph.getAttribute(glyph.tagName === "ellipse" ? "cx" : "x"),
        );
        const y = Number(
          glyph.getAttribute(glyph.tagName === "ellipse" ? "cy" : "y"),
        );
        return Array.from(head.querySelectorAll('path[fill="none"]')).some(
          (path) => {
            const box = path.getBBox();
            return (
              box.x < x - 6 &&
              box.x + box.width > x + 6 &&
              box.y < y &&
              box.y + box.height > y
            );
          },
        );
      });
      assert.equal(
        parentheses,
        expected[3] === "\uE0A8",
        "parentheses around the hollow X",
      );
      assert.equal(centers[1], centers[2], "explicit unpitched E4");
      assert.equal(
        centers[3],
        centers[4],
        "unpitched default is middle line B4",
      );
      assert.ok(centers[1] > centers[3], "E4 is below B4");
      assert.equal(await heads.nth(0).getAttribute("data-midi"), "60");
      assert.equal(await heads.nth(1).getAttribute("data-midi"), "64");
      assert.equal(await rest.locator("[data-notehead-shape]").count(), 0);
    }
    async function full(expected) {
      await button("전체 보기").click();
      const fullScore = page.locator('[data-full-score="ready"]');
      await fullScore
        .locator("svg text")
        .filter({ hasText: "\uE0A4" })
        .first()
        .waitFor({ state: "attached" });
      // Read actual font glyphs. DOM text Y baselines allow different glyph
      // widths while still detecting a head rendered at the wrong staff step.
      const ink = await fullScore.locator("svg text").evaluateAll((nodes) =>
        nodes
          .filter((node) =>
            ["\uE0A4", "\uE0A8", "\uE0A9"].includes(node.textContent),
          )
          .map((node) => ({
            shape: node.textContent === "\uE0A4" ? "default" : node.textContent,
            y: node.getBoundingClientRect().y,
          })),
      );
      assert.deepEqual(
        ink.map((head) => head.shape),
        expected,
        name + " engraved head shapes",
      );
      assert.ok(Math.abs(ink[1].y - ink[2].y) < 1, "full E4 positions");
      assert.ok(Math.abs(ink[3].y - ink[4].y) < 1, "full B4 positions");
      await button("한 줄 보기").click();
    }
    async function setHead(index, value) {
      await press(heads.nth(index).locator("[data-notehead-hit]"));
      await select.selectOption(value);
      await page.keyboard.press("Escape");
    }
    const x = "\uE0A9";
    const hollowX = "\uE0A8";
    const original = ["default", x, x, hollowX, "default"];
    const edited = [x, x, x, hollowX, "default"];
    await line(original);
    await full(original);
    await setHead(0, "x");
    await line(edited);
    await full(edited);
    await setHead(3, "default");
    await line([x, x, x, "default", "default"]);
    await button("실행 취소").click();
    await line(edited);
    await button("실행 취소").click();
    await line(original);
    await press(rest);
    await page.locator("[data-edit-panel]").waitFor();
    assert.equal(await select.count(), 0, "rest offered a notehead control");
    console.log(
      `${width} ${name}: line and full score, mixed heads, edit and undo`,
    );
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH && {
      executablePath: process.env.BROWSER_PATH,
    }),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    const errors = [];
    const transfers = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (dialog) => dialog.accept());
    await page.route("**/*", (route) => {
      const request = route.request();
      const payload = request.postDataBuffer();
      if (
        [marker, "<score-partwise", "<museScore", "MThd"].some(
          (token) => request.url().includes(token) || payload?.includes(token),
        ) ||
        payload?.includes(mxl) ||
        payload?.includes(mscz)
      ) {
        transfers.push(request.method());
        return route.abort();
      }
      return new URL(request.url()).origin === base.origin
        ? route.continue()
        : route.abort();
    });
    await page.goto(new URL("/ko/melody/upload", base).href);
    const input = page.locator("input[type=file]").first();
    const accept = (await input.getAttribute("accept")).split(",");
    for (const ext of [
      ".xml",
      ".musicxml",
      ".mxl",
      ".mscx",
      ".mscz",
      ".mid",
      ".midi",
    ]) {
      assert.ok(accept.includes(ext), "File chooser excludes " + ext);
    }
    const upload = (suffix, source) =>
      input.setInputFiles({
        name: marker + "-" + suffix,
        mimeType: "application/octet-stream",
        buffer: Buffer.from(source),
      });
    const bar = page.locator('[data-edit-bar="0"]');
    const heads = (event) =>
      bar.locator('[data-edit-event="' + event + '"][data-edit-head]');
    const pitches = (event) =>
      heads(event).evaluateAll((nodes) =>
        nodes.map((node) => Number(node.dataset.midi)).sort((a, b) => a - b),
      );
    const button = (name) => page.getByRole("button", { name, exact: true });
    const phase = (value) =>
      page.locator('[data-import-phase="' + value + '"]').waitFor();
    async function edit() {
      const first = heads(0).first();
      await first.press("ArrowUp");
      await bar.locator('[data-edit-event="0"][data-midi="62"]').waitFor();
      await first.press("Escape");
    }
    async function undo() {
      await button("실행 취소").click();
      assert.deepEqual(await pitches(0), [60, 64]);
    }
    for (const [name, source, exerciseEditor] of [
      ["part.xml", musicXml, false],
      ["packed.mxl", mxl, true],
      ["native.mscx", native, false],
      ["package.mscz", mscz, true],
      ["single-track.mid", midi(0), false],
      ["multi-track.midi", midi(1), true],
      ["renamed.musicxml", midi(0), false],
    ]) {
      if (name === "package.mscz")
        await page.setViewportSize({ width: 390, height: 844 });
      const oldLine = page.locator("[data-score-line]");
      if (await oldLine.count())
        await oldLine.evaluate((el) => (el.dataset.previous = "true"));
      await upload(name, source);
      try {
        await page
          .locator("[data-score-line]:not([data-previous])")
          .waitFor({ timeout: 15000 });
      } catch (err) {
        throw new Error(
          name +
            ": " +
            (await page.getByRole("alert").allTextContents()).join(" "),
          { cause: err },
        );
      }
      assert.deepEqual(await pitches(0), [60, 64], name + " chord");
      assert.deepEqual(await pitches(1), [62], name + " following note");
      if (exerciseEditor) {
        await edit();
        assert.deepEqual(await pitches(0), [62, 64]);
        await undo();
        await button("이 마디 듣기").click();
        await phase("preview");
        await phase("ready");
        await button("전체 보기").click();
        await page.locator('[data-full-score="ready"]').waitFor();
        await button("한 줄 보기").click();
        assert.deepEqual(await pitches(0), [60, 64]);
      }
      console.log(name + " passed");
    }

    await edit();
    // Accept replacing the dirty document. Failed imports must preserve the
    // edited notes and the user's undo history.
    for (const [suffix, data, message] of [
      ["external-swing.mscz", swingMscz, "지원"],
      ["truncated.mid", midi(0).subarray(0, 18), "읽을 수 없"],
      ["independent-sequences.midi", midi(2), "지원"],
    ]) {
      await upload(suffix, data);
      await page.getByRole("alert").filter({ hasText: message }).waitFor();
      assert.deepEqual(
        await pitches(0),
        [62, 64],
        suffix + " lost edited document",
      );
      assert.equal(await button("실행 취소").isEnabled(), true);
    }
    await undo();
    assert.deepEqual(errors, []);
    assert.deepEqual(
      transfers,
      [],
      "Private score data entered a network request",
    );
    console.log(
      "Failed replacements preserved edits and undo. File data stayed local.",
    );
    await verifyWrittenHeads(browser, 1280, "mixed-heads.musicxml", mixedHeads);
    await verifyWrittenHeads(
      browser,
      390,
      "mixed-heads.mxl",
      zip({
        "META-INF/container.xml": manifest("score.musicxml"),
        "score.musicxml": mixedHeads,
      }),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
