"use client";

import React from "react";
import { FaCog } from "react-icons/fa";
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
  isIdle: boolean;
  settingsOpen: boolean;
  onSettingsOpen: () => void;
  onSettingsClose: () => void;
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
  isIdle,
  settingsOpen,
  onSettingsOpen,
  onSettingsClose,
}: PracticeShellProps) {
  const { t } = useTranslation();

  return (
    <div className="grid w-full min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 p-3 sm:p-4">
          <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] md:items-center">
            <div
              className={
                isIdle ? "min-w-0" : "sr-only sm:not-sr-only sm:min-w-0"
              }
            >
              <p className="hidden text-xs font-black text-[#5b21b6] sm:block">
                {kicker}
              </p>
              <h1
                tabIndex={-1}
                data-practice-heading
                className="text-xl font-black text-slate-950 sm:mt-1 sm:text-2xl"
              >
                {title}
              </h1>
            </div>
            {modeSwitcher}
          </div>
        </div>

        <div className="grid min-w-0 gap-3 p-3 sm:p-4 lg:p-5">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 lg:grid-cols-1">
            <div className="min-w-0">{actions}</div>
            <button
              type="button"
              onClick={onSettingsOpen}
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 lg:hidden"
            >
              <FaCog />
              {t.settings}
            </button>
          </div>
          {isIdle ? (
            <p className="text-sm leading-6 text-slate-500">
              {settingsSummary}
            </p>
          ) : (
            status
          )}
          <div className="min-h-0 min-w-0 overflow-hidden">{stage}</div>
          {input && <div className="min-w-0 overflow-hidden">{input}</div>}
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
