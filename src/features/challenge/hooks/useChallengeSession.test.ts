import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStage } from "../data/stages";
import { createChallengeStore } from "../store/challengeStore";
import { useChallengeSession } from "./useChallengeSession";
import type { MicrophoneSignal } from "@/lib/music/microphoneSignal";
import type { PerformanceEvent } from "../domain/performance";
import type { ExerciseDefinition, StageDefinition } from "../domain/stage";

type Store = ReturnType<typeof createChallengeStore>;
const harness = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  stores: [] as Store[],
  states: [] as unknown[],
  rafs: new Map<number, FrameRequestCallback>(),
  rafSerial: 0,
  connect: null as
    | null
    | ((audio: { context: { currentTime: number } }) => Promise<boolean>),
  prepare: null as
    | null
    | ((audio: { context: { currentTime: number } }) => Promise<void>),
  audio: [] as Array<{
    context: { currentTime: number };
    dispose: ReturnType<typeof vi.fn>;
    endCollection: ReturnType<typeof vi.fn>;
    pianoTone: ReturnType<typeof vi.fn>;
    preparePiano: ReturnType<typeof vi.fn>;
    beatCue: ReturnType<typeof vi.fn>;
    beginCollection: ReturnType<typeof vi.fn>;
    callbacks: {
      signal?: MicrophoneSignal;
      onEvent: (event: PerformanceEvent) => void;
      onError: (error: string) => void;
    };
  }>,
}));
// Node-only hook harness: browser events and audio are mocks; the lifecycle store
// and pause/rewind behavior remain real. Browser rotation has a separate CDP case.
vi.mock("react", () => ({
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => {
    const index = harness.states.push(initial) - 1;
    return [
      initial,
      (value: unknown) => {
        harness.states[index] = value;
      },
    ];
  },
  useEffect: (effect: () => void | (() => void)) =>
    harness.effects.push(effect),
}));
vi.mock("../store/challengeStore", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../store/challengeStore")>();
  return {
    ...original,
    createChallengeStore: (
      exercise: Parameters<typeof original.createChallengeStore>[0],
    ) => {
      const store = original.createChallengeStore(exercise);
      harness.stores.push(store);
      return Object.assign(() => store.getState(), store);
    },
  };
});
vi.mock("../audio/microphone", () => ({
  ChallengeAudioSession: class {
    context = { currentTime: 10 };
    dispose = vi.fn();
    endCollection = vi.fn();
    resume = vi.fn(async () => {});
    pianoTone = vi.fn();
    preparePiano = vi.fn(async () => {
      await harness.prepare?.(this);
    });
    beatCue = vi.fn();
    beginCollection = vi.fn();
    connectMicrophone = vi.fn(async () =>
      harness.connect ? harness.connect(this) : true,
    );
    constructor(
      public callbacks: {
        signal?: MicrophoneSignal;
        onEvent: (event: PerformanceEvent) => void;
        onError: (error: string) => void;
      },
    ) {
      harness.audio.push(this);
    }
  },
}));
let cleanups: Array<() => void>;
let windowEvents: EventTarget;
let orientationEvents: EventTarget;
beforeEach(() => {
  harness.effects.length = 0;
  harness.stores.length = 0;
  harness.audio.length = 0;
  harness.states.length = 0;
  harness.rafs.clear();
  harness.rafSerial = 0;
  harness.connect = null;
  harness.prepare = null;
  cleanups = [];
  windowEvents = new EventTarget();
  orientationEvents = new EventTarget();
  vi.stubGlobal(
    "window",
    Object.assign(windowEvents, { screen: { orientation: orientationEvents } }),
  );
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { hidden: false }),
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      const id = ++harness.rafSerial;
      harness.rafs.set(id, callback);
      return id;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => harness.rafs.delete(id)),
  );
});
afterEach(() => {
  for (const cleanup of cleanups.reverse()) cleanup();
  vi.unstubAllGlobals();
});
function SessionProbe(
  stage: ExerciseDefinition = getStage("w1-s2")!,
  cues = {},
) {
  return useChallengeSession(stage, cues);
}
async function setup() {
  const session = SessionProbe();
  for (const effect of harness.effects) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
  session.start({
    stageId: "w1-s2",
    profileId: "voice",
    inputMethod: "microphone",
    mode: "challenge",
  });
  await settleSchedule();
  const store = harness.stores[0],
    audio = harness.audio[0];
  const token = store.getState().attemptToken;
  store.getState().beginPlaying(token, 10);
  store.getState().addEvent(token, store.getState().segmentToken, {
    eventId: "completed-first-note",
    inputMethod: "microphone",
    onsetAudioSec: 10,
    offsetAudioSec: 12,
    observedMidi: 60,
    medianCents: 0,
    validPitchRatio: 1,
    confidence: 1,
    attackConfidence: 1,
  });
  audio.context.currentTime = 13;
  return { store, audio };
}
describe("challenge rotation recovery", () => {
  it.each(["legacy orientationchange", "screen.orientation change"])(
    "%s pauses and rewinds the unfinished note",
    async (kind) => {
      const { store, audio } = await setup();
      if (kind.startsWith("legacy"))
        windowEvents.dispatchEvent(new Event("orientationchange"));
      else orientationEvents.dispatchEvent(new Event("change"));
      expect(store.getState().phase).toBe("paused");
      expect(store.getState().elapsedSec).toBe(2);
      expect(store.getState().events.map((event) => event.eventId)).toEqual([
        "completed-first-note",
      ]);
      expect(audio.endCollection).toHaveBeenCalledWith(false);
      expect(audio.dispose).toHaveBeenCalledOnce();
      audio.context.currentTime = 99;
      expect(store.getState().getElapsed(99)).toBe(2);
    },
  );
  it("duplicate rotation events pause once and unmount removes listeners", async () => {
    const { store, audio } = await setup();
    windowEvents.dispatchEvent(new Event("orientationchange"));
    orientationEvents.dispatchEvent(new Event("change"));
    expect(audio.dispose).toHaveBeenCalledOnce();
    const pausedToken = store.getState().segmentToken;
    expect(store.getState().elapsedSec).toBe(2);
    orientationEvents.dispatchEvent(new Event("change"));
    expect(store.getState().segmentToken).toBe(pausedToken);
    const removeWindow = vi.spyOn(windowEvents, "removeEventListener");
    const removeOrientation = vi.spyOn(
      orientationEvents,
      "removeEventListener",
    );
    for (const cleanup of cleanups.reverse()) cleanup();
    cleanups = [];
    expect(removeWindow).toHaveBeenCalledWith(
      "orientationchange",
      expect.any(Function),
    );
    expect(removeOrientation).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    const afterUnmount = store.getState();
    windowEvents.dispatchEvent(new Event("orientationchange"));
    orientationEvents.dispatchEvent(new Event("change"));
    expect(store.getState()).toBe(afterUnmount);
  });
});

