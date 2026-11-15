"use client";

import React, { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import PracticeDialog from "./PracticeDialog";

export function usePracticeResultSurface(
  finished: boolean,
  sessionKey: string | number | null,
) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(finished);
  }, [finished, sessionKey]);
  return { open, setOpen };
}
export interface PracticeResultSurfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}
/** Presentation only: caller retains its result data and game-specific actions. */
export default function PracticeResultSurface({
  open,
  onOpenChange,
  returnFocusRef,
  children,
}: PracticeResultSurfaceProps) {
  const { t } = useTranslation();
  return (
    <PracticeDialog
      isOpen={open}
      title={t.scoreboard.gameResult}
      onClose={() => onOpenChange(false)}
      returnFocusRef={returnFocusRef}
    >
      <div
        data-practice-result
        data-result-presentation="dialog"
        className="[&_[data-result-heading]]:hidden"
      >
        <button
          type="button"
          data-minimize-results
          onClick={() => onOpenChange(false)}
          className="mb-3 min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-[#5b21b6]"
        >
          {t.practiceUi.minimizeResults}
        </button>
        {children}
      </div>
    </PracticeDialog>
  );
}
