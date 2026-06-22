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

export interface LeaderboardScorePayload {
  totalQuestions: number;
  correctAnswers: number;
  totalTime: number;
}

export interface LeaderboardResponse {
  viewerCountry: LeaderboardCountry;
  periodDate: string;
  entries: LeaderboardEntry[];
}
