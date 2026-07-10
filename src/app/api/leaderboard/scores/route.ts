import { NextResponse, type NextRequest } from "next/server";
import { detectCountryFromHeaders } from "@/lib/leaderboard/country";
import { submitCountrySession } from "@/lib/leaderboard/supabase";
import {
  calculateAccuracy,
  calculateSessionPoints,
  isScoreEligible,
  parseScorePayload,
  ScorePayloadValidationError,
} from "@/lib/leaderboard/validation";
import type { SessionScoreResponse } from "@/types/leaderboard";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = parseScorePayload(await request.json());
    const country = await detectCountryFromHeaders(request.headers);
    const sessionPoints = calculateSessionPoints(
      payload.correctAnswers,
      payload.totalQuestions,
    );

    if (!isScoreEligible(payload.totalQuestions)) {
      const response: SessionScoreResponse = {
        ok: true,
        country,
        sessionPoints,
        submissionStatus: "ineligible",
      };

      return NextResponse.json(response);
    }

    const submissionStatus = await submitCountrySession(
      country,
      payload.sessionId,
      sessionPoints,
      payload.totalQuestions,
      payload.correctAnswers,
      calculateAccuracy(payload.correctAnswers, payload.totalQuestions),
    );

    const response: SessionScoreResponse = {
      ok: true,
      country,
      sessionPoints,
      submissionStatus,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to submit leaderboard score.";
    const status =
      error instanceof ScorePayloadValidationError ||
      error instanceof SyntaxError
        ? 400
        : 503;

    console.error("Failed to submit leaderboard score:", error);

    return NextResponse.json({ message }, { status });
  }
}
