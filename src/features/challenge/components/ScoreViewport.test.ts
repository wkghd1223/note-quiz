import { describe, it, expect } from "vitest";
import { stages, getStage } from "../data/stages";
import { stageBarScore } from "./ScoreViewport";
describe("challenge score notation contract", () => {
  it.each(stages)(
    "$id retains every written note/rest and event identity",
    (stage) => {
      const bars = Array.from({ length: stage.measures }, (_, i) =>
        stageBarScore(stage, i),
      );
      const events = bars.flatMap((bar) => bar.events);
      expect(events.map((event) => event.id)).toEqual(
        stage.events.map((event) => event.id),
      );
      expect(events.map((event) => event.notes[0]?.midi ?? null)).toEqual(
        stage.events.map((event) => event.writtenMidi ?? null),
      );
      for (const bar of bars)
        expect(
          bar.events.reduce(
            (sum, event) => sum + (4 / event.duration) * (event.dots ? 1.5 : 1),
            0,
          ),
        ).toBe(4);
    },
  );
  it("three-beat introductory rest is a dotted half rest, not truncated", () => {
    expect(stageBarScore(getStage("w3-s1")!, 0).events[1]).toMatchObject({
      notes: [],
      duration: 2,
      dots: 1,
    });
  });
});
