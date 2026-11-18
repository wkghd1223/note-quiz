import { describe, expect, it } from "vitest";
import { importer, model, rendering, Settings } from "@coderline/alphatab";
import {
  fullScoreBarRegions,
  fullScoreViewportHeight,
  transposeFullScore,
} from "./FullScore";
import type { ImportedLane } from "./types";

const parts = ["P1", "P2"];
const note = (step: string, staff: number) =>
  `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><type>whole</type><staff>${staff}</staff></note>`;
const xml = `<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part>
  <score-part id="P2"><part-name>Voice</part-name></score-part></part-list>
  <part id="P2"><measure number="1">${note("D", 1)}</measure></part>
  <part id="P1"><measure number="1">
    <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves>
    <clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>
    ${note("F", 1)}<backup><duration>4</duration></backup>${note("C", 2)}
  </measure></part>
</score-partwise>`;

function staffLane(partId: string, staff: string, voice = "1"): ImportedLane {
  const id = [partId, staff, voice].join("-");
  return { id, partId, staff, voice, label: id, bars: [] };
}

describe("full imported score selection", () => {
  it("keeps the two piano staves and the following part independently clickable", () => {
    const settings = new Settings();
    settings.core.engine = "svg";
    settings.core.enableLazyLoading = false;
    const score = importer.ScoreLoader.loadScoreFromBytes(
      new TextEncoder().encode(xml),
      settings,
    );
    const renderer = new rendering.ScoreRenderer(settings);
    renderer.width = 640;
    renderer.renderScore(
      score,
      score.tracks.map((track) => track.index),
    );
    const lookup = renderer.boundsLookup!;
    const lanes = [
      staffLane("P2", "1"),
      staffLane("P1", "1"),
      staffLane("P1", "2"),
    ];
    const boxes = fullScoreBarRegions(lookup, parts, lanes).sort(
      (a, b) => a.y - b.y,
    );
    expect(
      boxes.map((box) => [box.index, box.partId, box.staff, box.lane?.id]),
    ).toEqual([
      [0, "P1", 1, "P1-1-1"],
      [0, "P1", 2, "P1-2-1"],
      [0, "P2", 1, "P2-1-1"],
    ]);
    expect(boxes[0].y + boxes[0].h).toBeLessThanOrEqual(boxes[1].y);
    expect(boxes[1].y + boxes[1].h).toBeLessThanOrEqual(boxes[2].y);
    // Several voices share a staff rectangle. A bar tap alone cannot select one.
    const ambiguous = fullScoreBarRegions(lookup, parts, [
      ...lanes,
      staffLane("P2", "1", "2"),
    ]);
    expect(ambiguous.find((box) => box.y === boxes[2].y)).toMatchObject({
      index: 0,
      partId: "P2",
      staff: 1,
      lane: undefined,
    });
    renderer.destroy();
  });
});

describe("wrapped full-score scrolling", () => {
  it("fits three complete multi-staff systems and drops the cap once the score fits", () => {
    const settings = new Settings();
    settings.core.engine = "svg";
    settings.core.enableLazyLoading = true;
    settings.display.barsPerRow = 1;
    const sixBars = xml.replace(
      /<measure number="1">[\s\S]*?<\/measure>/g,
      (bar) =>
        Array.from({ length: 6 }, (_, index) =>
          bar.replace('number="1"', `number="${index + 1}"`),
        ).join(""),
    );
    const score = importer.ScoreLoader.loadScoreFromBytes(
      new TextEncoder().encode(sixBars),
      settings,
    );
    score.title = "Piano and voice";
    const renderer = new rendering.ScoreRenderer(settings);
    try {
      renderer.width = 480;
      renderer.renderScore(score, [0, 1]);
      const lookup = renderer.boundsLookup!;
      expect(lookup.staffSystems).toHaveLength(6);
      expect(lookup.staffSystems[0].realBounds.y).toBeGreaterThan(0);
      const limit = fullScoreViewportHeight(lookup)!;
      const regions = fullScoreBarRegions(lookup, parts, []);
      const thirdLine = regions.filter((region) => region.index === 2);
      expect(thirdLine).toHaveLength(3);
      for (const region of thirdLine)
        expect(region.y + region.h).toBeLessThanOrEqual(limit);
      for (const region of regions.filter((region) => region.index === 3))
        expect(region.y).toBeGreaterThanOrEqual(limit - 1);

      settings.display.barsPerRow = 2;
      renderer.width = 900;
      renderer.renderScore(score, [0, 1]);
      expect(renderer.boundsLookup!.staffSystems).toHaveLength(3);
      expect(fullScoreViewportHeight(renderer.boundsLookup!)).toBeUndefined();
    } finally {
      renderer.destroy();
    }
  });
});

describe("full score in the practice key", () => {
  const clarinetXml = `<score-partwise version="4.0">
    <part-list><score-part id="C"><part-name>B-flat Clarinet</part-name></score-part></part-list>
    <part id="C"><measure number="1"><attributes><divisions>1</divisions><key><fifths>2</fifths></key>
      <time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef>
      <transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose></attributes>
      <harmony><root><root-step>D</root-step></root><kind>major</kind></harmony>
      ${note("D", 1)}</measure></part></score-partwise>`;

  it.each([
    [0, 60, 0, "C"],
    [2, 62, 2, "D"],
    [-2, 58, -2, "Bb"],
    [12, 72, 0, "C"],
  ] as const)(
    "renders concert pitch plus %i with its matching key and chord",
    (shift, midi, fifths, chord) => {
      const settings = new Settings();
      settings.core.engine = "svg";
      settings.core.includeNoteBounds = true;
      settings.core.enableLazyLoading = false;
      const parsed = importer.ScoreLoader.loadScoreFromBytes(
        new TextEncoder().encode(clarinetXml),
        settings,
      );
      const bar = parsed.tracks[0].staves[0].bars[0],
        beat = bar.voices[0].beats[0],
        head = beat.notes[0];
      expect([head.realValue, head.displayValue, bar.keySignature]).toEqual([
        60, 62, 2,
      ]);
      transposeFullScore(parsed, ["C"], [], shift, model.Chord);
      const renderer = new rendering.ScoreRenderer(settings);
      renderer.width = 640;
      renderer.renderScore(parsed, [0]);
      expect(renderer.boundsLookup?.findBeat(beat)?.notes).toHaveLength(1);
      expect([
        head.realValue,
        head.displayValue,
        bar.keySignature,
        beat.chord?.name,
      ]).toEqual([60, midi, fifths, chord]);
      renderer.destroy();
    },
  );
});
