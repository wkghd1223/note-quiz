import type {
  LeaderboardCountry,
  LeaderboardEntry,
  LeaderboardScorePayload,
} from "@/types/leaderboard";
import { getCountryFromCode } from "@/lib/leaderboard/country";
import { calculateAccuracy, calculateScore } from "@/lib/leaderboard/validation";

interface SupabaseLeaderboardRow {
  country_code: string;
  country_name: string;
  total_score: number;
  total_correct: number;
  total_questions: number;
  submission_count: number;
  best_accuracy: number;
  updated_at: string;
}

const TABLE_NAME = "leaderboard_countries";

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceRoleKey,
  };
}

function createHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function mapRowToEntry(row: SupabaseLeaderboardRow, index: number): LeaderboardEntry {
  const country = getCountryFromCode(row.country_code);
  const totalQuestions = Number(row.total_questions) || 0;
  const totalCorrect = Number(row.total_correct) || 0;

  return {
    ...country,
    countryName: row.country_name || country.countryName,
    rank: index + 1,
    totalScore: Number(row.total_score) || 0,
    totalCorrect,
    totalQuestions,
    submissionCount: Number(row.submission_count) || 0,
    averageAccuracy:
      totalQuestions > 0 ? Number(((totalCorrect / totalQuestions) * 100).toFixed(1)) : 0,
    bestAccuracy: Number(row.best_accuracy) || 0,
    updatedAt: row.updated_at,
  };
}

export async function fetchLeaderboardEntries(): Promise<LeaderboardEntry[]> {
  const config = getSupabaseConfig();
  if (!config) return [];

  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/${TABLE_NAME}?select=*&order=total_score.desc,submission_count.desc&limit=100`,
    {
      headers: createHeaders(config.serviceRoleKey),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load leaderboard.");
  }

  const rows = (await response.json()) as SupabaseLeaderboardRow[];
  return rows.map(mapRowToEntry);
}

export async function submitCountryScore(
  country: LeaderboardCountry,
  payload: LeaderboardScorePayload,
) {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/increment_country_score`, {
    method: "POST",
    headers: createHeaders(config.serviceRoleKey),
    body: JSON.stringify({
      p_country_code: country.countryCode,
      p_country_name: country.countryName,
      p_score: calculateScore(payload),
      p_correct_answers: payload.correctAnswers,
      p_total_questions: payload.totalQuestions,
      p_accuracy: calculateAccuracy(payload),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to submit leaderboard score.");
  }
}
