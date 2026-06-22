"use client";

import React, { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/gameStore";
import GameSettings from "./GameSettings";

interface GameSettingsTriggerProps {
  className?: string;
  variant?: "default" | "mobile-card";
}

const GameSettingsTrigger: React.FC<GameSettingsTriggerProps> = ({
  className = "",
  variant = "default",
}) => {
  const { t } = useTranslation();
  const { settings } = useGameStore();
  const [showSettings, setShowSettings] = useState(false);

  const answerModeLabel =
    settings.answerMode === "piano"
      ? t.answerModes.piano
      : settings.answerMode === "solfege"
        ? t.answerModes.solfege
        : t.answerModes.microphone;

  const summary = [
    settings.timeLimit ? `Timed · ${settings.timeLimit}s` : "Practice",
    answerModeLabel,
  ].join(" · ");

  return (
    <>
      {variant === "mobile-card" ? (
        <div
          className={`rounded-[1.75rem] border border-[#ded6f7] bg-white p-4 shadow-[0_14px_40px_rgba(76,29,149,0.08)] ${className}`}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xl font-black tracking-[-0.04em] text-slate-950">
                {t.settings}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {summary}
              </p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center justify-center rounded-full bg-[#ede9fe] px-4 py-2 text-sm font-bold uppercase tracking-[0.12em] text-[#5b21b6]"
            >
              Open
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowSettings(true)}
          className={`inline-flex w-full items-center justify-center rounded-2xl border border-[#ded6f7] bg-[#faf9fe] px-4 py-2.5 text-sm font-bold text-slate-700 shadow-[0_8px_18px_rgba(76,29,149,0.06)] transition-colors hover:border-[#c4b5fd] hover:bg-white ${className}`}
        >
          {t.settings}
        </button>
      )}

      <GameSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
};

export default GameSettingsTrigger;
