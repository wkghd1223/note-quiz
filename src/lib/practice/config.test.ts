import { describe, expect, it } from "vitest";
import {
  defaultConfig,
  earSettings,
  noteSettings,
  parsePracticeConfig,
  serializePracticeConfig,
  type PracticeConfig,
} from "./config";

describe("shared practice configuration", () => {
  it.each(["note", "ear", "interval", "chord"] as const)(
    "roundtrips supported %s settings without session state",
    (mode) => {
      const config = defaultConfig(mode, "custom");
      Object.assign(
        config,
        mode === "note"
          ? {
              clef: "bass",
              keySignature: "Bb",
              ledgerAbove: 3,
              ledgerBelow: 2,
              answerMode: "solfege",
              enableSound: false,
              enableAccidentals: true,
              accidentalProbability: 0.75,
            }
          : mode === "ear"
            ? {
                noteSet: "chromatic",
                octaveMin: 2,
                octaveMax: 5,
                answerMode: "solfege",
                enableSound: false,
              }
            : mode === "interval"
              ? {
                  task: "interval",
                  presentation: "visual",
                  direction: "descending",
                  intervals: ["M3", "A4", "d5", "P8"],
                }
              : {
                  task: "inversion",
                  chords: ["major", "min7"],
                  inversions: [0, 2, 3],
                },
      );
      config.length = "timed";
      config.timeLimit = 180;
      const shared = serializePracticeConfig(config);
      const parsed = parsePracticeConfig(shared);
      expect(parsed.invalid).toBe(false);
      expect(parsed.shared).toBe(true);
      expect(parsed.config).toEqual(config);
      expect(shared.length).toBeLessThanOrEqual(1800);
    },
  );
  it("serializes only allowed settings and no personal or transient state", () => {
    const config = {
      ...defaultConfig("chord"),
      sessionId: "private-session",
      answers: ["C4"],
      history: ["private"],
      completed: true,
      identity: "person",
      dailyKey: "private-day",
      settings: "javascript:alert(1)",
    } as PracticeConfig;
    const params = new URLSearchParams(serializePracticeConfig(config));
    expect(Array.from(params.keys()).sort()).toEqual(
      [
        "direction",
        "length",
        "level",
        "mode",
        "seconds",
        "share",
        "task",
        "view",
      ].sort(),
    );
    expect(params.toString()).not.toMatch(
      /private|identity|answers|history|completed|javascript/i,
    );
    expect(
      parsePracticeConfig("mode=ear&sessionId=secret&answers=C4&completed=1")
        .config,
    ).toEqual(defaultConfig("ear"));
  });
  it("uses safe defaults for unknown modes, tasks and enumerated controls", () => {
    const parsed = parsePracticeConfig(
      "mode=unknown&level=expert&length=forever&view=vr&direction=sideways&task=progression&clef=oops&key=none&input=midi&notes=alien&sound=true&accidentals=true",
    );
    expect(parsed.invalid).toBe(true);
    expect(parsed.config).toEqual(defaultConfig());
  });
  it.each(["-1", "6", "1.5", "NaN", "Infinity", "", "999999999999999999999"])(
    "rejects out-of-range staff limits %s",
    (value) => {
      const parsed = parsePracticeConfig(
        `above=${encodeURIComponent(value)}&below=${encodeURIComponent(value)}`,
      );
      expect(parsed.invalid).toBe(true);
      expect(parsed.config.ledgerAbove).toBe(0);
      expect(parsed.config.ledgerBelow).toBe(0);
    },
  );
  it("rejects inverted octave ranges and microphone sharing for single-note ear", () => {
    const parsed = parsePracticeConfig("mode=ear&input=microphone&min=8&max=0");
    expect(parsed.invalid).toBe(true);
    expect(parsed.config).toMatchObject({
      answerMode: "piano",
      octaveMin: 4,
      octaveMax: 4,
    });
  });
  it.each(["29", "31", "181", "30.5", "not-a-number"])(
    "accepts only supported time presets, rejecting %s",
    (seconds) => {
      const parsed = parsePracticeConfig(`length=timed&seconds=${seconds}`);
      expect(parsed.invalid).toBe(true);
      expect(parsed.config.timeLimit).toBe(60);
    },
  );
  it("bounds accidental probability and rejects oversized query strings", () => {
    expect(
      parsePracticeConfig("probability=1.1").config.accidentalProbability,
    ).toBe(0.3);
    expect(parsePracticeConfig("probability=-0.1").invalid).toBe(true);
    const result = parsePracticeConfig(
      `mode=chord&irrelevant=${"x".repeat(1800)}`,
    );
    expect(result.invalid).toBe(true);
    expect(result.config).toEqual(defaultConfig());
  });
  it("deduplicates allow-listed choices and rejects overlong or unknown lists", () => {
    expect(
      parsePracticeConfig("mode=interval&level=custom&intervals=M3,M3,P5")
        .config.intervals,
    ).toEqual(["M3", "P5"]);
    expect(
      parsePracticeConfig("mode=chord&level=custom&chords=major,constructor")
        .invalid,
    ).toBe(true);
    expect(
      parsePracticeConfig(
        `mode=interval&intervals=${Array(21).fill("M3").join(",")}`,
      ).invalid,
    ).toBe(true);
    expect(
      parsePracticeConfig("mode=interval&view=audio&intervals=A4,d5").invalid,
    ).toBe(true);
    expect(
      parsePracticeConfig("mode=interval&view=visual&intervals=A4,d5").config
        .intervals,
    ).toEqual(["A4", "d5"]);
    expect(parsePracticeConfig("mode=chord&inversions=0,4").invalid).toBe(true);
  });
  it("normalizes invalid runtime callers before generating a share link", () => {
    const runtime = {
      ...defaultConfig("note"),
      ledgerAbove: 500,
      ledgerBelow: -3,
      timeLimit: 17,
      accidentalProbability: 5,
      keySignature: "<script>",
      intervals: Array(100).fill("private"),
    } as PracticeConfig;
    const shared = serializePracticeConfig(runtime);
    expect(shared.length).toBeLessThanOrEqual(1800);
    const parsed = parsePracticeConfig(shared);
    expect(parsed.invalid).toBe(false);
    expect(parsed.config).toMatchObject({
      ledgerAbove: 0,
      ledgerBelow: 0,
      timeLimit: 60,
      accidentalProbability: 0.3,
      keySignature: "C",
    });
  });
  it("distinguishes plain route defaults from explicit shared settings", () => {
    expect(parsePracticeConfig(new URLSearchParams("mode=note")).shared).toBe(
      false,
    );
    expect(parsePracticeConfig("mode=note&share=1").shared).toBe(true);
    expect(parsePracticeConfig("share=false").invalid).toBe(true);
  });
});

