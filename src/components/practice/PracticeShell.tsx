"use client";

import React, { useEffect, useRef } from "react";
import { FaCog } from "react-icons/fa";
import { useTranslation } from "@/hooks/useTranslation";
import SettingsSurface from "./SettingsSurface";
import PracticeAnswerArea from "./PracticeAnswerArea";
import PracticeController from "./PracticeController";
import StablePracticeActions from "./StablePracticeActions";
import { practiceControlSizeClassName } from "./SettingsControls";
import PracticeResultSurface, {
  usePracticeResultSurface,
} from "./PracticeResultSurface";

interface PracticeShellProps {
  modeSwitcher: React.ReactNode;
  headerActions?: React.ReactNode;
  title: string;
  kicker: string;
  description?: React.ReactNode;
  onRestart?: () => void;
  restartDisabled?: boolean;
  status: React.ReactNode;
  stage: React.ReactNode;
  input: React.ReactNode;
  actions: React.ReactNode;
  settings: React.ReactNode;
  settingsIntro?: React.ReactNode;
  settingsSummary: string;
  isIdle: boolean;
  isFinished?: boolean;
  result?: React.ReactNode;
  resultKey?: string | number | null;
  settingsOpen: boolean;
  onSettingsOpen: () => void;
  onSettingsClose: () => void;
}

export default function PracticeShell({
  modeSwitcher,
  headerActions,
  title,
  kicker,
  description,
  onRestart,
  restartDisabled = false,
  status,
  stage,
  input,
  actions,
  settings,
  settingsIntro,
  settingsSummary,
  isIdle,
  isFinished = false,
  result,
  resultKey = null,
  settingsOpen,
  onSettingsOpen,
  onSettingsClose,
}: PracticeShellProps) {
  const { t } = useTranslation();
  const stageArea = useRef<HTMLDivElement>(null);
  const restoreButton = useRef<HTMLButtonElement>(null);
  const results = usePracticeResultSurface(isFinished, resultKey);
  const wasFinished = useRef(isFinished);
  useEffect(() => {
    if (wasFinished.current && !isFinished && !isIdle)
      stageArea.current
        ?.querySelector<HTMLElement>("[data-practice-prompt]")
        ?.focus({ preventScroll: true });
    wasFinished.current = isFinished;
  }, [isFinished, isIdle]);

  return (
    <div className="grid w-full min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 p-3 sm:p-4">
          <div className="grid min-w-0 gap-3 [container-type:inline-size]">
            <div className="min-w-0">
              <p className="hidden text-xs font-black text-[#5b21b6] sm:block">
                {kicker}
              </p>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <h1
                  tabIndex={-1}
                  data-practice-heading
                  className="min-w-0 flex-1 basis-32 text-xl font-black text-slate-950 [overflow-wrap:anywhere] sm:mt-1 sm:text-2xl"
                >
                  {title}
                </h1>
                <div className="flex shrink-0 items-stretch gap-2">
                  {headerActions}
                  <button
                    data-practice-settings-trigger
                    type="button"
                    onClick={onSettingsOpen}
                    aria-haspopup="dialog"
                    aria-expanded={settingsOpen}
                    className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white font-bold text-slate-800 sm:gap-2 lg:hidden ${practiceControlSizeClassName}`}
                  >
                    <FaCog aria-hidden="true" className="shrink-0" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {t.settings}
                    </span>
                  </button>
                </div>
              </div>
              {description && (
                <p
                  data-practice-description
                  className="mt-2 text-sm leading-5 text-slate-600"
                >
                  {description}
                </p>
              )}
            </div>
            {modeSwitcher}
          </div>
        </div>

        <div className="grid min-w-0 gap-3 p-3 sm:p-4 lg:p-5">
          <div
            data-practice-control-dock
            className="sticky top-0 z-10 grid gap-2 self-start bg-white pb-2"
          >
            <div className="grid min-h-11 min-w-0 items-stretch">
              <div data-practice-actions className="min-w-0">
                <StablePracticeActions
                  active={isFinished ? "results" : "mode"}
                  states={{
                    mode: actions,
                    results: (
                      <PracticeController
                        state="results"
                        states={{
                          results: [
                            {
                              id: "view-results",
                              label: t.practiceUi.viewResults,
                              onClick: () => results.setOpen(true),
                              tone: "primary",
                              buttonRef: restoreButton,
                            },
                            ...(onRestart
                              ? [
                                  {
                                    id: "restart",
                                    label: t.learning.restart,
                                    onClick: onRestart,
                                    disabled: restartDisabled,
                                  },
                                ]
                              : []),
                          ],
                        }}
                      />
                    ),
                  }}
                />
              </div>
            </div>
            <div className="relative min-w-0">
              <div
                aria-hidden={isIdle || undefined}
                className={isIdle ? "invisible" : undefined}
              >
                {status}
              </div>
              {isIdle && (
                <p
                  tabIndex={0}
                  className="absolute inset-0 overflow-auto text-sm leading-6 text-slate-500"
                >
                  {settingsSummary}
                </p>
              )}
            </div>
          </div>
          <div ref={stageArea} className="min-h-0 min-w-0">
            {stage}
          </div>
          {(input || isFinished) && (
            <PracticeAnswerArea finished={isFinished}>
              {input}
            </PracticeAnswerArea>
          )}
          {result && (
            <PracticeResultSurface
              open={results.open}
              onOpenChange={results.setOpen}
              returnFocusRef={restoreButton}
            >
              {result}
            </PracticeResultSurface>
          )}
        </div>
      </section>

      <SettingsSurface
        title={t.settings}
        summary={settingsSummary}
        isMobileOpen={settingsOpen}
        onMobileClose={onSettingsClose}
      >
        {settingsIntro}
        {settings}
      </SettingsSurface>
    </div>
  );
}
