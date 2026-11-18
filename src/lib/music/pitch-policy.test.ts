import { describe, expect, it } from "vitest";
import { hasReliablePitch, PITCH_MIN_CONFIDENCE } from "./estimatePitch";
import { createInputQualityObserver } from "./input-quality";
import { NoteEventDetector } from "@/features/challenge/audio/onset-offset";
import { getScoringProfile } from "@/features/challenge/domain/instrument-profile";
import { getStage } from "@/features/challenge/data/stages";

describe("independent YIN observation, scoring and attack confidence roles", () => {
  it("preserves the original observation floor without flattening score and attack thresholds", () => {
    const profile = getScoringProfile(getStage("w1-s1")!, "sustained-mic-v1");
    expect(PITCH_MIN_CONFIDENCE).toBe(0.8);
    expect(hasReliablePitch(440, 0.7)).toBe(false);
    expect(profile.confidenceThreshold).toBe(0.6);
    expect(profile.attackConfidenceThreshold).toBe(0.6);
  });
  it("uses the restored observation floor for quality without treating periodicity as score", () => {
    const observer = createInputQualityObserver();
    const estimate = {
      hz: 440,
      confidence: 0.79,
      rms: 0.1,
      peak: 0.2,
      clippingRatio: 0,
    };
    expect(observer.observe(estimate, 0, 0.015)).toBe("uncertain");
    expect(
      observer.observe({ ...estimate, confidence: 0.8 }, 0.01, 0.015),
    ).toBe("stable");
  });
  it.each([0.79, 0.8, 0.81])(
    "keeps unknown samples in event denominators at confidence %s",
    (confidence) => {
      const detector = new NoteEventDetector();
      detector.reset("policy", 0.001);
      for (let i = 0; i < 12; i++)
        detector.accept({
          streamSampleIndex: i * 480,
          audioTimeSec: i / 100,
          rms: 0.1,
          detectedHz: 440,
          confidence,
          isVoiced: true,
        });
      const [event] = detector.flush(0.12);
      expect(event.attackConfidence).toBe(1);
      expect(event.pitchSamples).toHaveLength(12);
      const reliable = confidence >= PITCH_MIN_CONFIDENCE;
      expect(event.observedMidi).toBe(reliable ? 69 : null);
      expect(event.validPitchRatio).toBe(reliable ? 1 : 0);
      expect(event.confidence).toBeCloseTo(reliable ? confidence : 0);
    },
  );
});
