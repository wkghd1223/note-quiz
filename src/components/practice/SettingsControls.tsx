import React from "react";

/** Compact mobile labels keep a 44px tap area and grow only with their own row. */
export const practiceControlSizeClassName =
  "min-h-11 min-w-0 max-w-full px-2 py-1 text-xs leading-4 [overflow-wrap:anywhere] sm:px-3 sm:py-2 sm:text-sm sm:leading-5";

export const settingsLabelClassName =
  "text-xs font-bold leading-5 text-slate-500";

const settingsFocusClassName =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed] focus-visible:ring-offset-2";

export const settingsSelectClassName = `min-h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 ${settingsFocusClassName}`;

export const settingsToggleClassName = `flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white font-semibold text-slate-800 sm:gap-3 ${practiceControlSizeClassName}`;

export const settingsCheckboxClassName = `h-4 w-4 shrink-0 accent-[#5b21b6] ${settingsFocusClassName}`;

export const settingsActionClassName = `rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 ${practiceControlSizeClassName} ${settingsFocusClassName}`;

interface SettingsChoiceProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
}

export function SettingsChoice({
  selected,
  className = "",
  ...props
}: SettingsChoiceProps) {
  return (
    <button
      {...props}
      type="button"
      aria-pressed={selected}
      className={`rounded-lg border font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${practiceControlSizeClassName} ${settingsFocusClassName} ${
        selected
          ? "border-[#7c3aed] bg-[#ede9fe] text-[#5b21b6]"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      } ${className}`}
    />
  );
}
