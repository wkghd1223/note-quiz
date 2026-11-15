import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as catalog from "../data/stages";
import type { StageDefinition } from "../domain/stage";
import type { PerformanceEvent } from "../domain/performance";
import { createChallengeStore } from "./challengeStore";
const originalGetStage = catalog.getStage;
const fixture: StageDefinition = {
  ...catalog.stages[0],
  barNavigation: [{ barIndex: 0, repeatCount: 2 }],
};
const input = (
  onsetAudioSec: number,
  offsetAudioSec: number,
  eventId = "held",
): PerformanceEvent => ({
  eventId,
  inputMethod: "touch",
  onsetAudioSec,
  offsetAudioSec,
  observedMidi: 60,
  medianCents: 0,
  validPitchRatio: 1,
  confidence: 1,
  attackConfidence: 1,
});
beforeEach(() =>
  vi
    .spyOn(catalog, "getStage")
    .mockImplementation((id) =>
      id === fixture.id ? fixture : originalGetStage(id),
    ),
);
afterEach(() => vi.restoreAllMocks());
const start = (offset = 0) => {
  const store = createChallengeStore();
  const token = store.getState().startAttempt({
    stageId: fixture.id,
    profileId: "touch-keyboard",
    inputMethod: "touch",
    mode: "challenge",
    inputOffsetMs: offset,
  });
  store.getState().beginPlaying(token, 10);
  return { store, token, segment: store.getState().segmentToken };
};
describe("navigation-aware session lifecycle", () => {
  it("rejects a transition-onset event, including its later updates, instead of answering the return note", () => {
    const { store, token, segment } = start();
    expect(
      store.getState().addEvent(token, segment, input(10, 14, "first")),
    ).toBe(true);
    expect(store.getState().addEvent(token, segment, input(14.9, 18.9))).toBe(
      false,
    );
    expect(store.getState().addEvent(token, segment, input(14.9, 19.2))).toBe(
      false,
    );
    expect(store.getState().events).toHaveLength(1);
    const result = store.getState().finish(token, 19.3)!;
    expect(result.notes.map((note) => note.status)).toEqual([
      "passed",
      "missed",
    ]);
    expect(result.stars).toBe(0);
    expect(store.getState().elapsedSec).toBe(9);
  });
  it("rejects transition onset using configured input latency", () => {
    const { store, token, segment } = start(200);
    expect(store.getState().addEvent(token, segment, input(15.1, 19.1))).toBe(
      false,
    );
    expect(store.getState().addEvent(token, segment, input(15.2, 19.2))).toBe(
      true,
    );
  });
  it("does not clip notes held too long across the rewind", () => {
    const { store, token, segment } = start();
    expect(store.getState().addEvent(token, segment, input(10, 15.5))).toBe(
      true,
    );
    const result = store.getState().finish(token, 19.3)!;
    expect(result.notes[0].reasons).toContain("tooLong");
    expect(result.notes[1].status).toBe("missed");
  });
  it("pause during a rewind replays the transition and retains the completed pass", () => {
    const { store, token, segment } = start();
    store.getState().addEvent(token, segment, input(10, 14, "first"));
    store.getState().pause(token, 14.6);
    expect(store.getState().elapsedSec).toBe(4);
    expect(store.getState().events).toHaveLength(1);
    expect(
      store.getState().addEvent(token, segment, input(15, 19, "stale")),
    ).toBe(false);
    store.getState().resume(token);
    store.getState().beginPlaying(token, 30);
    const resumedSegment = store.getState().segmentToken;
    expect(
      store
        .getState()
        .addEvent(token, resumedSegment, input(30.8, 34.8, "gap")),
    ).toBe(false);
    expect(
      store.getState().addEvent(token, resumedSegment, input(31, 35, "second")),
    ).toBe(true);
    expect(store.getState().finish(token, 34.9)).toBeNull();
    expect(store.getState().finish(token, 35.3)?.stars).toBe(3);
  });
  it("pause during the second pass rewinds only that occurrence", () => {
    const { store, token, segment } = start();
    store.getState().addEvent(token, segment, input(10, 14, "first"));
    store.getState().addEvent(token, segment, input(15, 16, "partial-second"));
    store.getState().pause(token, 16);
    expect(store.getState().elapsedSec).toBe(5);
    expect(store.getState().events.map((event) => event.eventId)).toEqual([
      "first",
    ]);
  });
  it("restart invalidates all prior occurrence and segment tokens", () => {
    const { store, token, segment } = start();
    store.getState().addEvent(token, segment, input(10, 14));
    const replacement = store.getState().startAttempt({
      stageId: fixture.id,
      profileId: "touch-keyboard",
      inputMethod: "touch",
      mode: "challenge",
    });
    store.getState().beginPlaying(replacement, 30);
    expect(store.getState().addEvent(token, segment, input(15, 19))).toBe(
      false,
    );
    expect(store.getState().finish(token, 40)).toBeNull();
    expect(store.getState().events).toEqual([]);
  });
});
