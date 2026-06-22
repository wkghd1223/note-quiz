import { NextResponse, type NextRequest } from "next/server";
import { detectCountryFromHeaders } from "@/lib/leaderboard/country";
import {
  fetchLeaderboardEntries,
  getCurrentUtcPeriodDate,
} from "@/lib/leaderboard/supabase";
import type { LeaderboardResponse } from "@/types/leaderboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const periodDate = getCurrentUtcPeriodDate();
    const response: LeaderboardResponse = {
      viewerCountry: detectCountryFromHeaders(request.headers),
      periodDate,
      entries: await fetchLeaderboardEntries(periodDate),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to load leaderboard:", error);

    return NextResponse.json(
      { message: "Failed to load leaderboard." },
      { status: 500 },
    );
  }
}
