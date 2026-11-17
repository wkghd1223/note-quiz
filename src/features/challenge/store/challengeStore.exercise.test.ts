import { describe, expect, it } from "vitest";
import { generateMelody } from "@/features/melody/domain/generator";
import { defaultMelodySettings } from "@/features/melody/domain/settings";
import { getStage } from "../data/stages";
import {
  getInstrumentProfile,
  supportsStage,
} from "../domain/instrument-profile";
import type {
  InputMethod,
  PerformanceEvent,
  TargetEvent,
} from "../domain/performance";
import { buildPlaybackTimeline } from "../domain/score-timeline";
import { createChallengeStore } from "./challengeStore";

const exercise = () =>
  generateMelody({ ...defaultMelodySettings, durations: [1] }, 123);
const performance = (
  target: TargetEvent,
  origin: number,
  elapsed = 0,
): PerformanceEvent => ({
  eventId: target.stageEventId,
  inputMethod: "microphone",
  onsetAudioSec: origin + target.startAudioSec - elapsed,
  offsetAudioSec: origin + target.endAudioSec - elapsed,
  observedMidi: target.targetConcertMidi,
  medianCents: 0,
  validPitchRatio: 1,
  confidence: 1,
  attackConfidence: 1,
});

describe("explicit runtime exercise store", () => {
  it("commits audio-processed judgments once and keeps them through pause, finish and retry", () => {
    const melody = exercise();
    const store = createChallengeStore(melody);
    const options = {
      stageId: melody.id,
      profileId: "voice",
      inputMethod: "microphone" as const,
      mode: "challenge" as const,
    };
    const token = store.getState().startAttempt(options);
    store.getState().beginPlaying(token, 10);
    const segment = store.getState().segmentToken;
    const playback = buildPlaybackTimeline(
      melody,
      getInstrumentProfile("voice")!,
      0,
    );
    const first = playback.targets[0];
    store.getState().addEvent(token, segment, performance(first, 10));
    store.getState().advanceJudgments(token, segment, 15, 10);
    expect(store.getState().liveResult).toBeNull();
    store
      .getState()
      .advanceJudgments(token, segment, 10 + first.endAudioSec, 11);
    const committed = store.getState().liveResult!;
    expect(committed.notes[0].status).toBe("passed");
    const notifications: unknown[] = [];
    const unsubscribe = store.subscribe((state) => notifications.push(state));
    for (let tick = 1; tick <= 60; tick++)
      store
        .getState()
        .advanceJudgments(
          token,
          segment,
          10 + first.endAudioSec + tick / 120,
          11,
        );
    expect(notifications).toEqual([]);
    unsubscribe();
    store.getState().pause(token, 10 + first.endAudioSec + 0.1);
    expect(store.getState().liveResult!.notes[0]).toBe(committed.notes[0]);
    const paused = store.getState().liveResult;
    store.getState().advanceJudgments(token, segment, 99, 99);
    expect(store.getState().liveResult).toBe(paused);
    store.getState().resume(token);
    store.getState().beginPlaying(token, 50);
    const resumedSegment = store.getState().segmentToken;
    store.getState().advanceJudgments(token, segment, 99, 99);
    expect(store.getState().liveResult).toBe(paused);
    // A new physical AudioContext starts at a different origin on resume.
    store.getState().advanceJudgments(token, resumedSegment, 51, 51);
    expect(store.getState().liveResult!.notes[0]).toBe(committed.notes[0]);
    const result = store
      .getState()
      .finish(token, 50 + playback.durationSec + 1)!;
    expect(result.notes[0]).toBe(committed.notes[0]);
    expect(store.getState().finish(token)).toBe(result);
    store.getState().startAttempt(options);
    expect(store.getState().liveResult).toBeNull();
    expect(store.getState().events).toEqual([]);
    store.getState().advanceJudgments(token, resumedSegment, 999, 999);
    expect(store.getState().liveResult).toBeNull();
  });
  it("scores an uncatalogued voice melody, pauses/resumes, and invalidates stale callbacks", () => {
    const melody = exercise();
    expect(getStage(melody.id)).toBeUndefined();
    const store = createChallengeStore(melody);
    store.getState().selectStage(melody.id);
    expect(store.getState().stageId).toBe(melody.id);
    const token = store.getState().startAttempt({
      stageId: melody.id,
      profileId: "voice",
      inputMethod: "microphone",
      mode: "challenge",
    });
    expect(store.getState().phase).toBe("countIn");
    expect(store.getState().beginPlaying(token, 10)).toBe(true);
    const playback = buildPlaybackTimeline(
      melody,
      getInstrumentProfile("voice")!,
      0,
    );
    const first = playback.targets[0];
    const segment = store.getState().segmentToken;
    expect(
      store.getState().addEvent(token, segment, performance(first, 10)),
    ).toBe(true);
    expect(store.getState().pause(token, 10 + first.endAudioSec + 0.1)).toBe(
      true,
    );
    expect(store.getState().elapsedSec).toBe(first.endAudioSec);
    expect(store.getState().events).toHaveLength(1);
    expect(
      store.getState().addEvent(token, segment, performance(first, 10)),
    ).toBe(false);
    expect(store.getState().resume(token)).toBe(true);
    expect(store.getState().beginPlaying(token, 50)).toBe(true);
    const elapsed = store.getState().elapsedSec;
    for (const target of playback.targets.filter(
      (t) => t.kind === "note" && t.startAudioSec >= elapsed,
    ))
      expect(
        store
          .getState()
          .addEvent(
            token,
            store.getState().segmentToken,
            performance(target, 50, elapsed),
          ),
      ).toBe(true);
    expect(store.getState().finish(token, 51)).toBeNull();
    const result = store
      .getState()
      .finish(token, 50 + playback.durationSec - elapsed + 0.2);
    expect(result?.score).toBe(100);
    expect(result?.notes.every((note) => note.status === "passed")).toBe(true);
    expect(result?.restViolations).toEqual([]);
    expect(store.getState().elapsedSec).toBe(playback.durationSec);
    expect(store.getState().finish(token)).toBe(result);
    store.getState().reset();
    expect(store.getState().finish(token)).toBeNull();
    expect(getStage(melody.id)).toBeUndefined();
  });
  it.each<[string, InputMethod]>([
    ["touch-keyboard", "touch"],
    ["voice", "touch"],
    ["voice", "midi"],
    ["piano-mic", "microphone"],
    ["percussion-mic", "microphone"],
    ["flute", "microphone"],
  ])("rejects nonvoice input %s/%s", (profileId, inputMethod) => {
    const melody = exercise(),
      store = createChallengeStore(melody);
    const token = store.getState().startAttempt({
      stageId: melody.id,
      profileId,
      inputMethod,
      mode: "challenge",
    });
    expect(store.getState().phase).toBe("error");
    expect(store.getState().beginPlaying(token, 10)).toBe(false);
  });
  it("rejects touch events during an otherwise valid voice session", () => {
    const melody = exercise(),
      store = createChallengeStore(melody);
    const token = store.getState().startAttempt({
      stageId: melody.id,
      profileId: "voice",
      inputMethod: "microphone",
      mode: "challenge",
    });
    store.getState().beginPlaying(token, 10);
    const target = buildPlaybackTimeline(
      melody,
      getInstrumentProfile("voice")!,
      0,
    ).targets[0];
    expect(
      store.getState().addEvent(token, store.getState().segmentToken, {
        ...performance(target, 10),
        inputMethod: "touch",
      }),
    ).toBe(false);
  });
  it("never falls back to the catalog for a supplied exercise's mismatched id", () => {
    const store = createChallengeStore(exercise());
    store.getState().selectStage("w1-s1");
    expect(store.getState().stageId).toBeNull();
    expect(store.getState().error).toBe("invalidStage");
    store.getState().startAttempt({
      stageId: "w1-s1",
      profileId: "voice",
      inputMethod: "microphone",
      mode: "challenge",
    });
    expect(store.getState().phase).toBe("error");
  });
  it("uses the supplied exercise throughout even when its id collides with a stage", () => {
    const melody = { ...exercise(), id: "w1-s1" },
      store = createChallengeStore(melody);
    const token = store.getState().startAttempt({
      stageId: melody.id,
      profileId: "voice",
      inputMethod: "microphone",
      mode: "challenge",
    });
    store.getState().beginPlaying(token, 10);
    const timeline = buildPlaybackTimeline(
      melody,
      getInstrumentProfile("voice")!,
      0,
    );
    expect(store.getState().finish(token, 14.2)).toBeNull();
    expect(store.getState().pause(token, 15)).toBe(true);
    expect(store.getState().elapsedSec).toBeGreaterThan(4);
    store.getState().resume(token);
    store.getState().beginPlaying(token, 50);
    const remaining = timeline.durationSec - store.getState().elapsedSec;
    const result = store.getState().finish(token, 50 + remaining + 0.2);
    expect(result?.notes).toHaveLength(
      melody.events.filter((event) => event.kind === "note").length,
    );
    expect(store.getState().elapsedSec).toBe(timeline.durationSec);
    expect(getStage("w1-s1")?.measures).toBe(1);
  });
  it("supports voice C3–C6 while preserving every other instrument range", () => {
    expect(getInstrumentProfile("voice")?.writtenRange).toEqual([48, 84]);
    for (const id of [
      "flute",
      "touch-keyboard",
      "piano-mic",
      "guitar-mic",
      "percussion-mic",
    ])
      expect(getInstrumentProfile(id)?.writtenRange).toEqual([60, 67]);
    for (const midi of [48, 84]) {
      const melody = generateMelody(
        { ...defaultMelodySettings, minMidi: midi, maxMidi: midi },
        1,
      );
      expect(supportsStage(melody, getInstrumentProfile("voice")!)).toBe(true);
      const store = createChallengeStore(melody);
      store.getState().startAttempt({
        stageId: melody.id,
        profileId: "voice",
        inputMethod: "microphone",
        mode: "challenge",
      });
      expect(store.getState().phase).toBe("countIn");
    }
  });
});
