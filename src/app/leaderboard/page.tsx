import type { Metadata } from "next";
import LeaderboardClient from "@/app/leaderboard/LeaderboardClient";
import { siteUrl } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "Nationality Leaderboard | Note Quiz",
  description:
    "See Note Quiz country rankings by total score, submissions, and average accuracy.",
  alternates: {
    canonical: `${siteUrl}/leaderboard`,
  },
  openGraph: {
    title: "Nationality Leaderboard | Note Quiz",
    description:
      "See Note Quiz country rankings by total score, submissions, and average accuracy.",
    url: `${siteUrl}/leaderboard`,
  },
};

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
