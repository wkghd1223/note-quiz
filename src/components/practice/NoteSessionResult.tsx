"use client";

import React from "react";
import {
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaGlobeAmericas,
} from "react-icons/fa";
import { useTranslation } from "@/hooks/useTranslation";
import LearningResult from "./LearningResult";

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
  onRestart?: () => void;
  onReview?: () => void;
  onChange?: () => void;
  children?: React.ReactNode;
}
export default function NoteSessionResult({
  result,
  sessionPoints,
  submissionStatus,
  onRestart = () => {},
  onReview = () => {},
  onChange = () => {},
  children,
}: NoteSessionResultProps) {
  const { t } = useTranslation();
  return (
    <LearningResult
      result={result}
      onRestart={onRestart}
      onReview={onReview}
      onChange={onChange}
      hasMistakes={result.answers.some(
        (answer) => !answer.isCorrect && answer.question,
      )}
    >
      {submissionStatus !== "idle" && (
        <>
          <p className="text-sm font-bold text-[#5b21b6]">
            {t.scoreboard.sessionPoints}: {sessionPoints}
          </p>
          <SubmissionNotice status={submissionStatus} />
        </>
      )}
      {children}
    </LearningResult>
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
