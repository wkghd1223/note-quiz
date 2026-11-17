"use client";

import React, { useEffect, useId, useRef } from "react";
import { FaTimes } from "react-icons/fa";
import { useTranslation } from "@/hooks/useTranslation";

interface PracticeDialogProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export default function PracticeDialog({
  isOpen,
  title,
  onClose,
  children,
  returnFocusRef,
}: PracticeDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    // Both shared consumers keep the restore control mounted while the dialog is open.
    const preferredFocus = returnFocusRef?.current;
    const previousFocus = document.activeElement;
    const previousOverflowX = document.body.style.overflowX;
    const previousOverflowY = document.body.style.overflowY;
    const { scrollX, scrollY } = window;
    const pathname = window.location.pathname;
    const workspace = document.querySelector<HTMLElement>(
      "[data-practice-scroll]",
    );
    const previousWorkspace = workspace
      ? {
          top: workspace.scrollTop,
          left: workspace.scrollLeft,
          overflow: workspace.style.overflowY,
        }
      : null;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    if (workspace) workspace.style.overflowY = "hidden";
    closeButtonRef.current?.focus({ preventScroll: true });

    return () => {
      const samePage = window.location.pathname === pathname;
      dialog.close();
      document.body.style.overflowX = previousOverflowX;
      document.body.style.overflowY = previousOverflowY;
      if (workspace && previousWorkspace) {
        workspace.style.overflowY = previousWorkspace.overflow;
        if (samePage)
          workspace.scrollTo({
            top: previousWorkspace.top,
            left: previousWorkspace.left,
            behavior: "instant",
          });
      }
      // A persistent workspace may already contain another route. Unlock it,
      // then leave that route's focus and scroll to the navigation handler.
      if (!samePage) return;
      const returnTarget =
        preferredFocus?.isConnected &&
        preferredFocus.getClientRects().length > 0 &&
        getComputedStyle(preferredFocus).visibility !== "hidden"
          ? preferredFocus
          : previousFocus instanceof HTMLElement &&
              previousFocus !== document.body &&
              previousFocus.isConnected &&
              previousFocus.getClientRects().length > 0
            ? previousFocus
            : document.querySelector<HTMLElement>("[data-practice-heading]");
      returnTarget?.focus({ preventScroll: true });
      window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
    };
  }, [isOpen, returnFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
      className="practice-dialog motion-enter overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-950 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop:bg-slate-950/35"
    >
      <div className="flex flex-col" style={{ maxHeight: "inherit" }}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 id={titleId} className="text-base font-black">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="motion-control flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
            aria-label={t.ui.close}
          >
            <FaTimes />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
          {children}
        </div>
      </div>
    </dialog>
  );
}
