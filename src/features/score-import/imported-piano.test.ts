import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { prepareImportedPiano } from "./imported-piano";

afterEach(() => vi.unstubAllGlobals());

it("prepares finite piano samples for a whole chord on an output device with a different rate", async () => {
  const font = readFileSync(
    "node_modules/@coderline/alphatab/dist/soundfont/sonivox.sf2",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(Uint8Array.from(font))),
  );
  const createBuffer = vi.fn(
    (_channels: number, _frames: number, rate: number) => ({
      sampleRate: rate,
      copyToChannel: vi.fn(),
    }),
  );
  const sources: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    loop?: boolean;
  }[] = [];
  const context = {
    sampleRate: 48000,
    createBuffer,
    createBufferSource() {
      const source = { connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      sources.push(source);
      return source;
    },
    createGain: () => ({
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
    }),
  } as unknown as AudioContext;
  const notes = [60, 64, 67].map((midi, i) => ({
    midi,
    startSec: 0,
    endSec: i ? 1 : 3,
  }));
  const sound = await prepareImportedPiano(context, notes, () => true);
  for (const note of notes) sound(note.midi, 0.1, note.endSec);
  expect(createBuffer).toHaveBeenCalledTimes(3);
  expect(sources.map((source) => source.start.mock.calls[0][0])).toEqual([
    0.1, 0.1, 0.1,
  ]);
  expect(sources.map((source) => source.stop.mock.calls[0][0])).toEqual([
    3.1, 1.1, 1.1,
  ]);
  expect(sources[0].loop).toBe(true);
});
