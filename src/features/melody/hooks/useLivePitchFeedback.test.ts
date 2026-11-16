import { beforeEach, describe, expect, it, vi } from "vitest";
import { getScoringProfile } from "@/features/challenge/domain/instrument-profile";
import { generateMelody } from "../domain/generator";
import { defaultMelodySettings } from "../domain/settings";
import type {
  LivePitchFeedbackInput,
  ProvisionalPitchFeedback,
} from "../domain/live-feedback";
import { useLivePitchFeedback } from "./useLivePitchFeedback";

const harness = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>,
  refIndex: 0,
  effects: [] as Array<() => void>,
  feedback: null as ProvisionalPitchFeedback | null,
  updates: [] as Array<ProvisionalPitchFeedback | null>,
}));
// Real state machine; this Node harness counts published state updates, not DOM commits.
vi.mock("react", () => ({
  useRef: (initial: unknown) =>
    (harness.refs[harness.refIndex++] ??= { current: initial }),
  useState: () => [
    harness.feedback,
    (next: ProvisionalPitchFeedback | null) => {
      harness.feedback = next;
      harness.updates.push(next);
    },
  ],
  useEffect: (effect: () => void) => harness.effects.push(effect),
}));

const target = {
  stageEventId: "note-1",
  sourceEventId: "note-1",
  kind: "note" as const,
  startAudioSec: 0,
  endAudioSec: 4,
  targetConcertMidi: 60,
  requiresDistinctAttack: false,
};
const input: LivePitchFeedbackInput = {
  target,
  profile: getScoringProfile(generateMelody(defaultMelodySettings, 1), "voice"),
  elapsedSec: 1,
  enabled: true,
  frame: null,
};
const frame = (time: number) => ({
  audioTimeSec: time,
  streamSampleIndex: Math.round(time * 48000),
  detectedHz: 261.625565,
  rms: 0.1,
  confidence: 0.99,
  isVoiced: true,
});
function FeedbackProbe(next: Partial<LivePitchFeedbackInput> = {}, token = 1) {
  harness.refIndex = 0;
  const feedback = useLivePitchFeedback({ ...input, ...next }, token);
  for (const effect of harness.effects.splice(0)) effect();
  return feedback;
}
function confirm() {
  FeedbackProbe({ frame: frame(20), elapsedSec: 1 });
  FeedbackProbe({ frame: frame(20.05), elapsedSec: 1.05 });
  expect(harness.feedback).toEqual({
    stageEventId: "note-1",
    pitchMatches: true,
  });
}
beforeEach(() => {
  harness.refs = [];
  harness.effects = [];
  harness.feedback = null;
  harness.updates = [];
});

describe("live pitch feedback publication", () => {
  it("does not publish redundant empty guidance across 60 clock updates", () => {
    for (let tick = 0; tick < 60; tick++)
      FeedbackProbe({ elapsedSec: tick / 60 });
    expect(harness.updates).toEqual([]);
    expect(harness.feedback).toBeNull();
  });

  it("keeps fresh-frame bookkeeping without publishing the same color, then clears stale input", () => {
    confirm();
    const published = harness.feedback;
    for (let tick = 1; tick <= 20; tick++) {
      FeedbackProbe({
        frame: frame(20.05 + tick * 0.05),
        elapsedSec: 1.05 + tick * 0.05,
      });
    }
    expect(harness.feedback).toBe(published);
    expect(harness.updates).toHaveLength(1);
    FeedbackProbe({ frame: frame(21.05), elapsedSec: 2.24 });
    expect(harness.feedback).toBe(published);
    FeedbackProbe({ frame: frame(21.05), elapsedSec: 2.26 });
    expect(harness.feedback).toBeNull();
    expect(harness.updates).toEqual([published, null]);
  });

  it("clears on a target boundary without reusing the previous target's held frame", () => {
    confirm();
    const nextTarget = { ...target, stageEventId: "note-2" };
    FeedbackProbe({ target: nextTarget, frame: frame(20.05), elapsedSec: 1.1 });
    expect(harness.feedback).toBeNull();
    FeedbackProbe({ target: nextTarget, frame: frame(20.1), elapsedSec: 1.15 });
    expect(harness.feedback).toBeNull();
    FeedbackProbe({ target: nextTarget, frame: frame(20.15), elapsedSec: 1.2 });
    expect(harness.feedback).toEqual({
      stageEventId: "note-2",
      pitchMatches: true,
    });
  });

  it("requires a fresh confirmation on retry, including a restarted capture clock", () => {
    confirm();
    FeedbackProbe({ frame: frame(0.1), elapsedSec: 0.1 }, 2);
    expect(harness.feedback).toBeNull();
    FeedbackProbe({ frame: frame(0.1), elapsedSec: 0.11 }, 2);
    expect(harness.feedback).toBeNull();
    FeedbackProbe({ frame: frame(0.15), elapsedSec: 0.15 }, 2);
    expect(harness.feedback).toEqual({
      stageEventId: "note-1",
      pitchMatches: true,
    });
  });

  it("clears disabled guidance and does not restore it from an old frame on resume", () => {
    confirm();
    FeedbackProbe({ frame: frame(20.05), enabled: false, elapsedSec: 1.1 });
    expect(harness.feedback).toBeNull();
    FeedbackProbe({ frame: frame(20.05), elapsedSec: 1.15 });
    expect(harness.feedback).toBeNull();
    expect(harness.updates).toHaveLength(2);
  });
});
