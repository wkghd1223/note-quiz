import { describe, it, expect } from "vitest";
import { getStage } from "../data/stages";
import { getInstrumentProfile, getScoringProfile } from "./instrument-profile";
import { buildScoreTimeline } from "./score-timeline";
import { scoreAttempt } from "./scoring";
import { matchEvents } from "./matching";
import type { PerformanceEvent, TargetEvent } from "./performance";

const target = (
  midi = 60,
  start = 0,
  duration = 2,
  id = "n1",
  distinct = false,
): TargetEvent => ({
  stageEventId: id,
  targetConcertMidi: midi,
  startAudioSec: start,
  endAudioSec: start + duration,
  kind: "note",
  requiresDistinctAttack: distinct,
});
const event = (
  overrides: Partial<PerformanceEvent> = {},
): PerformanceEvent => ({
  eventId: "p1",
  inputMethod: "touch",
  onsetAudioSec: 0,
  offsetAudioSec: 2,
  observedMidi: 60,
  medianCents: 0,
  validPitchRatio: 1,
  confidence: 1,
  attackConfidence: 1,
  ...overrides,
});
const easy = getScoringProfile(getStage("w2-s1")!, "touch-keyboard-v1");
const normal = getScoringProfile(getStage("w3-s1")!, "touch-keyboard-v1");

