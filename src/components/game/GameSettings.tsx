"use client";

import React from "react";
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
  const { settings, updateSettings, resetSettings, resetStats } =
    useGameStore();

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className={`bg-white rounded-lg shadow-xl max-w-2xl w-full mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto ${className}`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            {t.settings}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl sm:text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* 설정 내용 */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* 음자리표 설정 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 sm:mb-3">
              {t.settingsLabels.clef}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => handleClefChange("random")}
                className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                  settings.clef === "random"
                    ? "bg-blue-100 border-blue-300 text-blue-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {t.settingsLabels.random}
              </button>
              {Object.entries(CLEFS).map(([key, clef]) => (
                <button
                  key={key}
                  onClick={() => handleClefChange(key as ClefType)}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    settings.clef === key
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {clef.name}
                </button>
              ))}
            </div>
          </div>

          {/* 조표 설정 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t.settingsLabels.keySignature}
            </label>
            <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
              <button
                onClick={() => handleKeySignatureChange("random")}
                className={`p-2 rounded-lg border text-sm font-medium transition-colors ${
                  settings.keySignature === "random"
                    ? "bg-blue-100 border-blue-300 text-blue-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {t.settingsLabels.random}
              </button>
              {Object.entries(KEY_SIGNATURES).map(([key, keySignature]) => (
                <button
                  key={`${key}_${keySignature}`}
                  onClick={() => handleKeySignatureChange(key)}
                  className={`p-2 rounded-lg border text-sm font-medium transition-colors ${
                    settings.keySignature === key
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* 오선지 범위 설정 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t.settingsLabels.staffRange}
            </label>
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
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
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  {[0, 1, 2, 3, 4, 5].map((lines) => (
                    <option key={lines} value={lines}>
                      {lines}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
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
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  {[0, 1, 2, 3, 4, 5].map((lines) => (
                    <option key={lines} value={lines}>
                      {lines}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {t.settingsLabels.ledgerLinesInstruction}
            </p>
          </div>

          {/* 답안 입력 방식 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t.settingsLabels.answerMode}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["piano", "solfege"] as AnswerMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleAnswerModeChange(mode)}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    settings.answerMode === mode
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {mode === "piano" && t.answerModes.piano}
                  {mode === "solfege" && t.answerModes.solfege}
                </button>
              ))}
            </div>
          </div>

          {/* 소리 설정 */}
          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.enableSound}
                onChange={(e) => handleSoundToggle(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                {t.settingsLabels.enableSound}
              </span>
            </label>
          </div>

          {/* 시간 제한 설정 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t.settingsLabels.timeLimit}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.timeLimit !== undefined}
                onChange={(e) =>
                  handleTimeLimitChange(e.target.checked ? 30 : undefined)
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
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
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm w-20"
                />
              )}
            </div>
          </div>

          {/* 임시표 설정 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t.settingsLabels.accidentals} (♯, ♭, ♮)
            </label>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={settings.enableAccidentals}
                  onChange={(e) => handleAccidentalsToggle(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  {t.settingsLabels.accidentals}
                </span>
              </label>

              {settings.enableAccidentals && (
                <div>
                  <label className="block text-xs text-gray-500 mb-2">
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
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>10%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {t.ui.accidentalDescription}
            </p>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50 flex-wrap space-y-3">
          <div className="flex space-x-3">
            <button
              onClick={resetSettings}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t.settingsLabels.resetToDefault}
            </button>
            <button
              onClick={resetStats}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t.settingsLabels.resetAllStats}
            </button>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t.settingsLabels.cancel}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t.settingsLabels.apply}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameSettings;
