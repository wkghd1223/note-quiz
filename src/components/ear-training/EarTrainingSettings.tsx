"use client";

import React, { useId } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  SettingsChoice,
  settingsCheckboxClassName,
  settingsLabelClassName,
  settingsSelectClassName,
  settingsToggleClassName,
} from "@/components/practice/SettingsControls";

interface EarTrainingSettingsProps {
  settings: EarTrainingSettings;
  onChange: (settings: Partial<EarTrainingSettings>) => void;
  embedded?: boolean;
}

const EarTrainingSettings: React.FC<EarTrainingSettingsProps> = ({
  settings,
  onChange,
  embedded = false,
}) => {
  const { t } = useTranslation();
  const settingsId = useId();
  const octaveValues = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

  const handleOctaveChange = (bound: "min" | "max", value: number) => {
    const nextRange = { ...settings.octaveRange };

    if (bound === "min") {
      nextRange.min = Math.min(value as Octave, nextRange.max) as Octave;
    } else {
      nextRange.max = Math.max(value as Octave, nextRange.min) as Octave;
    }

    onChange({ octaveRange: nextRange });
  };

  return (
    <div
      className={
        embedded
          ? ""
          : "rounded-xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
      }
    >
      {!embedded && (
        <h2 className="text-base font-black text-slate-950">
          {t.earTraining.settings}
        </h2>
      )}

      <div className={`${embedded ? "" : "mt-4 "}grid gap-4`}>
        <div className="grid gap-2">
          <label
            htmlFor={`${settingsId}-session-type`}
            className={settingsLabelClassName}
          >
            {t.learning.sessionType}
          </label>
          <select
            id={`${settingsId}-session-type`}
            aria-label={t.learning.sessionType}
            value={
              settings.questionLimit
                ? "ten"
                : settings.sessionType === "timed"
                  ? "timed"
                  : "free"
            }
            onChange={(event) =>
              onChange({
                sessionType:
                  event.target.value === "timed" ? "timed" : "practice",
                questionLimit: event.target.value === "ten" ? 10 : undefined,
                timeLimit:
                  event.target.value === "timed"
                    ? (settings.timeLimit ?? 60)
                    : undefined,
              })
            }
            className={settingsSelectClassName}
          >
            <option value="ten">{t.learning.ten}</option>
            <option value="free">{t.learning.free}</option>
            <option value="timed">{t.learning.timed}</option>
          </select>
        </div>

        {settings.sessionType === "timed" && (
          <fieldset className="grid gap-2">
            <legend className={`mb-2 ${settingsLabelClassName}`}>
              {t.timer.timeLimit}
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {[30, 60, 180].map((time) => (
                <SettingsChoice
                  key={time}
                  selected={settings.timeLimit === time}
                  onClick={() => onChange({ timeLimit: time })}
                >
                  {time} {t.units.seconds}
                </SettingsChoice>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="grid gap-2">
          <legend className={`mb-2 ${settingsLabelClassName}`}>
            {t.earTraining.noteSet.title}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {(["natural", "chromatic"] as EarTrainingNoteSet[]).map(
              (noteSet) => (
                <SettingsChoice
                  key={noteSet}
                  selected={settings.noteSet === noteSet}
                  onClick={() => onChange({ noteSet })}
                >
                  {noteSet === "natural"
                    ? t.earTraining.noteSet.natural
                    : t.earTraining.noteSet.chromatic}
                </SettingsChoice>
              ),
            )}
          </div>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className={`mb-2 ${settingsLabelClassName}`}>
            {t.earTraining.inputMode.title}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {(["piano", "solfege"] as EarTrainingInputMode[]).map(
              (inputMode) => (
                <SettingsChoice
                  key={inputMode}
                  selected={settings.inputMode === inputMode}
                  onClick={() => onChange({ inputMode })}
                >
                  {inputMode === "piano"
                    ? t.earTraining.inputMode.piano
                    : t.earTraining.inputMode.solfege}
                </SettingsChoice>
              ),
            )}
          </div>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className={`mb-2 ${settingsLabelClassName}`}>
            {t.settingsLabels.octaveRange}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <label
                htmlFor={`${settingsId}-octave-min`}
                className={settingsLabelClassName}
              >
                {t.settingsLabels.octaveMin}
              </label>
              <select
                id={`${settingsId}-octave-min`}
                aria-label={t.settingsLabels.octaveMin}
                value={settings.octaveRange.min}
                onChange={(event) =>
                  handleOctaveChange("min", parseInt(event.target.value, 10))
                }
                className={settingsSelectClassName}
              >
                {octaveValues.map((octave) => (
                  <option key={`ear-min-${octave}`} value={octave}>
                    {octave}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label
                htmlFor={`${settingsId}-octave-max`}
                className={settingsLabelClassName}
              >
                {t.settingsLabels.octaveMax}
              </label>
              <select
                id={`${settingsId}-octave-max`}
                aria-label={t.settingsLabels.octaveMax}
                value={settings.octaveRange.max}
                onChange={(event) =>
                  handleOctaveChange("max", parseInt(event.target.value, 10))
                }
                className={settingsSelectClassName}
              >
                {octaveValues.map((octave) => (
                  <option key={`ear-max-${octave}`} value={octave}>
                    {octave}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <label className={settingsToggleClassName}>
          {t.settingsLabels.enableSound}
          <input
            type="checkbox"
            checked={settings.enableSound}
            onChange={(event) =>
              onChange({ enableSound: event.target.checked })
            }
            className={settingsCheckboxClassName}
          />
        </label>
      </div>
    </div>
  );
};

export default EarTrainingSettings;
