"use client";
import { useId } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { melodyCopy } from "../i18n";
import {
  practiceControlSizeClassName,
  settingsCheckboxClassName,
  settingsSelectClassName,
} from "@/components/practice/SettingsControls";
import type { BeatCueOptions } from "@/features/challenge/audio/beat-cues";

export function MelodyTempoField({
  value,
  onChange,
  onBlur,
  min,
  max,
  hint,
}: {
  value: number | string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  min: number;
  max?: number;
  hint?: string;
}) {
  const id = useId();
  const { language } = useTranslation();
  return (
    <div className="grid min-w-0 gap-1 text-sm font-semibold">
      <label htmlFor={id}>{melodyCopy(language).bpm}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-describedby={hint ? id + "-hint" : undefined}
        className={settingsSelectClassName}
      />
      {hint && (
        <span
          id={id + "-hint"}
          className="text-xs font-normal leading-5 text-slate-500"
        >
          {hint}
        </span>
      )}
    </div>
  );
}

export function MelodyBeatSoundFields({
  value,
  onChange,
}: {
  value: BeatCueOptions;
  onChange: (patch: BeatCueOptions) => void;
}) {
  const { language } = useTranslation(),
    c = melodyCopy(language);
  return (
    <fieldset className="grid min-w-0 gap-2">
      <legend className="mb-2 text-sm font-semibold">{c.beatSounds}</legend>
      {(["metronome", "barBell"] as const).map((key) => (
        <label
          key={key}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 font-semibold ${practiceControlSizeClassName}`}
        >
          <input
            type="checkbox"
            className={settingsCheckboxClassName}
            checked={!!value[key]}
            onChange={(event) => onChange({ [key]: event.target.checked })}
          />
          {c[key]}
        </label>
      ))}
      <p className="text-xs leading-5 text-slate-500">{c.beatSoundsHint}</p>
      <p className="text-xs leading-5 text-slate-500">{c.headphones}</p>
    </fieldset>
  );
}
