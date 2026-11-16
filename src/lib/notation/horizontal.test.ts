import { generateMelody } from "@/features/melody/domain/generator";
import { defaultMelodySettings } from "@/features/melody/domain/settings";
import { exerciseScore } from "@/features/melody/domain/notation";
import { getInstrumentProfile } from "@/features/challenge/domain/instrument-profile";
import { buildPlaybackTimeline } from "@/features/challenge/domain/score-timeline";
import { scoreCursorPosition } from "@/features/challenge/components/score-scroll";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  EngravingSettings,
  LayoutMode,
  Settings,
  StaveProfile,
  model,
  rendering,
} from "@coderline/alphatab";
import { timeSpacingInset } from "./time-spacing";
import {
  melodyQuarterWidth,
  melodyQuarterWidthFor,
} from "@/features/melody/domain/score-layout";
import { getMelodyPitches } from "@/features/melody/domain/settings";
import { KEY_SIGNATURES } from "@/lib/music/constants";
import { legacyToScore } from "./legacy-to-score";
import { theoryToScore } from "./theory-to-score";
import { notationRenderResult, toAlphaTabScore } from "./alphatab-score";
import {
  writtenNote,
  type NotationDirection,
  type NotationScore,
} from "./score";

const note = (name: NoteName, accidental: Accidental | null = null): Note => ({
  name,
  accidental,
  octave: 4,
});
const fixture = (): NotationScore => ({
  clef: "treble",
  keySignature: 0,
  timeSignature: { numerator: 4, denominator: 4 },
  showTimeSignature: true,
  events: [
    { id: "first", duration: 4, notes: [writtenNote(note("F", "sharp"))] },
    { id: "second", duration: 4, notes: [writtenNote(note("F", "sharp"))] },
    { id: "rest", duration: 2, notes: [] },
    { id: "last", duration: 1, barIndex: 1, notes: [writtenNote(note("C"))] },
  ],
});

// Read the shipped font's advance widths as well as SMuFL ink boxes. In SVG,
// text-anchor="middle" centers the advance, which need not equal the ink width.
const fontSvg = readFileSync("public/alphatab/font/Bravura.svg", "utf8");
const fontUnits = Number(fontSvg.match(/units-per-em="(\d+)"/)![1]);
const glyphAdvances = new Map(
  [
    ...fontSvg.matchAll(
      /<glyph[^>]*unicode="&#x([\da-f]+);"[^>]*horiz-adv-x="(\d+)"/g,
    ),
  ].map((match) => [parseInt(match[1], 16), Number(match[2])] as const),
);

