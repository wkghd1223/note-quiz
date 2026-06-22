import type { LeaderboardScorePayload } from "@/types/leaderboard";

export async function submitLeaderboardScore(payload: LeaderboardScorePayload) {
  const response = await fetch("/api/leaderboard/scores", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to submit leaderboard score.");
  }
}
