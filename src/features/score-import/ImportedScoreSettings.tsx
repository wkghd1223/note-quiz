"use client";

import { memo, useMemo, useState } from "react";
import {
  settingsActionClassName,
  settingsCheckboxClassName,
  settingsSelectClassName,
} from "@/components/practice/SettingsControls";
import { useTranslation } from "@/hooks/useTranslation";
import { melodyCopy } from "@/features/melody/i18n";
import {
  MelodyBeatSoundFields,
  MelodyTempoField,
} from "@/features/melody/components/MelodyPlaybackFields";
import { importCopy, type ImportWords } from "./copy";
import { practiceEventHeads } from "./timeline";
import KeySignatureField from "./KeySignatureField";
import { clefEdit, meterEdit, writtenRhythm } from "./score-edits";
import {
  clefs,
  clefKeys,
  clefValue,
  meters,
  signatureText,
  keyName,
} from "./signature-options";
import {
  displayedPitch,
  pitchLabel,
  shiftedKey,
  soundingShift,
} from "./editor-pitch";
import type { ScoreChange } from "./edit-history";
import type {
  ImportedBar,
  ImportedLane,
  ImportedScore,
  ImportedTimeline,
  ScoreMeter,
  ScoreOptions,
} from "./types";

const fieldClass = "grid min-w-0 gap-1 text-sm font-semibold";
const hintClass = "text-xs font-normal text-slate-600";
const mod = (v: number, m: number) => ((v % m) + m) % m;

