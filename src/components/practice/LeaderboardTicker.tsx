"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FaChevronRight, FaTrophy } from "react-icons/fa";
import type {
  LeaderboardEntry,
  LeaderboardResponse,
} from "@/types/leaderboard";
import { useTranslation } from "@/hooks/useTranslation";
import PracticeDialog from "./PracticeDialog";

interface LeaderboardTickerProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export default function LeaderboardTicker({
  isOpen,
  onOpen,
  onClose,
}: LeaderboardTickerProps) {
  const { t, language } = useTranslation();
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(
    null,
  );
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const requestRef = useRef<AbortController | null>(null);
  const hasRequested = useRef(false);

  const loadLeaderboard = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    hasRequested.current = true;
    setStatus("loading");
    try {
      const response = await fetch("/api/leaderboard", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Leaderboard unavailable");
      const data = (await response.json()) as LeaderboardResponse;
      if (!controller.signal.aborted) {
        setLeaderboard(data);
        setStatus("success");
      }
    } catch {
      if (!controller.signal.aborted) setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (isOpen || !hasRequested.current) void loadLeaderboard();
  }, [isOpen, loadLeaderboard]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
      hasRequested.current = false;
    },
    [],
  );

  const entries = leaderboard?.entries ?? [];
  const tickerText = useMemo(() => {
    if (status === "loading") return t.leaderboard.loading;
    if (status === "error") return t.leaderboard.error;
    if (!leaderboard?.entries.length) return t.leaderboard.empty;
    const formatter = new Intl.NumberFormat(language);
    return leaderboard.entries
      .slice(0, 5)
      .map(
        (entry) =>
          `#${entry.rank} ${entry.flag} ${entry.countryName} ${formatter.format(entry.totalScore)} ${t.leaderboard.columns.totalScore}`,
      )
      .join("  /  ");
  }, [leaderboard, language, status, t.leaderboard]);

  return (
    <div className="relative border-y border-slate-200 bg-white">
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="mx-auto flex min-h-11 w-full max-w-7xl items-center gap-3 px-3 text-left text-sm sm:px-4"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <FaTrophy />
        </span>
        <span className="min-w-0 shrink font-bold text-slate-950">
          {t.leaderboard.title}
        </span>
        <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-slate-600">
          <span className="inline-block motion-safe:animate-[ticker_18s_linear_infinite]">
            {tickerText}
          </span>
        </span>
        <FaChevronRight className="shrink-0 text-slate-400" />
      </button>
      <PracticeDialog
        isOpen={isOpen}
        title={t.leaderboard.title}
        onClose={onClose}
      >
        {status === "loading" ? (
          <p
            role="status"
            className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600"
          >
            {t.leaderboard.loading}
          </p>
        ) : status === "error" ? (
          <div className="space-y-3 rounded-lg bg-slate-50 p-4">
            <p role="alert" className="text-sm text-slate-600">
              {t.leaderboard.error}
            </p>
            <button
              type="button"
              onClick={() => void loadLeaderboard()}
              className="min-h-11 rounded-lg bg-[#5b21b6] px-4 text-sm font-bold text-white"
            >
              {t.ui.retry}
            </button>
          </div>
        ) : (
          <LeaderboardList
            entries={entries}
            locale={language}
            pointsLabel={t.leaderboard.columns.totalScore}
          />
        )}
      </PracticeDialog>
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
  const { t } = useTranslation();
  const formatter = new Intl.NumberFormat(locale);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">
        {t.leaderboard.empty}
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
