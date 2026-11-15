import { describe, it, expect } from "vitest";
import { createChallengeStore } from "./challengeStore";
import type { PerformanceEvent } from "../domain/performance";
const event = (onset = 10, duration = 4, id = "p1"): PerformanceEvent => ({
  eventId: id,
  inputMethod: "touch",
  onsetAudioSec: onset,
  offsetAudioSec: onset + duration,
  observedMidi: 60,
  medianCents: 0,
  validPitchRatio: 1,
  confidence: 1,
  attackConfidence: 1,
});
const setup = (stageId = "w1-s1") => {
  const store = createChallengeStore();
  const token = store.getState().startAttempt({
    stageId,
    profileId: "touch-keyboard",
    inputMethod: "touch",
    mode: "challenge",
  });
  store.getState().beginPlaying(token, 10);
  return { store, token };
};
describe("isolated challenge lifecycle", () => {
  it("S15: pause/restart invalidates old segment and attempt frames", () => {
    const { store, token } = setup(),
      segment = store.getState().segmentToken;
    expect(store.getState().addEvent(token, segment, event())).toBe(true);
    expect(store.getState().pause(token, 12)).toBe(true);
    expect(store.getState().elapsedSec).toBe(0);
    expect(store.getState().events).toEqual([]);
    expect(store.getState().addEvent(token, segment, event())).toBe(false);
    store.getState().resume(token);
    store.getState().beginPlaying(token, 30);
    expect(store.getState().addEvent(token, segment, event(30))).toBe(false);
    expect(
      store
        .getState()
        .addEvent(token, store.getState().segmentToken, event(30)),
    ).toBe(true);
    expect(store.getState().finish(token, 34.2)?.stars).toBe(3);
    store.getState().reset();
    expect(
      store.getState().addEvent(token, store.getState().segmentToken, event()),
    ).toBe(false);
    expect(store.getState().finish(token)).toBeNull();
  });
  it("pause mid-note rewinds only current note and preserves completed notes", () => {
    const { store, token } = setup("w1-s2"),
      segment = store.getState().segmentToken;
    store.getState().addEvent(token, segment, event(10, 2));
    store
      .getState()
      .addEvent(token, segment, { ...event(12, 1, "p2"), observedMidi: 62 });
    store.getState().pause(token, 13);
    expect(store.getState().elapsedSec).toBe(2);
    expect(store.getState().events).toHaveLength(1);
    store.getState().resume(token);
    store.getState().beginPlaying(token, 50);
    store.getState().addEvent(token, store.getState().segmentToken, {
      ...event(50, 2, "p3"),
      observedMidi: 62,
    });
    expect(store.getState().getElapsed(51)).toBe(3);
    expect(store.getState().finish(token, 52.2)?.stars).toBe(3);
  });
  it("finish is idempotent and rejects early completion", () => {
    const { store, token } = setup();
    store.getState().addEvent(token, store.getState().segmentToken, event());
    expect(store.getState().finish(token, 11)).toBeNull();
    const result = store.getState().finish(token, 14.2);
    expect(result?.stars).toBe(3);
    expect(store.getState().finish(token, 20)).toBe(result);
    expect(
      store.getState().addEvent(token, store.getState().segmentToken, event()),
    ).toBe(false);
  });
  it("pause preserves completed notes with configured input latency", () => {
    const store = createChallengeStore();
    const token = store
      .getState()
      .startAttempt({
        stageId: "w1-s2",
        profileId: "touch-keyboard",
        inputMethod: "touch",
        mode: "challenge",
        inputOffsetMs: 200,
      });
    store.getState().beginPlaying(token, 10);
    store
      .getState()
      .addEvent(token, store.getState().segmentToken, event(10.2, 2));
    store.getState().pause(token, 13);
    expect(store.getState().events).toHaveLength(1);
    expect(store.getState().elapsedSec).toBe(2);
  });
  it("official attempts force stage BPM despite supplied rehearsal scale", () => {
    const store = createChallengeStore();
    store.getState().startAttempt({
      stageId: "w1-s1",
      profileId: "touch-keyboard",
      inputMethod: "touch",
      mode: "challenge",
      tempoScale: 0.7,
    });
    expect(store.getState().tempoScale).toBe(1);
  });
  it.each([
    [-0.2, false],
    [-0.08, true],
  ])(
    "early first-note %ss remains available for onset judgment",
    (offset, pass) => {
      const { store, token } = setup("w3-s1");
      expect(
        store
          .getState()
          .addEvent(
            token,
            store.getState().segmentToken,
            event(10 + offset, 1),
          ),
      ).toBe(true);
      const result = store.getState().finish(token, 14.2);
      expect(result!.notes[0].onsetPass).toBe(pass);
      expect(result!.notes[0].reasons.includes("early")).toBe(!pass);
    },
  );
  it("duplicate start callback and invalid profile cannot become playing", () => {
    const { store, token } = setup();
    expect(store.getState().beginPlaying(token, 10)).toBe(false);
    const next = store.getState().startAttempt({
      stageId: "w1-s1",
      profileId: "piano-mic",
      inputMethod: "microphone",
      mode: "challenge",
    });
    expect(store.getState().phase).toBe("error");
    expect(store.getState().beginPlaying(next, 20)).toBe(false);
  });
  it("stage changes invalidate callbacks without touching practice state", () => {
    const { store, token } = setup();
    store.getState().selectStage("w2-s1");
    expect(store.getState().phase).toBe("landing");
    expect(store.getState().finish(token)).toBeNull();
  });
});
