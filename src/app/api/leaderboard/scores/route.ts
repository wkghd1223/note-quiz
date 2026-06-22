import { NextResponse, type NextRequest } from "next/server";
import { detectCountryFromHeaders } from "@/lib/leaderboard/country";
import { submitCountryScore } from "@/lib/leaderboard/supabase";
import { parseScorePayload } from "@/lib/leaderboard/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = parseScorePayload(await request.json());
    const country = await detectCountryFromHeaders(request.headers);

    await submitCountryScore(country, payload);

    return NextResponse.json({
      ok: true,
      country,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit leaderboard score.";
    const status = message.includes("Supabase") ? 503 : 400;

    console.error("Failed to submit leaderboard score:", error);

    return NextResponse.json({ message }, { status });
  }
}
