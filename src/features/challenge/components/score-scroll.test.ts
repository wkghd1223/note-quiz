import { describe, expect, it } from "vitest";
import type { NotationRenderResult } from "@/lib/notation/score";
import type {
  AttemptResult,
  NoteResult,
  PlaybackTransition,
} from "../domain/performance";
import {
  incorrectNoteColor,
  matchedNoteColor,
  scoreCursorPosition,
  scoreNoteColors,
  type ScoreCursorTarget,
} from "./score-scroll";

const target = (
  id: string,
  source: string,
  bar: number,
  start: number,
  end: number,
  visit = 1,
): ScoreCursorTarget => ({
  stageEventId: id,
  sourceEventId: source,
  sourceBarIndex: bar,
  startAudioSec: start,
  endAudioSec: end,
  visit,
  kind: "note",
});
const render: NotationRenderResult = {
  width: 700,
  height: 200,
  events: [
    { id: "a", x: 100, anchorX: 120, y: 30, width: 30, height: 40 },
    { id: "b", x: 220, anchorX: 240, y: 30, width: 30, height: 40 },
    { id: "c", x: 420, anchorX: 440, y: 30, width: 30, height: 40 },
  ],
  measures: [
    { index: 0, x: 0, y: 0, width: 360, height: 200 },
    { index: 1, x: 360, y: 0, width: 320, height: 200 },
  ],
};
const result = (
  notes: Array<Pick<NoteResult, "stageEventId" | "status">>,
): AttemptResult => ({
  scoringVersion: 1,
  score: 0,
  stars: 0,
  cleared: false,
  notePassRate: 0,
  unscorable: false,
  notes: notes.map((note) => ({
    ...note,
    eventId: null,
    pitchPass: false,
    durationPass: false,
    onsetPass: false,
    distinctAttackPass: false,
    reasons: [],
    pitchScore: 0,
    durationScore: 0,
    onsetScore: null,
  })),
  restViolations: [],
  breakdown: { pitch: 0, duration: 0, onset: null },
});
const repeat: PlaybackTransition = {
  startAudioSec: 4,
  endAudioSec: 5,
  fromBar: 0,
  toBar: 0,
  kind: "repeat",
};

describe("audio-clock projection onto a single engraved score", () => {
  it("paints live rests only after their input was actually settled", () => {
    const rest = { ...target("rest", "rest", 0, 1, 2), kind: "rest" as const };
    const pending = { ...result([]), settledRestIds: [] };
    expect(scoreNoteColors([rest], [], pending, 10, true)).toEqual({});
    const passed = { ...pending, settledRestIds: ["rest"] };
    expect(scoreNoteColors([rest], [], passed, 10, true)).toEqual({
      rest: matchedNoteColor,
    });
    const failed = { ...passed, restViolations: ["rest"] };
    expect(scoreNoteColors([rest], [], failed, 10, true)).toEqual({
      rest: incorrectNoteColor,
    });
  });
  it("aligns every onset with its actual note anchor and traverses bar boundaries continuously", () => {
    const targets = [
      target("a", "a", 0, 0, 2),
      target("b", "b", 0, 2, 4),
      target("c", "c", 1, 4, 8),
    ];
    expect(
      [0, 1, 2, 3, 4, 8].map(
        (time) => scoreCursorPosition(targets, [], render, time).x,
      ),
    ).toEqual([120, 180, 240, 340, 440, 680]);
    expect(scoreCursorPosition(targets, [], render, 8).barIndex).toBe(1);
    expect(scoreCursorPosition(targets, [], render, 1)).toEqual(
      scoreCursorPosition(targets, [], render, 1),
    );
  });
  it("requires explicit pre-roll and approaches the first engraved anchor continuously at zero", () => {
    const targets = [target("a", "a", 0, 0, 2), target("b", "b", 0, 2, 4)];
    expect(scoreCursorPosition(targets, [], render, -4).x).toBe(120);
    const positions = [4, 3, 2, 1, 0.35, 0.001, 0].map(
      (remainingSec) =>
        scoreCursorPosition(targets, [], render, 0, false, {
          remainingSec,
          durationSec: 4,
          baseElapsedSec: 0,
        }).x,
    );
    expect(positions).toEqual([-120, -60, 0, 60, 99, 119.94, 120]);
    // Score translation is playheadX - cursorX: increasing cursor positions
    // bring the first note from right to left onto the fixed play line.
    expect(scoreCursorPosition(targets, [], render, 0.01).x).toBeCloseTo(120.6);
    expect(positions.at(-2)).toBeCloseTo(120, 0);
  });
  it("approaches a resume target using its own spacing and exact audio-time anchor", () => {
    const targets = [
      target("a", "a", 0, 0, 2),
      target("b", "b", 0, 2, 4),
      target("c", "c", 1, 4, 8),
    ];
    const before = scoreCursorPosition(targets, [], render, 2, false, {
      remainingSec: 0.001,
      durationSec: 4,
      baseElapsedSec: 2,
    });
    expect(before.x).toBeCloseTo(239.9);
    const onset = scoreCursorPosition(targets, [], render, 2);
    expect(onset.x).toBe(240);
    expect(
      scoreCursorPosition(targets, [], render, 2, false, {
        remainingSec: 0,
        durationSec: 4,
        baseElapsedSec: 2,
      }),
    ).toEqual(onset);
    expect(scoreCursorPosition(targets, [], render, 2.01).x).toBeCloseTo(241);
  });
  it("retains the essential count-in approach with reduced motion and handles empty scores", () => {
    const targets = [target("a", "a", 0, 0, 2), target("b", "b", 0, 2, 4)];
    expect(
      scoreCursorPosition(targets, [], render, 0, true, {
        remainingSec: 0.001,
        durationSec: 4,
        baseElapsedSec: 0,
      }).x,
    ).toBeCloseTo(119.94);
    expect(scoreCursorPosition(targets, [], render, 0, true).x).toBe(120);
    expect(
      scoreCursorPosition([], [], render, 0, false, {
        remainingSec: 4,
        durationSec: 4,
        baseElapsedSec: 0,
      }),
    ).toEqual({ x: 0, barIndex: 0, rewinding: false });
  });
  it("finishes a held note before rewinding and reaches the return target exactly when scoring resumes", () => {
    const targets = [target("a1", "a", 0, 0, 4), target("a2", "a", 0, 5, 9, 2)];
    expect(scoreCursorPosition(targets, [repeat], render, 3.99).x).toBeCloseTo(
      359.4,
    );
    expect(scoreCursorPosition(targets, [repeat], render, 4)).toEqual({
      x: 360,
      barIndex: 0,
      rewinding: true,
    });
    expect(scoreCursorPosition(targets, [repeat], render, 4.5).x).toBe(240);
    expect(scoreCursorPosition(targets, [repeat], render, 5)).toEqual({
      x: 120,
      barIndex: 0,
      rewinding: false,
    });
  });
  it("reduced motion preserves essential clock projection while skipping decorative return animation", () => {
    const targets = [target("a1", "a", 0, 0, 4), target("a2", "a", 0, 5, 9, 2)];
    expect(scoreCursorPosition(targets, [repeat], render, 2, true).x).toBe(240);
    expect(scoreCursorPosition(targets, [repeat], render, 4.5, true)).toEqual({
      x: 120,
      barIndex: 0,
      rewinding: true,
    });
  });
  it("a forward coda jump does not scroll over skipped notes while the preceding note is held", () => {
    const targets = [target("a", "a", 0, 0, 4), target("c", "c", 3, 4, 8)];
    expect(scoreCursorPosition(targets, [], render, 3.5).x).toBe(330);
    expect(scoreCursorPosition(targets, [], render, 4).x).toBe(440);
  });
});

