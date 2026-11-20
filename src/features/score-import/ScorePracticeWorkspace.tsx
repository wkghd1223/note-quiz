"use client";

import dynamic from "next/dynamic";
import {
  memo,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SettingsSurface from "@/components/practice/SettingsSurface";
import { settingsActionClassName as buttonClass } from "@/components/practice/SettingsControls";
import { useTranslation } from "@/hooks/useTranslation";
import { challengeCopy } from "@/features/challenge/i18n";
import { melodyCopy } from "@/features/melody/i18n";
import { importCopy, type ImportWords } from "./copy";
import { editScore, type ScoreChange } from "./edit-history";
import { displayedPitch, pitchLabel, soundingShift } from "./editor-pitch";
import { prepareScore } from "./timeline";
import { useImportedSession } from "./useImportedSession";
import type { ImportedScore, ImportedTimeline, ScoreOptions } from "./types";
import {
  MelodyHeading,
  MelodySettingsButton,
  MelodyWorkspace,
} from "@/features/melody/components/MelodyWorkspace";
import ImportedScoreSettings from "./ImportedScoreSettings";
import ScoreEditor from "./ScoreEditor";
import SourceExcerpt from "./recognition/SourceExcerpt";

import type { ScoreDraftRef } from "@/features/melody/score-draft";
import { reason, fileMessage } from "./score-error";

const FullScore = dynamic(() => import("./FullScore"), { ssr: false });
const LineEditor = memo(ScoreEditor);
const primary = `${buttonClass} !border-violet-800 !bg-violet-800 !text-white disabled:opacity-50`;

function notationLabel(code: string, w: ImportWords) {
  if (["dynamics", "wedge"].includes(code)) return w.dynamics;
  if (["grace", "ornaments"].includes(code)) return w.ornament;
  if (
    [
      "articulations",
      "technical",
      "pedal",
      "glissando",
      "arpeggiate",
      "pizzicato",
      "slide",
    ].includes(code)
  )
    return w.technique;
  if (code === "fermata") return w.hold;
  if (
    [
      "ending",
      "repeat",
      "navigation",
      "beat-repeat",
      "measure-repeat",
    ].includes(code)
  )
    return w.repeat;
  if (code === "time" || code === "midMeasureTime") return w.meter;
  if (code === "pitch" || code === "unpitched") return w.pitch;
  if (code === "transpose") return w.transpose;
  if (["tempo", "tempo-text", "metronome"].includes(code)) return w.speed;
  return w.mark;
}

function itemAt<T extends { startSec: number; endSec: number }>(
  targets: readonly T[],
  seconds: number,
) {
  let left = 0,
    right = targets.length;
  while (left < right) {
    const middle = (left + right) >>> 1;
    if (targets[middle].endSec <= seconds) left = middle + 1;
    else right = middle;
  }
  const item = targets[left];
  return item && item.startSec <= seconds ? item : undefined;
}

const noteNames = [
  "C",
  "C♯",
  "D",
  "E♭",
  "E",
  "F",
  "F♯",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
];
function pitchName(midi: number) {
  return `${noteNames[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export default function ScorePracticeWorkspace({
  original,
  draft,
  title,
  initialCues,
  headerAction,
  loading = false,
  errorMessage,
}: {
  original: ImportedScore;
  draft: ScoreDraftRef;
  title?: string;
  initialCues?: Pick<ScoreOptions, "metronome" | "barBell">;
  headerAction: (locked: boolean, dirty: boolean) => ReactNode;
  loading?: boolean;
  errorMessage?: string;
}) {
  const { language, t } = useTranslation();
  const w = useMemo(() => importCopy(language), [language]),
    c = challengeCopy(language),
    m = melodyCopy(language);
  const saved = draft.current?.original === original ? draft.current : null;
  const [score, setScore] = useState(saved?.score ?? original);
  const past = useRef<ImportedScore[]>(saved?.past ?? []),
    future = useRef<ImportedScore[]>(saved?.future ?? []);
  const historyLimit = useMemo(
    () =>
      Math.max(
        1,
        Math.min(
          40,
          Math.floor(
            300_000 /
              Math.max(1, original.document.getElementsByTagName("*").length),
          ),
        ),
      ),
    [original],
  );
  const [laneId, setLaneId] = useState(saved?.laneId ?? original.lanes[0].id);
  const lane = score.lanes.find((row) => row.id === laneId) ?? score.lanes[0];
  const [barIndex, setBarIndex] = useState(saved?.barIndex ?? 0);
  const [options, setOptions] = useState<ScoreOptions>(
    saved?.options ?? {
      fromBar: 0,
      toBar: Infinity,
      semitones: 0,
      speed: 1,
      repeats: true,
      ...initialCues,
    },
  );
  const [view, setView] = useState<"line" | "full">(saved?.view ?? "line");
  const [compareOriginal, setCompareOriginal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editError, setEditError] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [barPreview, setBarPreview] = useState<ImportedTimeline | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [audioMode, setAudioMode] = useState<"practice" | "preview">(
    "practice",
  );
  const end = lane.bars.length - 1;
  const from = Math.min(end, options.fromBar),
    to = Math.min(end, options.toBar);
  const compiled = useMemo(() => {
    try {
      return {
        timeline: prepareScore(score, lane.id, {
          ...options,
          fromBar: from,
          toBar: to,
        }),
        error: "",
      };
    } catch (error) {
      return { timeline: null, error: reason(error) };
    }
  }, [score, lane.id, options, from, to]);
  const session = useImportedSession(compiled.timeline);
  const { phase } = session;
  const playing =
    phase === "playing" ||
    phase === "preview" ||
    phase === "countIn" ||
    phase === "paused";
  const locked = playing || phase === "preparing" || loading;
  const audible =
    phase === "preview" && barPreview ? barPreview : compiled.timeline;
  const target =
    playing && audible ? itemAt(audible.targets, session.elapsed) : undefined;
  const span =
    playing && audible?.tempoSpans
      ? (itemAt(audible.tempoSpans, session.elapsed) ??
        audible.tempoSpans.at(-1))
      : undefined;
  const bar = Math.min(end, span?.barIndex ?? target?.barIndex ?? barIndex);
  const playhead = useMemo(
    () =>
      playing
        ? { barIndex: bar, partId: lane.partId, staff: lane.staff }
        : undefined,
    [playing, bar, lane.partId, lane.staff],
  );
  const playPosition = useMemo(
    () =>
      span && {
        barIndex: span.barIndex,
        beat:
          span.startBeat +
          (Math.min(session.elapsed, span.endSec) - span.startSec) *
            span.quartersPerSecond,
      },
    [span, session.elapsed],
  );
  const written =
    playing && audible?.cursor
      ? itemAt(audible.cursor, session.elapsed)
      : undefined;
  const writtenEvent = useMemo(
    () =>
      written &&
      lane.bars[written.barIndex]?.events.find(
        (event) => event.id === written.eventId,
      ),
    [written, lane],
  );
  const currentPitches = useMemo(
    () =>
      target?.midis.map((midi) => {
        const head = writtenEvent?.heads.find(
          (h) => h.midi + options.semitones === midi,
        );
        return head && writtenEvent
          ? pitchLabel(
              displayedPitch(
                head,
                writtenEvent.fifths,
                soundingShift(head, options.semitones),
              ),
            )
          : pitchName(midi);
      }),
    [target, writtenEvent, options.semitones],
  );
  const issues = useMemo(
    () =>
      score.issues
        .filter(
          (issue) =>
            (!issue.partId || issue.partId === lane.partId) &&
            (!issue.staff || issue.staff === lane.staff) &&
            (!issue.voice || issue.voice === lane.voice) &&
            (issue.barIndex === undefined ||
              (issue.barIndex >= from && issue.barIndex <= to)),
        )
        .sort((a, b) => Number(b.blocksPractice) - Number(a.blocksPractice)),
    [score, lane, from, to],
  );
  const blocked = !compiled.timeline;
  const dirty = score !== original;
  const hasChords = useMemo(
    () => compiled.timeline?.targets.some((item) => item.midis.length > 1),
    [compiled.timeline],
  );
  const audition = (oneBar: boolean) => {
    setPreviewError("");
    try {
      const passage = oneBar
        ? prepareScore(score, lane.id, {
            ...options,
            fromBar: bar,
            toBar: bar,
            repeats: false,
          })
        : undefined;
      setBarPreview(passage ?? null);
      setAudioMode("preview");
      setCompareOriginal(false);
      session.preview(passage);
    } catch (failure) {
      setPreviewError(reason(failure));
    }
  };

  useLayoutEffect(() => {
    draft.current = {
      original,
      score,
      past: past.current,
      future: future.current,
      laneId: lane.id,
      barIndex,
      options,
      view,
    };
  }, [draft, original, score, lane.id, barIndex, options, view]);

  const edit = useCallback(
    (change: ScoreChange) => {
      if (locked) return false;
      try {
        const next = editScore(score, change);
        past.current = [...past.current, score].slice(-historyLimit);
        future.current = [];
        setEditError(false);
        setPreviewError("");
        setScore(next);
        return true;
      } catch {
        setEditError(true);
        return false;
      }
    },
    [score, locked, historyLimit],
  );

  const travel = (back: boolean) => {
    if (locked) return;
    const source = back ? past : future;
    const next = source.current.pop();
    if (!next) return;
    (back ? future : past).current.push(score);
    setEditError(false);
    setPreviewError("");
    setScore(next);
  };
  const setLane = useCallback(
    (id: string) => {
      const next = score.lanes.find((item) => item.id === id);
      if (!next) return;
      setLaneId(next.id);
      setBarIndex(0);
      setOptions((old) => ({ ...old, fromBar: 0, toBar: Infinity }));
    },
    [score.lanes],
  );
  const resultTargets =
    phase === "result" ? (compiled.timeline?.targets ?? []) : [];
  const audioError =
    audioMode === "preview"
      ? m.previewError
      : session.error === "denied"
        ? m.denied
        : session.error === "missing-device"
          ? m.missing
          : session.error === "device-busy"
            ? c.deviceBusy
            : session.error === "unsupported"
              ? m.unsupported
              : m.audioError;
  return (
    <section
      data-imported-score
      data-import-phase={phase}
      className="grid w-full min-w-0 gap-3"
      onKeyDown={(event) => {
        if (
          !(event.metaKey || event.ctrlKey) ||
          event.key.toLowerCase() !== "z" ||
          (event.target instanceof HTMLElement &&
            event.target.matches(
              "input, textarea, select, [contenteditable=true]",
            ))
        )
          return;
        event.preventDefault();
        travel(!event.shiftKey);
      }}
    >
      <MelodyHeading
        title={title || score.title || original.file?.name || w.editor}
        description={
          original.sourceFormat === "midi" ? w.midiNotation : undefined
        }
      >
        {headerAction(locked, dirty)}
      </MelodyHeading>
      {loading && <p role="status">{c.loading}</p>}
      {errorMessage && (
        <p role="alert" className="text-red-800">
          {errorMessage}
        </p>
      )}
      {original.sourceExcerpt && <SourceExcerpt excerpt={original.sourceExcerpt} words={w} />}
      <MelodyWorkspace>
        <section className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              role="group"
              aria-label={c.sheetMusic}
              className="flex flex-wrap gap-1"
            >
              {(["line", "full"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={loading}
                  aria-pressed={view === value}
                  className={`${buttonClass} aria-pressed:border-violet-500 aria-pressed:bg-violet-50`}
                  onClick={() => {
                    setView(value);
                    setCompareOriginal(false);
                  }}
                >
                  {w[value]}
                </button>
              ))}
            </div>
            {view === "full" && !locked && (
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={compareOriginal}
                  onChange={(e) => setCompareOriginal(e.target.checked)}
                />
                {w.original}
              </label>
            )}
            <MelodySettingsButton
              label={t.settings}
              open={settingsOpen}
              disabled={locked}
              onClick={() => setSettingsOpen(true)}
            />
          </div>
          {view === "line" ? (
            <>
              <LineEditor
                score={score}
                lane={lane}
                barIndex={bar}
                semitones={options.semitones}
                locked={locked}
                activeEventId={written?.eventId}
                playPosition={playPosition}
                onBar={setBarIndex}
                onEdit={edit}
                words={w}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={locked || !past.current.length}
                  onClick={() => travel(true)}
                >
                  {w.undo}
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={locked || !future.current.length}
                  onClick={() => travel(false)}
                >
                  {w.redo}
                </button>
              </div>
            </>
          ) : (
            <FullScore
              score={compareOriginal ? original : score}
              words={w}
              semitones={compareOriginal ? undefined : options.semitones}
              playhead={playhead}
              onBar={
                locked || compareOriginal
                  ? undefined
                  : (index, id) => {
                      if (id && id !== lane.id) setLane(id);
                      setBarIndex(index);
                      setView("line");
                    }
              }
            />
          )}
          {editError && (
            <p role="alert" className="text-amber-900">
              {w.editConflict}
            </p>
          )}
          {(compiled.error || issues.length > 0) && (
            <div
              role="status"
              className="rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-900"
            >
              <p>
                {compiled.error
                  ? fileMessage(compiled.error, w)
                  : blocked
                    ? w.limited
                    : w.notationHint}
              </p>
              {issues.length > 0 && (
                <details
                  className="mt-1"
                  onToggle={(event) => setIssuesOpen(event.currentTarget.open)}
                >
                  <summary className="cursor-pointer">
                    {issues[0].barIndex !== undefined &&
                      `${w.bar} ${lane.bars[issues[0].barIndex]?.label} · `}
                    {notationLabel(issues[0].code, w)}
                    {issues.length > 1 && ` (+${issues.length - 1})`}
                  </summary>
                  <ul className="mt-2 max-h-40 overflow-auto">
                    {issuesOpen &&
                      issues.map((issue, i) => (
                        <li key={i}>
                          {issue.barIndex !== undefined && (
                            <button
                              type="button"
                              disabled={locked}
                              className="rounded underline"
                              onClick={() => {
                                setView("line");
                                setBarIndex(issue.barIndex!);
                              }}
                            >
                              {w.bar} {lane.bars[issue.barIndex]?.label}
                            </button>
                          )}{" "}
                          {notationLabel(issue.code, w)} ·{" "}
                          <code className="text-xs">{issue.code}</code>
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
            {phase === "ready" || phase === "result" || phase === "error" ? (
              <>
                <button
                  type="button"
                  disabled={loading || blocked}
                  className={primary}
                  onClick={() => {
                    setCompareOriginal(false);
                    setPreviewError("");
                    setAudioMode("practice");
                    session.start();
                  }}
                >
                  {phase === "result" ? m.retry : m.start}
                </button>
                <button
                  type="button"
                  disabled={loading || blocked}
                  className={buttonClass}
                  onClick={() => audition(false)}
                >
                  {c.preview}
                </button>
                {view === "line" && (
                  <button
                    type="button"
                    disabled={loading}
                    className={buttonClass}
                    onClick={() => audition(true)}
                  >
                    {w.hearBar}
                  </button>
                )}
              </>
            ) : (
              <>
                {(phase === "playing" || phase === "paused") && (
                  <button
                    type="button"
                    className={primary}
                    onClick={
                      phase === "paused" ? session.resume : session.pause
                    }
                  >
                    {phase === "paused" ? c.resume : c.pause}
                  </button>
                )}
                <button
                  type="button"
                  className={buttonClass}
                  onClick={session.stop}
                >
                  {phase === "preview" ? c.stopExample : t.endGame}
                </button>
              </>
            )}
            {phase === "preparing" && <span role="status">{c.loading}</span>}
            {phase === "countIn" && (
              <span role="status">
                {c.countIn} · {session.count}
              </span>
            )}
            {target && (
              <span className="text-sm tabular-nums">
                {w.bar} {lane.bars[bar]?.label} ·{" "}
                {currentPitches?.join(" + ") || w.rest}
              </span>
            )}
          </div>
          {previewError && <p role="alert">{fileMessage(previewError, w)}</p>}
          {session.error && (
            <p role="alert" className="text-red-800">
              {audioError}
            </p>
          )}
          {phase === "result" && (
            <div>
              <p role="status" className="font-semibold">
                {c.passed} ·{" "}
                {
                  resultTargets.filter((item) => session.results[item.id])
                    .length
                }{" "}
                / {resultTargets.length}
              </p>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer">
                  {w.bar} {lane.bars[bar]?.label} · {c.score}
                </summary>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {compiled.timeline?.targets
                    .filter((item) => item.barIndex === bar)
                    .map((item) => {
                      const pass = session.results[item.id];
                      return (
                        <li
                          key={item.id}
                          className={`rounded border px-2 py-1 ${pass ? "text-emerald-800" : "text-rose-800"}`}
                        >
                          {item.midis.map(pitchName).join(" + ") || w.rest} ·{" "}
                          {pass
                            ? c.passed
                            : item.midis.length
                              ? c.missed
                              : c.restViolation}
                        </li>
                      );
                    })}
                </ul>
              </details>
            </div>
          )}
          {hasChords && <p className="text-sm text-slate-600">{w.chordRule}</p>}
        </section>
        <SettingsSurface
          title={t.settings}
          summary={`${w.bar} ${lane.bars[from]?.label}–${lane.bars[to]?.label} · ${Math.round(options.speed * 100)}%`}
          isMobileOpen={settingsOpen}
          onMobileClose={() => setSettingsOpen(false)}
        >
          <ImportedScoreSettings
            score={score}
            lane={lane}
            barIndex={bar}
            options={options}
            timeline={compiled.timeline}
            disabled={locked}
            onOptions={setOptions}
            onLane={setLane}
            onBar={setBarIndex}
            onEdit={edit}
          />
        </SettingsSurface>
      </MelodyWorkspace>
    </section>
  );
}
