export interface LeaderboardCountry {
  countryCode: string;
  countryName: string;
  flag: string;
}

export interface LeaderboardEntry extends LeaderboardCountry {
  rank: number;
  periodDate: string;
  totalScore: number;
  totalCorrect: number;
  totalQuestions: number;
  submissionCount: number;
  averageAccuracy: number;
  bestAccuracy: number;
  updatedAt: string;
}

export type SessionScoreSubmissionStatus =
  | "accepted"
  | "duplicate"
  | "ineligible";

export interface SessionScorePayload {
  schemaVersion: 2;
  sessionId: string;
  mode: "note";
  totalQuestions: number;
  correctAnswers: number;
  totalTime: number;
}

export interface SessionScoreResponse {
  ok: true;
  country: LeaderboardCountry;
  sessionPoints: number;
  submissionStatus: SessionScoreSubmissionStatus;
}

export interface LeaderboardResponse {
  viewerCountry: LeaderboardCountry;
  periodDate: string;
  entries: LeaderboardEntry[];
}
