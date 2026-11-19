import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareScore } from "@/features/score-import/timeline";
import { stubScoreDocument } from "@/test/score-document";
import { createMelody } from "./generator";
import { editableMelody } from "./editable-score";
import { defaultMelodySettings } from "./settings";

afterEach(() => vi.unstubAllGlobals());

describe("editing a generated melody", () => {
  it("keeps compound meter, concert pitches, rests, triplets, minor key and the original playback grid", () => {
    stubScoreDocument();
    const result = createMelody(
      {
        ...defaultMelodySettings,
        clef: "alto",
        tonalityId: "Eb-minor",
        progressionId: "minor-basic",
        minMidi: 48,
        maxMidi: 84,
        durations: [0.25, 0.5, 1],
        triplets: true,
        dotted: true,
        bpm: 98,
        timeSignature: [6, 8],
      },
      10,
    );
    if (!result.ok) throw Error(result.issue.code);
    const score = editableMelody(result, "Melody");
    const lane = score.lanes[0];
    const plan = prepareScore(score, lane.id, {
      fromBar: 0,
      toBar: 7,
      semitones: 0,
      speed: 1,
      repeats: true,
    });
    expect(score.issues).toEqual([]);
    expect(lane.bars).toHaveLength(8);
    expect(lane.bars[0]).toMatchObject({
      clef: { sign: "C", line: 3 },
      keyMode: "minor",
      fifths: -6,
      meter: { beats: 6, beatType: 8 },
    });
    expect(plan.sourceBpm).toBe(98);
    const events = lane.bars.flatMap((bar) =>
      bar.events.map((event) => ({
        start: 3 * bar.index + event.start,
        duration: event.duration,
        midi: event.heads[0]?.midi,
      })),
    );
    expect(events).toHaveLength(result.exercise.events.length);
    result.exercise.events.forEach((source, index) => {
      expect(events[index].start).toBeCloseTo(source.startBeat, 8);
      expect(events[index].duration).toBeCloseTo(source.durationBeats, 8);
      expect(events[index].midi).toBe(source.writtenMidi);
    });
    expect(
      lane.bars.every((bar) =>
        Array.from(bar.source.children).some(
          (el) => el.localName === "harmony",
        ),
      ),
    ).toBe(true);
  });
});
