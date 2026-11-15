"use client";

import React from "react";
import StablePracticeActions from "./StablePracticeActions";

export interface PracticeAction {
  id: string;
  label: string;
  onClick: () => void;
  tone?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  icon?: React.ReactNode;
  buttonRef?: React.Ref<HTMLButtonElement>;
}
export interface PracticeControllerProps {
  state: string;
  states: Record<string, readonly PracticeAction[]>;
}

/** Supply only real capabilities; inactive states reserve their translated footprint. */
export default function PracticeController({
  state,
  states,
}: PracticeControllerProps) {
  return (
    <div data-practice-controller>
      <StablePracticeActions
        active={state}
        states={Object.fromEntries(
          Object.entries(states).map(([key, actions]) => [
            key,
            <div
              key={key}
              className={`grid gap-2 ${actions.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
            >
              {actions.map(
                ({
                  id,
                  label,
                  onClick,
                  tone = "secondary",
                  disabled,
                  icon,
                  buttonRef,
                }) => (
                  <button
                    key={id}
                    ref={state === key ? buttonRef : undefined}
                    data-practice-action={id}
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    className={`inline-flex min-h-11 min-w-0 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-50 ${tone === "primary" ? "bg-[#5b21b6] text-white hover:bg-[#4c1d95]" : tone === "danger" ? "bg-red-500 text-white hover:bg-red-600" : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}
                  >
                    {icon && (
                      <span aria-hidden="true" className="shrink-0">
                        {icon}
                      </span>
                    )}
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {label}
                    </span>
                  </button>
                ),
              )}
            </div>,
          ]),
        )}
      />
    </div>
  );
}
