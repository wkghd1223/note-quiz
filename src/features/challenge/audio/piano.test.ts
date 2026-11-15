import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { estimatePitch, frequencyPitch } from "./pitch";

const font = readFileSync(
  "node_modules/@coderline/alphatab/dist/soundfont/sonivox.sf2",
);
function context(rate = 48000) {
  return {
    sampleRate: rate,
    createBuffer: vi.fn(
      (channels: number, length: number, sampleRate: number) => {
        const data = Array.from(
          { length: channels },
          () => new Float32Array(length),
        );
        return {
          length,
          sampleRate,
          duration: length / sampleRate,
          numberOfChannels: channels,
          copyToChannel: (values: Float32Array, channel: number) =>
            data[channel].set(values),
          getChannelData: (channel: number) => data[channel],
        } as unknown as AudioBuffer;
      },
    ),
  };
}
function fetchFont() {
  return vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => Uint8Array.from(font).buffer,
  }));
}
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("bundled piano, real public alphaTab offline export", () => {
  it.each([44100, 48000, 96000])(
    "renders C3..C6 stereo PCM on the requested %sHz clock without a live audio context",
    async (rate) => {
      const fetch = fetchFont();
      const audioContext = vi.fn(() => {
        throw new Error("Unexpected live context");
      });
      vi.stubGlobal("fetch", fetch);
      vi.stubGlobal("AudioContext", audioContext);
      const { preparePianoBuffers, pianoNoteKey, pianoReleaseSec } =
        await import("./piano");
      const ctx = context(rate);
      const notes = [48, 60, 72, 84].map((midi) => ({
        midi,
        durationSec: 0.475,
      }));
      const buffers = await preparePianoBuffers(
        ctx,
        [...notes, notes[0]],
        () => true,
      );
      expect(buffers.size).toBe(4);
      expect(fetch).toHaveBeenCalledWith("/alphatab/soundfont/sonivox.sf2");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(audioContext).not.toHaveBeenCalled();
      for (const note of notes) {
        const buffer = buffers.get(pianoNoteKey(note))!;
        expect(buffer.numberOfChannels).toBe(2);
        expect(buffer.sampleRate).toBe(rate);
        expect(buffer.length).toBe(
          Math.ceil(
            (note.durationSec + pianoReleaseSec(note.durationSec)) * rate,
          ),
        );
        expect(buffer.duration).toBeLessThanOrEqual(0.5);
        const pcm = buffer.getChannelData(0);
        expect(pcm.every(Number.isFinite)).toBe(true);
        expect(Math.abs(pcm[0])).toBe(0);
        expect(Math.abs(pcm.at(-1)!)).toBe(0);
        const peak = pcm.reduce(
          (max, sample) => Math.max(max, Math.abs(sample)),
          0,
        );
        expect(peak).toBeGreaterThan(0.02);
        expect(peak).toBeLessThan(0.4);
        const pitch = estimatePitch(
          pcm.subarray(Math.round(rate * 0.15), Math.round(rate * 0.15) + 2048),
          rate,
        );
        expect(pitch.hz, `MIDI ${note.midi}`).not.toBeNull();
        expect(frequencyPitch(pitch.hz!)?.midi).toBe(note.midi);
      }
    },
  );
  it("retries a failed font request and caches only the successful bytes", async () => {
    const fetch = fetchFont().mockRejectedValueOnce(
      new Error("network failed"),
    );
    vi.stubGlobal("fetch", fetch);
    const { preparePianoBuffers } = await import("./piano");
    const notes = [{ midi: 60, durationSec: 0.475 }];
    await expect(
      preparePianoBuffers(context(), notes, () => true),
    ).rejects.toThrow("network failed");
    expect((await preparePianoBuffers(context(), notes, () => true)).size).toBe(
      1,
    );
    expect((await preparePianoBuffers(context(), notes, () => true)).size).toBe(
      1,
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("stops before creating buffers after cancellation during fetch", async () => {
    let resolve: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      ),
    );
    const { preparePianoBuffers } = await import("./piano");
    let current = true;
    const ctx = context();
    const pending = preparePianoBuffers(
      ctx,
      [{ midi: 60, durationSec: 1 }],
      () => current,
    );
    current = false;
    resolve({
      ok: true,
      arrayBuffer: async () => Uint8Array.from(font).buffer,
    });
    expect((await pending).size).toBe(0);
    expect(ctx.createBuffer).not.toHaveBeenCalled();
  });
  it("rejects malformed fonts and allows the next request to recover", async () => {
    vi.stubGlobal(
      "fetch",
      fetchFont().mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(32),
      }),
    );
    const { preparePianoBuffers } = await import("./piano");
    const notes = [{ midi: 60, durationSec: 0.475 }];
    await expect(
      preparePianoBuffers(context(), notes, () => true),
    ).rejects.toThrow();
    expect((await preparePianoBuffers(context(), notes, () => true)).size).toBe(
      1,
    );
  });
  it("leaves no buffers when cancellation arrives between prepared notes", async () => {
    vi.stubGlobal("fetch", fetchFont());
    const { preparePianoBuffers } = await import("./piano");
    const ctx = context();
    const result = await preparePianoBuffers(
      ctx,
      [
        { midi: 60, durationSec: 0.475 },
        { midi: 62, durationSec: 0.475 },
      ],
      () => ctx.createBuffer.mock.calls.length === 0,
    );
    expect(result.size).toBe(0);
    expect(ctx.createBuffer).toHaveBeenCalledTimes(1);
  });
  it("bounds note count and PCM memory before fetching", async () => {
    const fetch = fetchFont();
    vi.stubGlobal("fetch", fetch);
    const { preparePianoBuffers } = await import("./piano");
    await expect(
      preparePianoBuffers(
        context(),
        Array.from({ length: 129 }, () => ({ midi: 60, durationSec: 1 })),
        () => true,
      ),
    ).rejects.toThrow("Too many");
    await expect(
      preparePianoBuffers(
        context(96000),
        Array.from({ length: 10 }, (_, i) => ({
          midi: 60 + i,
          durationSec: 10,
        })),
        () => true,
      ),
    ).rejects.toThrow("session limit");
    for (const note of [
      { midi: NaN, durationSec: 1 },
      { midi: 60.5, durationSec: 1 },
      { midi: 128, durationSec: 1 },
      { midi: 60, durationSec: Infinity },
      { midi: 60, durationSec: 0 },
      { midi: 60, durationSec: 11 },
    ])
      await expect(
        preparePianoBuffers(context(), [note], () => true),
      ).rejects.toThrow("Invalid piano note");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("native piano PCM boundary validation", () => {
  it("rejects short, odd, oversized, silent and non-finite PCM before creating a buffer", async () => {
    const { pianoBuffer } = await import("./piano");
    const ctx = context();
    const note = { midi: 60, durationSec: 0.475 };
    const frames = Math.ceil((0.475 + 0.475 / 20) * 48000);
    const valid = new Float32Array(frames * 2).fill(0.1);
    const tailOnly = new Float32Array((frames + 32) * 2);
    tailOnly[tailOnly.length - 1] = 0.1;
    const invalid = [
      tailOnly,
      undefined,
      new Float32Array(1),
      valid.subarray(0, valid.length - 2),
      new Float32Array((frames + 65) * 2).fill(0.1),
      new Float32Array(valid.length),
      Float32Array.from(valid, (v, i) => (i === 3 ? NaN : v)),
      Float32Array.from(valid, (v, i) => (i === 3 ? Infinity : v)),
    ];
    for (const pcm of invalid)
      expect(() => pianoBuffer(ctx, note, pcm)).toThrow("Invalid piano PCM");
    expect(ctx.createBuffer).not.toHaveBeenCalled();
  });
  it("deinterleaves stereo channels without changing onset or adding sample padding", async () => {
    const { pianoBuffer } = await import("./piano");
    const ctx = context();
    const note = { midi: 60, durationSec: 0.475 };
    const frames = Math.ceil((0.475 + 0.475 / 20) * 48000);
    const pcm = Float32Array.from({ length: (frames + 32) * 2 }, (_, i) =>
      i % 2 ? -0.2 : 0.1,
    );
    const buffer = pianoBuffer(ctx, note, pcm);
    expect(buffer.length).toBe(frames);
    expect(buffer.getChannelData(0)[100]).toBeCloseTo(0.1);
    expect(buffer.getChannelData(1)[100]).toBeCloseTo(-0.2);
    expect(buffer.getChannelData(0).at(-1)).toBe(0);
  });
});
