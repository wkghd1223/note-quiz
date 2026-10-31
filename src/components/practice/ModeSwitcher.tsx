"use client";
import React, { useId } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { TrainingMode } from "@/lib/practice/types";
export type PracticeMode = TrainingMode;
export default function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: PracticeMode;
  onChange: (mode: PracticeMode) => void;
}) {
  const { t } = useTranslation(),
    id = useId();
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="text-xs font-bold text-slate-500">
        {t.learning.chooseMode}
      </label>
      <select
        id={id}
        data-practice-mode
        value={mode}
        onChange={(e) => onChange(e.target.value as PracticeMode)}
        className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900"
      >
        {(["note", "ear", "interval", "chord"] as const).map((value) => (
          <option key={value} value={value}>
            {t.learning[value]}
          </option>
        ))}
      </select>
    </div>
  );
}
