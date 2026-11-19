"use client";

import { useState } from "react";
import {
  settingsActionClassName,
  settingsCheckboxClassName,
  settingsSelectClassName,
} from "@/components/practice/SettingsControls";
import { shiftedKey } from "./editor-pitch";
import { keyName } from "./signature-options";
import { keyEdit } from "./signature-edit";
import type { ImportWords } from "./copy";
import type { ScoreChange } from "./edit-history";
import type {
  ImportedBar,
  ImportedEvent,
  ImportedLane,
  ImportedScore,
} from "./types";

const keys = Array.from({ length: 15 }, (_, i) => i - 7);

export default function KeySignatureField({
  score,
  lane,
  bar,
  event,
  semitones,
  words,
  onEdit,
  onApplied,
}: {
  score: ImportedScore;
  lane: ImportedLane;
  bar: ImportedBar;
  event?: ImportedEvent;
  semitones: number;
  words: ImportWords;
  onEdit: (change: ScoreChange) => boolean;
  onApplied?: () => void;
}) {
  const at = event ?? bar;
  const mode =
    at.keyMode === "ionian"
      ? "major"
      : at.keyMode === "aeolian"
        ? "minor"
        : at.keyMode;
  const current =
    (mode === "major" || mode === "minor") && keys.includes(at.fifths)
      ? mode + "/" + at.fifths
      : "source";
  const [choice, setChoice] = useState(current);
  const [transpose, setTranspose] = useState(false);
  const displayShift = semitones + (at.transpose ?? 0);
  function label(fifths: number, mode?: string) {
    const shown = shiftedKey(fifths, displayShift);
    const written = keyName(fifths, mode, words);
    if (shown === fifths) return written;
    return (
      keyName(shown, mode, words) +
      " · " +
      words.writtenKey.replace("{key}", written)
    );
  }
  return (
    <div className="grid min-w-0 gap-2" data-key-field>
      <label className="grid min-w-0 gap-1 text-sm font-semibold">
        {words.key}
        <select
          className={settingsSelectClassName}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          {current === "source" && (
            <option value="source">{label(at.fifths, at.keyMode)}</option>
          )}
          {(["major", "minor"] as const).map((group) => (
            <optgroup key={group} label={words[group]}>
              {keys.map((fifths) => (
                <option key={fifths} value={group + "/" + fifths}>
                  {label(fifths, group)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {choice !== current && (
        <>
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className={settingsCheckboxClassName}
              checked={transpose}
              onChange={(e) => setTranspose(e.target.checked)}
            />
            {words.transposeNotes}
          </label>
          <p className="text-xs leading-5 text-slate-600">{words.keyScope}</p>
          <button
            type="button"
            className={settingsActionClassName}
            onClick={() => {
              const [mode, fifths] = choice.split("/");
              if (mode !== "major" && mode !== "minor") return;
              if (
                onEdit(
                  keyEdit(
                    score,
                    lane,
                    bar,
                    { mode, fifths: Number(fifths) },
                    transpose,
                    event,
                  ),
                )
              )
                onApplied?.();
            }}
          >
            {words.apply}
          </button>
        </>
      )}
    </div>
  );
}
