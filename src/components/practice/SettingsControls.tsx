import React from "react";

export const settingsLabelClassName =
  "text-xs font-bold leading-5 text-slate-500";

const settingsFocusClassName =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed] focus-visible:ring-offset-2";

export const settingsSelectClassName = `min-h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 ${settingsFocusClassName}`;

export const settingsToggleClassName =
  "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800";

export const settingsCheckboxClassName = `h-4 w-4 shrink-0 accent-[#5b21b6] ${settingsFocusClassName}`;

export const settingsActionClassName = `min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${settingsFocusClassName}`;

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
      className={`min-h-11 min-w-0 rounded-lg border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${settingsFocusClassName} ${
        selected
          ? "border-[#7c3aed] bg-[#ede9fe] text-[#5b21b6]"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      } ${className}`}
    />
  );
}