describe("existing settings adapters", () => {
  it("keeps ten, free and timed behavior distinct for both existing modes", () => {
    const config = defaultConfig();
    expect(noteSettings(config)).toMatchObject({
      questionLimit: 10,
      timeLimit: undefined,
    });
    expect(earSettings(config)).toMatchObject({
      questionLimit: 10,
      sessionType: "practice",
      timeLimit: undefined,
    });
    config.length = "free";
    expect(noteSettings(config)).toMatchObject({
      questionLimit: null,
      timeLimit: undefined,
    });
    expect(earSettings(config)).toMatchObject({
      questionLimit: null,
      sessionType: "practice",
    });
    config.length = "timed";
    config.timeLimit = 30;
    expect(noteSettings(config)).toMatchObject({
      questionLimit: null,
      timeLimit: 30,
    });
    expect(earSettings(config)).toMatchObject({
      questionLimit: null,
      sessionType: "timed",
      timeLimit: 30,
    });
  });
});

describe("focused practice links", () => {
  it("preserves an allowed directional drill", () => {
    const result = parsePracticeConfig(
      "share=1&mode=interval&task=direction&focus=lower",
    );
    expect(result.invalid).toBe(false);
    expect(
      parsePracticeConfig(serializePracticeConfig(result.config)).config.focus,
    ).toBe("lower");
  });
  it("rejects an inversion not supported by chosen chord types", () => {
    const result = parsePracticeConfig(
      "share=1&mode=chord&level=custom&task=inversion&chords=major&inversions=3&focus=third",
    );
    expect(result.invalid).toBe(true);
    expect(result.config.focus).toBeUndefined();
    expect(result.config.inversions).not.toContain(3);
  });
  it("does not accept a focus outside the selected source", () => {
    const result = parsePracticeConfig(
      "share=1&mode=interval&level=custom&task=interval&intervals=M3&focus=P5",
    );
    expect(result.invalid).toBe(true);
    expect(result.config.focus).toBeUndefined();
  });
});
