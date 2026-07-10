"use client";

import React from "react";
import {
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaGlobeAmericas,
  FaTrophy,
} from "react-icons/fa";
import { useTranslation } from "@/hooks/useTranslation";

export type SessionSubmissionUiStatus =
  | "idle"
  | "submitting"
  | "accepted"
  | "duplicate"
  | "ineligible"
  | "failed";

interface NoteSessionResultProps {
  result: GameResult;
  sessionPoints: number;
  submissionStatus: SessionSubmissionUiStatus;
}

export default function NoteSessionResult({
  result,
  sessionPoints,
  submissionStatus,
}: NoteSessionResultProps) {
  const { t } = useTranslation();
  const grade =
    result.accuracy === 100
      ? t.achievements.perfect
      : result.accuracy >= 90
        ? t.achievements.excellent
        : result.accuracy >= 70
          ? t.achievements.good
          : null;

  return (
    <div className="min-h-[300px] bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-[#5b21b6]">
            {t.scoreboard.gameResult}
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
            {t.messages.gameComplete}
          </h2>
          {grade && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-black text-amber-800">
              <FaTrophy aria-hidden="true" />
              {grade}
            </div>
          )}
        </div>

        <div className="min-w-[180px] rounded-lg bg-slate-950 px-5 py-4 text-white">
          <p className="text-xs font-black uppercase text-white/65">
            {t.scoreboard.sessionPoints}
          </p>
          <p className="mt-1 text-4xl font-black">{sessionPoints}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-4">
        <ResultMetric
          label={t.scoreboard.finalScore}
          value={`${result.correctAnswers}/${result.totalQuestions}`}
        />
        <ResultMetric
          label={t.scoreboard.finalAccuracy}
          value={`${result.accuracy.toFixed(1)}%`}
        />
        <ResultMetric
          label={t.scoreboard.totalTime}
          value={formatSeconds(result.totalTime, t.units.seconds)}
        />
        <ResultMetric
          label={t.scoreboard.averageTime}
          value={formatSeconds(result.averageTime, t.units.seconds)}
        />
      </div>

      {submissionStatus !== "idle" && (
        <SubmissionNotice status={submissionStatus} />
      )}
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-white px-3 py-4 text-center">
      <p className="truncate text-[11px] font-black uppercase text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function SubmissionNotice({ status }: { status: SessionSubmissionUiStatus }) {
  const { t } = useTranslation();
  const content = {
    submitting: {
      icon: <FaGlobeAmericas aria-hidden="true" />,
      message: t.scoreboard.submission.submitting,
      className: "bg-sky-50 text-sky-800",
    },
    accepted: {
      icon: <FaCheckCircle aria-hidden="true" />,
      message: t.scoreboard.submission.accepted,
      className: "bg-emerald-50 text-emerald-800",
    },
    duplicate: {
      icon: <FaCheckCircle aria-hidden="true" />,
      message: t.scoreboard.submission.duplicate,
      className: "bg-slate-100 text-slate-700",
    },
    ineligible: {
      icon: <FaClock aria-hidden="true" />,
      message: t.scoreboard.submission.ineligible,
      className: "bg-amber-50 text-amber-800",
    },
    failed: {
      icon: <FaExclamationTriangle aria-hidden="true" />,
      message: t.scoreboard.submission.failed,
      className: "bg-red-50 text-red-800",
    },
  } as const;

  if (status === "idle") return null;
  const notice = content[status];

  return (
    <div
      className={`mt-5 flex items-start gap-3 rounded-lg px-4 py-3 text-sm font-bold ${notice.className}`}
    >
      <span className="mt-0.5 shrink-0">{notice.icon}</span>
      <span>{notice.message}</span>
    </div>
  );
}

function formatSeconds(milliseconds: number, unit: string) {
  return `${(milliseconds / 1000).toFixed(1)}${unit}`;
}
