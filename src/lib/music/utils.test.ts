import { describe, expect, it } from "vitest";
import {
  DEFAULT_EAR_TRAINING_SETTINGS,
  DEFAULT_GAME_SETTINGS,
} from "./constants";
import {
  generateEarTrainingQuestion,
  generateQuestion,
  getNoteFrequency,
  midiToNote,
  noteToMidi,
  stringToNote,
} from "./utils";
const note = (value: string) => stringToNote(value)!;
function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

describe("pitch and octave boundaries", () => {
  it.each([
    ["Db4", "C#4"],
    ["Bb4", "A#4"],
    ["E#4", "F4"],
    ["B#4", "C5"],
    ["Cb4", "B3"],
    ["Fb4", "E4"],
  ])("plays %s at the same frequency as %s", (a, b) => {
    expect(getNoteFrequency(note(a))).toBeCloseTo(getNoteFrequency(note(b)), 8);
  });
  it("uses A440 as its reference and transposes exactly by octaves", () => {
    expect(getNoteFrequency(note("A4"))).toBe(440);
    expect(getNoteFrequency(note("A5"))).toBe(880);
    expect(getNoteFrequency(note("Db4"))).toBeCloseTo(277.1826309768721, 7);
    expect(getNoteFrequency(note("Cb0"))).toBeCloseTo(15.433853164253883, 7);
    expect(getNoteFrequency(note("B#8"))).toBeCloseTo(8372.018089619156, 7);
  });
  it("roundtrips every supported MIDI pitch instead of substituting A4", () => {
    for (let midi = 12; midi <= 119; midi++)
      for (const flats of [false, true])
        expect(noteToMidi(midiToNote(midi, flats))).toBe(midi);
    expect(() => midiToNote(11)).toThrow(RangeError);
    expect(() =>
      getNoteFrequency({
        name: "Q" as NoteName,
        octave: 4,
        accidental: "natural",
      }),
    ).toThrow(RangeError);
  });
});

describe("seeded existing questions", () => {
  it("keeps note contexts identical across refresh-equivalent seeds", () => {
    const first = seeded(1),
      second = seeded(1);
    const config = {
      ...DEFAULT_GAME_SETTINGS,
      clef: "random" as const,
      keySignature: "random",
      enableAccidentals: true,
      accidentalProbability: 0.7,
    };
    expect(
      Array.from({ length: 10 }, () => generateQuestion(config, first)),
    ).toEqual(
      Array.from({ length: 10 }, () => generateQuestion(config, second)),
    );
  });
  it("reproduces natural and chromatic ear sets with the supplied source only", () => {
    for (const noteSet of ["natural", "chromatic"] as const) {
      const first = seeded(94),
        second = seeded(94);
      const config = { ...DEFAULT_EAR_TRAINING_SETTINGS, noteSet };
      expect(
        Array.from({ length: 10 }, () =>
          generateEarTrainingQuestion(config, first),
        ),
      ).toEqual(
        Array.from({ length: 10 }, () =>
          generateEarTrainingQuestion(config, second),
        ),
      );
    }
  });
});
