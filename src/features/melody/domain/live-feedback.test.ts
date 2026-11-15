import { describe, expect, it } from "vitest";
import { getScoringProfile } from "@/features/challenge/domain/instrument-profile";
import type {
  InputFrame,
  TargetEvent,
} from "@/features/challenge/domain/performance";
import { scoreAttempt } from "@/features/challenge/domain/scoring";
import { generateMelody } from "./generator";
import { defaultMelodySettings } from "./settings";
import {
  initialLivePitchFeedback,
  updateLivePitchFeedback,
  visibleLivePitchFeedback,
} from "./live-feedback";

const profile = getScoringProfile(
  generateMelody(defaultMelodySettings, 1),
  "voice",
);
const target: TargetEvent = {
  stageEventId: "first:visit1",
  sourceEventId: "first",
  startAudioSec: 0,
  endAudioSec: 4,
  kind: "note",
  targetConcertMidi: 60,
  requiresDistinctAttack: false,
};
const frame = (audioTimeSec = 20, cents = 0): InputFrame => ({
  streamSampleIndex: Math.round(audioTimeSec * 48000),
  audioTimeSec,
  rms: 0.1,
  detectedHz: 440 * 2 ** ((60 - 69 + cents / 100) / 12),
  confidence: 0.99,
  isVoiced: true,
});
const input = { frame: frame(), target, profile, elapsedSec: 1, enabled: true };
const first = updateLivePitchFeedback(initialLivePitchFeedback, input);
const confirmed = updateLivePitchFeedback(first, {
  ...input,
  frame: frame(20.05),
  elapsedSec: 1.05,
});

