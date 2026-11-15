import { describe, expect, it } from "vitest";
import { generateMelody } from "@/features/melody/domain/generator";
import { defaultMelodySettings } from "@/features/melody/domain/settings";
import { beatCues } from "./beat-cues";

describe("optional beat sounds on the score clock", () => {
  const stage = generateMelody({ ...defaultMelodySettings, bpm: 60 }, 7);
  it("is silent by default and distinguishes the two independent toggles", () => {
    expect(beatCues(stage, {})).toEqual([]);
    expect(beatCues(stage, { metronome: true })).toEqual(
      Array.from({ length: 32 }, (_, timeSec) => ({ timeSec, kind: "beat" })),
    );
    expect(beatCues(stage, { barBell: true })).toEqual(
      Array.from({ length: 8 }, (_, i) => ({ timeSec: i * 4, kind: "bar" })),
    );
    const both = beatCues(stage, { metronome: true, barBell: true });
    expect(both).toHaveLength(32);
    expect(both.slice(0, 5)).toEqual(
      [0, 1, 2, 3, 4].map((timeSec) => ({
        timeSec,
        kind: timeSec % 4 === 0 ? "bar" : "beat",
      })),
    );
  });
  it("uses dotted-quarter pulses in compound meter and excludes past beats on resume", () => {
    const compound = generateMelody(
      { ...defaultMelodySettings, bpm: 60, timeSignature: [6, 8] },
      7,
    );
    const cues = beatCues(compound, { metronome: true, barBell: true });
    expect(cues).toHaveLength(16);
    expect(cues.slice(0, 4)).toEqual([
      { timeSec: 0, kind: "bar" },
      { timeSec: 1.5, kind: "beat" },
      { timeSec: 3, kind: "bar" },
      { timeSec: 4.5, kind: "beat" },
    ]);
    expect(beatCues(compound, { metronome: true }, 1, 2).at(0)?.timeSec).toBe(
      3,
    );
    expect(
      beatCues(compound, { barBell: true }, 0.7, 4).at(0)?.timeSec,
    ).toBeCloseTo(3 / 0.7);
  });
});