describe("native note colors belong to performed occurrences", () => {
  it("keeps first-pass feedback during return, then resets before the new pass can be judged", () => {
    const targets = [target("a1", "a", 0, 0, 4), target("a2", "a", 0, 5, 9, 2)];
    const firstPass = result([{ stageEventId: "a1", status: "passed" }]);
    expect(scoreNoteColors(targets, [repeat], firstPass, 4.5, false)).toEqual({
      a: matchedNoteColor,
    });
    expect(scoreNoteColors(targets, [repeat], firstPass, 5, false)).toEqual({});
    expect(
      scoreNoteColors(
        targets,
        [repeat],
        result([...firstPass.notes, { stageEventId: "a2", status: "failed" }]),
        Infinity,
        false,
      ),
    ).toEqual({ a: incorrectNoteColor });
  });
  it("clears upcoming bars of a repeated range rather than leaving previous green answers visible", () => {
    const targets = [
      target("a1", "a", 0, 0, 4),
      target("c1", "c", 1, 4, 8),
      target("a2", "a", 0, 9, 13, 2),
      target("c2", "c", 1, 13, 17, 2),
    ];
    const jump = { ...repeat, startAudioSec: 8, endAudioSec: 9, fromBar: 1 };
    const firstPass = result([
      { stageEventId: "a1", status: "passed" },
      { stageEventId: "c1", status: "passed" },
    ]);
    expect(scoreNoteColors(targets, [jump], firstPass, 8.5, false)).toEqual({
      a: matchedNoteColor,
      c: matchedNoteColor,
    });
    expect(scoreNoteColors(targets, [jump], firstPass, 9, false)).toEqual({});
  });
  it("missed or unscorable notes are red and future unjudged notes stay neutral", () => {
    const targets = [
      target("a", "a", 0, 0, 2),
      target("b", "b", 0, 2, 4),
      target("c", "c", 1, 4, 8),
    ];
    expect(
      scoreNoteColors(
        targets,
        [],
        result([
          { stageEventId: "a", status: "missed" },
          { stageEventId: "b", status: "unscorable" },
        ]),
        4,
        false,
      ),
    ).toEqual({ a: incorrectNoteColor, b: incorrectNoteColor });
  });
});
