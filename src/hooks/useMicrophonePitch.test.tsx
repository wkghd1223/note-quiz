import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMicrophonePitch } from "./useMicrophonePitch";
import { detectPitch } from "@/lib/music/pitchDetection";

const harness = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  states: [] as unknown[],
}));
// Node hook harness. These tests exercise real permission/resource generations;
// synthetic pitch frames replace acoustic input, not the microphone lifecycle.
vi.mock("react", () => ({
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
vi.mock("@/lib/music/pitchDetection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/music/pitchDetection")>()),
  detectPitch: vi.fn(() => 440),
}));

const getUserMedia = vi.fn();
let rafs: Map<number, FrameRequestCallback>;
let rafId: number;
let now: number;
let cleanups: Array<() => void>;
let contexts: FakeAudioContext[];
let captureSampleRate = 44100;
class FakeAudioContext {
  sampleRate = captureSampleRate;
  analyser = {
    fftSize: 2048,
    frequencyBinCount: 1024,
    smoothingTimeConstant: 0,
    getFloatTimeDomainData: vi.fn((buffer: Float32Array) => buffer.fill(0)),
    getFloatFrequencyData: vi.fn(),
    disconnect: vi.fn(),
  };
  source = { connect: vi.fn(), disconnect: vi.fn() };
  close = vi.fn(async () => {});
  createAnalyser = () => this.analyser;
  createMediaStreamSource = () => this.source;
  constructor() {
    contexts.push(this);
  }
}
function stream() {
  const stop = vi.fn();
  return {
    value: { getTracks: () => [{ stop }] } as unknown as MediaStream,
    stop,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function MicrophoneProbe() {
  const hook = useMicrophonePitch();
  for (const effect of harness.effects) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
  return hook;
}
function frame(at: number) {
  now = at;
  const [id, callback] = rafs.entries().next().value!;
  rafs.delete(id);
  callback(at);
}
beforeEach(() => {
  harness.effects.length = 0;
  harness.states.length = 0;
  rafs = new Map();
  rafId = 0;
  now = 0;
  cleanups = [];
  contexts = [];
  captureSampleRate = 44100;
  vi.mocked(detectPitch).mockReturnValue(440);
  getUserMedia.mockReset();
  getUserMedia.mockImplementation(async () => stream().value);
  vi.stubGlobal("window", { AudioContext: FakeAudioContext });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      const id = ++rafId;
      rafs.set(id, callback);
      return id;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => rafs.delete(id)),
  );
  vi.spyOn(performance, "now").mockImplementation(() => now);
});
afterEach(() => {
  for (const cleanup of cleanups.reverse()) cleanup();
  vi.unstubAllGlobals();
});

