import { NextResponse } from "next/server";
import {
  fetchLeaderboardEntries,
  getCurrentUtcPeriodDate,
} from "@/lib/leaderboard/supabase";
import type { LeaderboardResponse } from "@/types/leaderboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const periodDate = getCurrentUtcPeriodDate();
    const response: LeaderboardResponse = {
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
