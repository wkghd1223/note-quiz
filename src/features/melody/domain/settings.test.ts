import { describe, expect, it } from "vitest";
import {
  defaultMelodySettings,
  getMelodyPitches,
  sanitizeMelodySettings,
  validateMelodySettings,
} from "./settings";

describe("melody settings validation and restoration", () => {
  it("uses treble C4–G4 and quarter/half notes by default", () => {
    expect(defaultMelodySettings).toEqual({
      clef: "treble",
      keySignature: "C",
      minMidi: 60,
      maxMidi: 67,
      durations: [1, 2],
      bpm: 72,
      timeSignature: [4, 4],
      dotted: false,
      triplets: false,
      metronome: false,
      barBell: false,
    });
  });
  it.each([
    [null, "settingsObject"],
    [[], "settingsObject"],
    ["{}", "settingsObject"],
    [{ clef: "random" }, "clef"],
    [{ keySignature: "__proto__" }, "keySignature"],
    [{ keySignature: "H" }, "keySignature"],
    [{ minMidi: 47 }, "minMidi"],
    [{ maxMidi: 85 }, "maxMidi"],
    [{ minMidi: 60.5 }, "minMidi"],
    [{ maxMidi: NaN }, "maxMidi"],
    [{ minMidi: 67, maxMidi: 60 }, "pitchRange"],
    [{ durations: [] }, "durations"],
    [{ durations: [0] }, "durations"],
    [{ durations: [1, 3] }, "durations"],
    [{ durations: ["1"] }, "durations"],
    [{ durations: Array(2) }, "durations"],
    [{ minMidi: 61, maxMidi: 61 }, "noAvailablePitch"],
  ])("rejects malformed input %j with %s", (patch, error) => {
    const input =
      patch && !Array.isArray(patch) && typeof patch === "object"
        ? { ...defaultMelodySettings, ...patch }
        : patch;
    const result = validateMelodySettings(input);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain(error);
  });
  it("normalizes durations and strips untrusted extra properties", () => {
    const settings = {
      ...defaultMelodySettings,
      durations: [2, 0.5, 2, 1],
      bpm: 60,
      extra: true,
    };
    expect(validateMelodySettings(settings)).toEqual({
      valid: true,
      settings: {
        ...defaultMelodySettings,
        durations: [0.5, 1, 2],
        bpm: 60,
      },
    });
    expect(settings.durations).toEqual([2, 0.5, 2, 1]);
  });
  it("restores safe independent values from parsed localStorage payloads", () => {
    const restored = sanitizeMelodySettings(
      JSON.parse('{"durations":[],"clef":"bass"}'),
    );
    expect(restored).toEqual(defaultMelodySettings);
    restored.durations.push(4);
    expect(defaultMelodySettings.durations).toEqual([1, 2]);
    const valid = {
      ...defaultMelodySettings,
      clef: "bass" as const,
      durations: [2],
    };
    const loaded = sanitizeMelodySettings(JSON.parse(JSON.stringify(valid)));
    expect(loaded).toEqual(valid);
    loaded.durations.push(4);
    expect(valid.durations).toEqual([2]);
  });
  it("spells enharmonic boundary pitches using the letter's octave", () => {
    expect(
      getMelodyPitches({ keySignature: "C#", minMidi: 60, maxMidi: 60 }),
    ).toEqual([{ midi: 60, spelling: "B#3" }]);
    expect(
      getMelodyPitches({ keySignature: "Cb", minMidi: 59, maxMidi: 59 }),
    ).toEqual([{ midi: 59, spelling: "Cb4" }]);
    expect(
      getMelodyPitches({ keySignature: "C#", minMidi: 84, maxMidi: 84 }),
    ).toEqual([{ midi: 84, spelling: "B#5" }]);
  });
  it("migrates v1 settings without discarding their musical selections", () => {
    const legacy = {
      clef: "bass",
      keySignature: "Eb",
      minMidi: 48,
      maxMidi: 62,
      durations: [0.5, 2],
    };
    expect(validateMelodySettings(legacy)).toEqual({
      valid: true,
      settings: {
        ...legacy,
        bpm: 60,
        timeSignature: [4, 4],
        dotted: false,
        triplets: false,
        metronome: false,
        barBell: false,
      },
    });
    expect(sanitizeMelodySettings({ ...legacy, durations: [1] }).bpm).toBe(72);
  });
  it.each([
    [{ bpm: 39 }, "bpm"],
    [{ bpm: 181 }, "bpm"],
    [{ bpm: 60.5 }, "bpm"],
    [{ bpm: undefined }, "bpm"],
    [{ bpm: null }, "bpm"],
    [{ bpm: "72" }, "bpm"],
    [{ timeSignature: [5, 4] }, "timeSignature"],
    [{ timeSignature: [3, 8] }, "timeSignature"],
    [{ timeSignature: [4, 4, 4] }, "timeSignature"],
    [{ timeSignature: undefined }, "timeSignature"],
    [{ dotted: 1 }, "dotted"],
    [{ dotted: undefined }, "dotted"],
    [{ triplets: "true" }, "triplets"],
    [{ triplets: null }, "triplets"],
    [{ metronome: null }, "metronome"],
    [{ barBell: "true" }, "barBell"],
  ])("rejects explicit malformed rhythm settings %j", (patch, error) => {
    const result = validateMelodySettings({
      ...defaultMelodySettings,
      ...patch,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain(error);
  });
  it.each([
    [2, 4],
    [3, 4],
    [6, 8],
  ])(
    "rejects only-whole notes in %i/%i without crossing bars",
    (numerator, denominator) => {
      const result = validateMelodySettings({
        ...defaultMelodySettings,
        timeSignature: [numerator, denominator],
        durations: [4],
        dotted: true,
      });
      expect(result).toEqual({ valid: false, errors: ["noFittingNotes"] });
    },
  );
  it("allows BPM limits for fitting notes and independent triplet groups throughout the supported range", () => {
    for (const bpm of [40, 180])
      expect(
        validateMelodySettings({
          ...defaultMelodySettings,
          bpm,
          timeSignature: [3, 4],
          durations: [2],
          dotted: true,
        }).valid,
      ).toBe(true);
    expect(
      validateMelodySettings({
        ...defaultMelodySettings,
        timeSignature: [3, 4],
        durations: [4],
        triplets: true,
        bpm: 40,
      }).valid,
    ).toBe(true);
  });
  it("allows every supported rhythm throughout the 40–180 BPM range", () => {
    for (const durations of [[1, 2], [0.5], [0.25]])
      for (const triplets of [false, true])
        for (const bpm of [40, 60, 72, 120, 180]) {
          const settings = {
            ...defaultMelodySettings,
            durations,
            triplets,
            bpm,
          };
          expect(validateMelodySettings(settings)).toEqual({
            valid: true,
            settings,
          });
          expect(sanitizeMelodySettings(settings)).toEqual(settings);
        }
  });
  it.each([
    [3, 4],
    [6, 8],
  ])("allows half-only %i/%i with correctly written per-bar rests", (n, d) => {
    expect(
      validateMelodySettings({
        ...defaultMelodySettings,
        timeSignature: [n, d],
        durations: [2],
      }).valid,
    ).toBe(true);
  });
  it("clones meter and palette when restoring defaults or valid settings", () => {
    for (const payload of [null, { ...defaultMelodySettings }]) {
      const restored = sanitizeMelodySettings(payload);
      restored.timeSignature[0] = 3;
      restored.durations.push(4);
      expect(defaultMelodySettings.timeSignature).toEqual([4, 4]);
      expect(defaultMelodySettings.durations).toEqual([1, 2]);
    }
  });
});
