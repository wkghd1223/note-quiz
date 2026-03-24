"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface EarTrainingSettingsProps {
  settings: EarTrainingSettings;
  onChange: (settings: Partial<EarTrainingSettings>) => void;
}

const EarTrainingSettings: React.FC<EarTrainingSettingsProps> = ({
  settings,
  onChange,
}) => {
  const { t } = useTranslation();
  const octaveValues = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

  const handleOctaveChange = (bound: "min" | "max", value: number) => {
    const nextRange = { ...settings.octaveRange };

    if (bound === "min") {
      nextRange.min = Math.min(value as Octave, nextRange.max);
    } else {
      nextRange.max = Math.max(value as Octave, nextRange.min);
    }

    onChange({ octaveRange: nextRange });
  };

  return (
    <div className="rounded-[1.5rem] border border-[#ded6f7] bg-white p-5 shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
      <h2 className="text-lg font-black tracking-[-0.03em] text-slate-950">
        {t.earTraining.settings}
      </h2>

      <div className="mt-5 space-y-5">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {t.earTraining.session.practice} / {t.earTraining.session.timed}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["practice", "timed"] as EarTrainingSessionType[]).map((type) => (
              <button
                key={type}
                onClick={() =>
                  onChange({
                    sessionType: type,
                    timeLimit: type === "timed" ? settings.timeLimit ?? 60 : undefined,
                  })
                }
                className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                  settings.sessionType === type
                    ? "border-[#7c3aed] bg-[#ede9fe] text-[#5b21b6]"
                    : "border-[#ded6f7] bg-white text-slate-700"
                }`}
              >
                {type === "practice"
                  ? t.earTraining.session.practice
                  : t.earTraining.session.timed}
              </button>
            ))}
          </div>
        </div>

        {settings.sessionType === "timed" && (
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              {t.timer.timeLimit}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[30, 60, 180].map((time) => (
                <button
                  key={time}
                  onClick={() => onChange({ timeLimit: time })}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                    settings.timeLimit === time
                      ? "border-[#7c3aed] bg-[#ede9fe] text-[#5b21b6]"
                      : "border-[#ded6f7] bg-white text-slate-700"
                  }`}
                >
                  {time}s
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {t.earTraining.noteSet.title}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["natural", "chromatic"] as EarTrainingNoteSet[]).map((noteSet) => (
              <button
                key={noteSet}
                onClick={() => onChange({ noteSet })}
                className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                  settings.noteSet === noteSet
                    ? "border-[#7c3aed] bg-[#ede9fe] text-[#5b21b6]"
                    : "border-[#ded6f7] bg-white text-slate-700"
                }`}
              >
                {noteSet === "natural"
                  ? t.earTraining.noteSet.natural
                  : t.earTraining.noteSet.chromatic}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {t.earTraining.inputMode.title}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["piano", "solfege"] as EarTrainingInputMode[]).map((inputMode) => (
              <button
                key={inputMode}
                onClick={() => onChange({ inputMode })}
                className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                  settings.inputMode === inputMode
                    ? "border-[#7c3aed] bg-[#ede9fe] text-[#5b21b6]"
                    : "border-[#ded6f7] bg-white text-slate-700"
                }`}
              >
                {inputMode === "piano"
                  ? t.earTraining.inputMode.piano
                  : t.earTraining.inputMode.solfege}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {t.settingsLabels.octaveRange}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#ede9fe] bg-[#faf9fe] p-3">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                {t.settingsLabels.octaveMin}
              </label>
              <select
                value={settings.octaveRange.min}
                onChange={(event) =>
                  handleOctaveChange("min", parseInt(event.target.value, 10))
                }
                className="w-full rounded-2xl border border-[#ded6f7] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {octaveValues.map((octave) => (
                  <option key={`ear-min-${octave}`} value={octave}>
                    {octave}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-[#ede9fe] bg-[#faf9fe] p-3">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                {t.settingsLabels.octaveMax}
              </label>
              <select
                value={settings.octaveRange.max}
                onChange={(event) =>
                  handleOctaveChange("max", parseInt(event.target.value, 10))
                }
                className="w-full rounded-2xl border border-[#ded6f7] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {octaveValues.map((octave) => (
                  <option key={`ear-max-${octave}`} value={octave}>
                    {octave}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={settings.enableSound}
            onChange={(event) => onChange({ enableSound: event.target.checked })}
            className="h-4 w-4 rounded border-[#ded6f7] text-[#5b21b6] focus:ring-[#7c3aed]"
          />
          {t.settingsLabels.enableSound}
        </label>
      </div>
    </div>
  );
};

export default EarTrainingSettings;
