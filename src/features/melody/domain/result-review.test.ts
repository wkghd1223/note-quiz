import { describe, expect, it } from "vitest";
import type {
  AttemptResult,
  NoteResult,
} from "@/features/challenge/domain/performance";
import { getStage } from "@/features/challenge/data/stages";
import { getInstrumentProfile } from "@/features/challenge/domain/instrument-profile";
import { buildPlaybackTimeline } from "@/features/challenge/domain/score-timeline";
import {
  melodyReviewEvents,
  reviewReasons,
  reviewEventAt,
  reviewEventBounds,
  reviewPointerMoved,
} from "./result-review";

const note: NoteResult = {
  stageEventId: "a",
  eventId: "input",
  status: "failed",
  pitchPass: false,
  durationPass: false,
  onsetPass: false,
  distinctAttackPass: true,
  reasons: ["late", "tooShort", "wrongPitch", "noSignal"],
  pitchScore: 0,
  durationScore: 20,
  onsetScore: 0,
};
const result: AttemptResult = {
  scoringVersion: 1,
  score: 0,
  stars: 0,
  cleared: false,
  notePassRate: 0,
  unscorable: false,
  notes: [note],
  restViolations: [],
  breakdown: { pitch: 0, duration: 0, onset: 0 },
};

describe("immutable result explanations", () => {
  it("prioritizes input then pitch evidence and limits to two distinct existing reasons", () => {
    const snapshot = JSON.stringify(note);
    expect(reviewReasons(note)).toEqual(["noSignal", "wrongPitch"]);
    expect(JSON.stringify(note)).toBe(snapshot);
    expect(
      reviewReasons({
        ...note,
        reasons: ["late", "tooShort", "tooShort"],
        pitchPass: true,
      }),
    ).toEqual(["pitchCorrectTooShort", "late"]);
    expect(
      reviewReasons({ ...note, reasons: ["tooLong"], pitchPass: true }),
    ).toEqual(["pitchCorrectTooLong"]);
  });
  it("explains missing/unscorable status without claiming the learner deliberately omitted a note", () => {
    expect(reviewReasons({ ...note, status: "missed", reasons: [] })).toEqual([
      "missed",
    ]);
    expect(
      reviewReasons({
        ...note,
        status: "unscorable",
        reasons: ["unsupportedInput"],
      }),
    ).toEqual(["unsupportedInput", "noSignal"]);
    expect(
      reviewReasons({
        ...note,
        reasons: ["wrongPitch", "missingAttack", "early"],
      }),
    ).toEqual(["missingAttack", "wrongPitch"]);
  });
  it("selects only failed notes and violated rests, using occurrence identity and within-bar ordinal", () => {
    const stage = {
      ...getStage("w1-s2")!,
      barNavigation: [{ barIndex: 0, repeatCount: 2 }],
    };
    const targets = buildPlaybackTimeline(
      stage,
      getInstrumentProfile("voice")!,
      0,
    ).targets;
    const historical = {
      ...result,
      notes: targets
        .filter((target) => target.kind === "note")
        .map((target, index) => ({
          ...note,
          stageEventId: target.stageEventId,
          status: index === 0 ? ("passed" as const) : ("failed" as const),
        })),
    };
    const before = JSON.stringify(historical);
    const entries = melodyReviewEvents(stage, targets, historical);
    expect(entries).toHaveLength(historical.notes.length - 1);
    expect(entries[0]).toMatchObject({
      stageEventId: targets[1].stageEventId,
      sourceEventId: targets[1].sourceEventId,
      barIndex: 0,
      ordinal: 2,
      name: "D4",
    });
    expect(entries[1].stageEventId).not.toBe(entries[0].stageEventId);
    expect(JSON.stringify(historical)).toBe(before);
    const rests = {
      ...stage,
      events: [
        { id: "rest", kind: "rest" as const, startBeat: 0, durationBeats: 4 },
      ],
      barNavigation: undefined,
    };
    const restTargets = buildPlaybackTimeline(
      rests,
      getInstrumentProfile("voice")!,
      0,
    ).targets;
    expect(
      melodyReviewEvents(rests, restTargets, {
        ...result,
        notes: [],
        restViolations: ["rest"],
      }),
    ).toEqual([
      {
        stageEventId: "rest",
        sourceEventId: "rest",
        barIndex: 0,
        ordinal: 1,
        name: null,
        reasons: ["restViolation"],
      },
    ]);
    expect(
      melodyReviewEvents(rests, restTargets, {
        ...result,
        notes: [],
        restViolations: [],
      }),
    ).toEqual([]);
    expect(melodyReviewEvents(stage, targets, null)).toEqual([]);
  });
});
describe("score review selection geometry", () => {
  const render = {
    width: 320,
    height: 176,
    events: [
      { id: "a", x: 103.5, y: 42.25, width: 12, height: 18 },
      { id: "b", x: 120, y: 42.25, width: 12, height: 18 },
    ],
  };
  const events = [
    { stageEventId: "visit-a", sourceEventId: "a" },
    { stageEventId: "visit-b", sourceEventId: "b" },
  ];
  it("adds only the chord band's 24px to projected bounds, including a scrolled rail", () => {
    expect(reviewEventBounds(render, events[0], 24)).toMatchObject({
      x: 103.5,
      y: 66.25,
      width: 12,
      height: 18,
    });
    const railLeft = -90;
    expect(reviewEventAt(events, render, 20 - railLeft, 70, 24)).toBe(
      "visit-a",
    );
    expect(reviewEventAt(events, render, 125, 70, 24)).toBe("visit-b");
    expect(reviewEventAt(events, render, 117, 70, 24)).toBeNull(); // no overlapping touch boxes
    expect(reviewEventAt(events, render, 110, 42, 24)).toBeNull();
    expect(reviewEventAt(events, null, 110, 70, 24)).toBeNull();
  });
  it("rejects drag, scrolling, and drag-return gestures while keeping taps", () => {
    const start = { id: 1, x: 100, y: 30, scrollLeft: 90, moved: false };
    expect(reviewPointerMoved(start, 103, 32, 90)).toBe(false);
    expect(reviewPointerMoved(start, 112, 30, 90)).toBe(true);
    expect(reviewPointerMoved(start, 100, 30, 99)).toBe(true);
    expect(reviewPointerMoved({ ...start, moved: true }, 100, 30, 90)).toBe(
      true,
    );
  });
});