describe("provisional microphone pitch guidance", () => {
  it("requires two distinct reliable frames; UI ticks cannot invent confirmation", () => {
    expect(first.feedback).toBeNull();
    expect(
      updateLivePitchFeedback(first, { ...input, elapsedSec: 1.01 }).feedback,
    ).toBeNull();
    expect(confirmed.feedback).toEqual({
      stageEventId: target.stageEventId,
      pitchMatches: true,
    });
    expect(input.frame).toEqual(frame());
    expect(target.targetConcertMidi).toBe(60);
  });

  it.each([-1200, -100, 100, 1200])(
    "keeps a measured %i-cent error red instead of forcing target pitch/octave",
    (cents) => {
      const start = updateLivePitchFeedback(initialLivePitchFeedback, {
        ...input,
        frame: frame(20, cents),
      });
      expect(
        updateLivePitchFeedback(start, {
          ...input,
          frame: frame(20.05, cents),
          elapsedSec: 1.05,
        }).feedback?.pitchMatches,
      ).toBe(false);
    },
  );

  it.each([-1, 1])("reuses the actual profile tolerance at sign %i", (sign) => {
    for (const tolerance of [45, 60]) {
      for (const [difference, expected] of [
        [0, true],
        [0.01, false],
      ] as const) {
        const args = {
          ...input,
          profile: { ...profile, pitchToleranceCents: tolerance },
        };
        const cents = sign * (tolerance + difference);
        const start = updateLivePitchFeedback(initialLivePitchFeedback, {
          ...args,
          frame: frame(20, cents),
        });
        expect(
          updateLivePitchFeedback(start, {
            ...args,
            frame: frame(20.05, cents),
            elapsedSec: 1.05,
          }).feedback?.pitchMatches,
        ).toBe(expected);
      }
    }
  });

  it.each([
    { isVoiced: false },
    { detectedHz: null },
    { detectedHz: NaN },
    { detectedHz: Infinity },
    { detectedHz: 0 },
    { detectedHz: -1 },
    { rms: 0 },
    { rms: NaN },
    { confidence: profile.confidenceThreshold - 0.01 },
    { confidence: NaN },
    { confidence: 1.1 },
    { audioTimeSec: NaN },
  ])(
    "clears color immediately for silent/uncertain/invalid input %j",
    (patch) => {
      expect(
        updateLivePitchFeedback(confirmed, {
          ...input,
          frame: { ...frame(20.1), ...patch },
          elapsedSec: 1.1,
        }).feedback,
      ).toBeNull();
    },
  );

  it("uses voiced reliability plus profile confidence without inventing an RMS threshold", () => {
    const args = {
      ...input,
      frame: {
        ...frame(),
        confidence: profile.confidenceThreshold,
        rms: 0.0001,
      },
    };
    const start = updateLivePitchFeedback(initialLivePitchFeedback, args);
    expect(
      updateLivePitchFeedback(start, {
        ...args,
        frame: { ...args.frame, audioTimeSec: 20.05 },
        elapsedSec: 1.05,
      }).feedback?.pitchMatches,
    ).toBe(true);
  });

  it("neutralizes a changing classification until the next matching frame", () => {
    const changed = updateLivePitchFeedback(confirmed, {
      ...input,
      frame: frame(20.1, 100),
      elapsedSec: 1.1,
    });
    expect(changed.feedback).toBeNull();
    expect(
      updateLivePitchFeedback(changed, {
        ...input,
        frame: frame(20.15, 100),
        elapsedSec: 1.15,
      }).feedback?.pitchMatches,
    ).toBe(false);
  });

  it("clears stale or missing frames using elapsed deltas, not unrelated clock origins", () => {
    expect(
      updateLivePitchFeedback(confirmed, {
        ...input,
        frame: frame(20.05),
        elapsedSec: 1.3,
      }).feedback,
    ).toBeNull();
    expect(
      updateLivePitchFeedback(confirmed, {
        ...input,
        frame: null,
        elapsedSec: 1.1,
      }).feedback,
    ).toBeNull();
    expect(
      updateLivePitchFeedback(confirmed, {
        ...input,
        frame: frame(20),
        elapsedSec: 1.1,
      }).feedback,
    ).toBeNull();
    expect(
      updateLivePitchFeedback(first, {
        ...input,
        frame: frame(21),
        elapsedSec: 2,
      }).feedback,
    ).toBeNull();
  });

  it("clears confirmation when the playback clock resets even with a fresh frame", () => {
    expect(
      updateLivePitchFeedback(confirmed, {
        ...input,
        frame: frame(20.1),
        elapsedSec: 0,
      }).feedback,
    ).toBeNull();
  });

  it("clears count-in, preview, pause/reset, target changes, rests and out-of-window input", () => {
    const paused = updateLivePitchFeedback(confirmed, {
      ...input,
      frame: frame(20.05),
      enabled: false,
    });
    expect(paused.feedback).toBeNull();
    expect(
      updateLivePitchFeedback(paused, { ...input, frame: frame(20.05) })
        .feedback,
    ).toBeNull();
    for (const elapsedSec of [-1, 4, NaN])
      expect(
        updateLivePitchFeedback(confirmed, { ...input, elapsedSec }).feedback,
      ).toBeNull();
    const next = { ...target, stageEventId: "second" };
    const changed = updateLivePitchFeedback(confirmed, {
      ...input,
      target: next,
      frame: frame(20.05),
      elapsedSec: 1.1,
    });
    expect(changed.feedback).toBeNull();
    expect(
      updateLivePitchFeedback(changed, {
        ...input,
        target: next,
        frame: frame(20.1),
        elapsedSec: 1.15,
      }).feedback,
    ).toBeNull();
    expect(
      updateLivePitchFeedback(confirmed, {
        ...input,
        target: { ...target, kind: "rest", targetConcertMidi: null },
      }).feedback,
    ).toBeNull();
    expect(
      updateLivePitchFeedback(confirmed, {
        ...input,
        profile: { ...profile, inputMethod: "touch" },
      }).feedback,
    ).toBeNull();
  });
});

describe("score feedback precedence", () => {
  it("maps current occurrence to its written glyph and rejects other times/rests", () => {
    expect(
      visibleLivePitchFeedback(confirmed.feedback, [target], null, 1),
    ).toEqual({ ...confirmed.feedback, sourceEventId: "first" });
    expect(
      visibleLivePitchFeedback(confirmed.feedback, [target], null, 4),
    ).toBeNull();
    expect(
      visibleLivePitchFeedback(
        confirmed.feedback,
        [{ ...target, stageEventId: "first:visit2" }],
        null,
        1,
      ),
    ).toBeNull();
    expect(
      visibleLivePitchFeedback(
        confirmed.feedback,
        [{ ...target, kind: "rest" }],
        null,
        1,
      ),
    ).toBeNull();
  });
  it("never overwrites a finalized result or changes scoring inputs", () => {
    const result = scoreAttempt([], [target], profile);
    const before = JSON.stringify(result);
    expect(
      visibleLivePitchFeedback(confirmed.feedback, [target], result, 1),
    ).toBeNull();
    expect(JSON.stringify(result)).toBe(before);
    expect(result.notes[0].status).toBe("missed");
  });
});
