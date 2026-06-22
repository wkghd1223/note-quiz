"use client";

import { useEffect, useState } from "react";
import type { LeaderboardResponse } from "@/types/leaderboard";

const numberFormatter = new Intl.NumberFormat("en");

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPeriodDate(value: string | undefined) {
  if (!value) return "Today";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function LeaderboardClient() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const response = await fetch("/api/leaderboard", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load leaderboard.");
        }

        setLeaderboard((await response.json()) as LeaderboardResponse);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load leaderboard.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaderboard();
  }, []);

  const viewerCountry = leaderboard?.viewerCountry;
  const periodDate = leaderboard?.periodDate;
  const entries = leaderboard?.entries ?? [];

  return (
    <div className="min-h-screen bg-[#f7f3ff] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-6xl space-y-8">
        <section className="space-y-4">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#6d28d9]">
            Global Rankings
          </p>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-black tracking-[-0.03em] text-slate-950 sm:text-5xl">
                Today&apos;s Nationality Leaderboard
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Scores from the main Note Quiz game are grouped by country and ranked by
                total score for the current UTC day.
              </p>
            </div>
            <div className="rounded-2xl border border-[#ded6f7] bg-white px-5 py-4 text-left shadow-[0_12px_35px_rgba(76,29,149,0.06)] md:text-right">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Accumulation Period
              </p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {formatPeriodDate(periodDate)} UTC
              </p>
              <p className="mt-1 text-sm text-slate-600">Scores reset daily.</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#ded6f7] bg-white p-6 shadow-[0_18px_55px_rgba(76,29,149,0.08)]">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#6d28d9]">
            Your Country
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="text-5xl" aria-hidden="true">
                {viewerCountry?.flag ?? "🏳"}
              </span>
              <div>
                <p className="text-2xl font-black text-slate-950">
                  {viewerCountry?.countryName ?? "Detecting country"}
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-[#6d28d9]">
                  Country code: {viewerCountry?.countryCode ?? "--"}
                </p>
              </div>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-600">
              Country is detected server-side for leaderboard grouping. Raw IP addresses
              are not stored for scoring. Daily aggregate rows are retained for 90 days.
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-[#ded6f7] bg-white shadow-[0_18px_55px_rgba(76,29,149,0.08)]">
          <div className="border-b border-[#ded6f7] px-6 py-5">
            <h2 className="text-2xl font-black text-slate-950">Country Rankings</h2>
          </div>

          {isLoading && (
            <div className="px-6 py-12 text-center text-slate-600">
              Loading leaderboard...
            </div>
          )}

          {!isLoading && errorMessage && (
            <div className="px-6 py-12 text-center text-red-600">{errorMessage}</div>
          )}

          {!isLoading && !errorMessage && entries.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-600">
              No leaderboard scores yet. Complete a game to start the rankings.
            </div>
          )}

          {!isLoading && !errorMessage && entries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[#faf9fe] text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Rank</th>
                    <th className="px-6 py-4">Country</th>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Total Score</th>
                    <th className="px-6 py-4">Submissions</th>
                    <th className="px-6 py-4">Avg Accuracy</th>
                    <th className="px-6 py-4">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ede7fb]">
                  {entries.map((entry) => (
                    <tr key={entry.countryCode} className="text-slate-700">
                      <td className="px-6 py-4 text-lg font-black text-slate-950">
                        #{entry.rank}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl" aria-hidden="true">
                            {entry.flag}
                          </span>
                          <span className="font-bold text-slate-950">
                            {entry.countryName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-[#6d28d9]">
                        {entry.countryCode}
                      </td>
                      <td className="px-6 py-4 font-bold">
                        {numberFormatter.format(entry.totalScore)}
                      </td>
                      <td className="px-6 py-4">
                        {numberFormatter.format(entry.submissionCount)}
                      </td>
                      <td className="px-6 py-4">{entry.averageAccuracy.toFixed(1)}%</td>
                      <td className="px-6 py-4">{formatDate(entry.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
