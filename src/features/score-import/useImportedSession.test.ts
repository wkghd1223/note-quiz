import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChallengeAudioSession } from "@/features/challenge/audio/microphone";
import type { ImportedTimeline } from "./types";
import { ImportedPracticeSession } from "./useImportedSession";
import { prepareImportedPiano } from "./imported-piano";

type Callbacks = ConstructorParameters<typeof ChallengeAudioSession>[0];
const mock = vi.hoisted(() => ({
  audios: [] as Array<{
    context: { currentTime: number };
    processedThroughAudioSec: number;
    dispose: ReturnType<typeof vi.fn>;
    beatCue: ReturnType<typeof vi.fn>;
    beginCollection: ReturnType<typeof vi.fn>;
    callbacks: Callbacks;
  }>,
  connect: vi.fn<() => Promise<boolean>>(),
  piano: vi.fn(),
}));
vi.mock("@/features/challenge/audio/microphone", () => ({
  ChallengeAudioSession: class {
    context = { currentTime: 0 };
    processedThroughAudioSec = Infinity;
    dispose = vi.fn();
    beatCue = vi.fn();
    beginCollection = vi.fn();
    resume = vi.fn(async () => {});
    connectMicrophone = mock.connect;
    constructor(public callbacks: Callbacks) {
      mock.audios.push(this);
    }
  },
}));
vi.mock("./imported-piano", () => ({
  prepareImportedPiano: vi.fn(async () => mock.piano),
}));
const plan: ImportedTimeline = {
  countIn: { pulses: 2, pulseSec: 0.5 },
  durationSec: 1,
  targets: [
    {
      id: "a",
      eventId: "a",
      barIndex: 0,
      startSec: 0,
      endSec: 1,
      midis: [60, 64],
    },
  ],
  notes: [
    { midi: 60, startSec: 0, endSec: 1 },
    { midi: 64, startSec: 0, endSec: 0.5 },
  ],
};
const pending = new Map<number, FrameRequestCallback>();
let serial = 0;
function tick(time: number) {
  mock.audios.at(-1)!.context.currentTime = time;
  const callbacks = [...pending.values()];
  pending.clear();
  for (const callback of callbacks) callback(1000 * time);
}
async function prepared() {
  await Promise.resolve();
  await Promise.resolve();
}
beforeEach(() => {
  mock.audios.length = 0;
  mock.connect.mockReset().mockResolvedValue(true);
  mock.piano.mockClear();
  pending.clear();
  vi.stubGlobal("AudioContext", class {});
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    pending.set(++serial, callback);
    return serial;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => pending.delete(id));
});
afterEach(() => vi.unstubAllGlobals());

describe("imported exercise audio lifecycle", () => {
  it("cancels pending microphone permission and ignores old callbacks on retry", async () => {
    let resolve!: (value: boolean) => void;
    mock.connect.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const session = new ImportedPracticeSession(plan);
    session.start();
    expect(session.getSnapshot().phase).toBe("preparing");
    session.stop();
    const old = mock.audios[0];
    session.start();
    await prepared();
    resolve(true);
    await prepared();
    old.callbacks.onError("denied");
    expect(session.getSnapshot().phase).toBe("countIn");
    expect(old.beatCue).not.toHaveBeenCalled();
    expect(old.dispose).toHaveBeenCalledOnce();
    expect(pending.size).toBe(1);
  });
  it("freezes the physical elapsed time at pause and continues on a fresh audio clock", async () => {
    const session = new ImportedPracticeSession(plan);
    session.start();
    await prepared();
    expect(mock.audios[0].beatCue).toHaveBeenCalledTimes(2);
    tick(1.38);
    session.pause();
    expect(session.getSnapshot().elapsed).toBeCloseTo(0.3);
    expect(session.getSnapshot().phase).toBe("paused");
    tick(120);
    session.resume();
    await prepared();
    expect(session.getSnapshot().elapsed).toBeCloseTo(0.3);
    tick(1.28);
    expect(session.getSnapshot().elapsed).toBeCloseTo(0.5);
    mock.audios[1].callbacks.onError("suspended");
    expect(session.getSnapshot().phase).toBe("paused");
    session.resume();
    await prepared();
    tick(1.6);
    expect(session.getSnapshot()).toMatchObject({
      phase: "result",
      elapsed: 1,
      results: { a: false },
    });
    session.start();
    expect(session.getSnapshot().results).toEqual({});
  });
  it("previews every chord pitch on one clock, with no microphone permission", async () => {
    const session = new ImportedPracticeSession(plan);
    session.preview();
    await prepared();
    expect(vi.mocked(prepareImportedPiano)).toHaveBeenCalled();
    expect(mock.connect).not.toHaveBeenCalled();
    expect(mock.piano).toHaveBeenCalledWith(60, 0.08, 1);
    expect(mock.piano).toHaveBeenCalledWith(64, 0.08, expect.closeTo(0.5));
    expect(session.getSnapshot().phase).toBe("preview");
    session.stop();
    expect(mock.audios[0].dispose).toHaveBeenCalledOnce();
    expect(pending.size).toBe(0);
  });
  it("schedules enabled score clicks in preview and after the practice count-in", async () => {
    const session = new ImportedPracticeSession({
      ...plan,
      beatCues: [
        { timeSec: 0, kind: "bar" },
        { timeSec: 0.5, kind: "beat" },
      ],
    });
    session.preview();
    await prepared();
    expect(mock.audios[0].beatCue.mock.calls).toEqual([[0.08, "bar"]]);
    tick(0.35);
    expect(mock.audios[0].beatCue.mock.calls.at(-1)).toEqual([
      expect.closeTo(0.58),
      "beat",
    ]);
    session.stop();
    session.start();
    await prepared();
    expect(mock.audios[1].beatCue).toHaveBeenCalledTimes(2);
    tick(0.95);
    expect(mock.audios[1].beatCue.mock.calls.at(-1)).toEqual([1.08, "bar"]);
    tick(1.4);
    expect(mock.audios[1].beatCue.mock.calls.at(-1)).toEqual([1.58, "beat"]);
    session.stop();
  });

  it("plays the editor's selected bar on its own timeline, then practices the original range", async () => {
    const session = new ImportedPracticeSession(plan);
    const bar: ImportedTimeline = {
      ...plan,
      durationSec: 2,
      notes: [{ midi: 74, startSec: 0, endSec: 2 }],
      targets: [{ ...plan.targets[0], id: "bar", midis: [74], endSec: 2 }],
    };
    session.preview(bar);
    await prepared();
    expect(mock.piano).toHaveBeenCalledWith(74, 0.08, 2);
    tick(1.58);
    expect(session.getSnapshot().elapsed).toBeCloseTo(1.5);
    tick(2.1);
    expect(session.getSnapshot().phase).toBe("ready");
    session.start();
    await prepared();
    tick(2.2);
    expect(session.getSnapshot()).toMatchObject({
      phase: "result",
      elapsed: 1,
      results: { a: false },
    });
  });
  it("surfaces a failed device as an error instead of crediting missed samples", async () => {
    const session = new ImportedPracticeSession(plan);
    session.start();
    await prepared();
    mock.audios[0].processedThroughAudioSec = 1.5;
    tick(3);
    expect(session.getSnapshot()).toMatchObject({
      phase: "error",
      error: "audio-error",
      results: {},
    });
  });
});
