import { afterEach, describe, expect, it, vi } from "vitest";
import { detectCountryFromHeaders } from "./country";
describe("bounded country lookup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it("falls back within two seconds even when external transport never settles", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetch);
    const lookup = detectCountryFromHeaders(
      new Headers({
        "x-forwarded-for": "8.8.8.8",
        "cloudfront-viewer-country": "KR",
      }),
    );
    await vi.advanceTimersByTimeAsync(2000);
    expect((await lookup).countryCode).toBe("KR");
    expect(fetch.mock.calls).toHaveLength(1);
  });
  it("does not change existing header trust or add raw identifiers to results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unavailable")));
    const result = await detectCountryFromHeaders(
      new Headers({ "x-forwarded-for": "8.8.8.8" }),
    );
    expect(result).toEqual({
      countryCode: "XX",
      countryName: "Unknown",
      flag: "🏳",
    });
  });
});
