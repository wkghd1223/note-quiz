import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LeaderboardEntry } from "@/types/leaderboard";

const { detectCountryFromHeaders, fetchLeaderboardEntries } = vi.hoisted(
  () => ({
    detectCountryFromHeaders: vi.fn(),
    fetchLeaderboardEntries: vi.fn(),
  }),
);

vi.mock("@/lib/leaderboard/country", () => ({ detectCountryFromHeaders }));
vi.mock("@/lib/leaderboard/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/leaderboard/supabase")>()),
  fetchLeaderboardEntries,
}));

import { GET } from "./route";

// Next supplies a request even when a public handler does not consume it.
const handleGet: (request: NextRequest) => ReturnType<typeof GET> = GET;
const request = () =>
  new NextRequest("http://localhost/api/leaderboard", {
    headers: {
      "x-forwarded-for": "8.8.8.8",
      "cloudfront-viewer-country": "KR",
    },
  });
const entry: LeaderboardEntry = {
  countryCode: "KR",
  countryName: "South Korea",
  flag: "🇰🇷",
  rank: 1,
  periodDate: "2026-11-15",
  totalScore: 18,
  totalCorrect: 15,
  totalQuestions: 20,
  submissionCount: 1,
  averageAccuracy: 75,
  bestAccuracy: 75,
  updatedAt: "2026-11-15T23:00:00.000Z",
};

describe("GET /api/leaderboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T23:59:59.000Z"));
    detectCountryFromHeaders.mockReset();
    detectCountryFromHeaders.mockResolvedValue({ countryCode: "KR" });
    fetchLeaderboardEntries.mockReset();
    fetchLeaderboardEntries.mockResolvedValue([entry]);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => vi.useRealTimers());

  it("loads public rankings without waiting for a forwarded-IP country lookup", async () => {
    detectCountryFromHeaders.mockImplementation(() => new Promise(() => {}));

    const response = handleGet(request());

    expect(fetchLeaderboardEntries).toHaveBeenCalledWith("2026-11-15");
    expect(detectCountryFromHeaders).not.toHaveBeenCalled();
    const loaded = await response;
    expect(loaded.status).toBe(200);
    await expect(loaded.json()).resolves.toEqual({
      periodDate: "2026-11-15",
      entries: [entry],
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reads the current UTC period afresh across midnight and returns empty rankings", async () => {
    fetchLeaderboardEntries.mockResolvedValue([]);
    const beforeMidnight = await handleGet(request());
    await expect(beforeMidnight.json()).resolves.toEqual({
      periodDate: "2026-11-15",
      entries: [],
    });

    vi.setSystemTime(new Date("2026-11-16T00:00:00.000Z"));
    const afterMidnight = await handleGet(request());
    await expect(afterMidnight.json()).resolves.toEqual({
      periodDate: "2026-11-16",
      entries: [],
    });
    expect(fetchLeaderboardEntries.mock.calls).toEqual([
      ["2026-11-15"],
      ["2026-11-16"],
    ]);
    expect(detectCountryFromHeaders).not.toHaveBeenCalled();
  });

  it("returns the existing failure response when ranking storage fails", async () => {
    fetchLeaderboardEntries.mockRejectedValue(new Error("Storage unavailable"));

    const response = await handleGet(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: "Failed to load leaderboard.",
    });
    expect(detectCountryFromHeaders).not.toHaveBeenCalled();
  });
});
