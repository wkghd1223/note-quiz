"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CLEFS, KEY_SIGNATURES } from "@/lib/music/constants";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";

interface GameSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const GameSettings: React.FC<GameSettingsProps> = ({
  isOpen,
  onClose,
  className = "",
}) => {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const { settings, updateSettings, resetSettings, resetStats } =
    useGameStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, mounted]);

  if (!isOpen || !mounted) return null;

  const handleClefChange = (clef: ClefType | "random") => {
    updateSettings({ clef });
  };

  const handleKeySignatureChange = (keySignature: string) => {
    updateSettings({ keySignature });
  };

  const handleStaffRangeChange = (
    type: "ledgerLinesAbove" | "ledgerLinesBelow",
    value: number
  ) => {
    const newRange = { ...settings.staffRange };
    newRange[type] = Math.max(0, Math.min(5, value)); // 0-5 범위로 제한

    updateSettings({ staffRange: newRange });
  };

  const handleAnswerModeChange = (answerMode: AnswerMode) => {
    updateSettings({ answerMode });
  };

  const handleSoundToggle = (enableSound: boolean) => {
    updateSettings({ enableSound });
  };

  const handleTimeLimitChange = (timeLimit: number | undefined) => {
    updateSettings({ timeLimit });
  };

  const handleAccidentalsToggle = (enableAccidentals: boolean) => {
    updateSettings({ enableAccidentals });
  };

  const handleAccidentalProbabilityChange = (accidentalProbability: number) => {
    updateSettings({ accidentalProbability });
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/45 p-3 sm:p-4">
      <div
        className={`mx-auto my-4 w-full max-w-2xl rounded-[2rem] border border-[#ded6f7] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:my-8 ${className}`}
      >
        <div className="flex items-center justify-between border-b border-[#ede9fe] p-4 sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6d28d9]">
              {t.settings}
            </p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-slate-950 sm:text-2xl">
              {t.settings}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#ede9fe] bg-[#faf9fe] text-xl font-bold text-slate-400 hover:text-slate-700 sm:text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
          <div className="rounded-[1.5rem] border border-[#ede9fe] bg-[#faf9fe] p-4">
            <label className="mb-3 block text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
              {t.settingsLabels.clef}
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                onClick={() => handleClefChange("random")}
                className={`rounded-2xl border p-3 text-sm font-bold transition-colors ${
                  settings.clef === "random"
                    ? "border-[#7c3aed] bg-[#ede9fe] text-[#5b21b6]"
                    : "border-[#ded6f7] bg-white text-slate-700 hover:bg-[#faf9fe]"
                }`}
              >
                {t.settingsLabels.random}
              </button>
              {CLEFS.map((key) => (
                <button
                  key={key}
                  onClick={() => handleClefChange(key)}
                  className={`rounded-2xl border p-3 text-sm font-bold transition-colors ${
                    settings.clef === key
                      ? "border-[#7c3aed] bg-[#ede9fe] text-[#5b21b6]"
                      : "border-[#ded6f7] bg-white text-slate-700 hover:bg-[#faf9fe]"
                  }`}
                >
                  {t.clefs[key]}
                </button>
                ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#ede9fe] bg-[#faf9fe] p-4">
            <label className="mb-3 block text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
              {t.settingsLabels.keySignature}
            </label>
            <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto pr-1">
              <button
                onClick={() => handleKeySignatureChange("random")}
                className={`rounded-2xl border p-2 text-sm font-bold transition-colors ${
                  settings.keySignature === "random"
                    ? "border-[#7c3aed] bg-[#ede9fe] text-[#5b21b6]"
                    : "border-[#ded6f7] bg-white text-slate-700 hover:bg-[#faf9fe]"
                }`}
              >
                {t.settingsLabels.random}
              </button>
              {Object.entries(KEY_SIGNATURES).map(([key, keySignature]) => (
                <button
                  key={`${key}_${keySignature}`}
                  onClick={() => handleKeySignatureChange(key)}
                  className={`rounded-2xl border p-2 text-sm font-bold transition-colors ${
                    settings.keySignature === key
                      ? "border-[#7c3aed] bg-[#ede9fe] text-[#5b21b6]"
                      : "border-[#ded6f7] bg-white text-slate-700 hover:bg-[#faf9fe]"
                  }`}
                >
                  {key}
                </button>
                ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#ede9fe] bg-[#faf9fe] p-4">
            <label className="mb-3 block text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
              {t.settingsLabels.staffRange}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#ded6f7] bg-white p-3">
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  {t.settingsLabels.ledgerLinesAbove}
                </label>
                <select
                  value={settings.staffRange?.ledgerLinesAbove || 0}
                  onChange={(e) =>
                    handleStaffRangeChange(
                      "ledgerLinesAbove",
                      parseInt(e.target.value)
                    )
                  }
                  className="rounded-2xl border border-[#ded6f7] px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  {[0, 1, 2, 3, 4, 5].map((lines) => (
                    <option key={lines} value={lines}>
                      {lines}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-[#ded6f7] bg-white p-3">
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  {t.settingsLabels.ledgerLinesBelow}
                </label>
                <select
                  value={settings.staffRange?.ledgerLinesBelow || 0}
                  onChange={(e) =>
                    handleStaffRangeChange(
                      "ledgerLinesBelow",
                      parseInt(e.target.value)
                    )
                  }
                  className="rounded-2xl border border-[#ded6f7] px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  {[0, 1, 2, 3, 4, 5].map((lines) => (
                    <option key={lines} value={lines}>
                      {lines}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              {t.settingsLabels.ledgerLinesInstruction}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-[#ede9fe] bg-[#faf9fe] p-4">
            <label className="mb-3 block text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
              {t.settingsLabels.answerMode}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["piano", "solfege"] as AnswerMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleAnswerModeChange(mode)}
                  className={`rounded-2xl border p-3 text-sm font-bold transition-colors ${
                    settings.answerMode === mode
                      ? "border-[#7c3aed] bg-[#ede9fe] text-[#5b21b6]"
                      : "border-[#ded6f7] bg-white text-slate-700 hover:bg-[#faf9fe]"
                  }`}
                >
                  {mode === "piano" && t.answerModes.piano}
                  {mode === "solfege" && t.answerModes.solfege}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#ede9fe] bg-[#faf9fe] p-4">
            <label className="flex items-center gap-3 rounded-2xl border border-[#ded6f7] bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={settings.enableSound}
                onChange={(e) => handleSoundToggle(e.target.checked)}
                className="h-4 w-4 rounded border-[#ded6f7] text-[#5b21b6] focus:ring-[#7c3aed]"
              />
              <span className="text-sm font-bold text-slate-700">
                {t.settingsLabels.enableSound}
              </span>
            </label>
          </div>

          <div className="rounded-[1.5rem] border border-[#ede9fe] bg-[#faf9fe] p-4">
            <label className="mb-3 block text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
              {t.settingsLabels.timeLimit}
            </label>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#ded6f7] bg-white p-3">
              <input
                type="checkbox"
                checked={settings.timeLimit !== undefined}
                onChange={(e) =>
                  handleTimeLimitChange(e.target.checked ? 30 : undefined)
                }
                className="h-4 w-4 rounded border-[#ded6f7] text-[#5b21b6] focus:ring-[#7c3aed]"
              />
              <span className="text-sm font-medium text-slate-600">
                {t.settingsLabels.timeLimitEnable}
              </span>
              {settings.timeLimit !== undefined && (
                <input
                  type="number"
                  min="10"
                  max="300"
                  value={settings.timeLimit}
                  onChange={(e) =>
                    handleTimeLimitChange(parseInt(e.target.value))
                  }
                  className="w-20 rounded-2xl border border-[#ded6f7] px-2 py-1 text-sm font-semibold text-slate-700"
                />
              )}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#ede9fe] bg-[#faf9fe] p-4">
            <label className="mb-3 block text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
              {t.settingsLabels.accidentals} (♯, ♭, ♮)
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 rounded-2xl border border-[#ded6f7] bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={settings.enableAccidentals}
                  onChange={(e) => handleAccidentalsToggle(e.target.checked)}
                  className="h-4 w-4 rounded border-[#ded6f7] text-[#5b21b6] focus:ring-[#7c3aed]"
                />
                <span className="text-sm font-bold text-slate-700">
                  {t.settingsLabels.accidentals}
                </span>
              </label>

              {settings.enableAccidentals && (
                <div className="rounded-2xl border border-[#ded6f7] bg-white p-4">
                  <label className="mb-2 block text-xs text-slate-500">
                    {t.settingsLabels.accidentalProbability}:{" "}
                    {Math.round(settings.accidentalProbability * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={settings.accidentalProbability}
                    onChange={(e) =>
                      handleAccidentalProbabilityChange(
                        parseFloat(e.target.value)
                      )
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#ede9fe]"
                  />
                  <div className="mt-1 flex justify-between text-xs text-slate-500">
                    <span>10%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              {t.ui.accidentalDescription}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ede9fe] bg-[#faf9fe] p-4 sm:p-6">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={resetSettings}
              className="rounded-2xl border border-[#ded6f7] bg-white px-4 py-2 text-sm font-bold text-slate-700"
            >
              {t.settingsLabels.resetToDefault}
            </button>
            <button
              onClick={resetStats}
              className="rounded-2xl border border-[#ded6f7] bg-white px-4 py-2 text-sm font-bold text-slate-700"
            >
              {t.settingsLabels.resetAllStats}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onClose}
              className="rounded-2xl border border-[#ded6f7] bg-white px-4 py-2 text-sm font-bold text-slate-700"
            >
              {t.settingsLabels.cancel}
            </button>
            <button
              onClick={onClose}
              className="rounded-2xl bg-gradient-to-r from-[#5b21b6] to-[#6d28d9] px-4 py-2 text-sm font-bold text-white shadow-[0_10px_24px_rgba(91,33,182,0.22)]"
            >
              {t.settingsLabels.apply}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GameSettings;