function MeterField({
  value,
  onChange,
  words,
}: {
  value: ScoreMeter;
  onChange: (meter: ScoreMeter) => boolean;
  words: ImportWords;
}) {
  const current = signatureText(value.beats, value.beatType);
  const [custom, setCustom] = useState(false);
  const [beats, setBeats] = useState(String(value.beats)),
    [unit, setUnit] = useState(value.beatType);
  const valid =
    Number.isInteger(Number(beats)) &&
    Number(beats) >= 1 &&
    Number(beats) <= 32;
  if (custom)
    return (
      <fieldset className="grid gap-1">
        <legend className="mb-1 font-semibold">{words.meter}</legend>
        <div className="flex flex-wrap items-center gap-1">
          <input
            type="number"
            min={1}
            max={32}
            value={beats}
            aria-label={words.meter + " 𝅘𝅥"}
            onChange={(e) => setBeats(e.target.value)}
            className={settingsSelectClassName + " !w-14"}
          />
          <span aria-hidden="true">/</span>
          <select
            value={unit}
            aria-label={words.length}
            onChange={(e) => setUnit(Number(e.target.value))}
            className={settingsSelectClassName + " !w-16"}
          >
            {[1, 2, 4, 8, 16, 32].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <button
            type="button"
            className={settingsActionClassName}
            disabled={!valid}
            onClick={() => {
              if (onChange({ beats: Number(beats), beatType: unit }))
                setCustom(false);
            }}
          >
            {words.apply}
          </button>
          <button
            type="button"
            className={settingsActionClassName}
            onClick={() => setCustom(false)}
            aria-label={words.cancel}
          >
            ×
          </button>
        </div>
      </fieldset>
    );
  return (
    <label className={fieldClass}>
      {words.meter}
      <select
        className={settingsSelectClassName}
        value={current}
        onChange={(event) => {
          if (event.target.value === "custom") {
            setBeats(String(value.beats));
            setUnit(value.beatType);
            setCustom(true);
            return;
          }
          const [n, d] = event.target.value.split("/").map(Number);
          onChange({ beats: n, beatType: d });
        }}
      >
        {[...new Set([...meters, current])].map((v) => (
          <option key={v}>{v}</option>
        ))}
        <option value="custom">𝑛 / 𝑑 …</option>
      </select>
    </label>
  );
}

const lengths: Record<string, string> = {
  whole: "1",
  half: "1/2",
  quarter: "1/4",
  eighth: "1/8",
  breve: "2",
  long: "4",
  maxima: "8",
};
function passageSummary(
  lane: ImportedLane,
  from: number,
  to: number,
  semitones: number,
  practiceHeads?: ReadonlySet<Element>,
) {
  let min = Infinity,
    max = -Infinity,
    low = "",
    high = "";
  const rhythms = new Set<string>();
  for (let i = from; i <= to; i++)
    for (const event of lane.bars[i].events) {
      for (const head of practiceEventHeads(event.heads, practiceHeads)) {
        const rhythm = writtenRhythm(event, head);
        if (rhythm.type) {
          const denominator = parseInt(rhythm.type, 10);
          const length =
            lengths[rhythm.type] ??
            (denominator ? "1/" + denominator : rhythm.type);
          rhythms.add(
            length +
              "·".repeat(rhythm.dots) +
              (event.tuplet
                ? ` (${event.tuplet.actual}:${event.tuplet.normal})`
                : ""),
          );
        }
        if (head.midi >= min && head.midi <= max) continue;
        const label = pitchLabel(
          displayedPitch(head, event.fifths, soundingShift(head, semitones)),
        );
        if (head.midi < min) {
          min = head.midi;
          low = label;
        }
        if (head.midi > max) {
          max = head.midi;
          high = label;
        }
      }
    }
  return {
    pitches: low === high ? low : low + "–" + high,
    rhythm: [...rhythms].join(", "),
  };
}

interface Props {
  score: ImportedScore;
  lane: ImportedLane;
  barIndex: number;
  options: ScoreOptions;
  timeline: ImportedTimeline | null;
  disabled: boolean;
  onOptions: (next: ScoreOptions) => void;
  onLane: (id: string) => void;
  onBar: (index: number) => void;
  onEdit: (change: ScoreChange) => boolean;
}

function ImportedScoreSettings({
  score,
  lane,
  barIndex,
  options,
  timeline,
  disabled,
  onOptions,
  onLane,
  onBar,
  onEdit,
}: Props) {
  const { language } = useTranslation(),
    m = melodyCopy(language),
    w = useMemo(() => importCopy(language), [language]);
  const [failure, setFailure] = useState<ImportedBar | null>(null);
  const [tempoDraft, setTempoDraft] = useState<string | null>(null);
  const end = lane.bars.length - 1,
    from = Math.min(end, options.fromBar),
    to = Math.min(end, options.toBar);
  const bar = lane.bars[Math.min(end, barIndex)];
  const revise = (change: ScoreChange) => {
    const ok = onEdit(change);
    setFailure(ok ? null : bar);
    return ok;
  };
  const set = (patch: Partial<ScoreOptions>) =>
    onOptions({ ...options, ...patch });
  const sourceKey = shiftedKey(bar.fifths, bar.transpose ?? 0);
  const targetKey = (change: number) =>
    shiftedKey(bar.fifths, (bar.transpose ?? 0) + change);
  const interval = options.semitones;
  const choices = Array.from({ length: 12 }, (_, i) => {
    const closest = interval + mod(i - interval + 5, 12) - 5;
    return closest > 24 ? closest - 12 : closest < -24 ? closest + 12 : closest;
  });
  const sourceBpm = timeline?.sourceBpm;
  const bpm = sourceBpm
    ? Math.round(sourceBpm * options.speed * 100) / 100
    : null;
  const percent = Math.round(options.speed * 10000) / 100;
  const summary = useMemo(
    () => passageSummary(lane, from, to, interval, score.practiceHeads),
    [lane, from, to, interval, score.practiceHeads],
  );
  const barOptions = useMemo(
    () =>
      lane.bars.map((row) => (
        <option key={row.index} value={row.index}>
          {row.label}
        </option>
      )),
    [lane],
  );
  return (
    <fieldset
      disabled={disabled}
      className="grid min-w-0 gap-4 text-sm disabled:opacity-60"
      data-import-settings
    >
      {score.lanes.length > 1 && (
        <label className={fieldClass}>
          {w.lane}
          <select
            value={lane.id}
            onChange={(e) => onLane(e.target.value)}
            className={settingsSelectClassName}
          >
            {score.lanes.map((l) => (
              <option value={l.id} key={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        {(["fromBar", "toBar"] as const).map((key) => (
          <label key={key} className={fieldClass}>
            {key === "fromBar" ? w.from : w.to}
            <select
              className={settingsSelectClassName}
              value={key === "fromBar" ? from : to}
              onChange={(e) => {
                const n = Number(e.target.value);
                set(
                  key === "fromBar"
                    ? { fromBar: n, toBar: Math.max(n, options.toBar) }
                    : {
                        fromBar: Math.min(n, from),
                        toBar: n === end ? Infinity : n,
                      },
                );
                onBar(n);
              }}
            >
              {barOptions}
            </select>
          </label>
        ))}
      </div>
      <fieldset className="grid gap-2 border-t border-slate-200 pt-2">
        <legend className="px-1 font-semibold">{w.signatures}</legend>
        <label className={fieldClass}>
          {w.fromHere}
          <select
            className={settingsSelectClassName}
            value={bar.index}
            onChange={(e) => onBar(Number(e.target.value))}
          >
            {barOptions}
          </select>
        </label>
        <KeySignatureField
          key={[lane.id, bar.index, bar.fifths, bar.keyMode].join("/")}
          score={score}
          lane={lane}
          bar={bar}
          semitones={options.semitones}
          words={w}
          onEdit={revise}
        />
        <label className={fieldClass}>
          {w.clef}
          <select
            value={clefValue(bar.clef)}
            className={settingsSelectClassName}
            onChange={(e) => {
              const clef = clefs.find((c) => clefValue(c) === e.target.value);
              if (clef) revise(clefEdit(bar, lane, clef));
            }}
          >
            {!clefs.some((c) => clefValue(c) === clefValue(bar.clef)) && (
              <option value={clefValue(bar.clef)}>{clefValue(bar.clef)}</option>
            )}
            {clefs.map((c, i) => (
              <option key={clefKeys[i]} value={clefValue(c)}>
                {w.clefNames[clefKeys[i]]}
              </option>
            ))}
          </select>
        </label>
        <MeterField
          key={
            lane.id +
            "/" +
            barIndex +
            "/" +
            signatureText(bar.meter.beats, bar.meter.beatType)
          }
          value={bar.meter}
          words={w}
          onChange={(meter) => revise(meterEdit(score, lane, bar, meter))}
        />
        {failure === bar && (
          <p role="alert" className="text-sm text-red-800">
            {w.editConflict}
          </p>
        )}
      </fieldset>
      <label className={fieldClass}>
        {w.practiceKey}
        <select
          className={settingsSelectClassName}
          value={mod(interval, 12)}
          onChange={(e) => set({ semitones: choices[Number(e.target.value)] })}
        >
          {choices.map((shift, i) => (
            <option key={i} value={i}>
              {keyName(targetKey(shift), bar.keyMode, m)}
            </option>
          ))}
        </select>
        <span className={hintClass}>
          {w.original} · {keyName(bar.fifths, bar.keyMode, m)}
          {sourceKey !== bar.fifths &&
            ` · ${w.concertPitch} ${keyName(sourceKey, bar.keyMode, m)}`}
        </span>
      </label>
      <div className="grid grid-cols-2 items-end gap-2">
        <label className={fieldClass}>
          {w.transpose}
          <select
            className={settingsSelectClassName}
            value={interval}
            onChange={(e) => set({ semitones: Number(e.target.value) })}
          >
            {Array.from({ length: 49 }, (_, i) => i - 24).map((n) => (
              <option key={n} value={n}>
                {n > 0 ? "+" : ""}
                {n}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="min-w-0">
          <legend className="mb-1 text-sm font-semibold">
            {w.octaveShift}
          </legend>
          <div className="grid grid-cols-2 gap-1">
            {[-12, 12].map((n) => (
              <button
                type="button"
                key={n}
                className={settingsActionClassName}
                aria-label={w.octaveShift + " " + (n > 0 ? "+1" : "−1")}
                disabled={Math.abs(interval + n) > 24}
                onClick={() => set({ semitones: interval + n })}
              >
                {n > 0 ? "+1" : "−1"}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs text-slate-600">
        <dt>{m.range}</dt>
        <dd>{summary.pitches || "—"}</dd>
        <dt>{m.durations}</dt>
        <dd>{summary.rhythm || "—"}</dd>
      </dl>
      <div className="grid grid-cols-2 items-start gap-2">
        {sourceBpm && bpm !== null && (
          <MelodyTempoField
            min={1}
            value={tempoDraft ?? bpm}
            onChange={(input) => {
              setTempoDraft(input);
              const next = Number(input);
              if (input && Number.isFinite(next) && next >= 1)
                set({ speed: next / sourceBpm });
            }}
            onBlur={() => setTempoDraft(null)}
          />
        )}
        <label className={fieldClass}>
          {w.speed}
          <select
            className={settingsSelectClassName}
            value={options.speed}
            onChange={(e) => {
              setTempoDraft(null);
              set({ speed: Number(e.target.value) });
            }}
          >
            {[...new Set([0.5, 0.75, 1, 1.25, 1.5, 2, options.speed])]
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  {n === options.speed ? percent : Math.round(n * 100)}%
                </option>
              ))}
          </select>
        </label>
      </div>
      <label className="flex min-h-10 items-center gap-2 font-semibold">
        <input
          className={settingsCheckboxClassName}
          type="checkbox"
          checked={options.repeats}
          onChange={(e) => set({ repeats: e.target.checked })}
        />
        {w.follow}
      </label>
      <MelodyBeatSoundFields value={options} onChange={set} />
    </fieldset>
  );
}
export default memo(ImportedScoreSettings);