describe("hold microphone lifecycle", () => {
  it.each([44100, 48000, 88200, 96000])(
    "keeps a usable analysis window at %sHz",
    async (rate) => {
      captureSampleRate = rate;
      const hook = MicrophoneProbe();
      await hook.startListening();
      frame(0);
      const size = rate >= 88200 ? 4096 : 2048;
      expect(contexts[0].analyser.fftSize).toBe(size);
      expect(
        contexts[0].analyser.getFloatTimeDomainData.mock.calls[0][0],
      ).toHaveLength(size);
      expect(detectPitch).toHaveBeenCalledWith(expect.any(Float32Array), rate);
    },
  );

  it("returns only a stable current note once, and releases every capture resource", async () => {
    const input = stream();
    getUserMedia.mockResolvedValue(input.value);
    const hook = MicrophoneProbe();
    await hook.startListening();
    frame(0);
    frame(219);
    expect(harness.states[2]).toBeNull();
    frame(220);
    expect(hook.stopListening()).toMatchObject({ name: "A", octave: 4 });
    expect(hook.stopListening()).toBeNull();
    expect(harness.states[2]).toBeNull();
    expect(harness.states[1]).toBe(false);
    expect(input.stop).toHaveBeenCalledOnce();
    expect(contexts[0].source.disconnect).toHaveBeenCalledOnce();
    expect(contexts[0].analyser.disconnect).toHaveBeenCalledOnce();
    expect(contexts[0].close).toHaveBeenCalledOnce();
    expect(rafs.size).toBe(0);
    expect(hook.signalRef.current.rms).toBe(0);
  });

  it("does not submit a candidate that has not reached the existing stability threshold", async () => {
    const hook = MicrophoneProbe();
    await hook.startListening();
    frame(0);
    frame(219);
    expect(hook.stopListening()).toBeNull();
  });

  it("a fresh hold clears a previously detected note even before permission resolves", async () => {
    const hook = MicrophoneProbe();
    await hook.startListening();
    frame(0);
    frame(220);
    expect(harness.states[2]).toMatchObject({ name: "A" });
    const request = deferred<MediaStream>();
    getUserMedia.mockReturnValue(request.promise);
    const pending = hook.startListening();
    expect(harness.states[2]).toBeNull();
    expect(hook.stopListening()).toBeNull();
    const late = stream();
    request.resolve(late.value);
    await pending;
    expect(late.stop).toHaveBeenCalledOnce();
  });

  it.each(["release", "unmount"])(
    "invalidates a permission grant after %s",
    async (action) => {
      const request = deferred<MediaStream>();
      getUserMedia.mockReturnValue(request.promise);
      const hook = MicrophoneProbe();
      const pending = hook.startListening();
      if (action === "release") hook.stopListening();
      else {
        for (const cleanup of cleanups) cleanup();
        cleanups = [];
      }
      const late = stream();
      request.resolve(late.value);
      await pending;
      expect(late.stop).toHaveBeenCalledOnce();
      expect(contexts).toHaveLength(0);
      expect(harness.states[1]).toBe(false);
      expect(rafs.size).toBe(0);
    },
  );

  it("commits the latest stable octave within one hold instead of retaining the same pitch class", async () => {
    const hook = MicrophoneProbe();
    vi.mocked(detectPitch).mockReturnValue(220);
    await hook.startListening();
    frame(0);
    frame(220);
    expect(harness.states[2]).toMatchObject({ name: "A", octave: 3 });
    vi.mocked(detectPitch).mockReturnValue(440);
    frame(221);
    frame(440);
    expect(harness.states[2]).toMatchObject({ name: "A", octave: 3 });
    frame(441);
    expect(hook.stopListening()).toMatchObject({ name: "A", octave: 4 });
  });

  it("an old rejection cannot stop a newer granted hold", async () => {
    const old = deferred<MediaStream>();
    const current = stream();
    getUserMedia
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(current.value);
    const hook = MicrophoneProbe();
    const first = hook.startListening();
    await hook.startListening();
    old.reject(new DOMException("Denied", "NotAllowedError"));
    await first;
    expect(harness.states[0]).toBe("granted");
    expect(harness.states[1]).toBe(true);
    expect(current.stop).not.toHaveBeenCalled();
    expect(rafs.size).toBe(1);
  });

  it("an old RAF callback cannot read a newer capture or schedule more work", async () => {
    const hook = MicrophoneProbe();
    await hook.startListening();
    const oldTick = rafs.values().next().value!;
    hook.stopListening();
    await hook.startListening();
    oldTick(1000);
    expect(detectPitch).not.toHaveBeenCalled();
    expect(rafs.size).toBe(1);
    expect(hook.stopListening()).toBeNull();
  });

  it("stops a late old stream without replacing the newer stream", async () => {
    const old = deferred<MediaStream>(),
      current = stream(),
      late = stream();
    getUserMedia
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(current.value);
    const hook = MicrophoneProbe();
    const first = hook.startListening();
    await hook.startListening();
    old.resolve(late.value);
    await first;
    expect(late.stop).toHaveBeenCalledOnce();
    expect(current.stop).not.toHaveBeenCalled();
    expect(contexts).toHaveLength(1);
  });

  it("reports denied permission and leaves no capture running", async () => {
    getUserMedia.mockRejectedValue(
      new DOMException("Denied", "NotAllowedError"),
    );
    const hook = MicrophoneProbe();
    await hook.startListening();
    expect(harness.states[0]).toBe("denied");
    expect(harness.states[1]).toBe(false);
    expect(hook.stopListening()).toBeNull();
    expect(rafs.size).toBe(0);
  });
});
