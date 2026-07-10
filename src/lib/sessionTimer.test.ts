import { describe, expect, it } from "vitest";
import { hasReachedTimeLimit } from "./sessionTimer";

describe("hasReachedTimeLimit", () => {
  it("triggers exactly at the configured boundary", () => {
    expect(hasReachedTimeLimit(29_999, 30)).toBe(false);
    expect(hasReachedTimeLimit(30_000, 30)).toBe(true);
  });

  it("does not expire an unlimited session", () => {
    expect(hasReachedTimeLimit(500_000, undefined)).toBe(false);
  });
});
