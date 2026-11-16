"use client";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import PracticeFeedback from "./PracticeFeedback";
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
import { theoryLabel } from "@/lib/practice/theoryLabel";
import {
  serializePracticeConfig,
  type PracticeConfig,
} from "@/lib/practice/config";
import type { LearningTranslations } from "@/lib/i18n/learning";
import type { SessionKind } from "@/lib/practice/types";
import PracticeShell from "./PracticeShell";
import PracticeController from "./PracticeController";
import PracticeMetrics from "./PracticeMetrics";
import { FaClock, FaCheck, FaBullseye, FaVolumeUp } from "react-icons/fa";
import ModeSwitcher, { type PracticeMode } from "./ModeSwitcher";
import MusicNotation from "./MusicNotation";
import LearningResult from "./LearningResult";
import {
  settingsCheckboxClassName,
  settingsLabelClassName,
  settingsSelectClassName,
  settingsToggleClassName,
} from "./SettingsControls";

export { theoryLabel } from "@/lib/practice/theoryLabel";

interface Props {
  mode: PracticeMode;
  onModeChange: (mode: PracticeMode) => void;
  config: PracticeConfig;
  onConfigChange: (config: PracticeConfig) => void;
  settingsOpen: boolean;
  settingsIntro?: React.ReactNode;
  headerActions?: React.ReactNode;
  onSettingsOpen: () => void;
  onSettingsClose: () => void;
  runOptions?: { questions: TheoryQuestion[]; kind: SessionKind };
  onComplete: (result: TheoryResult) => void;
  onChangePractice: () => void;
}
export default function TheoryPracticeMode(props: Props) {
  const { t } = useTranslation(),
    c = t.learning,
    s = useTheoryStore(
      useShallow((state) => ({
        current: state.current,
        generation: state.generation,
        state: state.state,
        result: state.result,
        feedback: state.feedback,
        answers: state.answers,
        kind: state.kind,
        length: state.length,
        limit: state.limit,
        reset: state.reset,
        review: state.review,
        end: state.end,
        submit: state.submit,
      })),
    );
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
  const exampleOptions = getTheoryOptions({
    ...config,
    task: config.mode === "interval" ? "interval" : "quality",
  }).map((id) =>
    config.mode === "interval" &&
    config.difficulty === "beginner" &&
    id === "P1"
      ? "P8"
      : id,
  );
  const example = () => {
    const settings: TheorySettings = {
      ...config,
      task: config.mode === "interval" ? "interval" : config.task,
    };
    if (config.mode === "interval") {
      settings.difficulty = "custom";
      settings.intervals = (
        exampleType ? [exampleType] : exampleOptions
      ) as TheorySettings["intervals"];
    } else if (exampleType) {
      settings.difficulty = "custom";
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
              {task === "interval" ? c.intervalTask : c[task as "direction"]}
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
            {config.mode === "interval" ? c.intervalTask : c.quality}
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
  const result = s.result;
  const isIdle = s.state === "idle";
  const isFinished = s.state === "finished";
  const lastAnswer = result?.answers.at(-1);
  const question = isFinished
    ? lastAnswer?.question
    : (s.current ?? s.feedback?.question);
  const feedback = isIdle || isFinished ? null : s.feedback;
  const notation = (q: TheoryQuestion, revealed = true) => (
    <TheoryNotation
      question={q}
      kind={config.kind}
      task={config.task}
      label={c.components}
      revealed={revealed}
    />
  );
  const resultContent = result ? (
    <LearningResult
      preserveScroll
      focusOnMount={false}
      result={result}
      hasMistakes={result.answers.some((a) => !a.correct)}
      onReview={() => s.review()}
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
                className={`${button} inline-flex h-11 w-11 items-center justify-center px-0`}
                aria-label={c.play}
                title={c.play}
                onClick={() => void play(a.question)}
              >
                <FaVolumeUp aria-hidden="true" />
              </button>
            </details>
          ))}
      </div>
    </LearningResult>
  ) : null;
  // Reserve only the rows this task needs; answer changes must not move the score/input.
  const promptHeight =
    config.task === "progression"
      ? "min-h-36 sm:min-h-24"
      : "min-h-28 sm:min-h-20";
  const stage = (
    <div
      data-practice-stage
      data-practice-phase={isIdle ? "idle" : isFinished ? "finished" : "active"}
      className="relative grid min-w-0 grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <div className={`flex items-start gap-3 ${promptHeight}`}>
        <div
          className={`grid min-w-0 flex-1 items-center ${promptHeight}`}
          data-practice-prompt-band
        >
          <h2
            data-practice-prompt
            tabIndex={-1}
            className={`col-start-1 row-start-1 max-h-10 overflow-auto font-bold leading-5 ${feedback ? "opacity-0" : ""}`}
          >
            {c.selectAnswer}
          </h2>
          <PracticeFeedback
            message={
              feedback
                ? feedback.correct
                  ? t.messages.correct
                  : t.messages.incorrect
                : undefined
            }
            correct={feedback?.correct}
            details={
              feedback ? (
                <>
                  <p>
                    {c.yourAnswer}: {theoryLabel(c, feedback.answer)} ·{" "}
                    {c.answer}: {theoryLabel(c, feedback.question.answer)}
                  </p>
                  <p>
                    {c.components}:{" "}
                    {feedback.question.notes.map(noteToString).join(" · ")}
                  </p>
                </>
              ) : undefined
            }
            announcementKey={s.answers.length}
          />
        </div>
        <span
          data-practice-progress
          className="shrink-0 text-sm font-bold tabular-nums"
        >
          {s.answers.length}
          {s.length === "ten" ? `/${s.limit}` : ""}
        </span>
      </div>
      {question && !isIdle ? (
        notation(
          question,
          isFinished || question.presentation === "visual" || !!feedback,
        )
      ) : (
        <TheoryNotation
          label={c.components}
          revealed={false}
          kind={config.kind}
          task={config.task}
        />
      )}
      <div className="flex h-11 min-w-0 items-stretch gap-2">
        {isIdle ? (
          <>
            <label className="min-w-0 flex-1">
              <span className="sr-only">{c.example}</span>
              <select
                className={`${button} h-11 w-full`}
                value={exampleType}
                onChange={(event) => setExampleType(event.target.value)}
              >
                <option value="">{c.preset}</option>
                {exampleOptions.map((id) => (
                  <option key={id} value={id}>
                    {theoryLabel(c, id)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={`${button} inline-flex h-11 w-11 shrink-0 items-center justify-center px-0`}
              onClick={example}
              disabled={busy}
              aria-label={busy ? c.playingAudio : c.example}
              title={busy ? c.playingAudio : c.example}
            >
              <FaVolumeUp aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => question && void play(question)}
              className={`${button} inline-flex h-11 w-11 shrink-0 items-center justify-center px-0`}
              disabled={busy || !question || isFinished}
              aria-label={busy ? c.playingAudio : c.play}
              title={busy ? c.playingAudio : c.play}
            >
              <FaVolumeUp aria-hidden="true" />
            </button>
            {config.mode === "chord" && (
              <>
                <button
                  type="button"
                  className={`${button} h-11 min-w-0 flex-1 overflow-auto !px-1 !py-1 !text-xs leading-4 sm:!px-3 sm:!text-sm`}
                  onClick={() => question && void play(question, "chord")}
                  disabled={busy || !question || isFinished}
                >
                  {c.simultaneous}
                </button>
                <button
                  type="button"
                  className={`${button} h-11 min-w-0 flex-1 overflow-auto !px-1 !py-1 !text-xs leading-4 sm:!px-3 sm:!text-sm`}
                  onClick={() => question && void play(question, "arpeggio")}
                  disabled={busy || !question || isFinished}
                >
                  {c.arpeggio}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
  return (
    <PracticeShell
      title={c[config.mode]}
      kicker={c[config.mode]}
      description={help}
      onRestart={() => void start()}
      restartDisabled={busy}
      modeSwitcher={
        <ModeSwitcher mode={props.mode} onChange={props.onModeChange} />
      }
      isIdle={isIdle}
      isFinished={isFinished}
      result={resultContent}
      resultKey={s.generation}
      headerActions={props.headerActions}
      settingsIntro={props.settingsIntro}
      settings={settings}
      settingsSummary={`${c[config.difficulty]} · ${config.presentation === "audio" ? c.listening : c.reading}`}
      settingsOpen={props.settingsOpen}
      onSettingsOpen={props.onSettingsOpen}
      onSettingsClose={props.onSettingsClose}
      actions={
        <PracticeController
          state={s.state}
          states={{
            playing: [
              {
                id: "end",
                label: c.finish,
                tone: "danger",
                onClick: () => {
                  audioToken.current++;
                  stopAllNotes();
                  s.end();
                },
              },
            ],
            idle: [
              {
                id: "start",
                label: t.startGame,
                tone: "primary",
                onClick: () => void start(),
              },
            ],
          }}
        />
      }
      status={<TheoryStatus />}
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
        (s.state === "playing" && question) || isFinished ? (
          <TheoryAnswerControls
            direction={config.task === "direction"}
            options={question?.options ?? getTheoryOptions(config)}
            copy={c}
            disabled={isFinished || !!feedback || busy}
            onSubmit={s.submit}
          />
        ) : null
      }
    />
  );
}

const EMPTY_NOTES: Note[] = [];
const EMPTY_PROGRESSION = [EMPTY_NOTES, EMPTY_NOTES, EMPTY_NOTES, EMPTY_NOTES];

const TheoryNotation = memo(function TheoryNotation({
  question,
  label,
  revealed,
  kind = "interval",
  task,
}: {
  question?: TheoryQuestion;
  label: string;
  revealed: boolean;
  kind?: TheoryQuestion["kind"];
  task?: TheoryQuestion["task"];
}) {
  // The possible task range is fixed before any hidden audio question is revealed.
  const staffRange = {
    ledgerLinesAbove:
      kind === "interval"
        ? 1
        : task === "inversion"
          ? 3
          : task === "progression"
            ? 2
            : 0,
    ledgerLinesBelow: 5,
  };
  return task === "progression" ? (
    <div className="grid grid-cols-2 gap-2" data-practice-progression>
      {(question?.groups.slice(-4) ?? EMPTY_PROGRESSION).map((notes, index) => (
        <MusicNotation
          key={index}
          notes={notes}
          staffRange={staffRange}
          chord
          compact
          label={`${label} ${index + 1}`}
          revealed={revealed}
        />
      ))}
    </div>
  ) : (
    <MusicNotation
      notes={question?.notes ?? EMPTY_NOTES}
      staffRange={staffRange}
      chord={(question?.kind ?? kind) === "chord"}
      label={label}
      revealed={revealed}
    />
  );
});

const TheoryAnswerControls = memo(function TheoryAnswerControls({
  options,
  direction,
  copy,
  disabled,
  onSubmit,
}: {
  options: string[];
  direction: boolean;
  copy: LearningTranslations;
  disabled: boolean;
  onSubmit: (answer: string) => boolean;
}) {
  return (
    <div
      data-practice-answer-options
      className={`grid auto-rows-[4rem] gap-2 ${direction ? "grid-cols-3" : "grid-cols-2"}`}
    >
      {(direction
        ? ["higher", "same", "lower"].filter((answer) =>
            options.includes(answer),
          )
        : options
      ).map((answer) => (
        <button
          key={answer}
          type="button"
          className="h-16 overflow-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold leading-4 text-slate-800 [overflow-wrap:anywhere] disabled:opacity-50"
          disabled={disabled}
          onClick={() => onSubmit(answer)}
        >
          {theoryLabel(copy, answer)}
        </button>
      ))}
    </div>
  );
});

function TheoryStatus() {
  const { t } = useTranslation();
  const elapsed = useTheoryStore((state) => state.elapsed);
  const answers = useTheoryStore((state) => state.answers);
  const kind = useTheoryStore((state) => state.kind);
  const correct = answers.filter((answer) => answer.correct).length;
  return (
    <PracticeMetrics
      items={[
        {
          label: t.timer.elapsed,
          value: `${(elapsed / 1000).toFixed(1)} ${t.units.seconds}`,
          icon: <FaClock />,
        },
        {
          label: t.scoreboard.correct,
          value: String(correct),
          icon: <FaCheck />,
        },
        {
          label: t.scoreboard.accuracy,
          value: `${(answers.length ? (correct / answers.length) * 100 : 0).toFixed(0)}%`,
          icon: <FaBullseye />,
        },
      ]}
      detail={kind === "review" ? t.learning.review : "\u00a0"}
    />
  );
}
