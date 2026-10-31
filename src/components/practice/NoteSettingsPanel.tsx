"use client";

import React, { useId } from "react";
import { CLEFS, KEY_SIGNATURES } from "@/lib/music/constants";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/gameStore";
import {
  SettingsChoice,
  settingsActionClassName,
  settingsCheckboxClassName,
  settingsLabelClassName,
  settingsSelectClassName,
  settingsToggleClassName,
} from "./SettingsControls";

export default function NoteSettingsPanel() {
  const settingsId = useId();
  const { t } = useTranslation();
  const { settings, updateSettings, resetSettings, resetStats } =
    useGameStore();

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className={`mb-2 ${settingsLabelClassName}`}>
          {t.settingsLabels.clef}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {(["random", ...CLEFS] as Array<ClefType | "random">).map((clef) => (
            <SettingsChoice
              key={clef}
              selected={settings.clef === clef}
              onClick={() => updateSettings({ clef })}
            >
              {clef === "random" ? t.clefs.random : t.clefs[clef]}
            </SettingsChoice>
          ))}
        </div>
      </fieldset>

      <section className="grid gap-2">
        <label
          htmlFor={`${settingsId}-key-signature`}
          className={settingsLabelClassName}
        >
          {t.settingsLabels.keySignature}
        </label>
        <select
          id={`${settingsId}-key-signature`}
          aria-label={t.settingsLabels.keySignature}
          value={settings.keySignature}
          onChange={(event) =>
            updateSettings({ keySignature: event.target.value })
          }
          className={settingsSelectClassName}
        >
          <option value="random">{t.keySignatures.random}</option>
          {Object.keys(KEY_SIGNATURES).map((key) => (
            <option key={key} value={key}>
              {t.keySignatures.major.replace("{key}", key)}
            </option>
          ))}
        </select>
      </section>

      <fieldset className="grid gap-2">
        <legend className={`mb-2 ${settingsLabelClassName}`}>
          {t.settingsLabels.answerMode}
        </legend>
        <div className="grid gap-2">
          {(["piano", "solfege", "microphone"] as AnswerMode[]).map((mode) => (
            <SettingsChoice
              key={mode}
              selected={settings.answerMode === mode}
              onClick={() => updateSettings({ answerMode: mode })}
            >
              {mode === "piano" && t.answerModes.piano}
              {mode === "solfege" && t.answerModes.solfege}
              {mode === "microphone" && t.answerModes.microphone}
            </SettingsChoice>
          ))}
        </div>
      </fieldset>

      <section className="grid gap-2">
        <label className={settingsToggleClassName}>
          {t.settingsLabels.enableSound}
          <input
            type="checkbox"
            checked={settings.enableSound}
            onChange={(event) =>
              updateSettings({ enableSound: event.target.checked })
            }
            className={settingsCheckboxClassName}
          />
        </label>
        <label className={settingsToggleClassName}>
          {t.settingsLabels.accidentals}
          <input
            type="checkbox"
            checked={settings.enableAccidentals}
            onChange={(event) =>
              updateSettings({ enableAccidentals: event.target.checked })
            }
            className={settingsCheckboxClassName}
          />
        </label>
      </section>

      <section className="grid gap-2">
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
              : settings.timeLimit
                ? "timed"
                : "free"
          }
          onChange={(event) =>
            updateSettings({
              questionLimit: event.target.value === "ten" ? 10 : undefined,
              timeLimit: event.target.value === "timed" ? 60 : undefined,
            })
          }
          className={settingsSelectClassName}
        >
          <option value="ten">{t.learning.ten}</option>
          <option value="free">{t.learning.free}</option>
          <option value="timed">{t.learning.timed}</option>
        </select>
        {settings.timeLimit !== undefined && (
          <fieldset className="mt-2 grid gap-2">
            <legend className={`mb-2 ${settingsLabelClassName}`}>
              {t.settingsLabels.timeLimit}
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {[30, 60, 180].map((time) => (
                <SettingsChoice
                  key={time}
                  selected={settings.timeLimit === time}
                  onClick={() => updateSettings({ timeLimit: time })}
                >
                  {time} {t.units.seconds}
                </SettingsChoice>
              ))}
            </div>
          </fieldset>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={resetSettings}
          className={settingsActionClassName}
        >
          {t.settingsLabels.resetToDefault}
        </button>
        <button
          type="button"
          onClick={resetStats}
          className={settingsActionClassName}
        >
          {t.settingsLabels.resetAllStats}
        </button>
      </div>
    </div>
  );
}