describe("16 scoring oracles", () => {
  it("S01: 261.63Hz C4 at 2 beats passes pitch AND duration", () => {
    const cents = 1200 * Math.log2(261.63 / (440 * 2 ** ((60 - 69) / 12)));
    const result = scoreAttempt(
      [event({ medianCents: cents })],
      [target()],
      easy,
    );
    expect(result.notes[0]).toMatchObject({
      pitchPass: true,
      durationPass: true,
      status: "passed",
    });
    expect(result.stars).toBe(3);
  });
  it.each([
    ["S02", 61],
    ["S03", 72],
  ])("%s: semitone and octave errors never pass", (_, midi) => {
    const result = scoreAttempt(
      [event({ observedMidi: midi })],
      [target()],
      normal,
    );
    expect(result.notes[0].pitchPass).toBe(false);
    expect(result.cleared).toBe(false);
  });
  it("S04: written Db4 and sounding C#4 use the same concert pitch", () => {
    const stage = structuredClone(getStage("w2-s1")!);
    stage.events = [
      {
        id: "db",
        kind: "note",
        writtenMidi: 61,
        writtenSpelling: "Db4",
        startBeat: 0,
        durationBeats: 2,
      },
    ];
    const targets = buildScoreTimeline(
      stage,
      getInstrumentProfile("voice")!,
      0,
    );
    expect(
      scoreAttempt([event({ observedMidi: 61 })], targets, easy).notes[0]
        .pitchPass,
    ).toBe(true);
    expect(stage.events[0].writtenSpelling).toBe("Db4");
  });
  it.each([
    ["S05", 0.5, "tooShort"],
    ["S06", 3, "tooLong"],
  ])("%s: wrong duration is mandatory", (_, duration, reason) => {
    const result = scoreAttempt(
      [event({ offsetAudioSec: duration as number })],
      [target()],
      easy,
    );
    expect(result.notes[0].reasons).toContain(reason);
    expect(result.stars).toBe(0);
  });
  it.each([
    ["S07", 0.2, false],
    ["S08", 0.08, true],
  ])("%s: onset threshold remains independent", (_, late, pass) => {
    const result = scoreAttempt(
      [
        event({
          onsetAudioSec: late as number,
          offsetAudioSec: 2 + (late as number),
        }),
      ],
      [target()],
      normal,
    );
    expect(result.notes[0].onsetPass).toBe(pass);
    expect(result.notes[0].status === "passed").toBe(pass);
  });
  it("S09: one sustained C4 cannot satisfy two distinct attacks", () => {
    const result = scoreAttempt(
      [event()],
      [target(60, 0, 1), target(60, 1, 1, "n2", true)],
      normal,
    );
    expect(result.notes[1].reasons).toContain("missingAttack");
    expect(result.notes[1].eventId).toBeNull();
    expect(result.cleared).toBe(false);
  });
  it("S10: two notes pass with unique assignments", () => {
    const result = scoreAttempt(
      [
        event({ offsetAudioSec: 1 }),
        event({
          eventId: "p2",
          onsetAudioSec: 1,
          offsetAudioSec: 2,
          observedMidi: 62,
        }),
      ],
      [target(60, 0, 1), target(62, 1, 1, "n2")],
      normal,
    );
    expect(result.notes.map((n) => n.status)).toEqual(["passed", "passed"]);
    expect(new Set(result.notes.map((n) => n.eventId)).size).toBe(2);
  });
  it("S11: continuous playing during required rest blocks stars", () => {
    const profile = {
      ...normal,
      required: [...normal.required, "rest" as const],
    };
    const result = scoreAttempt(
      [
        event({ offsetAudioSec: 1 }),
        event({ eventId: "extra", onsetAudioSec: 1.1, offsetAudioSec: 1.5 }),
      ],
      [
        target(60, 0, 1),
        { ...target(60, 1, 1, "rest"), kind: "rest", targetConcertMidi: null },
      ],
      profile,
    );
    expect(result.notes[0].status).toBe("passed");
    expect(result.restViolations).toEqual(["rest"]);
    expect(result.stars).toBe(0);
  });
  it("S12: noise is not a successful input", () => {
    const result = scoreAttempt(
      [event({ observedMidi: null, medianCents: null, confidence: 0.1 })],
      [target()],
      easy,
    );
    expect(result.unscorable).toBe(true);
    expect(result.notes[0].status).toBe("unscorable");
    expect(result.stars).toBe(0);
  });
  it("S13: confident 2x harmonic is an octave failure", () => {
    const result = scoreAttempt(
      [event({ observedMidi: 72, confidence: 0.95 })],
      [target()],
      easy,
    );
    expect(result.notes[0].pitchPass).toBe(false);
  });
  it("S14: one event spanning a short dropout remains a single duration", () => {
    const pitchSamples = Array.from({ length: 10 }, (_, i) => ({
      audioTimeSec: i * 0.2,
      midi: i === 5 ? null : 60,
      cents: i === 5 ? null : 0,
      confidence: i === 5 ? 0 : 1,
    }));
    const result = scoreAttempt([event({ pitchSamples })], [target()], normal);
    expect(result.notes[0].status).toBe("passed");
    expect(result.notes[0].pitchScore).toBe(90);
  });
  it("S16: repeated identical inputs have byte-identical result JSON", () => {
    const a = scoreAttempt([event()], [target()], normal),
      b = scoreAttempt([event()], [target()], normal);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
describe("matching and input safety", () => {
  it("missed first target does not consume the later correct event", () => {
    const matches = matchEvents(
      [event({ onsetAudioSec: 1, offsetAudioSec: 2, observedMidi: 62 })],
      [target(60, 0, 1), target(62, 1, 1, "n2")],
    );
    expect([...matches.keys()]).toEqual(["n2"]);
  });
  it("overlapping candidate windows choose global monotone cost, not greedy order", () => {
    const targets = [target(60, 0, 1), target(62, 0.7, 1, "n2")];
    const first = event({
      onsetAudioSec: 0.35,
      offsetAudioSec: 1.35,
      observedMidi: 62,
    });
    expect(matchEvents([first], targets).get("n2")?.eventId).toBe("p1");
  });
  it("repeated event IDs are not reused", () => {
    const result = scoreAttempt(
      [event({ offsetAudioSec: 1 }), event({ onsetAudioSec: 1 })],
      [target(60, 0, 1), target(60, 1, 1, "n2")],
      normal,
    );
    expect(result.notes.filter((n) => n.eventId)).toHaveLength(1);
  });
  it("sample pitch ratio is target-relative and includes null/low-confidence frames", () => {
    const samples = Array.from({ length: 10 }, (_, i) => ({
      audioTimeSec: i * 0.2,
      midi: i < 6 ? 60 : null,
      cents: i < 6 ? 0 : null,
      confidence: i < 6 ? 1 : 0,
    }));
    const result = scoreAttempt(
      [event({ pitchSamples: samples })],
      [target()],
      normal,
    );
    expect(result.notes[0].pitchScore).toBe(60);
    expect(result.notes[0].pitchPass).toBe(false);
  });
  it.each([NaN, Infinity, -Infinity])(
    "rejects invalid numeric observations %s",
    (n) => {
      const result = scoreAttempt(
        [event({ confidence: n })],
        [target()],
        normal,
      );
      expect(result.unscorable).toBe(true);
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.stars).toBe(0);
    },
  );
  it("unclosed event cannot receive duration credit", () => {
    const result = scoreAttempt(
      [event({ offsetAudioSec: null })],
      [target()],
      easy,
    );
    expect(result.unscorable).toBe(true);
    expect(result.notes[0].durationPass).toBe(false);
  });
  it("unclosed extra sound during a rest cannot be silently ignored", () => {
    const profile = {
      ...normal,
      required: [...normal.required, "rest" as const],
    };
    const result = scoreAttempt(
      [
        event({ offsetAudioSec: 1 }),
        event({ eventId: "extra", onsetAudioSec: 1.1, offsetAudioSec: null }),
      ],
      [
        target(60, 0, 1),
        { ...target(60, 1, 1, "rest"), kind: "rest", targetConcertMidi: null },
      ],
      profile,
    );
    expect(result.restViolations).toEqual(["rest"]);
    expect(result.stars).toBe(0);
  });
  it("World 1 still requires duration", () => {
    const result = scoreAttempt(
      [event({ offsetAudioSec: 0.1 })],
      [target()],
      getScoringProfile(getStage("w1-s1")!, "touch-keyboard-v1"),
    );
    expect(result.notes[0].durationPass).toBe(false);
    expect(result.stars).toBe(0);
  });
  it("unsupported decay profile cannot obtain free duration or stars", () => {
    const result = scoreAttempt(
      [event()],
      [target()],
      getScoringProfile(getStage("w1-s1")!, "piano-mic"),
    );
    expect(result.unscorable).toBe(true);
    expect(result.score).toBe(0);
    expect(result.stars).toBe(0);
  });
  it("onset offset is applied once, not to duration", () => {
    const result = scoreAttempt(
      [event({ onsetAudioSec: 0.2, offsetAudioSec: 2.2 })],
      [target()],
      normal,
      200,
    );
    expect(result.notes[0]).toMatchObject({
      status: "passed",
      durationPass: true,
      onsetPass: true,
    });
  });
  it("nonfinite profile thresholds cannot create successes", () => {
    expect(
      scoreAttempt([event()], [target()], {
        ...normal,
        durationToleranceRatio: Infinity,
      }).stars,
    ).toBe(0);
  });
});
