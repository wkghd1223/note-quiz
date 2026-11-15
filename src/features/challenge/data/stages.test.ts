import { describe, it, expect } from "vitest";
import { stages, getStage } from "./stages";
import { worlds } from "./worlds";
import { validateStages } from "../domain/stage";
import {
  instrumentProfiles,
  getInstrumentProfile,
  supportsStage,
  concertMidi,
  getScoringProfile,
} from "../domain/instrument-profile";
import { scoreAttempt } from "../domain/scoring";
import {
  beatToSeconds,
  buildScoreTimeline,
  sampleTimeSec,
} from "../domain/score-timeline";

const patterns = [
  "60:4",
  "60:2,62:2",
  "60:2,62:1,64:1",
  "64:2,67:2",
  "67:1,64:1,62:1,60:1",
  "60:2,62:2,64:2,67:2",
  "60:2,62:2",
  "60:1,62:1,64:1,67:1",
  "60:2,62:1,64:1",
  "67:4",
  "64:1,62:1,60:2",
  "60:4,62:2,64:1,67:1",
  "60:1,R:3",
  "60:1,62:1,64:1,67:1",
  "60:1,60:1,62:2",
  "R:2,64:2",
  "62:1,64:1,67:2",
  "60:1,60:1,R:2,64:2,67:2",
  "60:1,62:1,64:1,67:1",
  "60:1,60:1,62:1,64:1",
  "60:1,R:1,64:1,67:1",
  "60:1,62:1,64:2,67:1,64:1,60:2",
  "60:2,R:1,62:1,64:1,67:1,64:2",
  "60:1,62:1,64:1,R:1,67:1,64:1,62:1,60:1",
];
describe("24 authored educational stages", () => {
  it("has exactly four worlds and six stages each, with valid acyclic prerequisites", () => {
    expect(stages).toHaveLength(24);
    expect(worlds).toHaveLength(4);
    worlds.forEach((w) =>
      expect(stages.filter((s) => s.world === w.number)).toHaveLength(6),
    );
    expect(validateStages(stages)).toEqual([]);
  });
  it.each(stages.map((stage, i) => [stage.id, stage, patterns[i]] as const))(
    "%s freezes pitch/rhythm intent and complete timeline",
    (_, stage, pattern) => {
      expect(
        stage.events
          .map((e) => `${e.writtenMidi ?? "R"}:${e.durationBeats}`)
          .join(","),
      ).toBe(pattern);
      expect(stage.events[0].startBeat).toBe(0);
      expect(
        stage.events.at(-1)!.startBeat + stage.events.at(-1)!.durationBeats,
      ).toBe(stage.measures * 4);
      expect(stage.scoring.required).toEqual(
        expect.arrayContaining(["pitch", "duration"]),
      );
      expect(
        stage.events
          .filter((e) => e.kind === "note")
          .every((e) => e.writtenMidi! >= 60 && e.writtenMidi! <= 67),
      ).toBe(true);
      expect(supportsStage(stage, getInstrumentProfile("voice")!)).toBe(true);
      expect(
        supportsStage(stage, getInstrumentProfile("touch-keyboard")!),
      ).toBe(true);
    },
  );
  it("W4 final stage has seven notes plus a rest; longer phrase has six notes", () => {
    expect(
      getStage("w4-s6")!.events.filter((e) => e.kind === "note"),
    ).toHaveLength(7);
    expect(getStage("w4-s4")!.events).toHaveLength(6);
  });
  it.each(stages)(
    "$id exact authored performance earns three stars",
    (stage) => {
      const targets = buildScoreTimeline(
        stage,
        getInstrumentProfile("touch-keyboard")!,
        0,
      );
      const input = targets
        .filter((t) => t.kind === "note")
        .map((t) => ({
          eventId: `performed-${t.stageEventId}`,
          inputMethod: "touch" as const,
          onsetAudioSec: t.startAudioSec,
          offsetAudioSec: t.endAudioSec,
          observedMidi: t.targetConcertMidi,
          medianCents: 0,
          validPitchRatio: 1,
          confidence: 1,
          attackConfidence: 1,
        }));
      expect(
        scoreAttempt(input, targets, getScoringProfile(stage, "touch-keyboard"))
          .stars,
      ).toBe(3);
    },
  );
  it("initial timing lesson rest is covered but deliberately unscored", () => {
    expect(getStage("w3-s1")!.events[1].kind).toBe("rest");
    expect(getStage("w3-s1")!.scoring.required).not.toContain("rest");
  });
  it("rejects gaps, overlap, missing and cyclic prerequisites, duplicate IDs", () => {
    const copy = structuredClone(stages);
    copy[0].events[0].startBeat = 0.5;
    copy[0].prerequisites = [copy[1].id];
    copy[2].prerequisites = ["absent"];
    copy[3].events[1].id = copy[3].events[0].id;
    const errors = validateStages(copy);
    expect(errors).toEqual(
      expect.arrayContaining([
        "w1-s1:timelineCoverage",
        "w1-s1:prerequisiteCycle",
        "w1-s3:missingPrerequisite",
        "w1-s4:duplicateEventId",
      ]),
    );
  });
});
describe("capabilities and audio clock", () => {
  it("decaying and percussion microphones are not official pitched-duration input", () => {
    for (const id of ["piano-mic", "guitar-mic", "percussion-mic"])
      expect(supportsStage(stages[0], getInstrumentProfile(id)!)).toBe(false);
    expect(
      supportsStage(stages[0], getInstrumentProfile("voice")!, "touch"),
    ).toBe(false);
  });
  it("transposition separates written and sounding pitch without enabling untested instruments", () => {
    const bb = { ...instrumentProfiles[0], concertTransposeSemitones: -2 };
    expect(concertMidi(60, bb)).toBe(58);
    expect(supportsStage(stages[0], bb)).toBe(false);
  });
  it.each([60, 80, 120])(
    "beat timeline at BPM %s uses seconds, not wall clock",
    (bpm) => {
      expect(beatToSeconds(4, bpm)).toBe(240 / bpm);
      const stage = { ...stages[0], bpm };
      expect(
        buildScoreTimeline(stage, instrumentProfiles[0], 10)[0].endAudioSec,
      ).toBe(10 + 240 / bpm);
    },
  );
  it.each([44100, 48000, 96000])(
    "sample clock follows actual sampleRate %s",
    (rate) => {
      expect(sampleTimeSec(rate * 2, rate, 7)).toBe(9);
    },
  );
  it.each([NaN, Infinity, 0, 7999, 192001])(
    "invalid sampleRate %s is rejected",
    (rate) => {
      expect(() => sampleTimeSec(1, rate)).toThrow("invalidSampleClock");
    },
  );
  it("fixed rehearsal presets are explicit and do not mutate original BPM", () => {
    expect(
      buildScoreTimeline(stages[0], instrumentProfiles[0], 0, 0.7)[0]
        .endAudioSec,
    ).toBeCloseTo(4 / 0.7);
    expect(() =>
      buildScoreTimeline(stages[0], instrumentProfiles[0], 0, 0.8),
    ).toThrow();
    expect(stages[0].bpm).toBe(60);
  });
});
