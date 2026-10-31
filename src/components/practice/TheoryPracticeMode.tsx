"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useTheoryStore, type TheoryResult } from "@/store/theoryStore";
import {
  generateTheoryQuestion,
  getTheoryOptions,
  AUDIO_INTERVAL_IDS,
  VISUAL_INTERVAL_IDS,
  CHORD_IDS,
  type TheoryQuestion,
  type TheorySettings,
} from "@/lib/music/theory";
import {
  initializeAudio,
  playSequence,
  playChord,
  playArpeggio,
  stopAllNotes,
} from "@/lib/music/audio";
import { noteToString } from "@/lib/music/utils";
import {
  serializePracticeConfig,
  type PracticeConfig,
} from "@/lib/practice/config";
import type { LearningTranslations } from "@/lib/i18n/learning";
import type { SessionKind } from "@/lib/practice/types";
import PracticeShell from "./PracticeShell";
import ModeSwitcher, { type PracticeMode } from "./ModeSwitcher";
import MusicNotation from "./MusicNotation";
import LearningResult from "./LearningResult";
import {
  settingsCheckboxClassName,
  settingsLabelClassName,
  settingsSelectClassName,
  settingsToggleClassName,
} from "./SettingsControls";

export function theoryLabel(copy: LearningTranslations, value: string): string {
  if (value.startsWith("inversion_"))
    return (
      copy[value.slice(10) as keyof LearningTranslations] ?? copy.inversion
    );
  if (value.startsWith("progression_"))
    return value.slice(12).replaceAll("-", " → ");
  const key = (
    value in copy
      ? value
      : `interval_${value}` in copy
        ? `interval_${value}`
        : `quality_${value}`
  ) as keyof LearningTranslations;
  return copy[key] ?? value.replaceAll("-", " → ");
}
interface Props {
  mode: PracticeMode;
  onModeChange: (mode: PracticeMode) => void;
  config: PracticeConfig;
  onConfigChange: (config: PracticeConfig) => void;
  settingsOpen: boolean;
  onSettingsOpen: () => void;
  onSettingsClose: () => void;
  runOptions?: { questions: TheoryQuestion[]; kind: SessionKind };
  onComplete: (result: TheoryResult) => void;
  onChangePractice: () => void;
}
export default function TheoryPracticeMode(props: Props) {
  const { t } = useTranslation(),
    c = t.learning,
    s = useTheoryStore();
  const [audioError, setAudioError] = useState(false),
    [busy, setBusy] = useState(false),
    [exampleType, setExampleType] = useState("");
  const mounted = useRef(true),
    audioToken = useRef(0),
    starting = useRef(false),
    reported = useRef<TheoryResult | null>(null);
  const config = props.config;
  const configKey = serializePracticeConfig(config);
  const lastConfig = useRef(configKey);
  useEffect(() => {
    if (lastConfig.current === configKey) return;
    lastConfig.current = configKey;
    audioToken.current++;
    starting.current = false;
    setBusy(false);
    stopAllNotes();
    useTheoryStore.getState().reset();
  }, [configKey]);

  const dispose = useCallback(() => {
    mounted.current = false;
    audioToken.current++;
    stopAllNotes();
    useTheoryStore.getState().reset();
  }, []);
  useEffect(() => {
    mounted.current = true;
    return dispose;
  }, [dispose]);
  useEffect(() => {
    const timer = setInterval(
      () => useTheoryStore.getState().tick(Date.now()),
      100,
    );
    return () => clearInterval(timer);
  }, []);
  const play = useCallback(
    async (
      question: TheoryQuestion,
      style: "sequence" | "chord" | "arpeggio" = "sequence",
    ) => {
      const token = ++audioToken.current;
      stopAllNotes();
      setBusy(true);
      setAudioError(false);
      try {
        await initializeAudio();
        if (!mounted.current || token !== audioToken.current) return;
        if (style === "chord") await playChord(question.notes, 900);
        else if (style === "arpeggio") await playArpeggio(question.notes, 400);
        else await playSequence(question.groups, 550, 100);
      } catch {
        if (mounted.current && token === audioToken.current)
          setAudioError(true);
      } finally {
        if (mounted.current && token === audioToken.current) setBusy(false);
      }
    },
    [],
  );
  const currentQuestion = s.current,
    phase = s.state,
    resultValue = s.result,
    onComplete = props.onComplete;
  useEffect(() => {
    if (
      currentQuestion &&
      phase === "playing" &&
      currentQuestion.presentation === "audio"
    )
      void play(currentQuestion);
    else {
      audioToken.current++;
      stopAllNotes();
      setBusy(false);
    }
  }, [currentQuestion, phase, play]);
  useEffect(() => {
    if (resultValue && reported.current !== resultValue) {
      reported.current = resultValue;
      onComplete(resultValue);
    }
  }, [resultValue, onComplete]);
  const start = async () => {
    if (starting.current) return;
    starting.current = true;
    const token = ++audioToken.current;
    const generation = useTheoryStore.getState().generation;
    stopAllNotes();
    setAudioError(false);
    try {
      if (config.presentation === "audio") await initializeAudio();
      if (
        !mounted.current ||
        token !== audioToken.current ||
        generation !== useTheoryStore.getState().generation
      )
        return;
      useTheoryStore.getState().start(config, {
        length: config.length,
        duration: config.timeLimit,
        kind: props.runOptions?.kind,
        questions: props.runOptions?.questions,
      });
    } catch {
      if (mounted.current) setAudioError(true);
    } finally {
      starting.current = false;
    }
  };
  const change = (change: Partial<PracticeConfig>) => {
    audioToken.current++;
    stopAllNotes();
    s.reset();
    props.onConfigChange({ ...config, ...change });
  };
  const example = () => {
    const settings: TheorySettings = {
      ...config,
      task: config.mode === "interval" ? "interval" : config.task,
    };
    if (exampleType) {
      settings.difficulty = "custom";
      if (config.mode === "interval")
        settings.intervals = [
          exampleType as NonNullable<TheorySettings["intervals"]>[number],
        ];
      else
        settings.chords = [
          exampleType as NonNullable<TheorySettings["chords"]>[number],
        ];
    }
    void play(generateTheoryQuestion(settings));
  };
  const help =
    config.mode === "interval"
      ? config.task === "direction"
        ? c.directionHelp
        : config.presentation === "audio"
          ? c.intervalAudioHelp
          : c.intervalHelp
      : config.task === "progression"
        ? c.tonic
        : config.task === "inversion"
          ? c.inversionHelp
          : c.chordHelp;
  const button =
    "min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800";
  const settings = (
    <div className="grid gap-4">
      <label className={`grid gap-2 ${settingsLabelClassName}`}>
        {c.task}
        <select
          className={settingsSelectClassName}
          value={config.task}
          onChange={(e) =>
            change({ task: e.target.value as PracticeConfig["task"] })
          }
        >
          {(config.mode === "interval"
            ? ["direction", "interval"]
            : ["quality", "inversion", "progression"]
          ).map((task) => (
            <option key={task} value={task}>
              {c[task as "direction"]}
            </option>
          ))}
        </select>
      </label>
      <label className={`grid gap-2 ${settingsLabelClassName}`}>
        {c.reading} / {c.listening}
        <select
          className={settingsSelectClassName}
          value={config.presentation}
          onChange={(e) =>
            change({ presentation: e.target.value as "audio" | "visual" })
          }
        >
          <option value="audio">{c.listening}</option>
          <option value="visual">{c.reading}</option>
        </select>
      </label>
      {config.mode === "interval" && config.task !== "direction" && (
        <label className={`grid gap-2 ${settingsLabelClassName}`}>
          {c.playDirection}
          <select
            className={settingsSelectClassName}
            value={config.direction}
            onChange={(e) =>
              change({
                direction: e.target.value as PracticeConfig["direction"],
              })
            }
          >
            {(["ascending", "descending", "simultaneous"] as const).map((d) => (
              <option key={d} value={d}>
                {c[d]}
              </option>
            ))}
          </select>
        </label>
      )}
      {config.difficulty === "custom" && (
        <fieldset className="grid gap-2">
          <legend className={`mb-2 ${settingsLabelClassName}`}>
            {config.mode === "interval" ? c.interval : c.quality}
          </legend>
          {(config.mode === "interval"
            ? config.presentation === "audio"
              ? AUDIO_INTERVAL_IDS
              : VISUAL_INTERVAL_IDS
            : CHORD_IDS
          ).map((value) => {
            const values =
              config.mode === "interval"
                ? (config.intervals ??
                  getTheoryOptions({ ...config, task: "interval" }))
                : (config.chords ??
                  getTheoryOptions({ ...config, task: "quality" }));
            return (
              <label key={value} className={settingsToggleClassName}>
                {theoryLabel(c, value)}
                <input
                  type="checkbox"
                  className={settingsCheckboxClassName}
                  checked={values.includes(value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...values, value]
                      : values.filter((v) => v !== value);
                    if (!next.length) return;
                    if (config.mode === "interval")
                      change({
                        intervals: next as PracticeConfig["intervals"],
                      });
                    else change({ chords: next as PracticeConfig["chords"] });
                  }}
                />
              </label>
            );
          })}
          {config.task === "inversion" &&
            ["root", "first", "second", "third"].map((name, i) => (
              <label key={name} className={settingsToggleClassName}>
                {theoryLabel(c, name)}
                <input
                  type="checkbox"
                  className={settingsCheckboxClassName}
                  checked={(config.inversions ?? [0, 1, 2, 3]).includes(i)}
                  onChange={(e) => {
                    const values = config.inversions ?? [0, 1, 2, 3];
                    const next = e.target.checked
                      ? [...values, i]
                      : values.filter((v) => v !== i);
                    if (next.length) change({ inversions: next });
                  }}
                />
              </label>
            ))}
        </fieldset>
      )}
    </div>
  );
  const question = s.current ?? s.feedback?.question;
  const feedback = s.feedback;
  const notation = (q: TheoryQuestion) => (
    <div
      className={q.task === "progression" ? "grid grid-cols-2 gap-2" : "w-full"}
    >
      {q.task === "progression" ? (
        q.groups
          .slice(-4)
          .map((notes, i) => (
            <MusicNotation
              key={i}
              notes={notes}
              chord
              label={`${c.components} ${i + 1}`}
            />
          ))
      ) : (
        <MusicNotation
          notes={q.notes}
          chord={q.kind === "chord"}
          label={c.components}
        />
      )}
    </div>
  );
  const result = s.result;
  const stage = result ? (
    <LearningResult
      result={result}
      hasMistakes={result.answers.some((a) => !a.correct)}
      onRestart={() => void start()}
      onReview={() => s.review()}
      onChange={props.onChangePractice}
    >
      <p className="text-sm text-slate-500">
        {result.kind === "review"
          ? c.reviewNotice
          : result.kind === "daily"
            ? c.dailyNotice
            : config.mode === "interval"
              ? c.intervalHelp
              : c.chordHelp}
      </p>
      <div className="mt-4 grid gap-2">
        {result.answers
          .filter((a) => !a.correct)
          .map((a, i) => (
            <details key={i} className="rounded-lg border border-slate-200 p-3">
              <summary>
                {c.yourAnswer}: {theoryLabel(c, a.answer)} · {c.answer}:{" "}
                {theoryLabel(c, a.question.answer)}
              </summary>
              {notation(a.question)}
              <p className="my-2 text-sm">
                {a.question.notes.map(noteToString).join(" · ")}
              </p>
              <button
                type="button"
                className={button}
                onClick={() => void play(a.question)}
              >
                {c.play}
              </button>
            </details>
          ))}
      </div>
    </LearningResult>
  ) : s.state === "idle" ? (
    <div className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
      <p>{help}</p>
      <label className="grid gap-2">
        {c.example}
        <select
          className={button}
          value={exampleType}
          onChange={(e) => setExampleType(e.target.value)}
        >
          <option value="">{c.preset}</option>
          {getTheoryOptions({
            ...config,
            task: config.mode === "interval" ? "interval" : "quality",
          }).map((id) => (
            <option key={id} value={id}>
              {theoryLabel(c, id)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className={button}
        onClick={example}
        disabled={busy}
      >
        {busy ? c.playingAudio : c.example}
      </button>
    </div>
  ) : question ? (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <h2 className="font-bold" role="status">
        {feedback
          ? feedback.correct
            ? t.messages.correct
            : t.messages.incorrect
          : c.selectAnswer}
      </h2>
      {config.task === "progression" && (
        <p className="text-sm text-slate-600">{c.tonic}</p>
      )}
      {(question.presentation === "visual" || feedback) && notation(question)}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void play(question)}
          className={button}
          disabled={busy}
        >
          {busy ? c.playingAudio : c.play}
        </button>
        {config.mode === "chord" && (
          <>
            <button
              type="button"
              className={button}
              onClick={() => void play(question, "chord")}
              disabled={busy}
            >
              {c.simultaneous}
            </button>
            <button
              type="button"
              className={button}
              onClick={() => void play(question, "arpeggio")}
              disabled={busy}
            >
              {c.arpeggio}
            </button>
          </>
        )}
      </div>
      {feedback && (
        <div className="text-sm">
          <p>
            {c.yourAnswer}: {theoryLabel(c, feedback.answer)} · {c.answer}:{" "}
            {theoryLabel(c, question.answer)}
          </p>
          <p>
            {c.components}: {question.notes.map(noteToString).join(" · ")}
          </p>
          <p>{help}</p>
        </div>
      )}
    </div>
  ) : null;
  return (
    <PracticeShell
      title={c[config.mode]}
      kicker={c[config.mode]}
      modeSwitcher={
        <ModeSwitcher mode={props.mode} onChange={props.onModeChange} />
      }
      isIdle={s.state === "idle"}
      settings={settings}
      settingsSummary={`${c[config.difficulty]} · ${config.presentation === "audio" ? c.listening : c.reading}`}
      settingsOpen={props.settingsOpen}
      onSettingsOpen={props.onSettingsOpen}
      onSettingsClose={props.onSettingsClose}
      actions={
        s.state === "playing" ? (
          <button
            type="button"
            className="min-h-11 w-full rounded-lg bg-red-500 px-4 text-sm font-bold text-white"
            onClick={() => {
              audioToken.current++;
              stopAllNotes();
              s.end();
            }}
          >
            {c.finish}
          </button>
        ) : !result ? (
          <button
            type="button"
            className="min-h-11 w-full rounded-lg bg-[#5b21b6] px-4 text-sm font-bold text-white"
            onClick={() => void start()}
          >
            {t.startGame}
          </button>
        ) : null
      }
      status={
        result ? null : (
          <div className="flex flex-wrap justify-between gap-2 text-sm font-bold">
            <span>
              {c.progress}: {s.answers.length}
              {s.length === "ten" ? `/${s.limit}` : ""}
            </span>
            <span>
              {t.timer.elapsed}: {(s.elapsed / 1000).toFixed(1)}{" "}
              {t.units.seconds}
            </span>
            <span>{s.kind === "review" ? c.review : ""}</span>
          </div>
        )
      }
      stage={
        <>
          {audioError && (
            <div
              role="alert"
              className="mb-3 rounded-lg bg-amber-50 p-3 text-sm"
            >
              <p>{c.audioError}</p>
              <button
                type="button"
                className={button}
                onClick={() => (question ? void play(question) : void start())}
              >
                {c.retryAudio}
              </button>
            </div>
          )}
          {stage}
        </>
      }
      input={
        s.state === "playing" && question ? (
          <div className="grid grid-cols-2 gap-2">
            {question.options.map((answer) => (
              <button
                key={answer}
                type="button"
                className={`${button} disabled:opacity-50`}
                disabled={!!feedback || busy}
                onClick={() => s.submit(answer)}
              >
                {theoryLabel(c, answer)}
              </button>
            ))}
          </div>
        ) : null
      }
    />
  );
}
