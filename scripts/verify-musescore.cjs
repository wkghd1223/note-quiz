/* eslint-disable @typescript-eslint/no-require-imports */
// Run with PLAYWRIGHT_MODULE pointing to Playwright when it is installed separately.
const assert = require("node:assert/strict");
const path = require("node:path");
const { buildSync } = require("esbuild");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const head = (midi, tpc, written) =>
  `<Note><pitch>${midi}</pitch><tpc>${tpc}</tpc>${written ? `<tpc2>${written}</tpc2>` : ""}</Note>`;
const chord = (heads, type = "quarter") =>
  `<Chord><durationType>${type}</durationType>${heads}</Chord>`;
const rest = (type) => `<Rest><durationType>${type}</durationType></Rest>`;
const measure = (body, extra = "") =>
  `<Measure ${extra}><voice>${body}</voice></Measure>`;
const staff = (id, body) => `<Staff id="${id}">${body}</Staff>`;
function native({
  version = "4.40",
  staves,
  definitions,
  style = "",
  excerpt = "",
}) {
  return `<museScore version="${version}"><Score>${style}${definitions || '<Part><Staff id="1"/><trackName>Piano</trackName></Part>'}${staves}${excerpt}</Score></museScore>`;
}

async function verify(page) {
  const inspect = (xml) =>
    page.evaluate((text) => {
      const doc = Native.museScoreToMusicXml(
        new DOMParser().parseFromString(text, "application/xml"),
      );
      const model = Native.parseScoreDocument(doc);
      const lane = model.lanes[0];
      const plan = Native.prepareScore(model, lane.id, {
        fromBar: 0,
        toBar: lane.bars.length - 1,
        speed: 1,
        repeats: true,
        semitones: 0,
      });
      return {
        lanes: model.lanes.map((l) => [l.partId, l.staff, l.voice]),
        bars: lane.bars.map((bar) => ({
          length: bar.duration,
          key: bar.fifths,
          events: bar.events.map((e) => ({
            start: e.start,
            duration: e.duration,
            pitches: e.heads.map((h) => [h.step, h.alter, h.octave, h.midi]),
          })),
        })),
        dots: doc.querySelectorAll("note > dot").length,
        rhythm: [...doc.querySelectorAll("time-modification")].map(
          (el) => el.textContent,
        ),
        ties: [...doc.querySelectorAll("tie")].map((el) =>
          el.getAttribute("type"),
        ),
        tuplets: [...doc.querySelectorAll("tuplet")].map((el) =>
          el.getAttribute("type"),
        ),
        targets: plan.targets.map((target) => target.midis),
        bpm: plan.sourceBpm,
      };
    }, xml);

  const definitions =
    '<Part><Staff id="2"/><trackName>Clarinet</trackName><Instrument><transposeDiatonic>-1</transposeDiatonic><transposeChromatic>-2</transposeChromatic></Instrument></Part><Part><Staff id="1"/><trackName>Piano</trackName></Part>';
  const example = native({
    definitions,
    staves:
      staff(1, measure(rest("measure"), 'len="1/4"')) +
      staff(
        2,
        measure(
          "<KeySig><concertKey>-3</concertKey><actualKey>-1</actualKey></KeySig><TimeSig><sigN>3</sigN><sigD>4</sigD></TimeSig><Tempo><tempo>1.333333333</tempo></Tempo>" +
            chord(head(63, 11, 13) + head(67, 15, 17)),
          'len="1/4"',
        ),
      ),
    excerpt: '<Score><Staff id="2"><Measure/></Staff></Score>',
  });
  const written = await inspect(example);
  assert.deepEqual(written.lanes, [
    ["P1", "1", "1"],
    ["P2", "1", "1"],
  ]);
  assert.equal(written.bpm, 80);
  assert.equal(written.bars[0].length, 1);
  assert.equal(written.bars[0].key, -1);
  assert.deepEqual(written.bars[0].events[0].pitches, [
    ["F", 0, 4, 63],
    ["A", 0, 4, 67],
  ]);
  assert.deepEqual(written.targets, [[63, 67]]);
  const concert = await inspect(
    example.replace(
      "<Score>",
      "<Score><Style><concertPitch>1</concertPitch></Style>",
    ),
  );
  assert.deepEqual(concert.bars[0].events[0].pitches, [
    ["E", -1, 4, 63],
    ["G", 0, 4, 67],
  ]);
  assert.equal(concert.bars[0].key, -3);

  // A seven-note group occupies four sixteenths, followed by one quarter.
  const group =
    "<Tuplet><normalNotes>4</normalNotes><actualNotes>7</actualNotes></Tuplet>" +
    chord(head(60, 14), "16th").repeat(7) +
    "<endTuplet/>";
  const multi = native({
    staves: staff(
      1,
      "<Measure><startRepeat/><voice>" +
        group +
        chord(head(64, 18)) +
        "</voice><voice>" +
        rest("half") +
        "</voice><endRepeat>2</endRepeat></Measure>",
    ),
  });
  const result = await inspect(multi);
  assert.deepEqual(result.lanes, [
    ["P1", "1", "1"],
    ["P1", "1", "2"],
  ]);
  assert.deepEqual(result.tuplets, ["start", "stop"]);
  assert.deepEqual(result.rhythm, Array(7).fill("74"));
  assert.ok(Math.abs(result.bars[0].events[6].duration - 1 / 7) < 1e-9);
  assert.ok(Math.abs(result.bars[0].events[7].start - 1) < 1e-9);
  assert.equal(
    result.targets.filter((pitches) => pitches.includes(64)).length,
    2,
  );

  const a = head(60, 14),
    start = a.replace("</Note>", '<Tie id="3"/></Note>'),
    end = a.replace("</Note>", '<endSpanner id="3"/></Note>');
  const old = native({
    version: "2.06",
    staves: staff(
      1,
      "<Measure>" +
        chord(start, "half").replace(
          "<durationType>",
          "<dots>1</dots><durationType>",
        ) +
        chord(end) +
        "</Measure>",
    ),
  });
  const tied = await inspect(old);
  assert.equal(tied.dots, 1);
  assert.deepEqual(tied.ties, ["start", "stop"]);
  assert.deepEqual(tied.targets, [[60]]);
  const swing = example.replace(
    "<Score>",
    "<Score><Style><swingUnit>eighth</swingUnit><swingRatio>70</swingRatio></Style>",
  );
  await assert.rejects(inspect(swing), /unsupportedNotation/);
  assert.equal(
    (await inspect(swing.replace("70</swingRatio>", "50</swingRatio>"))).bpm,
    80,
  );
  await assert.rejects(
    inspect(example.replace("<Chord>", "<InstrumentChange/><Chord>")),
    /unsupportedNotation/,
  );
  await assert.rejects(
    inspect(example.replace('version="4.40"', 'version="1.11"')),
    /unsupportedFile/,
  );
}

(async () => {
  const bundle = buildSync({
    stdin: {
      contents:
        "export { museScoreToMusicXml } from './src/features/score-import/formats/musescore';" +
        "export { parseScoreDocument } from './src/features/score-import/model';" +
        "export { prepareScore } from './src/features/score-import/timeline';",
      resolveDir: path.join(__dirname, ".."),
    },
    bundle: true,
    write: false,
    globalName: "Native",
    platform: "browser",
  });
  const browser = await chromium.launch({
    channel: "chrome",
    ...(process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {}),
  });
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await verify(page);
    console.log("MuseScore native notation and practice regressions passed.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
