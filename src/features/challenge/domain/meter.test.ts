import { describe, expect, it } from "vitest";
import { stages } from "../data/stages";
import { getInstrumentProfile } from "./instrument-profile";
import {
  buildPlaybackPlan,
  validatePlaybackNavigation,
} from "./playback-order";
import { buildPlaybackTimeline } from "./score-timeline";
import {
  beatsPerMeasure,
  validateStages,
  type ExerciseDefinition,
  type StageDefinition,
} from "./stage";

const exercise = (timeSignature: [number, number]): ExerciseDefinition => {
  const beats = beatsPerMeasure(timeSignature);
  return {
    ...stages[0],
    timeSignature,
    measures: 2,
    events: [0, 1].map((bar) => ({
      id: `n${bar}`,
      kind: "note",
      startBeat: bar * beats,
      durationBeats: beats,
      writtenMidi: 60,
      writtenSpelling: "C4",
    })),
  };
};
describe("quarter-note meter timeline", () => {
  it.each([
    [2, 4, 2],
    [3, 4, 3],
    [4, 4, 4],
    [6, 8, 3],
  ])("uses %i/%i as %i quarter-note beats", (n, d, beats) => {
    const source = exercise([n, d]);
    expect(beatsPerMeasure(source)).toBe(beats);
    const plan = buildPlaybackPlan(source);
    expect(plan.durationBeats).toBe(beats * 2);
    expect(
      plan.visits.map((visit) => [visit.startBeat, visit.endBeat]),
    ).toEqual([
      [0, beats],
      [beats, beats * 2],
    ]);
    for (const bpm of [40, 72, 180]) {
      const playback = buildPlaybackTimeline(
        { ...source, bpm },
        getInstrumentProfile("voice")!,
        10,
      );
      expect(playback.durationSec).toBeCloseTo((beats * 2 * 60) / bpm);
      expect(playback.targets[1].startAudioSec).toBeCloseTo(
        10 + (beats * 60) / bpm,
      );
      expect(playback.endAudioSec).toBeCloseTo(10 + (beats * 2 * 60) / bpm);
    }
  });
  it.each([
    [2, 4],
    [3, 4],
    [6, 8],
  ])(
    "preserves conditional repeats in %i/%i with bar-local targets",
    (n, d) => {
      const source = exercise([n, d]);
      source.bpm = 60;
      source.barNavigation = [
        { barIndex: 0, repeatStart: true },
        { barIndex: 1, repeatEnd: true },
      ];
      const beats = beatsPerMeasure(source);
      expect(validatePlaybackNavigation(source)).toEqual([]);
      const plan = buildPlaybackPlan(source);
      expect(plan.visits.map((visit) => visit.sourceBarIndex)).toEqual([
        0, 1, 0, 1,
      ]);
      expect(plan.durationBeats).toBe(beats * 4 + 1);
      const playback = buildPlaybackTimeline(
        source,
        getInstrumentProfile("voice")!,
        10,
      );
      expect(playback.targets.map((target) => target.startAudioSec)).toEqual([
        10,
        10 + beats,
        11 + beats * 2,
        11 + beats * 3,
      ]);
      expect(playback.targets.map((target) => target.sourceEventId)).toEqual([
        "n0",
        "n1",
        "n0",
        "n1",
      ]);
      expect(
        playback.targets.every(
          (target) => target.endAudioSec - target.startAudioSec === beats,
        ),
      ).toBe(true);
      source.events[0].durationBeats = beats + 0.5;
      expect(validatePlaybackNavigation(source)).toContain(
        "crossBarNavigationEventUnsupported",
      );
    },
  );
  it("keeps fixed curriculum validation constrained to its authored 4/4 meter", () => {
    expect(
      validateStages([
        { ...stages[0], timeSignature: [3, 4] } as StageDefinition,
      ]),
    ).toContain(`${stages[0].id}:meter`);
  });
  it.each([
    [0, 4],
    [3, 0],
    [3, 6],
    [NaN, 4],
    [2.5, 4],
  ])("rejects invalid meter %s/%s", (n, d) => {
    expect(() => beatsPerMeasure([n, d])).toThrow("invalidTimeSignature");
    expect(
      validatePlaybackNavigation({ ...stages[0], timeSignature: [n, d] }),
    ).toEqual(["invalidTimeSignature"]);
  });
});
