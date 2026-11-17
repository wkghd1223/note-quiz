"use client";
import { memo, useId } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { CLEFS } from "@/lib/music/constants";
import SegmentedControl from "@/components/ui/SegmentedControl";
import {
  settingsSelectClassName,
  settingsCheckboxClassName,
} from "@/components/practice/SettingsControls";
import { melodyCopy } from "../i18n";
import {
  defaultMelodySettings,
  melodyTimeSignatures,
  changeMelodyTonality,
  type MelodySettings,
} from "../domain/settings";

import {
  melodyTonalities,
  patternsForTonality,
  progressionLabel,
  type TonalityId,
  type ProgressionChoice,
} from "../domain/harmony";
import type { MelodyGeneration } from "../domain/generator";

export const pitchName = (midi: number) =>
  `${["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][midi % 12]}${Math.floor(midi / 12) - 1}`;
function MelodySettingsPanel({
  value,
  onChange,
  disabled,
  generation,
}: {
  value: MelodySettings;
  onChange: (value: MelodySettings) => void;
  disabled: boolean;
  generation: MelodyGeneration;
}) {
  const { t, language } = useTranslation(),
    c = melodyCopy(language),
    id = useId();
  const issue = generation.ok ? undefined : generation.issue;
  const issueText = !issue
    ? undefined
    : issue.code === "missingChord"
      ? c.missingChord.replace("{chord}", issue.chord ?? "")
      : issue.code === "noAvailableProgression"
        ? c.noAvailableProgression
        : issue.code === "bpm"
          ? c.invalidTempo
          : ["pitchRange", "minMidi", "maxMidi", "noAvailablePitch"].includes(
                issue.code,
              )
            ? c.invalidRange
            : ["durations", "noFittingNotes"].includes(issue.code)
              ? c.invalidRhythm
              : c.invalid;

  return (
    <fieldset
      disabled={disabled}
      className="grid min-w-0 gap-4 disabled:opacity-60"
    >
      <SegmentedControl
        columns={2}
        label={t.settingsLabels.clef}
        value={value.clef}
        onChange={(clef) => onChange({ ...value, clef })}
        options={CLEFS.map((clef) => ({ value: clef, label: t.clefs[clef] }))}
      />
      <label className="grid min-w-0 gap-1 text-sm font-semibold">
        {c.tonality}
        <select
          className={settingsSelectClassName}
          value={value.tonalityId}
          onChange={(event) =>
            onChange(
              changeMelodyTonality(value, event.target.value as TonalityId),
            )
          }
        >
          {(["major", "minor"] as const).map((mode) => (
            <optgroup key={mode} label={c[mode]}>
              {melodyTonalities
                .filter((tonality) => tonality.mode === mode)
                .map((tonality) => (
                  <option key={tonality.id} value={tonality.id}>
                    {c[
                      mode === "major" ? "majorTonality" : "minorTonality"
                    ].replace(
                      "{key}",
                      tonality.tonic.replace("#", "♯").replace("b", "♭"),
                    )}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-semibold">
        {c.progression}
        <select
          className={`${settingsSelectClassName} w-full min-w-0 text-xs`}
          value={value.progressionId}
          onChange={(event) =>
            onChange({
              ...value,
              progressionId: event.target.value as ProgressionChoice,
            })
          }
        >
          <option value="none">{c.noProgression}</option>
          <option value="random">{c.randomProgression}</option>
          {patternsForTonality(value.tonalityId).map((pattern) => (
            <option
              key={pattern.id}
              value={pattern.id}
              disabled={
                generation.availability.find(
                  (entry) => entry.patternId === pattern.id,
                )?.available === false
              }
            >
              {progressionLabel(pattern)}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-semibold">{c.range}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["minMidi", "maxMidi"] as const).map((field, index) => (
            <label
              key={field}
              className="grid min-w-0 gap-1 text-xs font-semibold text-slate-600"
            >
              {index ? c.high : c.low}
              <select
                value={value[field]}
                onChange={(event) =>
                  onChange({ ...value, [field]: Number(event.target.value) })
                }
                className={settingsSelectClassName}
              >
                {Array.from({ length: 37 }, (_, i) => i + 48).map((midi) => (
                  <option value={midi} key={midi}>
                    {pitchName(midi)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>
      <SegmentedControl
        label={c.meter}
        value={value.timeSignature.join("/")}
        onChange={(meter) =>
          onChange({
            ...value,
            timeSignature: meter.split("/").map(Number) as [number, number],
          })
        }
        options={melodyTimeSignatures.map((meter) => ({
          value: meter.join("/"),
          label: meter.join("/"),
        }))}
      />
      <div className="grid gap-1 text-sm font-semibold">
        <label htmlFor={`${id}-tempo`}>{c.bpm}</label>
        <input
          type="number"
          id={`${id}-tempo`}
          inputMode="numeric"
          min={40}
          max={180}
          step={1}
          value={Number.isFinite(value.bpm) ? value.bpm : ""}
          onChange={(event) =>
            onChange({ ...value, bpm: event.target.valueAsNumber })
          }
          aria-describedby={`${id}-tempo-hint`}
          className={settingsSelectClassName}
        />
        <span
          id={`${id}-tempo-hint`}
          className="text-xs font-normal leading-5 text-slate-500"
        >
          {c.bpmHint}
        </span>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{c.durations}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              [4, c.whole],
              [2, c.half],
              [1, c.quarter],
              [0.5, c.eighth],
            ] as const
          ).map(([duration, label]) => (
            <label
              key={duration}
              className={`choice-segment flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${value.durations.includes(duration) ? "border-violet-300 bg-violet-50 text-violet-900" : "border-slate-200"}`}
            >
              <input
                type="checkbox"
                className={settingsCheckboxClassName}
                checked={value.durations.includes(duration)}
                onChange={(event) =>
                  onChange({
                    ...value,
                    durations: event.target.checked
                      ? [...value.durations, duration]
                      : value.durations.filter((item) => item !== duration),
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">{c.rhythm}</legend>
        {(["dotted", "triplets"] as const).map((key) => (
          <label
            key={key}
            className={`choice-segment flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${value[key] ? "border-violet-300 bg-violet-50 text-violet-900" : "border-slate-200"}`}
          >
            <input
              type="checkbox"
              className={settingsCheckboxClassName}
              checked={value[key]}
              onChange={(event) =>
                onChange({ ...value, [key]: event.target.checked })
              }
            />
            {c[key]}
          </label>
        ))}
        <p className="text-xs leading-5 text-slate-500">{c.dottedHint}</p>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">{c.beatSounds}</legend>
        {(["metronome", "barBell"] as const).map((key) => (
          <label
            key={key}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
          >
            <input
              type="checkbox"
              className={settingsCheckboxClassName}
              checked={value[key]}
              onChange={(event) =>
                onChange({ ...value, [key]: event.target.checked })
              }
            />
            {c[key]}
          </label>
        ))}
        <p className="text-xs leading-5 text-slate-500">{c.beatSoundsHint}</p>
        <p className="text-xs leading-5 text-slate-500">{c.headphones}</p>
      </fieldset>
      {issueText && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-700">
          {issueText}
        </p>
      )}
      <button
        type="button"
        onClick={() =>
          onChange({
            ...defaultMelodySettings,
            durations: [...defaultMelodySettings.durations],
          })
        }
        className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
      >
        {t.settingsLabels.resetToDefault}
      </button>
    </fieldset>
  );
}

export default memo(MelodySettingsPanel);
