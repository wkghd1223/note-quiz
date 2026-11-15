"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/gameStore";
import { useEarTrainingStore } from "@/store/earTrainingStore";
import { useTheoryStore } from "@/store/theoryStore";
import type { PracticeConfig } from "@/lib/practice/config";
import type { TrainingMode } from "@/lib/practice/types";
import LearningHistory from "./LearningHistory";
import PracticeDialog from "./PracticeDialog";
import { FaHistory } from "react-icons/fa";

type Props = React.ComponentProps<typeof LearningHistory> & {
  mode: TrainingMode;
  notice?: string;
};

export default function PracticeHistoryPanel({
  mode,
  notice,
  onPractice,
  ...history
}: Props) {
  const { t } = useTranslation();
  // Only lifecycle booleans subscribe: clock ticks never change these selections.
  const notePlaying = useGameStore(
    (state) => mode === "note" && state.gameState === "playing",
  );
  const earPlaying = useEarTrainingStore(
    (state) => mode === "ear" && state.sessionState === "playing",
  );
  const theoryPlaying = useTheoryStore(
    (state) =>
      (mode === "interval" || mode === "chord") && state.state === "playing",
  );
  const playing = notePlaying || earPlaying || theoryPlaying;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingPractice = useRef<PracticeConfig | null>(null);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (playing) setOpen(false);
  }, [playing]);
  useEffect(() => {
    if (open || !pendingPractice.current) return;
    const next = pendingPractice.current;
    pendingPractice.current = null;
    // Dialog cleanup/focus restoration runs before this passive setup invokes navigation.
    onPractice(next);
  }, [open, onPractice]);
  return (
    <>
      <button
        ref={triggerRef}
        data-practice-history-trigger
        type="button"
        disabled={playing}
        aria-haspopup="dialog"
        aria-label={t.learning.history}
        title={t.learning.history}
        aria-expanded={open && !playing}
        onClick={() => {
          if (!playing) setOpen(true);
        }}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FaHistory aria-hidden="true" focusable="false" />
      </button>
      <PracticeDialog
        isOpen={open && !playing}
        title={t.learning.history}
        onClose={close}
        returnFocusRef={triggerRef}
      >
        {open && !playing && (
          <>
            {notice && (
              <p role="status" className="mb-3 text-sm text-slate-600">
                {notice}
              </p>
            )}
            <LearningHistory
              {...history}
              onPractice={(next) => {
                pendingPractice.current = next;
                close();
              }}
            />
          </>
        )}
      </PracticeDialog>
    </>
  );
}
