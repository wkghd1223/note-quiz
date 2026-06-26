"use client";

import React from "react";
import { FaCog, FaTrophy } from "react-icons/fa";
import { useTranslation } from "@/hooks/useTranslation";
import SettingsSurface from "./SettingsSurface";

interface PracticeShellProps {
  modeSwitcher: React.ReactNode;
  title: string;
  kicker: string;
  status: React.ReactNode;
  stage: React.ReactNode;
  input: React.ReactNode;
  actions: React.ReactNode;
  settings: React.ReactNode;
  settingsSummary: string;
  settingsOpen: boolean;
  onSettingsOpen: () => void;
  onSettingsClose: () => void;
  onLeaderboardOpen: () => void;
}

export default function PracticeShell({
  modeSwitcher,
  title,
  kicker,
  status,
  stage,
  input,
  actions,
  settings,
  settingsSummary,
  settingsOpen,
  onSettingsOpen,
  onSettingsClose,
  onLeaderboardOpen,
}: PracticeShellProps) {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-[calc(100dvh-150px)] w-full min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 p-3 sm:p-4">
          <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] md:items-center">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-[#5b21b6]">
                {kicker}
              </p>
              <h1 className="mt-1 truncate text-2xl font-black text-slate-950 sm:text-3xl">
                {title}
              </h1>
            </div>
            {modeSwitcher}
          </div>
        </div>

        <div className="grid min-w-0 gap-3 p-3 sm:p-4 lg:p-5">
          {status}
          <div className="min-h-0 min-w-0 overflow-hidden">{stage}</div>
          <div className="min-w-0 overflow-hidden">{input}</div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div className="min-w-0">{actions}</div>
            <button
              type="button"
              onClick={onSettingsOpen}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 lg:hidden"
            >
              <FaCog />
              {t.settings}
            </button>
            <button
              type="button"
              onClick={onLeaderboardOpen}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 lg:hidden"
            >
              <FaTrophy className="text-amber-600" />
              {t.leaderboard.title}
            </button>
          </div>
        </div>
      </section>

      <SettingsSurface
        title={t.settings}
        summary={settingsSummary}
        isMobileOpen={settingsOpen}
        onMobileClose={onSettingsClose}
      >
        {settings}
      </SettingsSurface>
    </div>
  );
}
