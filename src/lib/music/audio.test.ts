import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  disposeAudio,
  getAudioContextState,
  initializeAudio,
  playArpeggio,
  playChord,
  playNote,
  playPianoNote,
  playSequence,
  stopAllNotes,
} from "./audio";
import { stringToNote } from "./utils";
class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}
class FakeGain {
  gain = new FakeParam();
  connect = vi.fn();
  disconnect = vi.fn();
}
class FakeOscillator {
  type = "sine";
  frequency = new FakeParam();
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
class FakeContext {
  static instances: FakeContext[] = [];
  static deferredResume: Promise<void> | null = null;
  static failResume = false;
  state: AudioContextState = "suspended";
  currentTime = 10;
  destination = {};
  gains: FakeGain[] = [];
  oscillators: FakeOscillator[] = [];
  constructor() {
    FakeContext.instances.push(this);
  }
  createGain = () => {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  };
  createOscillator = () => {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  };
  resume = vi.fn(async () => {
    if (FakeContext.failResume) throw new Error("denied");
    if (FakeContext.deferredResume) await FakeContext.deferredResume;
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
}
const note = (value: string) => stringToNote(value)!;
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
const context = () => FakeContext.instances.at(-1)!;

beforeEach(() => {
  disposeAudio();
  FakeContext.instances = [];
  FakeContext.deferredResume = null;
  FakeContext.failResume = false;
  vi.stubGlobal("window", { AudioContext: FakeContext });
});
afterEach(() => {
  disposeAudio();
  vi.unstubAllGlobals();
});

describe("scheduled and bounded playback", () => {
  it("starts a chord on one clock and normalizes its summed envelope", async () => {
    const playing = playChord([note("C4"), note("E4"), note("G4")]);
    await flush();
    expect(context().oscillators).toHaveLength(3);
    expect(
      context().oscillators.map(
        (oscillator) => oscillator.start.mock.calls[0][0],
      ),
    ).toEqual([10.01, 10.01, 10.01]);
    const peaks = context()
      .gains.filter(
        (gain) => gain.gain.linearRampToValueAtTime.mock.calls.length,
      )
      .map((gain) => gain.gain.linearRampToValueAtTime.mock.calls[0][0]);
    expect(peaks.reduce((total, value) => total + value, 0)).toBeCloseTo(1);
    context().oscillators.forEach((oscillator) => oscillator.onended?.());
    await playing;
    expect(
      context().oscillators.every(
        (oscillator) => oscillator.disconnect.mock.calls.length > 0,
      ),
    ).toBe(true);
  });
  it("schedules an entire sequence without timer callbacks, including piano harmonics", async () => {
    const playing = playSequence(
      [
        [note("C4"), note("E4"), note("G4")],
        [note("D4"), note("F4"), note("A4")],
      ],
      650,
      120,
    );
    await flush();
    expect(context().oscillators).toHaveLength(24);
    expect(
      new Set(
        context()
          .oscillators.slice(0, 12)
          .map((oscillator) => oscillator.start.mock.calls[0][0]),
      ).size,
    ).toBe(1);
    expect(context().oscillators[12].start.mock.calls[0][0]).toBeCloseTo(10.78);
    const firstVoiceHarmonics = context()
      .gains.slice(2, 6)
      .map((gain) => gain.gain.value);
    expect(
      firstVoiceHarmonics.reduce((sum, value) => sum + value, 0),
    ).toBeCloseTo(1);
    const firstChordEnvelopes = context()
      .gains.filter(
        (gain) => gain.gain.linearRampToValueAtTime.mock.calls.length,
      )
      .slice(0, 3);
    expect(
      firstChordEnvelopes.reduce(
        (sum, gain) => sum + gain.gain.linearRampToValueAtTime.mock.calls[0][0],
        0,
      ),
    ).toBeCloseTo(1);
    stopAllNotes();
    await playing;
    expect(
      context().oscillators.every(
        (oscillator) => oscillator.stop.mock.calls.at(-1)?.[0] === 10,
      ),
    ).toBe(true);
  });
  it("cancels future arpeggio notes and settles previous playback before replacing it", async () => {
    const old = playArpeggio([note("C4"), note("E4"), note("G4")]);
    await flush();
    const oldOscillators = context().oscillators.slice();
    const next = playPianoNote(note("A4"));
    await flush();
    await old;
    expect(
      oldOscillators.every(
        (oscillator) => oscillator.disconnect.mock.calls.length === 1,
      ),
    ).toBe(true);
    stopAllNotes();
    await next;
  });
  it("keeps short-note envelope times ordered", async () => {
    const playing = playNote(note("C4"), 1);
    await flush();
    const gain = context().gains.find(
      (gain) => gain.gain.linearRampToValueAtTime.mock.calls.length,
    )!;
    const times = [
      gain.gain.setValueAtTime.mock.calls[0][1],
      gain.gain.linearRampToValueAtTime.mock.calls[0][1],
      gain.gain.exponentialRampToValueAtTime.mock.calls[0][1],
      gain.gain.setValueAtTime.mock.calls[1][1],
      gain.gain.linearRampToValueAtTime.mock.calls[1][1],
    ];
    expect(times).toEqual([...times].sort((a, b) => a - b));
    stopAllNotes();
    await playing;
  });
});

describe("audio lifecycle and recovery", () => {
  it("resumes an initialized context again after browser suspension", async () => {
    await initializeAudio();
    expect(getAudioContextState()).toBe("running");
    context().state = "suspended";
    await initializeAudio();
    expect(context().resume).toHaveBeenCalledTimes(2);
    expect(FakeContext.instances).toHaveLength(1);
  });
  it("does not schedule old notes after delayed initialization is canceled", async () => {
    let resume!: () => void;
    FakeContext.deferredResume = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const old = playNote(note("C4"));
    await flush();
    stopAllNotes();
    resume();
    await old;
    expect(context().oscillators).toHaveLength(0);
  });
  it("allows a fresh gesture to recover from a rejected initialization", async () => {
    FakeContext.failResume = true;
    await expect(playNote(note("C4"))).rejects.toThrow("denied");
    FakeContext.failResume = false;
    const playing = playNote(note("C4"));
    await flush();
    expect(context().oscillators).toHaveLength(1);
    stopAllNotes();
    await playing;
  });
  it("reports unsupported audio rather than fabricating successful playback", async () => {
    vi.stubGlobal("window", {});
    await expect(initializeAudio()).rejects.toThrow("not supported");
    expect(getAudioContextState()).toBeNull();
  });
});
