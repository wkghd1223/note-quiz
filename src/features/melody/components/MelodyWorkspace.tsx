import type { ReactNode } from "react";
import { settingsActionClassName } from "@/components/practice/SettingsControls";

export function MelodyHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1
          data-practice-heading
          tabIndex={-1}
          className="break-words text-2xl font-black"
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        )}
      </div>
      {children}
    </header>
  );
}

export function MelodyWorkspace({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      {children}
    </div>
  );
}

export function MelodySettingsButton({
  label,
  open,
  disabled,
  onClick,
}: {
  label: string;
  open: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={onClick}
      className={`${settingsActionClassName} lg:hidden`}
    >
      {label}
    </button>
  );
}
