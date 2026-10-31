import { describe, expect, it } from "vitest";
import { seededRandom, utcDay } from "./random";
import { defaultConfig, serializePracticeConfig } from "./config";
import { generateTheoryQuestion } from "@/lib/music/theory";

describe("daily exercise seeds", () => {
  it("uses the UTC date on both sides of a local midnight", () => {
    expect(utcDay(new Date("2026-10-31T00:30:00+09:00"))).toBe("2026-10-30");
    expect(utcDay(new Date("2026-10-31T23:30:00-05:00"))).toBe("2026-11-01");
    expect(utcDay(new Date("2026-10-31T23:59:59.999Z"))).toBe("2026-10-31");
    expect(utcDay(new Date("2026-11-01T00:00:00.000Z"))).toBe("2026-11-01");
  });
  it("reproduces values on refresh without using identity or global randomness", () => {
    const seed = "2026-10-31:interval:basic";
    const first = seededRandom(seed),
      second = seededRandom(seed);
    const values = Array.from({ length: 100 }, () => first());
    expect(values).toEqual(Array.from({ length: 100 }, () => second()));
    expect(
      values.every(
        (value) => Number.isFinite(value) && value >= 0 && value < 1,
      ),
    ).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(90);
  });
  it("separates date, mode and difficulty streams", () => {
    const streams = [
      "2026-10-31:interval:basic",
      "2026-11-01:interval:basic",
      "2026-10-31:chord:basic",
      "2026-10-31:interval:advanced",
    ].map((seed) => Array.from({ length: 20 }, seededRandom(seed)));
    expect(new Set(streams.map((values) => JSON.stringify(values))).size).toBe(
      4,
    );
  });
  it("recreates the same ten full theory questions from date/configuration", () => {
    const config = {
      ...defaultConfig("chord", "advanced"),
      task: "inversion" as const,
    };
    const seed = `2026-10-31:${serializePracticeConfig(config)}`;
    const first = seededRandom(seed),
      second = seededRandom(seed);
    const setA = Array.from({ length: 10 }, () =>
      generateTheoryQuestion(config, first),
    );
    const setB = Array.from({ length: 10 }, () =>
      generateTheoryQuestion(config, second),
    );
    expect(setA).toEqual(setB);
    expect(
      new Set(
        setA.map(
          (question) =>
            question.root.name + question.root.accidental + question.inversion,
        ),
      ).size,
    ).toBeGreaterThan(1);
  });
});
