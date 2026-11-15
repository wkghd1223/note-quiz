import { describe, expect, it } from "vitest";
import { getScoringProfile } from "@/features/challenge/domain/instrument-profile";
import type {
  PerformanceEvent,
  TargetEvent,
} from "@/features/challenge/domain/performance";
import { scoreAttempt } from "@/features/challenge/domain/scoring";
import { generateMelody } from "./generator";
import { defaultMelodySettings } from "./settings";
import { liveResultTiming, visibleLiveResult } from "./live-result";

const profile = getScoringProfile(
  generateMelody(defaultMelodySettings, 1),
  "voice",
);
const targets: TargetEvent[] = [0, 1, 2].map((index) => ({
  stageEventId: `n${index}`,
  targetConcertMidi: 60,
  startAudioSec: index,
  endAudioSec: index + 1,
  kind: "note",
  requiresDistinctAttack: false,
}));
const event = (
  overrides: Partial<PerformanceEvent> = {},
): PerformanceEvent => ({
  eventId: "input",
  inputMethod: "microphone",
  onsetAudioSec: 0,
  offsetAudioSec: 1,
  observedMidi: 60,
  medianCents: 0,
  validPitchRatio: 1,
  confidence: 1,
  attackConfidence: 1,
  ...overrides,
});
const visible = (
  events: PerformanceEvent[],
  elapsed: number,
  heldDuration = 0,
) =>
  visibleLiveResult(
    scoreAttempt(events, targets, profile),
    liveResultTiming(targets, events),
    elapsed,
    heldDuration,
  )!;

describe("live judgment visibility independent of scoring", () => {
  it("reveals a matched judgment at its target end, never early", () => {
    expect(visible([event()], 0.999).notes).toEqual([]);
    expect(
      visible([event()], 1).notes.map((note) => note.stageEventId),
    ).toEqual(["n0"]);
  });

  it("waits the existing 450ms for a missing input and keeps held sounds pending", () => {
    expect(visible([], 1.449).notes).toEqual([]);
    expect(visible([], 1.45).notes[0].status).toBe("missed");
    expect(visible([], 4, 2).notes).toEqual([]);
    expect(visible([], 4).notes).toHaveLength(3);
  });

  it("a later onset releases earlier misses even while held, but not at the same instant", () => {
    expect(
      visible([event({ onsetAudioSec: 1, offsetAudioSec: 2 })], 1, 1).notes,
    ).toEqual([]);
    expect(
      visible([event({ onsetAudioSec: 1.01, offsetAudioSec: 2 })], 1.1, 1)
        .notes[0],
    ).toMatchObject({
      stageEventId: "n0",
      status: "missed",
    });
  });

  it("accepts a late completed input after previously showing a miss", () => {
    expect(visible([], 1.5).notes[0].status).toBe("missed");
    expect(visible([event()], 1.5).notes[0].status).toBe("passed");
  });

  it("preserves open-input unscorable feedback and leaves all score fields untouched", () => {
    const events = [event({ offsetAudioSec: null })];
    const result = scoreAttempt(events, targets, profile);
    const snapshot = structuredClone(result);
    const filtered = visibleLiveResult(
      result,
      liveResultTiming(targets, events),
      1,
      1,
    )!;
    expect(filtered.notes[0].status).toBe("unscorable");
    expect({ ...filtered, notes: result.notes }).toEqual(result);
    expect(result).toEqual(snapshot);
  });

  it("uses the latest onset even when input arrives out of order", () => {
    const events = [event({ onsetAudioSec: 2.1, offsetAudioSec: 3 }), event()];
    expect(
      visible(events, 2.2, 1).notes.map((note) => note.stageEventId),
    ).toEqual(["n0", "n1"]);
  });

  it("does not let invalid NaN onsets suppress later valid input", () => {
    const events = [
      event({ onsetAudioSec: NaN }),
      event({ onsetAudioSec: 2.1, offsetAudioSec: 3 }),
    ];
    expect(visible(events, 1.1, 1).notes[0].stageEventId).toBe("n0");
  });

  it("clears inactive results and can rewind the display without mutating evaluation", () => {
    const result = scoreAttempt([], targets, profile);
    const timing = liveResultTiming(targets, []);
    expect(visibleLiveResult(null, timing, 4, 0)).toBeNull();
    expect(visibleLiveResult(result, timing, 4, 0)?.notes).toHaveLength(3);
    expect(visibleLiveResult(result, timing, 0, 0)?.notes).toEqual([]);
    expect(result.notes).toHaveLength(3);
  });
});
