import type {
  SessionScorePayload,
  SessionScoreResponse,
} from "@/types/leaderboard";

export async function submitLeaderboardScore(
  payload: SessionScorePayload,
): Promise<SessionScoreResponse> {
  const response = await fetch("/api/leaderboard/scores", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;

    throw new Error(payload?.message ?? "Failed to submit leaderboard score.");
  }

  return (await response.json()) as SessionScoreResponse;
}
