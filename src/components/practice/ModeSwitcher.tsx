"use client";

import React from "react";
import { FaBookOpen, FaHeadphones } from "react-icons/fa";
import { useTranslation } from "@/hooks/useTranslation";

export type PracticeMode = "note" | "ear";

interface ModeSwitcherProps {
  mode: PracticeMode;
  onChange: (mode: PracticeMode) => void;
}

export default function ModeSwitcher({ mode, onChange }: ModeSwitcherProps) {
  const { t } = useTranslation();

  const modes = [
    {
      id: "note" as const,
      label: t.gameNavTitle,
      icon: FaBookOpen,
    },
    {
      id: "ear" as const,
      label: t.earTraining.title,
      icon: FaHeadphones,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
      {modes.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === mode;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black transition-colors ${
              isActive
                ? "bg-white text-slate-950 shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
            }`}
          >
            <Icon className={isActive ? "text-[#5b21b6]" : "text-slate-500"} />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
