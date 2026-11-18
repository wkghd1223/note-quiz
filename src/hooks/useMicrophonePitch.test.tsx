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
let captureHz: number | null = 440;
let captureAmplitude = 0.1;
let captureNoise = false;
let captureAudioTime: number | undefined;
class FakeAudioContext {
  sampleRate = captureSampleRate;
  get currentTime() {
    return captureAudioTime;
  }
  analyser = {
    fftSize: 2048,
    frequencyBinCount: 1024,
    smoothingTimeConstant: 0,
    getFloatTimeDomainData: vi.fn((buffer: Float32Array) => {
      let seed = 19;
      for (let i = 0; i < buffer.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        buffer[i] = captureNoise
          ? 0.3 * (seed / 0xffffffff - 0.5)
          : captureHz === null
            ? 0
            : captureAmplitude *
              Math.sin((2 * Math.PI * captureHz * i) / this.sampleRate);
      }
    }),
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
function frame(at: number, audioAt?: number) {
  now = at;
  if (audioAt !== undefined) captureAudioTime = audioAt;
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
  captureHz = 440;
  captureAmplitude = 0.1;
  captureNoise = false;
  captureAudioTime = undefined;
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

function observations(start: number, end: number) {
  for (let ms = start; ms <= end; ms += 20) frame(ms);
}
async function realPitch() {
  const actual = await vi.importActual<
    typeof import("@/lib/music/pitchDetection")
  >("@/lib/music/pitchDetection");
  vi.mocked(detectPitch).mockImplementation(actual.detectPitch);
}
describe("actual PCM → same hook/shared analyzer → continuous submission (mocked devices)", () => {
  it("uses AudioContext observation time rather than elapsed wall/RAF delivery time", async () => {
    await realPitch();
    const hook = MicrophoneProbe(),
      submit = vi.fn();
    captureAudioTime = 0;
    await hook.startListening({
      getContext: () => ({ eligible: true }),
      onSubmit: submit,
    });
    for (let i = 0; i <= 4; i++) frame(i * 1000, i / 10);
    expect(submit).not.toHaveBeenCalled();
    frame(5000, 0.499);
    expect(submit).not.toHaveBeenCalled();
    frame(6000, 0.5);
    expect(submit).toHaveBeenCalledOnce();
  });
  it.each([44100, 48000, 96000])(
    "submits once at500ms and retains the stream/latch across questions, locks and unpitched noise at%iHz",
    async (rate) => {
      await realPitch();
      captureSampleRate = rate;
      const hook = MicrophoneProbe(),
        submit = vi.fn();
      let questionKey = "q1",
        eligible = true;
      await hook.startListening({
        getContext: () => ({ questionKey, eligible }),
        onSubmit: submit,
      });
      observations(0, 480);
      frame(499);
      expect(submit).not.toHaveBeenCalled();
      frame(500);
      expect(submit).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ name: "A", octave: 4 }),
        "q1",
      );
      eligible = false;
      observations(520, 1000);
      questionKey = "q2";
      eligible = true;
      observations(1020, 1600);
      captureNoise = true;
      observations(1620, 1820);
      captureNoise = false;
      observations(1840, 2440);
      expect(submit).toHaveBeenCalledTimes(1);
      expect(getUserMedia).toHaveBeenCalledOnce();
      expect(contexts).toHaveLength(1);
      captureHz = null;
      observations(2460, 2580);
      captureHz = 440;
      observations(2600, 3080);
      expect(submit).toHaveBeenCalledTimes(1);
      frame(3100);
      expect(submit).toHaveBeenLastCalledWith(
        expect.objectContaining({ octave: 4 }),
        "q2",
      );
      expect(submit).toHaveBeenCalledTimes(2);
    },
  );
  it("never queues a locked/previous-question candidate, and requires fresh eligible500ms", async () => {
    await realPitch();
    const hook = MicrophoneProbe(),
      submit = vi.fn();
    let eligible = true,
      questionKey = "q1";
    await hook.startListening({
      getContext: () => ({ eligible, questionKey }),
      onSubmit: submit,
    });
    observations(0, 400);
    eligible = false;
    observations(420, 1000);
    eligible = true;
    observations(1020, 1400);
    questionKey = "q2";
    observations(1420, 1900);
    expect(submit).not.toHaveBeenCalled();
    frame(1920);
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ octave: 4 }),
      "q2",
    );
  });
  it("uses actual octave identity for a new legato500ms and discards transient octaves", async () => {
    await realPitch();
    const hook = MicrophoneProbe(),
      submit = vi.fn();
    captureHz = 220;
    await hook.startListening({
      getContext: () => ({ eligible: true }),
      onSubmit: submit,
    });
    observations(0, 500);
    captureHz = 440;
    observations(520, 900);
    captureHz = 220;
    observations(920, 1500);
    expect(submit).toHaveBeenCalledTimes(1);
    captureHz = 880;
    observations(1520, 2000);
    expect(submit).toHaveBeenCalledTimes(1);
    frame(2020);
    expect(submit.mock.calls.map((call) => call[0].octave)).toEqual([3, 5]);
  });
  it("resets on real observation gaps/invalid PCM while keeping a submitted voiced latch", async () => {
    await realPitch();
    const hook = MicrophoneProbe(),
      submit = vi.fn();
    await hook.startListening({
      getContext: () => ({ eligible: true }),
      onSubmit: submit,
    });
    observations(0, 400);
    observations(1000, 1480);
    expect(submit).not.toHaveBeenCalled();
    frame(1500);
    captureHz = NaN;
    observations(1520, 1740);
    captureHz = 440;
    observations(1760, 2400);
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it("cancels candidate/old RAF ownership on OFF and does not schedule after a submit callback stops capture", async () => {
    await realPitch();
    const hook = MicrophoneProbe(),
      submit = vi.fn();
    await hook.startListening({
      getContext: () => ({ eligible: true }),
      onSubmit: submit,
    });
    observations(0, 400);
    const old = rafs.values().next().value!;
    hook.stopListening();
    old(1000);
    expect(submit).not.toHaveBeenCalled();
    expect(rafs.size).toBe(0);
    await hook.startListening({
      getContext: () => ({ eligible: true }),
      onSubmit: (note) => {
        submit(note);
        hook.stopListening();
      },
    });
    observations(1000, 1500);
    expect(submit).toHaveBeenCalledOnce();
    expect(rafs.size).toBe(0);
  });
  it("ignores a continuous permission grant after OFF and a later hold owns the resources", async () => {
    const request = deferred<MediaStream>(),
      hook = MicrophoneProbe(),
      submit = vi.fn();
    getUserMedia.mockReturnValueOnce(request.promise);
    const pending = hook.startListening({
      getContext: () => ({ eligible: true }),
      onSubmit: submit,
    });
    hook.stopListening();
    await hook.startListening();
    const late = stream();
    request.resolve(late.value);
    expect(await pending).toBe(false);
    expect(late.stop).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
    expect(contexts).toHaveLength(1);
  });
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
      expect(detectPitch).toHaveBeenCalledWith(
        expect.any(Float32Array),
        rate,
        expect.objectContaining({ hz: expect.any(Number) }),
      );
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

  it.each([44100, 48000, 64000, 88200, 96000])(
    "actual Analyser PCM → shared analyzer → 220ms octave confirmation → release at %iHz",
    async (rate) => {
      const actual = await vi.importActual<
        typeof import("@/lib/music/pitchDetection")
      >("@/lib/music/pitchDetection");
      vi.mocked(detectPitch).mockImplementation(actual.detectPitch);
      captureSampleRate = rate;
      captureHz = 220;
      const hook = MicrophoneProbe();
      await hook.startListening();
      frame(0);
      frame(219);
      expect(harness.states[2]).toBeNull();
      frame(220);
      expect(harness.states[2]).toMatchObject({ name: "A", octave: 3 });
      captureHz = 440;
      frame(221);
      frame(440);
      expect(harness.states[2]).toMatchObject({ name: "A", octave: 3 });
      frame(441);
      expect(hook.stopListening()).toMatchObject({ name: "A", octave: 4 });
      expect(hook.stopListening()).toBeNull();
    },
  );

  it("hides stale displayed pitch after weak PCM while retaining the captured answer for release", async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/music/pitchDetection")
    >("@/lib/music/pitchDetection");
    vi.mocked(detectPitch).mockImplementation(actual.detectPitch);
    const hook = MicrophoneProbe();
    await hook.startListening();
    frame(0);
    frame(220);
    expect(harness.states[2]).toMatchObject({ name: "A", octave: 4 });
    captureHz = null;
    frame(230);
    frame(430);
    expect(harness.states[2]).toBeNull();
    expect(hook.signalRef.current.inputQuality).toBe("weak");
    expect(hook.stopListening()).toMatchObject({ name: "A", octave: 4 });
  });
});
