import { describe, expect, it } from "vitest";
import { stages } from "../data/stages";
import { getInstrumentProfile, getScoringProfile } from "./instrument-profile";
import {
  buildPlaybackPlan,
  MAX_PLAYBACK_BARS,
  validatePlaybackNavigation,
} from "./playback-order";
import {
  buildPlaybackTimeline,
  buildScoreTimeline,
  filterPlaybackInput,
  playbackTransitionAt,
} from "./score-timeline";
import { scoreAttempt } from "./scoring";
import {
  validateStages,
  type BarNavigation,
  type StageDefinition,
} from "./stage";
import type { PerformanceEvent, TargetEvent } from "./performance";
const profile = getInstrumentProfile("touch-keyboard")!;
export function navigationStage(
  measures: number,
  barNavigation: BarNavigation[],
): StageDefinition {
  return {
    ...stages[0],
    measures,
    bpm: 60,
    barNavigation,
    events: Array.from({ length: measures }, (_, i) => ({
      id: `bar-${i}`,
      kind: "note",
      startBeat: i * 4,
      durationBeats: 4,
      writtenMidi: 60 + (i % 7),
      writtenSpelling: "C4",
    })),
  };
}
const order = (stage: StageDefinition) =>
  buildPlaybackPlan(stage).visits.map((visit) => visit.sourceBarIndex);
