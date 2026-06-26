"use client";

import React from "react";
import { CLEFS, KEY_SIGNATURES } from "@/lib/music/constants";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/gameStore";

export default function NoteSettingsPanel() {
  const { t } = useTranslation();
  const { settings, updateSettings, resetSettings, resetStats } = useGameStore();

  return (
    <div className="grid gap-4">
      <section className="grid gap-2">
        <label className="text-xs font-black uppercase text-slate-500">
          {t.settingsLabels.clef}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["random", ...CLEFS] as Array<ClefType | "random">).map((clef) => (
            <button
              key={clef}
              type="button"
              onClick={() => updateSettings({ clef })}
              className={`min-h-10 rounded-lg border px-3 text-sm font-black ${
                settings.clef === clef
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {clef === "random" ? t.clefs.random : t.clefs[clef]}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-2">
        <label className="text-xs font-black uppercase text-slate-500">
          {t.settingsLabels.keySignature}
        </label>
        <select
          value={settings.keySignature}
          onChange={(event) =>
            updateSettings({ keySignature: event.target.value })
          }
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900"
        >
          <option value="random">{t.keySignatures.random}</option>
          {Object.entries(KEY_SIGNATURES).map(([key, signature]) => (
            <option key={key} value={key}>
              {signature.key}
            </option>
          ))}
        </select>
      </section>

      <section className="grid gap-2">
        <label className="text-xs font-black uppercase text-slate-500">
          {t.settingsLabels.answerMode}
        </label>
        <div className="grid gap-2">
          {(["piano", "solfege", "microphone"] as AnswerMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => updateSettings({ answerMode: mode })}
              className={`min-h-10 rounded-lg border px-3 text-sm font-black ${
                settings.answerMode === mode
                  ? "border-[#5b21b6] bg-[#5b21b6] text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {mode === "piano" && t.answerModes.piano}
              {mode === "solfege" && t.answerModes.solfege}
              {mode === "microphone" && t.answerModes.microphone}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <label className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
          {t.settingsLabels.enableSound}
          <input
            type="checkbox"
            checked={settings.enableSound}
            onChange={(event) =>
              updateSettings({ enableSound: event.target.checked })
            }
            className="h-4 w-4"
          />
        </label>
        <label className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
          {t.settingsLabels.accidentals}
          <input
            type="checkbox"
            checked={settings.enableAccidentals}
            onChange={(event) =>
              updateSettings({ enableAccidentals: event.target.checked })
            }
            className="h-4 w-4"
          />
        </label>
      </section>

      <section className="grid gap-2">
        <label className="text-xs font-black uppercase text-slate-500">
          {t.settingsLabels.timeLimit}
        </label>
        <select
          value={settings.timeLimit ?? 0}
          onChange={(event) => {
            const value = Number(event.target.value);
            updateSettings({ timeLimit: value === 0 ? undefined : value });
          }}
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900"
        >
          <option value={0}>{t.earTraining.session.practice}</option>
          <option value={30}>30s</option>
          <option value={60}>60s</option>
          <option value={180}>180s</option>
        </select>
      </section>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={resetSettings}
          className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700"
        >
          {t.settingsLabels.resetToDefault}
        </button>
        <button
          type="button"
          onClick={resetStats}
          className="min-h-10 rounded-lg bg-slate-950 px-3 text-sm font-black text-white"
        >
          {t.settingsLabels.resetAllStats}
        </button>
      </div>
    </div>
  );
}