function nativeSvgInk(svg: string) {
  const boxes = EngravingSettings.bravuraMetadata.glyphBBoxes!;
  const fontSize = EngravingSettings.bravuraDefaults.musicFontSize;
  return [
    ...svg.matchAll(
      /<g transform="translate\(([-\d.e]+) ([-\d.e]+)\)" class="at" ><text([^>]*)>(.*?)<\/text><\/g>/g,
    ),
  ].flatMap((match) => {
    const scale =
      Number(match[3].match(/font-size: ([\d.]+)%/)?.[1] ?? 100) / 100;
    const symbols = [...match[4].matchAll(/&#(\d+);/g)].map((value) =>
      Number(value[1]),
    );
    const advance = (symbol: number) =>
      (glyphAdvances.get(symbol)! / fontUnits) * fontSize * scale;
    let x =
      Number(match[1]) -
      (match[3].includes('text-anchor="middle"')
        ? symbols.reduce((sum, symbol) => sum + advance(symbol), 0) / 2
        : 0);
    return symbols.map((symbol) => {
      const name = model.MusicFontSymbol[symbol];
      const box = boxes[name[0].toLowerCase() + name.slice(1)];
      const unit = (fontSize / 4) * scale;
      const ink = {
        symbol,
        x: x + box.bBoxSW[0] * unit,
        y: Number(match[2]) - box.bBoxNE[1] * unit,
        width: (box.bBoxNE[0] - box.bBoxSW[0]) * unit,
        height: (box.bBoxNE[1] - box.bBoxSW[1]) * unit,
        scale,
      };
      x += advance(symbol);
      return ink;
    });
  });
}

function render(
  input: NotationScore,
  colors?: Readonly<Record<string, string>>,
  width = 1600,
  scale = 1,
) {
  const built = toAlphaTabScore(input, colors);
  const settings = new Settings();
  settings.core.engine = "svg";
  settings.core.includeNoteBounds = true;
  settings.core.enableLazyLoading = false;
  settings.display.layoutMode = LayoutMode.Horizontal;
  settings.display.staveProfile = StaveProfile.Score;
  settings.display.scale = scale;
  const renderer = new rendering.ScoreRenderer(settings);
  renderer.width = width;
  const symbols: { x: number; width: number; symbol: number; scale: number }[] =
    [];
  renderer.preRender.on(() => {
    const canvas = renderer.canvas!;
    const draw = canvas.fillMusicFontSymbol.bind(canvas);
    canvas.fillMusicFontSymbol = (x, y, relativeScale, symbol, centered) => {
      const glyphWidth =
        settings.display.resources.engravingSettings.glyphWidths.get(symbol)! *
        relativeScale;
      symbols.push({
        x: x - (centered ? glyphWidth / 2 : 0),
        width: glyphWidth,
        symbol,
        scale: relativeScale,
      });
      draw(x, y, relativeScale, symbol, centered);
    };
  });
  const parts: string[] = [];
  renderer.partialRenderFinished.on((event) =>
    parts.push(String(event.renderResult)),
  );
  renderer.error.on((error) => {
    throw error;
  });
  renderer.renderScore(built.score, [0]);
  return { built, renderer, svg: parts.join(""), symbols };
}

describe("optional written-bar navigation engraving", () => {
  it("leaves default legacy and theory adapters unstyled and without navigation", () => {
    const source = note("C");
    const inputs = [
      legacyToScore({
        clef: "bass",
        keySignature: KEY_SIGNATURES.C,
        note: source,
        originalNote: source,
      }),
      theoryToScore([source, note("E"), note("G")], true),
    ];
    for (const input of inputs) {
      const built = toAlphaTabScore(input);
      expect(input.bars).toBeUndefined();
      expect(built.score.masterBars).toHaveLength(1);
      expect(built.score.masterBars[0]).toMatchObject({
        isRepeatStart: false,
        repeatCount: 0,
        directions: null,
      });
      for (const { beat } of built.events) {
        expect(beat.style).toBeUndefined();
        expect(beat.notes.every((n) => n.style === undefined)).toBe(true);
      }
      expect(built.events[0].beat.notes.map((n) => n.realValue)).toEqual(
        input.events[0].notes.map((n) => n.midi),
      );
    }
  });

  it("maps total repeat passes without expanding or duplicating written events", () => {
    const input = fixture();
    input.bars = [{ repeatStart: true }, { repeatCount: 3 }];
    const { score, events } = toAlphaTabScore(input);
    expect(score.masterBars[0].isRepeatStart).toBe(true);
    expect(score.masterBars[1].repeatCount).toBe(3);
    expect(score.masterBars[1].isRepeatEnd).toBe(true);
    expect(events.map((event) => event.id)).toEqual(
      input.events.map((event) => event.id),
    );
  });

  it.each([
    ["segno", model.Direction.TargetSegno],
    ["coda", model.Direction.TargetCoda],
    ["fine", model.Direction.TargetFine],
    ["toCoda", model.Direction.JumpDaCoda],
    ["daCapo", model.Direction.JumpDaCapo],
    ["daCapoAlFine", model.Direction.JumpDaCapoAlFine],
    ["daCapoAlCoda", model.Direction.JumpDaCapoAlCoda],
    ["dalSegno", model.Direction.JumpDalSegno],
    ["dalSegnoAlFine", model.Direction.JumpDalSegnoAlFine],
    ["dalSegnoAlCoda", model.Direction.JumpDalSegnoAlCoda],
  ] satisfies [NotationDirection, model.Direction][])(
    "maps %s to its exact alphaTab public direction",
    (direction, expected) => {
      const input = fixture();
      input.bars = [{}, { directions: [direction] }];
      expect([
        ...toAlphaTabScore(input).score.masterBars[1].directions!,
      ]).toEqual([expected]);
    },
  );

  it("engraves actual horizontal bars, repeat glyphs and DC/DS/Fine directions", () => {
    const input = fixture();
    input.bars = [
      { repeatStart: true, directions: ["segno"] },
      { repeatCount: 3, directions: ["daCapoAlFine", "dalSegno", "fine"] },
    ];
    const { built, renderer, svg } = render(input);
    try {
      expect(renderer.boundsLookup?.staffSystems).toHaveLength(1);
      const bars = built.score.masterBars.map(
        (bar) => renderer.boundsLookup!.findMasterBar(bar)!,
      );
      expect(bars[1].realBounds.x).toBeGreaterThan(bars[0].realBounds.x);
      expect(svg).toContain("D.C. al Fine");
      expect(svg).toContain("D.S.");
      expect(svg).toContain("Fine");
      expect(svg).toContain("&#57415;"); // Native Segno, encoded by the Node SVG renderer.
      expect(svg).toContain("&#57412;"); // Native repeat dots.
      expect(svg).toContain("x3");
      expect(built.score.masterBars[1].repeatCount).toBe(3);
    } finally {
      renderer.destroy();
    }
  });

  it("engraves Coda and To Coda using the public directions model", () => {
    const input = fixture();
    input.bars = [{ directions: ["coda"] }, { directions: ["toCoda"] }];
    const { renderer, svg } = render(input);
    try {
      expect(svg).toContain("&#57416;");
      expect(svg).toContain("To Coda");
    } finally {
      renderer.destroy();
    }
  });
});

describe("native per-event colors and actual onset anchors", () => {
  it("styles the selected event rather than every equal-pitch note, including rests", () => {
    const { events } = toAlphaTabScore(fixture(), {
      second: "#15803d",
      rest: "#dc2626",
    });
    expect(events[0].beat.notes[0].style).toBeUndefined();
    expect(
      events[1].beat.notes[0].style!.colors.get(
        model.NoteSubElement.StandardNotationNoteHead,
      )?.rgba,
    ).toBe("#15803D");
    expect(
      events[1].beat.notes[0].style!.colors.get(
        model.NoteSubElement.StandardNotationAccidentals,
      )?.rgba,
    ).toBe("#15803D");
    expect(
      events[1].beat.style!.colors.get(
        model.BeatSubElement.StandardNotationStem,
      )?.rgba,
    ).toBe("#15803D");
    expect(
      events[2].beat.style!.colors.get(
        model.BeatSubElement.StandardNotationRests,
      )?.rgba,
    ).toBe("#DC2626");
    expect(events[3].beat.style).toBeUndefined();
    expect(
      toAlphaTabScore(fixture(), {}).events[1].beat.notes[0].style,
    ).toBeUndefined();
  });

  it("colors real engraved glyphs while preserving exact beat/bar anchors and IDs", () => {
    const plain = render(fixture()),
      colored = render(fixture(), { first: "#15803d", rest: "#dc2626" });
    const resized = render(
      fixture(),
      { first: "#15803d", rest: "#dc2626" },
      2200,
    );
    const result = (rendered: ReturnType<typeof render>) =>
      notationRenderResult(rendered.built, rendered.renderer.boundsLookup, {
        scale: 0.5,
        dx: 7,
        dy: 10,
        top: -30,
        width: 1600,
        height: 220,
        contentWidth: 700,
      });
    try {
      expect(colored.svg).toContain("#15803D");
      expect(colored.svg).toContain("#DC2626");
      const a = result(plain),
        b = result(colored),
        c = result(resized);
      expect(b).toEqual(a);
      expect(c.events).toEqual(b.events);
      expect(c.measures).toEqual(b.measures);
      expect(a.events).toHaveLength(4);
      for (const event of a.events) {
        const source = plain.built.events.find((e) => e.id === event.id)!;
        const native = plain.renderer.boundsLookup!.findBeat(source.beat)!;
        expect(event.anchorX).toBe(7 + native.onNotesX * 0.5);
        expect(event.y).toBe(-20 + native.visualBounds.y * 0.5);
      }
      expect(a.events[1].anchorX).toBeGreaterThan(a.events[0].anchorX!);
      expect(a.measures).toHaveLength(2);
      expect(a.measures![1].x).toBeGreaterThan(a.measures![0].x);
      expect(a.measures![0].width).toBeGreaterThan(0);
    } finally {
      plain.renderer.destroy();
      colored.renderer.destroy();
      resized.renderer.destroy();
    }
  });
});

describe("melody native time spacing", () => {
  it("leaves non-time-spaced legacy and theory engraving unchanged", () => {
    const inputs = [
      legacyToScore({
        clef: "treble",
        keySignature: KEY_SIGNATURES.C,
        note: note("C"),
        originalNote: note("C"),
      }),
      theoryToScore([note("C"), note("E"), note("G")], true),
    ];
    for (const input of inputs) {
      const before = render(input);
      const compact = render({
        ...fixture(),
        timeSpacing: { quarterWidth: melodyQuarterWidth },
      });
      const after = render(input);
      try {
        // alphaTab assigns new process-global beat group IDs to every model.
        const engraving = (svg: string) =>
          svg.replace(/class="b\d+"/g, 'class="beat"');
        expect(engraving(after.svg)).toBe(engraving(before.svg));
        expect(after.built.timeSpacing).toBeUndefined();
      } finally {
        before.renderer.destroy();
        compact.renderer.destroy();
        after.renderer.destroy();
      }
    }
  });

  it.each([1, 2])(
    "keeps native noteheads on a linear clock at scale %i, including full-bar notes",
    (scale) => {
      const input = fixture();
      input.timeSpacing = { quarterWidth: 72 };
      const built = toAlphaTabScore(input);
      const settings = new Settings();
      settings.core.engine = "svg";
      settings.core.includeNoteBounds = true;
      settings.core.enableLazyLoading = false;
      settings.display.layoutMode = LayoutMode.Horizontal;
      settings.display.staveProfile = StaveProfile.Score;
      settings.display.scale = scale;
      const renderer = new rendering.ScoreRenderer(settings);
      renderer.width = 2000;
      renderer.error.on((error) => {
        throw error;
      });
      renderer.renderScore(built.score, [0]);
      try {
        const positions = built.events.map(
          ({ beat }) => renderer.boundsLookup!.findBeat(beat)!.onNotesX,
        );
        const origin = positions[0];
        [0, 1, 2, 4].forEach((beat, i) =>
          expect(positions[i] - origin).toBeCloseTo(beat * 72 * scale, 5),
        );
        const full = renderer.boundsLookup!.findBeat(built.events[3].beat)!;
        const bar = renderer.boundsLookup!.findMasterBar(
          built.score.masterBars[1],
        )!;
        expect(full.onNotesX - bar.realBounds.x).toBeCloseTo(
          timeSpacingInset * scale,
          5,
        );
        expect(bar.realBounds.w).toBeCloseTo(288 * scale, 5);
        // The actual native notehead still spans the timely anchor.
        expect(full.notes![0].noteHeadBounds.x).toBeLessThan(full.onNotesX);
        expect(
          full.notes![0].noteHeadBounds.x + full.notes![0].noteHeadBounds.w,
        ).toBeGreaterThan(full.onNotesX);
      } finally {
        renderer.destroy();
      }
    },
  );
});

it("keeps native timing and bar widths across clefs, keys, rests, dots and triplets", () => {
  for (const timeSignature of [
    [2, 4],
    [3, 4],
    [4, 4],
    [6, 8],
  ] as [number, number][]) {
    for (const clef of ["treble", "bass", "alto", "tenor"] as const) {
      const stage = generateMelody(
        {
          ...defaultMelodySettings,
          clef,
          keySignature: "Gb",
          minMidi: 48,
          maxMidi: 84,
          timeSignature,
          durations: [0.5, 1, 2, 4],
          dotted: true,
          triplets: true,
          bpm: 40,
        },
        197,
      );
      const input = {
        ...exerciseScore(stage),
        timeSpacing: { quarterWidth: melodyQuarterWidth },
      };
      const { built, renderer, svg } = render(input);
      try {
        const origin = renderer.boundsLookup!.findBeat(
          built.events[0].beat,
        )!.onNotesX;
        built.events.forEach(({ beat }, i) => {
          expect(
            renderer.boundsLookup!.findBeat(beat)!.onNotesX - origin,
          ).toBeCloseTo(stage.events[i].startBeat * melodyQuarterWidth, 4);
        });
        const expectedWidth =
          ((timeSignature[0] * 4) / timeSignature[1]) * melodyQuarterWidth;
        built.score.masterBars
          .slice(1)
          .forEach((bar) =>
            expect(
              renderer.boundsLookup!.findMasterBar(bar)!.realBounds.w,
            ).toBeCloseTo(expectedWidth, 5),
          );
        for (const { beat } of built.events) {
          const beatBounds = renderer.boundsLookup!.findBeat(beat)!;
          const barBounds = renderer.boundsLookup!.findMasterBar(
            beat.voice.bar.masterBar,
          )!;
          for (const note of beatBounds.notes ?? []) {
            expect(note.noteHeadBounds.x).toBeGreaterThanOrEqual(
              barBounds.realBounds.x,
            );
            // Include the final double barline's native overhead, not just its outer edge.
            expect(
              note.noteHeadBounds.x + note.noteHeadBounds.w,
            ).toBeLessThanOrEqual(
              barBounds.realBounds.x +
                barBounds.realBounds.w -
                (beat.voice.bar.index === 7 ? 9.54 : 1.44),
            );
          }
          expect(beatBounds.realBounds.w).toBeGreaterThan(0);
        }
        expect(svg).toContain('class="b');
        expect(svg).toContain("<path"); // Beams/brackets remain native drawing.
        const result = notationRenderResult(built, renderer.boundsLookup, {
          scale: 1,
          dx: 0,
          dy: 0,
          top: 0,
          width: 2000,
          height: 260,
          contentWidth: 2000,
        });
        const last = result.measures!.at(-1)!;
        expect(last.timeStartX! + last.timeWidth! - origin).toBeCloseTo(
          stage.measures * expectedWidth,
          4,
        );
        const timeline = buildPlaybackTimeline(
          stage,
          getInstrumentProfile("voice")!,
          0,
        );
        const targets = timeline.targets.map((target, index) => ({
          ...target,
          sourceEventId: target.stageEventId,
          sourceBarIndex: Math.floor(
            stage.events[index].startBeat /
              ((timeSignature[0] * 4) / timeSignature[1]),
          ),
          visit: 1,
        }));
        for (const [index, target] of targets.entries()) {
          expect(
            scoreCursorPosition(
              targets,
              timeline.transitions,
              result,
              target.startAudioSec,
            ).x,
          ).toBeCloseTo(result.events[index].anchorX!, 4);
          expect(
            scoreCursorPosition(
              targets,
              timeline.transitions,
              result,
              (target.startAudioSec + target.endAudioSec) / 2,
            ).x,
          ).toBeCloseTo(
            origin +
              (stage.events[index].startBeat +
                stage.events[index].durationBeats / 2) *
                melodyQuarterWidth,
            4,
          );
        }
        for (const reducedMotion of [false, true]) {
          expect(
            scoreCursorPosition(
              targets,
              timeline.transitions,
              result,
              0,
              reducedMotion,
              {
                remainingSec: 60 / stage.bpm,
                durationSec: 240 / stage.bpm,
                baseElapsedSec: 0,
              },
            ).x,
          ).toBeCloseTo(origin - melodyQuarterWidth, 4);
        }
      } finally {
        renderer.destroy();
      }
    }
  }
});

describe("compact melody geometry at supported pitch extrema", () => {
  it.each([
    [1, false],
    [1, true],
    [2, false],
    [2, true],
  ] as const)(
    "contains native glyphs at scale %i (triplet ending: %s)",
    (scale, tripletEnding) => {
      for (const clef of ["treble", "bass", "alto", "tenor"] as const) {
        for (const keySignature of [
          "C",
          "F",
          "Bb",
          "Eb",
          "Ab",
          "Db",
          "Gb",
          "Cb",
        ]) {
          const pitches = getMelodyPitches({
            keySignature,
            minMidi: 48,
            maxMidi: 84,
          });
          const extremes = [pitches[0], pitches.at(-1)!].map((pitch) => ({
            step: pitch.spelling[0] as NoteName,
            octave: Number(pitch.spelling.at(-1)),
            alter: (pitch.spelling.includes("b") ? -1 : 0) as -1 | 0,
            explicitAccidental: null,
            midi: pitch.midi,
          }));
          const events: NotationScore["events"][number][] = [];
          const add = (
            barIndex: number,
            duration: 1 | 2 | 4 | 8 | 16,
            rest = false,
            dots = 0,
            triplet = false,
          ) => {
            events.push({
              id: `e${events.length}`,
              barIndex,
              duration,
              dots,
              notes: rest ? [] : [extremes[events.length % 2]],
              ...(triplet
                ? {
                    tuplet: {
                      numerator: 3,
                      denominator: 2,
                      groupId: `triplet-${barIndex}`,
                    } as const,
                  }
                : {}),
            });
          };
          add(0, 1); // Full-bar note retains the first onset, never centered.
          add(1, 1);
          add(2, 2, false, 1);
          add(2, 4, true);
          for (let i = 0; i < 8; i++) add(3, 8, i % 3 === 1);
          for (let i = 0; i < 12; i++) add(4, 8, i % 3 === 1, 0, true);
          add(5, 1, true);
          // Notation-only fixture: does not add sixteenths to melody generation.
          for (let i = 0; i < (tripletEnding ? 12 : 16); i++)
            add(6, tripletEnding ? 8 : 16, i % 3 === 1, 0, tripletEnding);
          const quarterWidth = melodyQuarterWidthFor({
            events: events.map((event) => ({
              noteValue: event.duration,
              durationBeats:
                (4 / event.duration) *
                (event.dots ? 1.5 : 1) *
                (event.tuplet ? 2 / 3 : 1),
            })),
          });
          expect(quarterWidth).toBe(tripletEnding ? 74 : 92);
          const input: NotationScore = {
            clef,
            keySignature:
              KEY_SIGNATURES[keySignature].sharps.length -
              KEY_SIGNATURES[keySignature].flats.length,
            showTimeSignature: true,
            timeSignature: { numerator: 4, denominator: 4 },
            events,
            timeSpacing: { quarterWidth },
          };
          const { built, renderer, svg, symbols } = render(
            input,
            undefined,
            6000,
            scale,
          );
          const baseline = render(
            { ...input, timeSpacing: { quarterWidth: 92 } },
            undefined,
            6000,
            scale,
          );
          try {
            const origin = renderer.boundsLookup!.findBeat(
              built.events[0].beat,
            )!.onNotesX;
            for (const [index, { beat }] of built.events.entries()) {
              const bounds = renderer.boundsLookup!.findBeat(beat)!;
              const bar = renderer.boundsLookup!.findMasterBar(
                beat.voice.bar.masterBar,
              )!;
              const label = `${clef}/${keySignature}/${scale}/bar${beat.voice.bar.index}/beat${beat.index}`;
              expect(bounds.onNotesX - origin, label).toBeCloseTo(
                (beat.voice.bar.index * 4 + beat.playbackStart / 960) *
                  quarterWidth *
                  scale,
                4,
              );
              for (const note of bounds.notes ?? []) {
                expect(note.noteHeadBounds.x, label).toBeGreaterThanOrEqual(
                  bar.realBounds.x,
                );
                expect(
                  note.noteHeadBounds.x + note.noteHeadBounds.w,
                  label,
                ).toBeLessThanOrEqual(
                  bar.realBounds.x +
                    bar.realBounds.w -
                    (beat.voice.bar.index === 6 ? 9.54 : 1.44) * scale,
                );
                expect(note.noteHeadBounds.x, label).toBeLessThan(
                  bounds.onNotesX,
                );
                expect(
                  note.noteHeadBounds.x + note.noteHeadBounds.w,
                  label,
                ).toBeGreaterThan(bounds.onNotesX);
              }
              expect(bounds.realBounds.w, label).toBeGreaterThan(0);
              const original = baseline.renderer.boundsLookup!.findBeat(
                baseline.built.events[index].beat,
              )!;
              expect(
                bounds.notes?.map((note) => [
                  note.noteHeadBounds.w,
                  note.noteHeadBounds.h,
                ]),
                label,
              ).toEqual(
                original.notes?.map((note) => [
                  note.noteHeadBounds.w,
                  note.noteHeadBounds.h,
                ]),
              );
              if (beat.isRest) {
                const rest = symbols.find(
                  (symbol) =>
                    symbol.symbol >= 58595 &&
                    symbol.symbol <= 58599 &&
                    Math.abs(
                      (symbol.x + symbol.width / 2) * scale - bounds.onNotesX,
                    ) < 0.001,
                );
                expect(rest, label).toBeDefined();
                expect(rest!.x * scale, label).toBeGreaterThanOrEqual(
                  bar.realBounds.x,
                );
                expect(
                  (rest!.x + rest!.width) * scale,
                  label,
                ).toBeLessThanOrEqual(
                  bar.realBounds.x +
                    bar.realBounds.w -
                    (beat.voice.bar.index === 6 ? 9.54 : 1.44) * scale,
                );
              }
            }
            for (const bar of built.score.masterBars.slice(1))
              expect(
                renderer.boundsLookup!.findMasterBar(bar)!.realBounds.w,
              ).toBeCloseTo(4 * quarterWidth * scale, 5);
            expect(
              symbols.map(({ symbol, width, scale }) => [symbol, width, scale]),
            ).toEqual(
              baseline.symbols.map(({ symbol, width, scale }) => [
                symbol,
                width,
                scale,
              ]),
            );
            const ink = nativeSvgInk(svg);
            expect(
              ink.filter(
                ({ symbol }) =>
                  symbol >= model.MusicFontSymbol.NoteheadWhole &&
                  symbol <= model.MusicFontSymbol.NoteheadBlack,
              ),
            ).toHaveLength(
              input.events.filter((event) => event.notes.length).length,
            );
            expect(
              ink.filter(
                ({ symbol }) =>
                  symbol >= model.MusicFontSymbol.RestWhole &&
                  symbol <= model.MusicFontSymbol.Rest16th,
              ),
            ).toHaveLength(
              input.events.filter((event) => !event.notes.length).length,
            );
            expect(
              ink.map(({ symbol, width, height, scale }) => [
                symbol,
                width,
                height,
                scale,
              ]),
            ).toEqual(
              nativeSvgInk(baseline.svg).map(
                ({ symbol, width, height, scale }) => [
                  symbol,
                  width,
                  height,
                  scale,
                ],
              ),
            );
            // Include multi-symbol SVG runs (the tuplet number), actual font
            // side bearings and centered rest advances, beyond engine hit boxes.
            expect(
              ink.some(
                ({ symbol }) => symbol === model.MusicFontSymbol.Tuplet3,
              ),
            ).toBe(true);
            for (const glyph of ink.filter(({ symbol }) =>
              [
                model.MusicFontSymbol.NoteheadWhole,
                model.MusicFontSymbol.NoteheadHalf,
                model.MusicFontSymbol.NoteheadBlack,
                model.MusicFontSymbol.RestWhole,
                model.MusicFontSymbol.RestQuarter,
                model.MusicFontSymbol.Rest8th,
                model.MusicFontSymbol.Rest16th,
                model.MusicFontSymbol.Tuplet3,
              ].includes(symbol),
            )) {
              const bar = built.score.masterBars
                .map((bar) => renderer.boundsLookup!.findMasterBar(bar)!)
                .find(
                  ({ realBounds: bounds }) =>
                    glyph.x + glyph.width / 2 >= bounds.x &&
                    glyph.x + glyph.width / 2 < bounds.x + bounds.w,
                )!;
              const label = `${clef}/${keySignature}/${scale}/symbol${glyph.symbol}`;
              expect(bar, label).toBeDefined();
              expect(glyph.x, label).toBeGreaterThanOrEqual(bar.realBounds.x);
              expect(glyph.x + glyph.width, label).toBeLessThanOrEqual(
                bar.realBounds.x +
                  bar.realBounds.w -
                  (bar.index === 6 ? 9.54 : 1.44) * scale,
              );
            }
            const finalBar = renderer.boundsLookup!.findMasterBar(
              built.score.masterBars[6],
            )!.realBounds;
            const rectangles = [
              ...svg.matchAll(
                /<rect x="([\d.e-]+)" y="([\d.e-]+)" width="([\d.e-]+)" height="([\d.e-]+)"/g,
              ),
            ].map((match) => ({
              x: Number(match[1]),
              width: Number(match[3]),
              height: Number(match[4]),
            }));
            const finalLines = rectangles.filter(
              (rect) =>
                rect.x >= finalBar.x + finalBar.w - 10 * scale &&
                rect.height >= 36 * scale,
            );
            expect(finalLines).toHaveLength(2);
            expect(finalLines.map((line) => line.width)).toEqual([
              1.44 * scale,
              4.5 * scale,
            ]);
            expect(finalLines[0].x).toBeCloseTo(
              finalBar.x + finalBar.w - 9.54 * scale,
              5,
            );
            expect(svg).toContain("<path");
            // Filled closed paths are native beams; shortening spacing must not
            // discard any of the eighth, triplet or sixteenth beam groups.
            const beams = (value: string) =>
              value.match(/<path[^>]*d="[^"]*z[^>]*>/g) ?? [];
            expect(beams(svg).length).toBeGreaterThan(0);
            expect(beams(svg)).toHaveLength(beams(baseline.svg).length);
          } finally {
            renderer.destroy();
            baseline.renderer.destroy();
          }
        }
      }
    },
  );
});