const performed = (
  target: TargetEvent,
  eventId = target.stageEventId,
): PerformanceEvent => ({
  eventId,
  inputMethod: "touch",
  onsetAudioSec: target.startAudioSec,
  offsetAudioSec: target.endAudioSec,
  observedMidi: target.targetConcertMidi,
  medianCents: 0,
  validPitchRatio: 1,
  confidence: 1,
  attackConfidence: 1,
});
describe("finite authored playback navigation", () => {
  it("plays a bounded ordinary repeat twice with one unscored beat before returning", () => {
    const stage = navigationStage(2, [
      { barIndex: 0, repeatStart: true },
      { barIndex: 1, repeatEnd: true },
    ]);
    const plan = buildPlaybackPlan(stage);
    expect(order(stage)).toEqual([0, 1, 0, 1]);
    expect(plan.visits.map((visit) => visit.visit)).toEqual([1, 1, 2, 2]);
    expect(plan.transitions).toEqual([
      { startBeat: 8, endBeat: 9, fromBar: 1, toBar: 0, kind: "repeat" },
    ]);
    expect(plan.durationBeats).toBe(17);
    const timeline = buildPlaybackTimeline(stage, profile, 10, 0.7);
    expect(timeline.transitions[0].startAudioSec).toBeCloseTo(10 + 8 / 0.7);
    expect(timeline.transitions[0].endAudioSec).toBeCloseTo(10 + 9 / 0.7);
    expect(timeline.durationSec).toBeCloseTo(17 / 0.7);
    expect(timeline.endAudioSec).toBeCloseTo(10 + 17 / 0.7);
    expect(
      new Set(timeline.targets.map((target) => target.stageEventId)).size,
    ).toBe(4);
    expect(timeline.targets.map((target) => target.sourceEventId)).toEqual([
      "bar-0",
      "bar-1",
      "bar-0",
      "bar-1",
    ]);
    expect(timeline.targets.map((target) => target.occurrenceIndex)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(
      timeline.targets.some(
        (target) =>
          target.startAudioSec < timeline.transitions[0].endAudioSec &&
          target.endAudioSec > timeline.transitions[0].startAudioSec,
      ),
    ).toBe(false);
  });
  it("repeatCount means total passes and an implicit repeat starts at bar zero", () => {
    expect(
      order(navigationStage(1, [{ barIndex: 0, repeatCount: 3 }])),
    ).toEqual([0, 0, 0]);
  });
  it("supports sequential nonnested repeats", () => {
    expect(
      order(
        navigationStage(3, [
          { barIndex: 0, repeatCount: 2 },
          { barIndex: 1, repeatStart: true },
          { barIndex: 2, repeatCount: 2 },
        ]),
      ),
    ).toEqual([0, 0, 1, 2, 1, 2]);
  });
  it("D.C. al Fine honors Fine only after the one-shot return", () => {
    const stage = navigationStage(3, [
      { barIndex: 0, directions: ["fine"] },
      { barIndex: 2, directions: ["daCapoAlFine"] },
    ]);
    expect(order(stage)).toEqual([0, 1, 2, 0]);
    expect(buildPlaybackPlan(stage).transitions[0].kind).toBe("daCapo");
  });
  it("D.S. al Fine returns to Segno, not the beginning", () => {
    const stage = navigationStage(4, [
      { barIndex: 1, directions: ["segno"] },
      { barIndex: 2, directions: ["fine"] },
      { barIndex: 3, directions: ["dalSegnoAlFine"] },
    ]);
    expect(order(stage)).toEqual([0, 1, 2, 3, 1, 2]);
    expect(buildPlaybackPlan(stage).transitions[0]).toMatchObject({
      fromBar: 3,
      toBar: 1,
      kind: "dalSegno",
    });
  });
  it.each(["daCapoAlCoda", "dalSegnoAlCoda"] as const)(
    "%s arms To Coda only after returning",
    (direction) => {
      const stage = navigationStage(6, [
        { barIndex: 1, directions: ["segno"] },
        { barIndex: 2, directions: ["toCoda"] },
        { barIndex: 4, directions: [direction] },
        { barIndex: 5, directions: ["coda"] },
      ]);
      expect(order(stage)).toEqual(
        direction === "daCapoAlCoda"
          ? [0, 1, 2, 3, 4, 0, 1, 2, 5]
          : [0, 1, 2, 3, 4, 1, 2, 5],
      );
      expect(buildPlaybackPlan(stage).transitions).toHaveLength(1); // Forward coda jump needs no rewind gap.
    },
  );
  it.each(["daCapo", "dalSegno"] as const)(
    "%s jumps only once and does not retake ordinary repeats",
    (direction) => {
      const stage = navigationStage(3, [
        { barIndex: 0, repeatStart: true, directions: ["segno"] },
        { barIndex: 1, repeatEnd: true },
        { barIndex: 2, directions: [direction] },
      ]);
      expect(order(stage)).toEqual([0, 1, 0, 1, 2, 0, 1, 2]);
      expect(
        buildPlaybackPlan(stage).transitions.map(
          (transition) => transition.kind,
        ),
      ).toEqual(["repeat", direction]);
    },
  );
  it.each([
    [[{ barIndex: 1, directions: ["dalSegno"] }], "missingSegno"],
    [[{ barIndex: 0, directions: ["toCoda"] }], "missingCoda"],
    [
      [{ barIndex: 1, directions: ["daCapoAlCoda"] }],
      "missingOrUnreachableCoda",
    ],
    [
      [{ barIndex: 1, directions: ["daCapoAlFine"] }],
      "missingOrUnreachableFine",
    ],
    [
      [
        { barIndex: 0, repeatStart: true },
        { barIndex: 1, repeatStart: true },
      ],
      "nestedRepeatsUnsupported",
    ],
    [[{ barIndex: 0, repeatStart: true }], "missingRepeatEnd"],
    [[{ barIndex: 0, repeatCount: 0 }], "invalidRepeatCount"],
    [[{ barIndex: 0, repeatCount: Infinity }], "invalidRepeatCount"],
    [[{ barIndex: 0, repeatCount: 9 }], "invalidRepeatCount"],
    [
      [
        { barIndex: 0, directions: ["daCapo"] },
        { barIndex: 1, directions: ["dalSegno"] },
      ],
      "multipleReturnInstructionsUnsupported",
    ],
    [[{ barIndex: 0, alternateEnding: 1 }], "unsupportedBarNavigationField"],
  ])(
    "rejects invalid or explicitly unsupported navigation %j",
    (navigation, error) => {
      const stage = navigationStage(2, navigation as BarNavigation[]);
      expect(validatePlaybackNavigation(stage)).toContain(error);
      expect(() => buildPlaybackPlan(stage)).toThrow(error);
      expect(validateStages([stage])).toContain(`${stage.id}:${error}`);
    },
  );
  it("caps performed bar expansion rather than permitting resource exhaustion", () => {
    const stage = navigationStage(MAX_PLAYBACK_BARS, [
      { barIndex: MAX_PLAYBACK_BARS - 1, repeatCount: 2 },
    ]);
    expect(validatePlaybackNavigation(stage)).toContain(
      "playbackExpansionLimit",
    );
  });
});
describe("performed occurrence gates and unscored transitions", () => {
  const repeated = () => navigationStage(1, [{ barIndex: 0, repeatCount: 2 }]);
  it("a correct first pass cannot answer the same written note on pass two", () => {
    const stage = repeated(),
      timeline = buildPlaybackTimeline(stage, profile, 0);
    const firstOnly = scoreAttempt(
      [performed(timeline.targets[0])],
      timeline.targets,
      getScoringProfile(stage, "touch-keyboard"),
    );
    expect(firstOnly.notes.map((note) => note.status)).toEqual([
      "passed",
      "missed",
    ]);
    expect(firstOnly.stars).toBe(0);
    const both = scoreAttempt(
      timeline.targets.map((target) => performed(target)),
      timeline.targets,
      getScoringProfile(stage, "touch-keyboard"),
    );
    expect(both.stars).toBe(3);
    expect(both.notes.map((note) => note.stageEventId)).toEqual(
      timeline.targets.map((target) => target.stageEventId),
    );
  });
  it("keeps mandatory pitch AND duration gates on each repeated occurrence", () => {
    const stage = repeated(),
      timeline = buildPlaybackTimeline(stage, profile, 0);
    for (const invalid of [
      { ...performed(timeline.targets[1]), observedMidi: 64 },
      { ...performed(timeline.targets[1]), offsetAudioSec: 6 },
    ]) {
      const result = scoreAttempt(
        [performed(timeline.targets[0]), invalid],
        timeline.targets,
        getScoringProfile(stage, "touch-keyboard"),
      );
      expect(result.notes[0].status).toBe("passed");
      expect(result.notes[1].status).toBe("failed");
      expect(result.stars).toBe(0);
    }
  });
  it("input started during rewind cannot sneak into the next target's early matching window", () => {
    const stage = repeated(),
      timeline = buildPlaybackTimeline(stage, profile, 0);
    const phantom = {
      ...performed(timeline.targets[1]),
      onsetAudioSec: 4.9,
      offsetAudioSec: 8.9,
    };
    const filtered = filterPlaybackInput(
      [performed(timeline.targets[0]), phantom],
      timeline.transitions,
    );
    expect(filtered).toHaveLength(1);
    expect(
      scoreAttempt(
        filtered,
        timeline.targets,
        getScoringProfile(stage, "touch-keyboard"),
      ).notes[1].status,
    ).toBe("missed");
    expect(playbackTransitionAt(timeline.transitions, 4)).not.toBeNull();
    expect(playbackTransitionAt(timeline.transitions, 5)).toBeNull();
    expect(
      filterPlaybackInput(
        [{ ...phantom, onsetAudioSec: 5.1 }],
        timeline.transitions,
        200,
      ),
    ).toEqual([]);
  });
  it("does not trim an overlong note that began before a rewind", () => {
    const stage = repeated(),
      timeline = buildPlaybackTimeline(stage, profile, 0);
    const overlong = { ...performed(timeline.targets[0]), offsetAudioSec: 5.5 };
    const filtered = filterPlaybackInput([overlong], timeline.transitions);
    expect(filtered).toEqual([overlong]);
    expect(
      scoreAttempt(
        filtered,
        timeline.targets,
        getScoringProfile(stage, "touch-keyboard"),
      ).notes[0].reasons,
    ).toContain("tooLong");
  });
  it.each(stages)(
    "$id no-navigation targets remain exactly the authored contract",
    (stage) => {
      const old = stage.events.map((event, index) => ({
        stageEventId: event.id,
        kind: event.kind,
        targetConcertMidi: event.kind === "note" ? event.writtenMidi! : null,
        startAudioSec: 10 + (event.startBeat * 60) / stage.bpm,
        endAudioSec:
          10 + ((event.startBeat + event.durationBeats) * 60) / stage.bpm,
        requiresDistinctAttack:
          stage.scoring.required.includes("rearticulation") &&
          index > 0 &&
          event.kind === "note" &&
          stage.events[index - 1].kind === "note" &&
          stage.events[index - 1].writtenMidi === event.writtenMidi,
      }));
      expect(buildScoreTimeline(stage, profile, 10)).toEqual(old);
      expect(buildPlaybackTimeline(stage, profile, 10).transitions).toEqual([]);
      expect(buildPlaybackTimeline(stage, profile, 10).endAudioSec).toBe(
        old.at(-1)!.endAudioSec,
      );
    },
  );
});
