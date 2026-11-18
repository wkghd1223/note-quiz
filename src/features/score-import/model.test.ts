import { describe, expect, it } from "vitest";
import { parseScoreDocument } from "./model";
import { prepareScore } from "./timeline";
import type { ImportedScore, ScoreOptions } from "./types";

// The unit environment is Node. Fixture nodes expose the same read-only
// element boundary as the native XMLDocument produced by the browser importer.
function e(
  name: string,
  attrs: Record<string, string> = {},
  ...content: (Element | string)[]
): Element {
  const children = content.filter((v): v is Element => typeof v !== "string");
  return {
    localName: name,
    children,
    textContent: content
      .map((v) => (typeof v === "string" ? v : v.textContent))
      .join(""),
    getAttribute: (key: string) => attrs[key] ?? null,
    hasAttribute: (key: string) => Object.hasOwn(attrs, key),
  } as unknown as Element;
}
const val = (name: string, value: string | number) =>
  e(name, {}, String(value));
const note = (step: string, duration = 1, extra: Element[] = [], alter = 0) =>
  e(
    "note",
    {},
    ...extra,
    e("pitch", {}, val("step", step), val("octave", 4), val("alter", alter)),
    val("duration", duration),
  );
const bar = (index: number, ...items: Element[]) =>
  e("measure", { number: String(index), implicit: "yes" }, ...items);
const asDoc = (root: Element) =>
  ({
    documentElement: root,
    getElementsByTagName: () => [],
  }) as unknown as XMLDocument;
const score = (...bars: Element[]) =>
  parseScoreDocument(
    asDoc(e("score-partwise", {}, e("part", { id: "P1" }, ...bars))),
  );
const opts = (
  value: ImportedScore,
  settings: Partial<ScoreOptions> = {},
): ScoreOptions => ({
  fromBar: 0,
  toBar: value.lanes[0].bars.length - 1,
  semitones: 0,
  speed: 1,
  repeats: true,
  ...settings,
});
const preview = (
  value: ImportedScore,
  settings: Partial<ScoreOptions> = {},
  lane = 0,
) => prepareScore(value, value.lanes[lane].id, opts(value, settings));
const sound = (attrs: Record<string, string>) =>
  e("direction", {}, e("sound", attrs));

