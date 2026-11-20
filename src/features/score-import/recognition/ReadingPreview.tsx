"use client";

import { useMemo, useState } from "react";
import {
  settingsActionClassName,
  settingsSelectClassName,
} from "@/components/practice/SettingsControls";
import type { ImportWords } from "../copy";
import { lengthChoices } from "../editor-layout";
import { pitchLabel } from "../editor-pitch";
import { keyName, meters, signatureText } from "../signature-options";
import type { ImportedScore } from "../types";
import type { ReadingContext, StaffReading } from "./reading";
import { scoreFromReading } from "./source";

const keys = Array.from({ length: 15 }, (_, i) => i - 7);

export default function ReadingPreview({
  reading,
  words,
  onAccept,
}: {
  reading: StaffReading;
  words: ImportWords;
  onAccept: (score: ImportedScore) => void;
}) {
  const [clef, setClef] = useState(reading.clef);
  const [fifths, setFifths] = useState(reading.fifths);
  const [meter, setMeter] = useState(reading.meter);
  const signature = meter ? signatureText(meter.beats, meter.beatType) : "";
  const printedMeter = reading.meter
    ? signatureText(reading.meter.beats, reading.meter.beatType)
    : null;
  const meterOptions =
    printedMeter && !meters.includes(printedMeter)
      ? [...meters, printedMeter]
      : meters;
  const preview = useMemo(() => {
    if (!clef || fifths == null || !meter) return null;
    const context: ReadingContext = { clef, fifths, meter };
    try {
      return { score: scoreFromReading(reading, context) };
    } catch (failure) {
      return {
        error:
          failure instanceof Error && failure.message === "meterMismatch"
            ? words.meterMismatch
            : words.recognitionFailed,
      };
    }
  }, [
    reading,
    clef,
    fifths,
    meter,
    words.meterMismatch,
    words.recognitionFailed,
  ]);

  return (
    <div className="grid min-w-0 gap-3">
      <h2 className="font-semibold">{words.reviewNotes}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid min-w-0 gap-1 text-sm font-semibold">
          {words.clef}
          <select
            data-recognition-clef
            required
            className={settingsSelectClassName}
            value={clef ?? ""}
            onChange={(e) => setClef(e.target.value === "G" ? "G" : "F")}
          >
            <option value="" disabled>
              {words.chooseFromSource}
            </option>
            <option value="G">{words.clefNames.treble}</option>
            <option value="F">{words.clefNames.bass}</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-semibold">
          {words.keySignature}
          <select
            data-recognition-key
            required
            className={settingsSelectClassName}
            value={fifths ?? ""}
            onChange={(e) => setFifths(Number(e.target.value))}
          >
            <option value="" disabled>
              {words.chooseFromSource}
            </option>
            {keys.map((key) => (
              <option key={key} value={key}>
                {keyName(key, undefined, words)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-semibold">
          {words.meter}
          <select
            data-recognition-meter
            required
            className={settingsSelectClassName}
            value={signature}
            onChange={(e) => {
              const [beats, beatType] = e.target.value.split("/").map(Number);
              const original = reading.meter;
              setMeter(
                original?.beats === beats && original.beatType === beatType
                  ? original
                  : { beats, beatType },
              );
            }}
          >
            <option value="" disabled>
              {words.chooseFromSource}
            </option>
            {meterOptions.map((value) => (
              <option key={value} value={value}>
                {value}
                {value === printedMeter && reading.meter?.symbol
                  ? reading.meter.symbol === "common"
                    ? " (𝄴)"
                    : " (𝄵)"
                  : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {preview?.error && (
        <p role="alert" className="text-red-800">
          {preview.error}
        </p>
      )}
      <PracticeNotes
        key={[clef, fifths, signature].join("/")}
        score={preview?.score}
        words={words}
        onAccept={onAccept}
      />
    </div>
  );
}

function PracticeNotes({
  score,
  words,
  onAccept,
}: {
  score?: ImportedScore;
  words: ImportWords;
  onAccept: (score: ImportedScore) => void;
}) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const bars = score?.lanes[0].bars;
  const complete = bars?.every((bar) =>
    bar.events.every((event) => event.heads.length < 2 || choices[event.id]),
  );

  function accept() {
    if (!score || !bars || !complete) return;
    const practiceHeads = new Set<Element>();
    for (const bar of bars) {
      for (const event of bar.events) {
        const index = choices[event.id];
        if (index && index !== "all")
          practiceHeads.add(event.heads[Number(index)].source);
      }
    }
    onAccept({ ...score, practiceHeads });
  }

  return (
    <>
      {bars && (
        <ol className="grid max-h-72 min-w-0 gap-3 overflow-auto text-sm">
          {bars.map((bar) => (
            <li key={bar.index}>
              <span className="font-semibold">
                {words.bar} {bar.label}
              </span>
              <div className="mt-1 flex flex-wrap items-start gap-x-4 gap-y-1">
                {bar.events.map((event) => {
                  const pitches = event.heads.map(pitchLabel);
                  const wholeBarRest =
                    !pitches.length &&
                    event.source.querySelector('rest[measure="yes"]');
                  const length = wholeBarRest
                    ? signatureText(bar.meter.beats, bar.meter.beatType)
                    : lengthChoices.find(
                        ([type]) => type === event.noteType,
                      )?.[1];
                  return (
                    <div
                      data-recognition-event
                      key={event.id}
                      className="grid min-w-0 gap-1"
                    >
                      <span>
                        {pitches.length ? pitches.join(" + ") : words.rest}{" "}
                        <small className="text-slate-600">
                          <span className="sr-only">{words.length} </span>
                          {length}
                          {"·".repeat(event.dots)}
                        </small>
                      </span>
                      {pitches.length > 1 && (
                        <label className="grid gap-1 text-xs text-slate-600">
                          {words.practiceNote}
                          <select
                            data-recognition-chord
                            aria-label={[
                              words.practiceNote,
                              words.bar + " " + bar.label,
                              pitches.join(" + "),
                            ].join(" · ")}
                            required
                            className={settingsSelectClassName}
                            value={choices[event.id] ?? ""}
                            onChange={(e) => {
                              const choice = e.target.value;
                              setChoices((current) => ({
                                ...current,
                                [event.id]: choice,
                              }));
                            }}
                          >
                            <option value="" disabled>
                              —
                            </option>
                            <option value="all">{words.wholeChord}</option>
                            {pitches.map((pitch, index) => (
                              <option key={index} value={index}>
                                {pitch}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        className={
          settingsActionClassName +
          " justify-self-start !border-violet-800 !bg-violet-800 !text-white disabled:opacity-50"
        }
        disabled={!complete}
        onClick={accept}
      >
        {words.editRecognized}
      </button>
    </>
  );
}
