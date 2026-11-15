import { expect, it } from "vitest";
import { playbackAudioTime } from "./playback-clock";

it("projects the device timestamp without assuming a constant latency", () => {
  const context = {
    currentTime: 10.1,
    getOutputTimestamp: () => ({ contextTime: 10, performanceTime: 1000 }),
  };
  expect(playbackAudioTime(context, 1040)).toBeCloseTo(10.04);
  expect(playbackAudioTime(context, 1200)).toBe(10.1);
});
it("uses the render clock for unavailable, startup or stale output timestamps", () => {
  expect(playbackAudioTime({ currentTime: 2 }, 100)).toBe(2);
  for (const stamp of [
    { contextTime: 0, performanceTime: 0 },
    { contextTime: 1, performanceTime: 200 },
    { contextTime: 1, performanceTime: -200 },
    { contextTime: NaN, performanceTime: 90 },
  ])
    expect(
      playbackAudioTime(
        { currentTime: 2, getOutputTimestamp: () => stamp },
        100,
      ),
    ).toBe(2);
});