describe("MusicXML score and performance", () => {
  it("keeps the complete written measure when shortening an unusually long count-in", () => {
    const value = score(
      e(
        "measure",
        { number: "1" },
        e(
          "attributes",
          {},
          e("time", {}, val("beats", 40), val("beat-type", 4)),
        ),
        sound({ tempo: "60" }),
        note("C", 40),
      ),
    );
    const timeline = preview(value);
    expect(timeline.countIn).toEqual({ pulses: 32, pulseSec: 1 });
    expect(timeline.durationSec).toBe(40);
  });
  it("plays all requested passes of a multi-bar repeat", () => {
    const value = score(
      ...Array.from({ length: 12 }, (_, index) =>
        bar(
          index + 1,
          ...(index === 0
            ? [
                e(
                  "barline",
                  { location: "left" },
                  e("repeat", { direction: "forward" }),
                ),
              ]
            : []),
          note("C"),
          ...(index === 11
            ? [
                e(
                  "barline",
                  {},
                  e("repeat", { direction: "backward", times: "24" }),
                ),
              ]
            : []),
        ),
      ),
    );
    expect(preview(value).visits).toHaveLength(288);
  });
  it("interprets repeat signs on either side of a measure boundary", () => {
    const s = score(
      bar(
        1,
        note("C"),
        e(
          "barline",
          { location: "right" },
          e("repeat", { direction: "forward" }),
        ),
      ),
      bar(2, note("D")),
      bar(
        3,
        e(
          "barline",
          { location: "left" },
          e("repeat", { direction: "backward" }),
        ),
        note("E"),
      ),
    );
    expect(preview(s).visits?.map((v) => v.barIndex)).toEqual([0, 1, 1, 2]);
  });
  it("resolves written alter and instrument transposition once, independently of printed key or courtesy accidentals", () => {
    const s = score(
      bar(
        0,
        e(
          "attributes",
          {},
          val("divisions", 2),
          e("key", {}, val("fifths", 2)),
          e("clef", {}, val("sign", "F"), val("line", 4)),
          e("transpose", {}, val("chromatic", -2)),
        ),
        note("F", 1, [], 1),
        note("F", 1, [val("accidental", "natural")]),
      ),
    );
    const measure = s.lanes[0].bars[0];
    expect(measure.duration).toBe(1);
    expect(measure.fifths).toBe(2);
    expect(measure.clef.sign).toBe("F");
    expect(preview(s, { semitones: 2 }).targets.map((t) => t.midis)).toEqual([
      [66],
      [65],
    ]);
  });

  it("keeps notes at their score-time key/clef even after a backup for another voice", () => {
    const s = score(
      bar(
        1,
        note("C"),
        e(
          "attributes",
          {},
          e("clef", {}, val("sign", "F"), val("line", 4)),
          e("key", {}, val("fifths", -2)),
        ),
        note("D"),
        e("backup", {}, val("duration", 2)),
        note("E", 2, [val("voice", 2)]),
      ),
    );
    expect(
      s.lanes[0].bars[0].events.map((v) => [v.clef.sign, v.fifths]),
    ).toEqual([
      ["G", 0],
      ["F", -2],
    ]);
    expect(s.lanes[1].bars[0].events[0].clef.sign).toBe("G");
    expect(preview(s, {}, 1).targets.map((v) => v.midis)).toEqual([[64]]);
  });

  it("follows first and second endings and crops repeats relative to the original score", () => {
    const s = score(
      bar(
        1,
        e(
          "barline",
          { location: "left" },
          e("repeat", { direction: "forward" }),
        ),
        sound({ tempo: "60" }),
        note("C"),
      ),
      bar(
        2,
        e(
          "barline",
          { location: "left" },
          e("ending", { type: "start", number: "1" }),
        ),
        sound({ tempo: "120" }),
        note("D"),
        e(
          "barline",
          { location: "right" },
          e("ending", { type: "stop", number: "1" }),
          e("repeat", { direction: "backward" }),
        ),
      ),
      bar(
        3,
        e(
          "barline",
          { location: "left" },
          e("ending", { type: "start", number: "2" }),
        ),
        note("E"),
        e(
          "barline",
          { location: "right" },
          e("ending", { type: "discontinue", number: "2" }),
        ),
      ),
      bar(4, note("F")),
    );
    expect(preview(s).visits?.map((v) => v.barIndex)).toEqual([0, 1, 0, 2, 3]);
    expect(preview(s).visits?.map((v) => v.endSec - v.startSec)).toEqual([
      1, 0.5, 1, 1, 1,
    ]);
    expect(preview(s, { fromBar: 2, toBar: 2 }).countIn.pulseSec).toBe(1);
    expect(preview(s, { repeats: false }).visits?.at(-1)?.endSec).toBe(2.5);
    expect(preview(s, { fromBar: 1 }).visits?.map((v) => v.barIndex)).toEqual([
      1, 2, 3,
    ]);
    expect(
      preview(s, { repeats: false }).visits?.map((v) => v.barIndex),
    ).toEqual([0, 1, 2, 3]);
  });

  it("follows a named D.S. and To Coda once", () => {
    const s = score(
      bar(1, note("C")),
      bar(2, sound({ segno: "A" }), note("D")),
      bar(3, note("E"), sound({ tocoda: "B" })),
      bar(4, note("F"), sound({ dalsegno: "A" })),
      bar(5, sound({ coda: "B" }), note("G")),
    );
    expect(preview(s).visits?.map((v) => v.barIndex)).toEqual([
      0, 1, 2, 3, 1, 2, 4,
    ]);
  });

  it("restores the entry tempo when a D.S. returns to an unmarked measure", () => {
    const s = score(
      bar(1, sound({ tempo: "60" }), note("C")),
      bar(2, sound({ segno: "S" }), note("D"), sound({ fine: "yes" })),
      bar(3, sound({ tempo: "120" }), note("E"), sound({ dalsegno: "S" })),
    );
    const timeline = preview(s);
    expect(
      timeline.visits?.map((visit) => [
        visit.barIndex,
        visit.endSec - visit.startSec,
      ]),
    ).toEqual([
      [0, 1],
      [1, 1],
      [2, 0.5],
      [1, 1],
    ]);
  });

  it("assigns jumps to the written beat and flags mid-measure navigation", () => {
    const boundary = score(
      bar(1, note("C"), sound({ segno: "S" })),
      bar(2, note("D"), sound({ fine: "yes" })),
      bar(3, note("E"), sound({ dalsegno: "S" })),
    );
    expect(preview(boundary).visits?.map((v) => v.barIndex)).toEqual([
      0, 1, 2, 1,
    ]);
    const middle = score(bar(1, note("C"), sound({ fine: "yes" }), note("E")));
    expect(middle.issues).toContainEqual(
      expect.objectContaining({
        code: "navigation",
        barIndex: 0,
        blocksPractice: true,
      }),
    );
    expect(() => preview(middle)).toThrow("unsupportedNotation");
  });

  it("keeps simultaneous heads, shorter chord releases and tied continuations on a common clock", () => {
    const s = score(
      bar(
        0,
        sound({ tempo: "60" }),
        note("C", 2, [e("tie", { type: "start" })]),
        note("E", 1, [e("chord")]),
      ),
      bar(1, note("C", 1, [e("tie", { type: "stop" })])),
    );
    const timeline = preview(s);
    expect(
      timeline.targets.map(({ midis, startSec, endSec }) => [
        midis,
        startSec,
        endSec,
      ]),
    ).toEqual([
      [[60, 64], 0, 1],
      [[60], 1, 3],
    ]);
    expect(timeline.notes).toEqual([
      { midi: 60, startSec: 0, endSec: 3 },
      { midi: 64, startSec: 0, endSec: 1 },
    ]);
    expect(timeline.cursor).toEqual(
      s.lanes[0].bars.map((bar, index) => ({
        barIndex: index,
        eventId: bar.events[0].id,
        startSec: index ? 2 : 0,
        endSec: index ? 3 : 2,
      })),
    );
    expect(preview(s, { fromBar: 1 }).notes).toEqual([
      { midi: 60, startSec: 0, endSec: 1 },
    ]);
  });

  it("joins a tie leaving a repeat only on the final visit", () => {
    const s = score(
      bar(
        1,
        sound({ tempo: "60" }),
        e(
          "barline",
          { location: "left" },
          e("repeat", { direction: "forward" }),
        ),
        note("D"),
      ),
      bar(
        2,
        note("C", 1, [e("tie", { type: "start" })]),
        e("barline", {}, e("repeat", { direction: "backward" })),
      ),
      bar(3, note("C", 1, [e("tie", { type: "stop" })])),
    );
    expect(preview(s).notes.filter((n) => n.midi === 60)).toEqual([
      { midi: 60, startSec: 1, endSec: 2 },
      { midi: 60, startSec: 3, endSec: 5 },
    ]);
  });

  it("integrates a tempo change inside a long note and uses performed tuplet duration exactly once", () => {
    const modification = e(
      "time-modification",
      {},
      val("actual-notes", 4),
      val("normal-notes", 3),
    );
    const s = score(
      bar(
        1,
        e(
          "attributes",
          {},
          val("divisions", 8),
          e("time", {}, val("beats", 6), val("beat-type", 8)),
        ),
        sound({ tempo: "60" }),
        e(
          "direction",
          {},
          e("offset", { sound: "yes" }, "8"),
          e("sound", { tempo: "120" }),
        ),
        ...["C", "D", "E", "F"].map((step) =>
          note(step, 3, [val("type", "eighth"), modification]),
        ),
      ),
    );
    expect(preview(s).durationSec).toBeCloseTo(1.25);
    expect(preview(s).countIn).toEqual({ pulses: 2, pulseSec: 1.5 });
    expect(s.lanes[0].bars[0].events[0].tuplet).toEqual({
      actual: 4,
      normal: 3,
    });
  });

  it("applies direction and sound offsets at their specified playback positions", () => {
    const change = { tempo: "120" };
    const beat = (direction: Element) =>
      preview(
        score(bar(1, sound({ tempo: "60" }), direction, note("C"), note("D"))),
      );
    const immediate = beat(
      e("direction", {}, val("offset", 1), e("sound", change)),
    );
    expect(immediate.targets.map((t) => t.endSec)).toEqual([0.5, 1]);
    const postponed = beat(
      e("direction", {}, e("sound", change, val("offset", 1))),
    );
    expect(postponed.targets.map((t) => t.endSec)).toEqual([1, 1.5]);
    expect(postponed.tempoSpans).toEqual([
      {
        barIndex: 0,
        startBeat: 0,
        startSec: 0,
        endSec: 1,
        quartersPerSecond: 1,
      },
      {
        barIndex: 0,
        startBeat: 1,
        startSec: 1,
        endSec: 1.5,
        quartersPerSecond: 2,
      },
    ]);
    const override = beat(
      e(
        "direction",
        {},
        e("offset", { sound: "yes" }, "2"),
        e("sound", change, val("offset", 1)),
      ),
    );
    expect(override.targets.map((t) => t.endSec)).toEqual([1, 1.5]);
    expect(beat(e("sound", change, val("offset", 1))).countIn.pulseSec).toBe(1);
  });

  it("clocks metronome and bar accents against the imported visits, compound meter and tempo changes", () => {
    const value = score(
      bar(
        1,
        e(
          "attributes",
          {},
          val("divisions", 2),
          e("time", {}, val("beats", 6), val("beat-type", 8)),
          e("key", {}, val("fifths", -1), val("mode", "minor")),
          e("transpose", {}, val("chromatic", -2)),
        ),
        sound({ tempo: "60" }),
        e(
          "barline",
          { location: "left" },
          e("repeat", { direction: "forward" }),
        ),
        note("C", 6),
      ),
      bar(
        2,
        sound({ tempo: "120" }),
        note("C", 6),
        e("barline", {}, e("repeat", { direction: "backward" })),
      ),
    );
    expect(value.lanes[0].bars[1]).toMatchObject({
      keyMode: "minor",
      fifths: -1,
      transpose: -2,
    });
    const full = preview(value, { metronome: true, barBell: true, speed: 2 });
    expect(full.sourceBpm).toBe(60);
    expect(
      full.tempoSpans?.map((span) => [
        span.barIndex,
        span.startSec,
        span.quartersPerSecond,
      ]),
    ).toEqual([
      [0, 0, 2],
      [1, 1.5, 4],
      [0, 2.25, 2],
      [1, 3.75, 4],
    ]);
    expect(full.beatCues?.map((c) => c.timeSec)).toEqual([
      0, 0.75, 1.5, 1.875, 2.25, 3, 3.75, 4.125,
    ]);
    expect(full.beatCues?.map((c) => c.kind)).toEqual([
      "bar",
      "beat",
      "bar",
      "beat",
      "bar",
      "beat",
      "bar",
      "beat",
    ]);
    expect(preview(value, { barBell: true, fromBar: 1 }).beatCues).toEqual([
      { kind: "bar", timeSec: 0 },
    ]);
    expect(preview(value).beatCues).toEqual([]);
  });
  it("preserves timewise XML and blocks an unsupported performance effect only in its lane", () => {
    const song = e(
      "score-timewise",
      {},
      e(
        "measure",
        { number: "1", implicit: "yes" },
        e(
          "part",
          { id: "p" },
          note("C", 1, [
            e("notations", {}, e("ornaments", {}, e("trill-mark"))),
          ]),
          e("backup", {}, val("duration", 1)),
          note("G", 1, [val("voice", 2)]),
        ),
      ),
    );
    const s = parseScoreDocument(asDoc(song));
    expect(s.document.documentElement).toBe(song);
    expect(s.lanes[0].bars[0].source.localName).toBe("part");
    expect(() => preview(s)).toThrow("unsupportedNotation");
    expect(preview(s, {}, 1).notes[0].midi).toBe(67);
  });
});
