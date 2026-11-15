"use client";
import { useId } from "react";

/** Native radio semantics preserve arrow-key selection and one tab stop. */
export default function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  columns,
  className = "",
  ...props
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  columns?: 2;
  className?: string;
  "data-practice-mode"?: boolean;
}) {
  const name = useId();
  return (
    <fieldset disabled={disabled} className={`min-w-0 ${className}`} {...props}>
      <legend className="mb-1 text-xs font-bold text-slate-500">{label}</legend>
      <div
        className={`${columns === 2 ? "grid grid-cols-2" : "flex flex-wrap"} gap-1 rounded-xl bg-slate-100 p-1`}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="relative min-w-0 flex-1 cursor-pointer"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="choice-segment flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-semibold leading-snug text-slate-600 peer-checked:bg-violet-100 peer-checked:text-violet-900 peer-checked:shadow-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-violet-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
