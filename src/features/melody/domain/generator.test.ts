import { describe, expect, it } from "vitest";
import { CLEFS, KEY_SIGNATURES } from "@/lib/music/constants";
import { buildPlaybackPlan } from "@/features/challenge/domain/playback-order";
import {
  getInstrumentProfile,
  supportsStage,
} from "@/features/challenge/domain/instrument-profile";
import { generateMelody } from "./generator";
import { defaultMelodySettings } from "./settings";

const palettes = Array.from({ length: 15 }, (_, mask) =>
  [0.5, 1, 2, 4].filter((_, index) => (mask + 1) & (1 << index)),
);
const ranges = [
  [48, 84],
  [60, 67],
  [72, 84],
];
const natural: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

describe("seeded eight-bar melody", () => {
  it.each(Object.keys(KEY_SIGNATURES))(
    "preserves musical invariants in %s across clefs, palettes, ranges and seeds",
    (keySignature) => {
      for (const clef of CLEFS)
        for (const durations of palettes)
          for (const [minMidi, maxMidi] of ranges)
            for (const seed of [0, 1, -17, 4294967295]) {
              const melody = generateMelody(
                {
                  ...defaultMelodySettings,
                  clef,
                  keySignature,
                  minMidi,
                  maxMidi,
                  durations,
                  bpm: durations.includes(0.5) ? 60 : 72,
                },
                seed,
              );
              expect(melody.measures).toBe(8);
              expect(melody.timeSignature).toEqual([4, 4]);
              expect(melody.bpm).toBe(durations.includes(0.5) ? 60 : 72);
              expect(melody.clef).toBe(clef);
              expect(melody.keySignature).toBe(keySignature);
              expect(melody.events[0]).toMatchObject({
                kind: "note",
                startBeat: 0,
              });
              expect(melody.events.at(-1)?.kind).toBe("note");
              expect(melody.events.some((event) => event.kind === "rest")).toBe(
                true,
              );
              expect(melody.supportedInputProfiles).toEqual([
                "sustained-mic-v1",
              ]);
              expect(
                supportsStage(melody, getInstrumentProfile("voice")!),
              ).toBe(true);
              expect(melody).not.toHaveProperty("barNavigation");
              for (const field of [
                "world",
                "sequence",
                "titleKey",
                "objectiveKey",
                "prerequisites",
              ])
                expect(melody).not.toHaveProperty(field);
              const totals = Array(8).fill(0);
              let cursor = 0,
                previous: number | undefined,
                run = 0;
              for (const [index, event] of melody.events.entries()) {
                expect(event.startBeat).toBe(cursor);
                expect(
                  (event.startBeat % 4) + event.durationBeats,
                ).toBeLessThanOrEqual(4);
                totals[Math.floor(event.startBeat / 4)] += event.durationBeats;
                cursor += event.durationBeats;
                if (event.kind === "rest") {
                  expect(melody.events[index - 1]?.kind).toBe("note");
                  expect(melody.events[index + 1]?.kind).toBe("note");
                  expect(event.writtenMidi).toBeUndefined();
                  expect(event.writtenSpelling).toBeUndefined();
                  continue;
                }
                expect(durations).toContain(event.durationBeats);
                expect(event.writtenMidi).toBeGreaterThanOrEqual(minMidi);
                expect(event.writtenMidi).toBeLessThanOrEqual(maxMidi);
                const [, letter, accidental, octave] =
                  /^([A-G])([#b]?)(\d)$/.exec(event.writtenSpelling!)!;
                const key = KEY_SIGNATURES[keySignature];
                expect(accidental).toBe(
                  key.sharps.includes(letter as NoteName)
                    ? "#"
                    : key.flats.includes(letter as NoteName)
                      ? "b"
                      : "",
                );
                expect(
                  (Number(octave) + 1) * 12 +
                    natural[letter] +
                    (accidental === "#" ? 1 : accidental === "b" ? -1 : 0),
                ).toBe(event.writtenMidi);
                run = previous === event.writtenMidi ? run + 1 : 1;
                expect(run).toBeLessThanOrEqual(2);
                previous = event.writtenMidi;
              }
              expect(totals).toEqual(Array(8).fill(4));
              expect(cursor).toBe(32);
              expect(new Set(melody.events.map((event) => event.id)).size).toBe(
                melody.events.length,
              );
              expect(buildPlaybackPlan(melody)).toMatchObject({
                durationBeats: 32,
                transitions: [],
              });
            }
    },
    20000,
  );
  it("is deterministic, gives settings distinct identities, and does not mutate settings", () => {
    const settings = { ...defaultMelodySettings, durations: [2, 1] };
    const melody = generateMelody(settings, 987);
    expect(generateMelody(settings, 987)).toEqual(melody);
    expect(generateMelody({ ...settings, durations: [1, 2, 1] }, 987)).toEqual(
      melody,
    );
    expect(generateMelody(settings, 988).id).not.toBe(melody.id);
    expect(generateMelody({ ...settings, clef: "bass" }, 987).id).not.toBe(
      melody.id,
    );
    expect(generateMelody({ ...settings, maxMidi: 72 }, 987).id).not.toBe(
      melody.id,
    );
    expect(settings.durations).toEqual([2, 1]);
  });
  it("allows a single in-key pitch rather than retrying forever", () => {
    const melody = generateMelody(
      { ...defaultMelodySettings, minMidi: 60, maxMidi: 60 },
      1,
    );
    expect(
      melody.events
        .filter((event) => event.kind === "note")
        .every((event) => event.writtenMidi === 60),
    ).toBe(true);
  });
  it("prefers singable nearby steps over wide leaps across seeded melodies", () => {
    let intervals = 0,
      nearby = 0;
    for (let seed = 0; seed < 40; seed++) {
      const notes = generateMelody(
        { ...defaultMelodySettings, minMidi: 48, maxMidi: 84 },
        seed,
      ).events.filter((event) => event.kind === "note");
      for (let index = 1; index < notes.length; index++) {
        intervals++;
        if (
          Math.abs(notes[index].writtenMidi! - notes[index - 1].writtenMidi!) <=
          4
        )
          nearby++;
      }
    }
    expect(nearby / intervals).toBeGreaterThan(0.65);
  });
  it("rejects invalid palettes, empty key ranges and invalid seeds clearly", () => {
    expect(() =>
      generateMelody({ ...defaultMelodySettings, durations: [] }, 1),
    ).toThrow("durations");
    expect(() =>
      generateMelody({ ...defaultMelodySettings, minMidi: 67, maxMidi: 60 }, 1),
    ).toThrow("pitchRange");
    expect(() =>
      generateMelody({ ...defaultMelodySettings, minMidi: 61, maxMidi: 61 }, 1),
    ).toThrow("noAvailablePitch");
    for (const seed of [NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])
      expect(() => generateMelody(defaultMelodySettings, seed)).toThrow(
        "invalidMelodySeed",
      );
  });
});
