import { afterEach, describe, expect, it, vi } from "vitest";
import { ChallengeAudioSession, classifyAudioError } from "./microphone";
import { preparePianoBuffers, pianoNoteKey } from "./piano";
import type { PerformanceEvent } from "../domain/performance";

vi.mock("./piano", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./piano")>()),
  preparePianoBuffers: vi.fn(),
}));

class FakeAnalyser {
  fftSize = 2048;
  frequencyBinCount = 1024;
  smoothingTimeConstant = 0;
  disconnect = vi.fn();
  getFloatTimeDomainData = vi.fn((values: Float32Array) => values.fill(0.1));
  getFloatFrequencyData = vi.fn((values: Float32Array) => {
    values.fill(-100);
    values[20] = -20;
  });
}
class FakeScheduledSource {
  buffer: { duration: number } | null = null;
  type = "sine";
  frequency = { value: 440 };
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
class FakeContext {
  currentTime = 0;
  sampleRate = 48000;
  analyser = new FakeAnalyser();
  createAnalyser = vi.fn(() => this.analyser);
  sources: FakeScheduledSource[] = [];
  createBuffer = vi.fn((_channels: number, length: number, rate: number) => ({
    duration: length / rate,
    length,
    sampleRate: rate,
    copyToChannel: vi.fn(),
  }));
  createBufferSource = vi.fn(() => {
    const source = new FakeScheduledSource();
    this.sources.push(source);
    return source;
  });
  createOscillator = this.createBufferSource;
  createGain = vi.fn(() => ({
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  state = "running";
  destination = {};
  onstatechange: (() => void) | null = null;
  audioWorklet = { addModule: vi.fn(async () => {}) };
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
  createMediaStreamSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
}
class FakeWorklet {
  static latest: FakeWorklet;
  constructor() {
    FakeWorklet.latest = this;
  }
  port = {
    onmessage: null as null | ((event: { data: unknown }) => void),
    postMessage: vi.fn(),
    close: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
  onprocessorerror = null;
}
afterEach(() => vi.unstubAllGlobals());
function environment(getUserMedia?: () => Promise<unknown>) {
  const track = {
    stop: vi.fn(),
    getSettings: () => ({ echoCancellation: false }),
    onended: null,
  };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("AudioWorkletNode", FakeWorklet);
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn(getUserMedia ?? (async () => stream)) },
  });
  return { track, stream };
}
function send(time: number, rms: number, hz: number | null = 261.625565) {
  let seed = 19;
  const pcm = Float32Array.from({ length: 2048 }, (_, i) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return hz === null
      ? rms * Math.sqrt(12) * (seed / 0xffffffff - 0.5)
      : rms * Math.sqrt(2) * Math.sin((2 * Math.PI * hz * i) / 48000);
  });
  FakeWorklet.latest.port.onmessage?.({
    data: {
      type: "frame",
      buffer: pcm.buffer,
      sampleRate: 48000,
      streamSampleIndex: Math.round(time * 48000),
      audioTimeSec: time,
      rms,
      droppedHops: 0,
    },
  });
}

describe("challenge microphone ownership (mocked devices, real frame analysis)", () => {
  it("reports analyzed input progress separately from output time and waits for a held event", async () => {
    environment();
    const events: PerformanceEvent[] = [];
    const session = new ChallengeAudioSession({
      onEvent: (input) => events.push(input),
      onFrame: () => {},
      onError: () => {},
    });
    await session.connectMicrophone();
    session.beginCollection("progress", 0);
    expect(session.processedThroughAudioSec).toBe(-Infinity);
    for (let i = 0; i <= 100; i++) send(i / 100, i < 10 ? 0 : 0.1);
    expect(session.processedThroughAudioSec).toBe(1);
    expect(session.finalizedBeforeAudioSec).toBe(0.1);
    expect(events).toEqual([]);
    // The output clock jumps ahead while no further PCM has arrived.
    Object.assign(session.context, { currentTime: 9 });
    expect(session.processedThroughAudioSec).toBe(1);
    expect(session.finalizedBeforeAudioSec).toBe(0.1);
    session.endCollection(true);
    expect(events[0]).toMatchObject({ onsetAudioSec: 0.1, offsetAudioSec: 1 });
    session.dispose();
  });
  it("advances the finalization frontier only after release hysteresis emits the event", async () => {
    environment();
    const events: PerformanceEvent[] = [];
    const session = new ChallengeAudioSession({
      onEvent: (input) => events.push(input),
      onFrame: () => {},
      onError: () => {},
    });
    await session.connectMicrophone();
    session.beginCollection("progress", 0);
    for (let i = 0; i < 100; i++) send(i / 100, 0.1);
    for (let i = 100; i < 105; i++) send(i / 100, 0);
    expect(session.finalizedBeforeAudioSec).toBe(0);
    expect(events).toEqual([]);
    for (let i = 105; i < 112; i++) send(i / 100, 0);
    expect(events).toHaveLength(1);
    expect(session.finalizedBeforeAudioSec).toBe(1.11);
    session.dispose();
  });
  it("calibrates ambient input during the count-in before scheduled collection", async () => {
    const { track } = environment();
    const events: PerformanceEvent[] = [];
    const session = new ChallengeAudioSession({
      onEvent: (event) => events.push(event),
      onFrame: () => {},
      onError: () => {},
    });
    expect(await session.connectMicrophone()).toBe(true);
    session.beginCollection("scheduled", 2);
    for (let i = 0; i < 190; i++) send(i / 100, 0.02, null);
    // This energy would open an event with the default threshold of .009.
    for (let i = 200; i < 250; i++) send(i / 100, 0.02, null);
    for (let i = 300; i < 400; i++) send(i / 100, 0.1);
    for (let i = 400; i < 410; i++) send(i / 100, 0);
    expect(events).toHaveLength(1);
    expect(events[0].onsetAudioSec).toBe(3);
    session.dispose();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });
  it("does not calibrate a count-in hum as ambient noise and suppress a quieter note", async () => {
    environment();
    const events: PerformanceEvent[] = [];
    const session = new ChallengeAudioSession({
      onEvent: (event) => events.push(event),
      onFrame: () => {},
      onError: () => {},
    });
    await session.connectMicrophone();
    session.beginCollection("hum", 2);
    for (let i = 0; i < 190; i++) send(i / 100, 0.08);
    for (let i = 200; i < 300; i++) send(i / 100, 0.02);
    for (let i = 300; i < 310; i++) send(i / 100, 0);
    expect(events).toHaveLength(1);
    expect(events[0].observedMidi).toBe(60);
    expect(events[0].onsetAudioSec).toBe(2);
    expect(events[0].offsetAudioSec).toBe(3);
    session.dispose();
  });
  it("exposes actual same-stream analyser PCM/magnitudes and clears them on disconnect", async () => {
    const { track } = environment();
    const session = new ChallengeAudioSession({
      onEvent: () => {},
      onFrame: () => {},
      onError: () => {},
    });
    expect(await session.connectMicrophone()).toBe(true);
    send(0, 0.9);
    // The display level comes from analyser PCM (.1), not the frame's .9 RMS,
    // while frequency is the real YIN estimate from that capture's worklet.
    expect(session.signal.rms).toBeCloseTo(0.1);
    expect(session.signal.frequencyHz).toBeCloseTo(261.6, 0);
    expect(session.signal.bins).toHaveLength(24);
    expect(session.signal.bins[13]).toBe(1);
    expect(session.signal.bins[0]).toBe(0);
    expect(session.signal.bins[23]).toBe(0);
    const context = session.context as unknown as FakeContext;
    const source = context.createMediaStreamSource.mock.results[0].value;
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(source.connect).toHaveBeenCalledWith(context.analyser);
    session.stopMicrophone();
    expect(context.analyser.disconnect).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(session.signal.rms).toBe(0);
    expect(session.signal.frequencyHz).toBeNull();
    expect([...session.signal.bins]).toEqual(Array(24).fill(0));
    session.dispose();
  });
  it("stops a late permission-granted stream after disposal", async () => {
    let grant: (value: unknown) => void = () => {};
    const { stream, track } = environment(
      () =>
        new Promise((resolve) => {
          grant = resolve;
        }),
    );
    const session = new ChallengeAudioSession({
      onEvent: () => {},
      onFrame: () => {},
      onError: () => {},
    });
    const pending = session.connectMicrophone();
    await vi.waitFor(() =>
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1),
    );
    session.dispose();
    grant(stream);
    expect(await pending).toBe(false);
    expect(track.stop).toHaveBeenCalledTimes(1);
  });
  it("never treats capture underrun as a successful note", async () => {
    environment();
    const onEvent = vi.fn(),
      onError = vi.fn();
    const session = new ChallengeAudioSession({
      onEvent,
      onFrame: () => {},
      onError,
    });
    await session.connectMicrophone();
    session.beginCollection("attempt", 0);
    FakeWorklet.latest.port.onmessage?.({
      data: {
        type: "frame",
        buffer: new Float32Array(2048).buffer,
        droppedHops: 3,
      },
    });
    expect(onError).toHaveBeenCalledWith("audio-error");
    expect(onEvent).not.toHaveBeenCalled();
    session.dispose();
  });
  it("schedules bounded beat and bar buffers on the existing context and cancels future cues", () => {
    environment();
    const session = new ChallengeAudioSession({
      onFrame: () => {},
      onEvent: () => {},
      onError: () => {},
    });
    const context = session.context as unknown as FakeContext;
    session.beatCue(3, "beat");
    session.beatCue(4, "bar");
    expect(context.sources).toHaveLength(2);
    expect(context.sources[0].start).toHaveBeenCalledWith(3);
    expect(context.sources[1].start).toHaveBeenCalledWith(4);
    expect(context.sources[0].stop).toHaveBeenCalledWith(3.028);
    expect(context.sources[1].stop).toHaveBeenCalledWith(4.045);
    for (const result of context.createBuffer.mock.results) {
      const pcm = result.value.copyToChannel.mock.calls[0][0] as Float32Array;
      expect(pcm.length).toBe(result.value.length);
      expect(Math.max(...pcm.map(Math.abs))).toBeLessThan(0.15);
    }
    session.silence();
    for (const source of context.sources) {
      expect(source.stop.mock.calls.at(-1)).toEqual([]);
      source.onended?.();
      expect(source.disconnect).toHaveBeenCalledOnce();
    }
    session.dispose();
    session.beatCue(5, "bar");
    expect(context.sources).toHaveLength(2);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
  it("keeps tone/held-tone release and cue cleanup together on disposal", () => {
    environment();
    const session = new ChallengeAudioSession({
      onFrame: () => {},
      onEvent: () => {},
      onError: () => {},
    });
    const context = session.context as unknown as FakeContext;
    session.tone(60, 1, 0.5);
    const release = session.holdTone(64);
    session.beatCue(8, "bar");
    expect(context.sources).toHaveLength(3);
    release();
    release();
    expect(context.sources[1].stop).toHaveBeenCalledTimes(1);
    session.dispose();
    expect(
      context.sources.every(
        (source) => source.stop.mock.calls.at(-1)?.length === 0,
      ),
    ).toBe(true);
    context.sources.forEach((source) => source.onended?.());
    expect(
      context.sources.every(
        (source) => source.disconnect.mock.calls.length === 1,
      ),
    ).toBe(true);
    expect(
      context.createGain.mock.results.every(
        (result) => result.value.disconnect.mock.calls.length === 1,
      ),
    ).toBe(true);
  });
  it("distinguishes permission, missing device, and busy device errors", () => {
    expect(classifyAudioError(new DOMException("", "NotAllowedError"))).toBe(
      "denied",
    );
    expect(classifyAudioError(new DOMException("", "NotFoundError"))).toBe(
      "missing-device",
    );
    expect(classifyAudioError(new DOMException("", "NotReadableError"))).toBe(
      "device-busy",
    );
  });
});

describe("sampled piano preparation and absolute source ownership", () => {
  const note = { midi: 60, durationSec: 0.475 };
  function session() {
    environment();
    vi.mocked(preparePianoBuffers).mockReset();
    return new ChallengeAudioSession({
      onFrame: () => {},
      onEvent: () => {},
      onError: () => {},
    });
  }
  function buffers(audio: ChallengeAudioSession, midi = 60) {
    const buffer = audio.context.createBuffer(
      2,
      23940,
      audio.context.sampleRate,
    );
    return new Map([[pianoNoteKey({ ...note, midi }), buffer]]);
  }
  it("uses its existing context, schedules exact starts and releases, and cancels future piano with other tones", async () => {
    const audio = session(),
      ctx = audio.context as unknown as FakeContext;
    const prepared = buffers(audio);
    vi.mocked(preparePianoBuffers).mockResolvedValue(prepared);
    await audio.preparePiano([note]);
    expect(preparePianoBuffers).toHaveBeenCalledWith(
      audio.context,
      [note],
      expect.any(Function),
    );
    expect(ctx.sources).toHaveLength(0);
    audio.pianoTone(60, 3, 0.475);
    audio.beatCue(4, "beat");
    expect(ctx.sources[0].buffer).toBe(prepared.get(pianoNoteKey(note)));
    expect(ctx.sources[0].start).toHaveBeenCalledWith(3);
    expect(ctx.sources[0].stop.mock.calls[0][0]).toBeCloseTo(3.49875, 8);
    expect(
      ctx.createGain.mock.results[0].value.gain.setValueAtTime,
    ).toHaveBeenCalledWith(1, 3);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    audio.silence();
    ctx.sources.forEach((source) => {
      expect(source.stop.mock.calls.at(-1)).toEqual([]);
      source.onended?.();
      expect(source.disconnect).toHaveBeenCalledOnce();
    });
    expect(
      ctx.createGain.mock.results[0].value.disconnect,
    ).toHaveBeenCalledOnce();
    expect(() => audio.pianoTone(60, 5, 0.475)).toThrow("not prepared");
    audio.dispose();
  });
  it("discards late prepared buffers after disposal without creating or playing a source", async () => {
    const audio = session(),
      ctx = audio.context as unknown as FakeContext;
    let resolve: (value: Map<string, AudioBuffer>) => void = () => {};
    vi.mocked(preparePianoBuffers).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = audio.preparePiano([note]);
    const prepared = buffers(audio);
    audio.dispose();
    resolve(prepared);
    await pending;
    audio.pianoTone(60, 3, 0.475);
    expect(ctx.sources).toHaveLength(0);
    expect(vi.mocked(preparePianoBuffers).mock.calls[0][2]()).toBe(false);
  });
  it("silence cancels pending preparation and the same session can retry", async () => {
    const audio = session();
    let resolve: (value: Map<string, AudioBuffer>) => void = () => {};
    vi.mocked(preparePianoBuffers).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = audio.preparePiano([note]);
    audio.silence();
    resolve(buffers(audio));
    await pending;
    expect(() => audio.pianoTone(60, 3, 0.475)).toThrow("not prepared");
    vi.mocked(preparePianoBuffers).mockResolvedValueOnce(buffers(audio));
    await audio.preparePiano([note]);
    expect(() => audio.pianoTone(60, 3, 0.475)).not.toThrow();
    audio.dispose();
  });
  it("keeps only the newest preparation and never retains a previous exercise's buffers", async () => {
    const audio = session();
    let resolve: (value: Map<string, AudioBuffer>) => void = () => {};
    vi.mocked(preparePianoBuffers).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const old = audio.preparePiano([note]);
    vi.mocked(preparePianoBuffers).mockResolvedValueOnce(buffers(audio, 62));
    await audio.preparePiano([{ ...note, midi: 62 }]);
    resolve(buffers(audio));
    await old;
    expect(() => audio.pianoTone(60, 3, 0.475)).toThrow("not prepared");
    expect(() => audio.pianoTone(62, 3, 0.475)).not.toThrow();
    audio.dispose();
  });
  it("retries failures, ignores errors from cancelled work, and rejects invalid schedules", async () => {
    const audio = session(),
      ctx = audio.context as unknown as FakeContext;
    vi.mocked(preparePianoBuffers).mockRejectedValueOnce(
      new Error("fetch failed"),
    );
    await expect(audio.preparePiano([note])).rejects.toThrow("fetch failed");
    vi.mocked(preparePianoBuffers).mockResolvedValueOnce(buffers(audio));
    await audio.preparePiano([note]);
    for (const [start, duration, gain] of [
      [NaN, 0.475, 1],
      [-1, 0.475, 1],
      [3, NaN, 1],
      [3, 0.475, Infinity],
      [3, 0.475, -1],
      [3, 0.475, 2],
    ])
      expect(() => audio.pianoTone(60, start, duration, gain)).toThrow();
    expect(ctx.sources).toHaveLength(0);
    let reject: (error: Error) => void = () => {};
    vi.mocked(preparePianoBuffers).mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const pending = audio.preparePiano([note]);
    audio.dispose();
    reject(new Error("late failure"));
    await expect(pending).resolves.toBeUndefined();
  });
});
