"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FaChevronRight, FaTrophy } from "react-icons/fa";
import type {
  LeaderboardEntry,
  LeaderboardResponse,
} from "@/types/leaderboard";
import { useTranslation } from "@/hooks/useTranslation";
import BottomSheet from "./BottomSheet";

interface LeaderboardTickerProps {
  isMobileOpen: boolean;
  onMobileOpen: () => void;
  onMobileClose: () => void;
}

export default function LeaderboardTicker({
  isMobileOpen,
  onMobileOpen,
  onMobileClose,
}: LeaderboardTickerProps) {
  const { t, language } = useTranslation();
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(
    null,
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadLeaderboard() {
      try {
        const response = await fetch("/api/leaderboard", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as LeaderboardResponse;
        if (!ignore) setLeaderboard(data);
      } catch {
        if (!ignore) setLeaderboard(null);
      }
    }

    loadLeaderboard();

    return () => {
      ignore = true;
    };
  }, []);

  const entries = useMemo(() => leaderboard?.entries ?? [], [leaderboard]);
  const tickerText = useMemo(() => {
    if (entries.length === 0) return t.leaderboard.empty;
    const formatter = new Intl.NumberFormat(language);

    return entries
      .slice(0, 5)
      .map(
        (entry) =>
          `#${entry.rank} ${entry.flag} ${entry.countryName} ${formatter.format(entry.totalScore)} ${t.leaderboard.columns.totalScore}`,
      )
      .join("  /  ");
  }, [
    entries,
    language,
    t.leaderboard.columns.totalScore,
    t.leaderboard.empty,
  ]);

  return (
    <div className="relative border-y border-slate-200 bg-white">
      <button
        type="button"
        onClick={onMobileOpen}
        onMouseEnter={() => setIsOpen(true)}
        onFocus={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onBlur={() => setIsOpen(false)}
        className="mx-auto flex h-10 w-full max-w-7xl items-center gap-3 px-3 text-left text-sm sm:px-4"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <FaTrophy />
        </span>
        <span className="shrink-0 font-black text-slate-950">
          {t.leaderboard.title}
        </span>
        <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-slate-600">
          <span className="inline-block animate-[ticker_18s_linear_infinite]">
            {tickerText}
          </span>
        </span>
        <FaChevronRight className="shrink-0 text-slate-400" />
      </button>

      <div
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className={`absolute left-1/2 top-full z-40 hidden w-[min(720px,calc(100vw-32px))] -translate-x-1/2 pt-2 lg:block ${
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        } transition-opacity`}
      >
        <LeaderboardPanel
          entries={entries}
          locale={language}
          pointsLabel={t.leaderboard.columns.totalScore}
        />
      </div>

      <BottomSheet
        isOpen={isMobileOpen}
        title={t.leaderboard.title}
        onClose={onMobileClose}
      >
        <LeaderboardList
          entries={entries}
          locale={language}
          pointsLabel={t.leaderboard.columns.totalScore}
        />
      </BottomSheet>
    </div>
  );
}

function LeaderboardPanel({
  entries,
  locale,
  pointsLabel,
}: {
  entries: LeaderboardEntry[];
  locale: string;
  pointsLabel: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_18px_44px_rgba(15,23,42,0.14)]">
      <LeaderboardList
        entries={entries}
        locale={locale}
        pointsLabel={pointsLabel}
      />
    </div>
  );
}

function LeaderboardList({
  entries,
  locale,
  pointsLabel,
}: {
  entries: LeaderboardEntry[];
  locale: string;
  pointsLabel: string;
}) {
  const formatter = new Intl.NumberFormat(locale);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">
        No leaderboard data yet.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {entries.slice(0, 10).map((entry) => (
        <div
          key={`${entry.rank}-${entry.countryCode}`}
          className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-950">
            {entry.rank}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">
              {entry.flag} {entry.countryName}
            </p>
            <p className="text-xs font-semibold text-slate-500">
              {formatter.format(entry.totalCorrect)}/
              {formatter.format(entry.totalQuestions)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-black text-[#5b21b6]">
              {formatter.format(entry.totalScore)}
            </p>
            <p className="text-xs font-semibold text-slate-500">
              {pointsLabel}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
