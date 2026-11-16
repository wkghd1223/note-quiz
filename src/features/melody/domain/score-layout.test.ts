import { describe, expect, it } from "vitest";
import { melodyQuarterWidthFor } from "./score-layout";

describe("melody physical bar spacing", () => {
  it("compacts the generated palette, including dotted notes and eighth triplets", () => {
    expect(
      melodyQuarterWidthFor({
        events: [
          { noteValue: 1, durationBeats: 4 },
          { noteValue: 2, durationBeats: 3 },
          { noteValue: 4, durationBeats: 1 },
          { noteValue: 8, durationBeats: 0.5 },
          { noteValue: 8, durationBeats: 320 / 960 },
        ],
      }),
    ).toBe(74);
  });

  it.each([
    { noteValue: 16 as const, durationBeats: 0.25 },
    { noteValue: 16 as const, durationBeats: 0.375 },
    { durationBeats: 0.25 }, // Persisted/historical values can lack noteValue.
    { durationBeats: 1 / 6 },
  ])(
    "keeps every bar at the original width when one event is dense: %j",
    (dense) => {
      expect(
        melodyQuarterWidthFor({
          events: [{ noteValue: 1, durationBeats: 4 }, dense],
        }),
      ).toBe(92);
    },
  );
});