describe("challenge navigation preview", () => {
  it("schedules each repeated occurrence and silence through the rewind gap", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const stage: StageDefinition = {
        ...getStage("w1-s1")!,
        barNavigation: [{ barIndex: 0, repeatCount: 2 }],
      };
      const session = SessionProbe(stage);
      await session.example();
      const audio = harness.audio[0];
      expect(audio.pianoTone).toHaveBeenCalledTimes(2);
      for (const [index, start] of [10.08, 15.08].entries()) {
        const [midi, time, duration] = audio.pianoTone.mock.calls[index];
        expect(midi).toBe(60);
        expect(time).toBeCloseTo(start);
        expect(duration).toBeCloseTo(3.8);
      }
      vi.advanceTimersByTime(99999); // Wall-clock timers never advance playback.
      runAudioFrame(audio, 19.279);
      expect(audio.dispose).not.toHaveBeenCalled();
      runAudioFrame(audio, 19.281);
      expect(audio.dispose).toHaveBeenCalledOnce();
      expect(visual().elapsed).toBe(0);
      expect(audio.beginCollection).not.toHaveBeenCalled();
      expect(harness.stores[0].getState().events).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

async function settleSchedule() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
function runAudioFrame(
  audio: { context: { currentTime: number } },
  now: number,
) {
  audio.context.currentTime = now;
  const callbacks = [...harness.rafs.values()];
  harness.rafs.clear();
  expect(callbacks).toHaveLength(1);
  for (const callback of callbacks) callback(999_999); // RAF's wall clock is irrelevant.
}
// State setters are observed without React DOM; audio and lifecycle behavior are real.
function visual() {
  return {
    preRoll: harness.states[2],
    elapsed: harness.states[4],
    count: harness.states[5],
  };
}
async function startClockSession(
  stage: ExerciseDefinition = getStage("w1-s2")!,
) {
  const session = SessionProbe(stage);
  for (const effect of harness.effects) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
  session.start({
    stageId: stage.id,
    profileId: "voice",
    inputMethod: "microphone",
    mode: "challenge",
  });
  await settleSchedule();
  const audio = harness.audio[0];
  const beat = 60 / stage.bpm;
  const pulseCount =
    stage.timeSignature[0] === 6 && stage.timeSignature[1] === 8
      ? 2
      : stage.timeSignature[0];
  const pulseLength = stage.timeSignature[1] === 8 ? 1.5 * beat : beat;
  const start =
    (audio.beatCue.mock.calls[0]?.[0] ?? 0) + pulseCount * pulseLength;
  return { session, audio, store: harness.stores[0], beat, start };
}
function measuredNote(onset: number, offset: number): PerformanceEvent {
  return {
    eventId: "first-held-note",
    inputMethod: "microphone",
    onsetAudioSec: onset,
    offsetAudioSec: offset,
    observedMidi: 60,
    medianCents: 0,
    validPitchRatio: 1,
    confidence: 1,
    attackConfidence: 1,
    pitchSamples: [{ audioTimeSec: onset, midi: 60, cents: 0, confidence: 1 }],
  };
}

describe("first-note audio-clock boundary", () => {
  it("shares one signal ref with capture and clears listening and measured values on pause/error", async () => {
    const { session, audio, store, start } = await startClockSession();
    const signal = session.signal.current;
    expect(audio.callbacks.signal).toBe(signal);
    expect(harness.states[0]).toBe(true);
    signal.rms = 0.1;
    signal.frequencyHz = 440;
    signal.bins.fill(0.5);
    runAudioFrame(audio, start);
    session.pause();
    expect(harness.states[0]).toBe(false);
    expect(session.signal.current).toBe(signal);
    expect(signal.rms).toBe(0);
    expect(signal.frequencyHz).toBeNull();
    expect([...signal.bins]).toEqual(Array(24).fill(0));
    session.resume();
    await settleSchedule();
    expect(harness.audio[1].callbacks.signal).toBe(signal);
    expect(harness.states[0]).toBe(true);
    signal.rms = 0.2;
    signal.bins.fill(0.3);
    harness.audio[1].callbacks.onError("missing-device");
    expect(store.getState().phase).toBe("error");
    expect(harness.states[0]).toBe(false);
    expect(signal.rms).toBe(0);
    expect([...signal.bins]).toEqual(Array(24).fill(0));
  });
  it.each([
    [[2, 4], 2, 1],
    [[3, 4], 3, 1],
    [[4, 4], 4, 1],
    [[6, 8], 2, 1.5],
  ] as const)(
    "counts one bar of %s with %s pulses from the quarter-note BPM",
    async (meter, pulses, pulseQuarterBeats) => {
      const exercise: ExerciseDefinition = {
        ...getStage("w1-s1")!,
        id: `meter-${meter.join("-")}`,
        timeSignature: [...meter],
        bpm: 120,
        events: [
          {
            ...getStage("w1-s1")!.events[0],
            durationBeats: (meter[0] * 4) / meter[1],
          },
        ],
      };
      const { session, audio, store, start, beat } =
        await startClockSession(exercise);
      expect(audio.beatCue).toHaveBeenCalledTimes(pulses);
      expect(audio.beatCue.mock.calls.map((call) => call[0])).toEqual(
        Array.from(
          { length: pulses },
          (_, i) => start - (pulses - i) * pulseQuarterBeats * beat,
        ),
      );
      expect(harness.states[1]).toEqual({
        pulses,
        pulseQuarterBeats,
        durationSec: pulses * pulseQuarterBeats * beat,
      });
      expect(harness.states[0]).toBe(true);
      for (const remaining of [0.35, 0.001]) {
        runAudioFrame(audio, start - remaining);
        expect(store.getState().phase).toBe("countIn");
        expect(visual().count).toBe(
          Math.ceil(remaining / (pulseQuarterBeats * beat)),
        );
      }
      runAudioFrame(audio, start);
      expect(store.getState().phase).toBe("playing");
      expect(visual()).toEqual({ preRoll: null, elapsed: 0, count: null });
      expect(harness.states[1]).toBeNull();
      session.pause();
      expect(harness.states[0]).toBe(false);
      session.resume();
      await settleSchedule();
      expect(harness.audio[1].beatCue).toHaveBeenCalledTimes(pulses);
      expect(harness.states[1]).toEqual({
        pulses,
        pulseQuarterBeats,
        durationSec: pulses * pulseQuarterBeats * beat,
      });
    },
  );
  it("binds a runtime exercise to its own store instead of the fixed-stage catalog", async () => {
    const exercise: ExerciseDefinition = {
      ...getStage("w1-s2")!,
      id: "generated-eight-bars",
      bpm: 96,
    };
    const { audio, store, start, beat } = await startClockSession(exercise);
    expect(store.getState().stageId).toBe(exercise.id);
    expect(beat).toBe(0.625);
    expect(store.getState().phase).toBe("countIn");
    runAudioFrame(audio, start);
    expect(store.getState().phase).toBe("playing");
    expect(store.getState().segmentStartAudioSec).toBe(start);
  });
  it("keeps preparation separate from playing through the four audible beats", async () => {
    const { audio, store, beat, start } = await startClockSession();
    expect(audio.beatCue.mock.calls.map((call) => call[0])).toEqual([
      start - 4 * beat,
      start - 3 * beat,
      start - 2 * beat,
      start - beat,
    ]);
    expect(audio.beginCollection).toHaveBeenCalledWith(
      expect.any(String),
      start - 0.35,
    );
    for (const remaining of [4 * beat, 3 * beat, 2 * beat, beat, 0.35, 0.001]) {
      runAudioFrame(audio, start - remaining);
      expect(store.getState().phase).toBe("countIn");
      expect(store.getState().segmentStartAudioSec).toBeNull();
      expect(store.getState().events).toEqual([]);
      expect(visual().elapsed).toBe(0);
      expect(visual().count).toBe(Math.min(4, Math.ceil(remaining / beat)));
      expect(visual().preRoll).toEqual({
        remainingSec: expect.closeTo(remaining),
        durationSec: 4 * beat,
        baseElapsedSec: 0,
      });
    }
    runAudioFrame(audio, start);
    expect(store.getState().phase).toBe("playing");
    expect(store.getState().segmentStartAudioSec).toBe(start);
    expect(visual()).toEqual({ preRoll: null, elapsed: 0, count: null });
    runAudioFrame(audio, start + 0.01);
    expect(visual().elapsed).toBeCloseTo(0.01);
    expect(store.getState().getElapsed(start + 0.01)).toBeCloseTo(0.01);
  });
  it("anchors all four beats after microphone warmup, with no synthetic elapsed compensation", async () => {
    harness.connect = async (audio) => {
      audio.context.currentTime += 7;
      return true;
    };
    const { audio, store, start, beat } = await startClockSession();
    expect(start).toBeCloseTo(17.08 + 4 * beat);
    runAudioFrame(audio, start - 0.001);
    expect(store.getState().phase).toBe("countIn");
    runAudioFrame(audio, start + 0.01);
    expect(store.getState().segmentStartAudioSec).toBe(start);
    expect(visual().elapsed).toBeCloseTo(0.01);
  });
  it("preserves measured onset and full duration for a held note crossing zero between RAF ticks", async () => {
    const { audio, store, start } = await startClockSession();
    runAudioFrame(audio, start - 0.001);
    audio.callbacks.onEvent(measuredNote(start - 0.2, start - 0.05));
    expect(store.getState().events).toEqual([]);
    audio.context.currentTime = start + 0.005;
    audio.callbacks.onEvent(measuredNote(start - 0.2, start + 0.005));
    expect(store.getState().phase).toBe("countIn");
    expect(store.getState().events).toEqual([]);
    runAudioFrame(audio, start + 0.01);
    const [event] = store.getState().events;
    expect(event.onsetAudioSec).toBeCloseTo(-0.2);
    expect(event.offsetAudioSec).toBeCloseTo(0.005);
    expect(event.offsetAudioSec! - event.onsetAudioSec).toBeCloseTo(0.205);
    expect(event.pitchSamples![0].audioTimeSec).toBeCloseTo(-0.2);
  });
  it("keeps late-delivered low input on its measured clock without transposing toward the target", async () => {
    const { audio, store, start } = await startClockSession();
    runAudioFrame(audio, start + 2.2);
    const measured = measuredNote(start + 0.2, start + 1.9);
    measured.observedMidi = 40;
    measured.pitchSamples![0].midi = 40;
    audio.callbacks.onEvent(measured);
    expect(store.getState().events[0]).toMatchObject({
      onsetAudioSec: expect.closeTo(0.2),
      offsetAudioSec: expect.closeTo(1.9),
      observedMidi: 40,
      pitchSamples: [
        {
          audioTimeSec: expect.closeTo(0.2),
          midi: 40,
          cents: 0,
          confidence: 1,
        },
      ],
    });
  });
  it("repeats the four-beat approach at the paused target and retains completed input", async () => {
    const { session, audio, store, start, beat } = await startClockSession();
    runAudioFrame(audio, start);
    audio.callbacks.onEvent(measuredNote(start, start + 2));
    runAudioFrame(audio, start + 3);
    session.pause();
    expect(store.getState().elapsedSec).toBe(2);
    const completed = store.getState().events;
    expect(completed).toHaveLength(1);
    session.resume();
    await settleSchedule();
    const resumedAudio = harness.audio[1];
    const resumedStart = resumedAudio.beatCue.mock.calls[0][0] + 4 * beat;
    for (const remaining of [4 * beat, 0.35, 0.001]) {
      runAudioFrame(resumedAudio, resumedStart - remaining);
      expect(store.getState().phase).toBe("countIn");
      expect(visual().elapsed).toBe(2);
      expect(visual().preRoll).toMatchObject({
        baseElapsedSec: 2,
        remainingSec: expect.closeTo(remaining),
      });
    }
    runAudioFrame(resumedAudio, resumedStart);
    expect(store.getState().segmentStartAudioSec).toBe(resumedStart);
    expect(visual()).toEqual({ preRoll: null, elapsed: 2, count: null });
    runAudioFrame(resumedAudio, resumedStart + 0.01);
    expect(visual().elapsed).toBeCloseTo(2.01);
    expect(store.getState().events).toEqual(completed);
    audio.callbacks.onEvent(measuredNote(start + 2, start + 4));
    expect(store.getState().events).toEqual(completed);
  });
  it("cancels preparation during microphone warmup and ignores stale callbacks", async () => {
    let ready!: (value: boolean) => void;
    harness.connect = () =>
      new Promise<boolean>((resolve) => {
        ready = resolve;
      });
    const pending = startClockSession();
    await settleSchedule();
    const { session, audio, store } = await pending;
    session.pause();
    ready(true);
    await settleSchedule();
    expect(store.getState().phase).toBe("paused");
    expect(audio.dispose).toHaveBeenCalledOnce();
    expect(audio.pianoTone).not.toHaveBeenCalled();
    expect(harness.rafs.size).toBe(0);
    audio.callbacks.onEvent(measuredNote(10, 11));
    expect(store.getState().events).toEqual([]);
    expect(visual().preRoll).toBeNull();
  });
});

describe("preview clock and cue lifecycle", () => {
  it("establishes playback zero after the piano finishes loading", async () => {
    let ready: () => void = () => {};
    harness.prepare = () =>
      new Promise<void>((resolve) => {
        ready = resolve;
      });
    const session = SessionProbe(getStage("w1-s1")!, { metronome: true });
    const pending = session.example();
    await settleSchedule();
    const audio = harness.audio[0];
    expect(audio.preparePiano).toHaveBeenCalledWith([
      { midi: 60, durationSec: 3.8 },
    ]);
    expect(audio.pianoTone).not.toHaveBeenCalled();
    expect(audio.beatCue).not.toHaveBeenCalled();
    expect(harness.rafs.size).toBe(0);
    audio.context.currentTime = 25;
    ready();
    await pending;
    expect(audio.pianoTone).toHaveBeenCalledWith(60, 25.08, 3.8);
    expect(audio.beatCue.mock.calls[0][0]).toBe(25.08);
    runAudioFrame(audio, 25.08);
    expect(visual().elapsed).toBe(0);
  });
  it("cancels a loading preview without late notes or animation", async () => {
    let ready: () => void = () => {};
    harness.prepare = () =>
      new Promise<void>((resolve) => {
        ready = resolve;
      });
    const session = SessionProbe();
    const pending = session.example();
    await settleSchedule();
    const audio = harness.audio[0];
    await session.example();
    ready();
    await pending;
    expect(audio.dispose).toHaveBeenCalledOnce();
    expect(audio.pianoTone).not.toHaveBeenCalled();
    expect(audio.beatCue).not.toHaveBeenCalled();
    expect(harness.rafs.size).toBe(0);
    expect(visual().elapsed).toBe(0);
  });
  it("exposes a preview failure and allows retry without requesting a microphone", async () => {
    harness.prepare = async () => {
      throw new Error("Soundfont unavailable");
    };
    const session = SessionProbe();
    await session.example();
    expect(harness.states.at(-1)).toBe(true); // previewFailed
    expect(harness.audio[0].dispose).toHaveBeenCalledOnce();
    expect(harness.rafs.size).toBe(0);
    harness.prepare = null;
    await session.example();
    expect(harness.states.at(-1)).toBe(false);
    expect(harness.audio[1].pianoTone).toHaveBeenCalled();
    expect(harness.audio[1].beginCollection).not.toHaveBeenCalled();
  });
  it("moves with the audio clock without collecting input, and stops on blur", async () => {
    const session = SessionProbe(getStage("w1-s1")!, {
      metronome: true,
      barBell: true,
    });
    for (const effect of harness.effects) {
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    }
    await session.example();
    const audio = harness.audio[0];
    expect(audio.beatCue.mock.calls).toEqual([
      [10.08, "bar"],
      [11.08, "beat"],
      [12.08, "beat"],
      [13.08, "beat"],
    ]);
    runAudioFrame(audio, 10.08);
    expect(visual().elapsed).toBe(0);
    runAudioFrame(audio, 11.33);
    expect(visual().elapsed).toBeCloseTo(1.25);
    expect(audio.beginCollection).not.toHaveBeenCalled();
    expect(harness.states[0]).toBe(false);
    windowEvents.dispatchEvent(new Event("blur"));
    expect(audio.dispose).toHaveBeenCalledOnce();
    expect(harness.rafs.size).toBe(0);
    expect(visual().elapsed).toBe(0);
    expect(harness.stores[0].getState().events).toEqual([]);
  });
  it("stops preview from its own toggle and restarts with a fresh clock", async () => {
    const session = SessionProbe();
    await session.example();
    const first = harness.audio[0];
    runAudioFrame(first, 11.08);
    await session.example();
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(visual().elapsed).toBe(0);
    expect(harness.rafs.size).toBe(0);
    await session.example();
    expect(harness.audio).toHaveLength(2);
    runAudioFrame(harness.audio[1], 10.08);
    expect(visual().elapsed).toBe(0);
    expect(harness.audio[1].beginCollection).not.toHaveBeenCalled();
  });
});

it("aligns preview and the first note to the reported device output clock", async () => {
  vi.stubGlobal("performance", { now: () => 1000 });
  const session = SessionProbe(getStage("w1-s1")!);
  await session.example();
  const audio = harness.audio[0];
  Object.assign(audio.context, {
    getOutputTimestamp: () => ({
      contextTime: audio.context.currentTime - 0.03,
      performanceTime: performance.now(),
    }),
  });
  runAudioFrame(audio, 10.1);
  expect(visual().elapsed).toBe(0);
  runAudioFrame(audio, 10.61);
  expect(visual().elapsed).toBeCloseTo(0.5, 3);
  session.start({
    stageId: "w1-s1",
    profileId: "voice",
    inputMethod: "microphone",
    mode: "challenge",
  });
  await settleSchedule();
  const playing = harness.audio[1];
  const first = playing.beatCue.mock.calls[0][0] + 4;
  Object.assign(playing.context, {
    getOutputTimestamp: () => ({
      contextTime: playing.context.currentTime - 0.03,
      performanceTime: performance.now(),
    }),
  });
  runAudioFrame(playing, first + 0.01);
  expect(harness.stores[0].getState().phase).toBe("countIn");
  runAudioFrame(playing, first + 0.04);
  expect(harness.stores[0].getState().phase).toBe("playing");
  expect(visual().elapsed).toBeCloseTo(0.01, 3);
});
