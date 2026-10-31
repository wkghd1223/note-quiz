"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/practice/AppShell";
import EarPracticeMode from "@/components/practice/EarPracticeMode";
import NotePracticeMode from "@/components/practice/NotePracticeMode";
import TheoryPracticeMode from "@/components/practice/TheoryPracticeMode";
import LearningHistory from "@/components/practice/LearningHistory";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/gameStore";
import { useEarTrainingStore } from "@/store/earTrainingStore";
import { useTheoryStore, type TheoryResult } from "@/store/theoryStore";
import {
  defaultConfig,
  parsePracticeConfig,
  serializePracticeConfig,
  noteSettings,
  earSettings,
  type PracticeConfig,
} from "@/lib/practice/config";
import {
  readLearningData,
  writeLearningData,
  appendHistory,
  emptyLearningData,
  type LearningData,
} from "@/lib/practice/history";
import { seededRandom, utcDay } from "@/lib/practice/random";
import {
  generateQuestion,
  generateEarTrainingQuestion,
} from "@/lib/music/utils";
import { generateTheoryQuestion } from "@/lib/music/theory";
import type {
  PracticeCompletion,
  SessionKind,
  TrainingMode,
} from "@/lib/practice/types";
import {
  trackLeaderboardTickerOpened,
  trackPracticeModeChanged,
  trackPracticeSettingsClosed,
  trackPracticeSettingsOpened,
  trackLearningEvent,
} from "@/lib/analytics";

export default function PracticeClient() {
  const router = useRouter(),
    pathname = usePathname(),
    search = useSearchParams(),
    { t } = useTranslation(),
    c = t.learning;
  const signature = useMemo(() => {
    const p = new URLSearchParams(search.toString());
    p.delete("settings");
    p.delete("leaderboard");
    return p.toString();
  }, [search]);
  const parsed = useMemo(() => parsePracticeConfig(signature), [signature]);
  const [config, setConfig] = useState(parsed.config),
    [daily, setDaily] = useState(search.get("daily") === "1"),
    // The prerendered page can be older than the browser's UTC date.
    [day, setDay] = useState(""),
    [challengeDay, setChallengeDay] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false),
    [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [learning, setLearning] = useState<LearningData>(emptyLearningData),
    [available, setAvailable] = useState(true),
    [notice, setNotice] = useState(""),
    [shareFallback, setShareFallback] = useState("");
  const note = useGameStore((s) => s.settings),
    ear = useEarTrainingStore((s) => s.settings);
  const recordRef = useRef(learning),
    configRef = useRef(config),
    entryStarted = useRef(false);
  const dailyKeyRef = useRef<string | undefined>(undefined);
  const activeRun = useRef<{
    config: PracticeConfig;
    dailyKey?: string;
  } | null>(null);
  recordRef.current = learning;
  const apply = useCallback((next: PracticeConfig) => {
    if (next.mode === "note") {
      const value = {
        ...useGameStore.getState().settings,
        ...noteSettings(next),
      };
      if (
        JSON.stringify(value) !==
        JSON.stringify(useGameStore.getState().settings)
      )
        useGameStore.getState().updateSettings(noteSettings(next));
    }
    if (next.mode === "ear") {
      const value = {
        ...useEarTrainingStore.getState().settings,
        ...earSettings(next),
      };
      if (
        JSON.stringify(value) !==
        JSON.stringify(useEarTrainingStore.getState().settings)
      )
        useEarTrainingStore.getState().updateSettings(earSettings(next));
    }
  }, []);
  useEffect(() => {
    const today = utcDay();
    setDay(today);
    setChallengeDay(today);
    const { data, available } = readLearningData();
    setLearning(data);
    setAvailable(available);
    const refresh = () => {
      const next = readLearningData();
      recordRef.current = next.data;
      setLearning(next.data);
      setAvailable(next.available);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "note-quiz-learning-v1" || event.key === null)
        refresh();
    };
    window.addEventListener("storage", onStorage);
    const timer = setInterval(() => {
      setDay(utcDay());
      refresh();
    }, 30_000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  useEffect(() => {
    entryStarted.current = false;
    setConfig(parsed.config);
    setDaily(search.get("daily") === "1");
    if (parsed.shared) apply(parsed.config);
    trackLearningEvent("entered", {
      mode: parsed.config.mode,
      difficulty: parsed.config.difficulty,
      presentation:
        parsed.config.mode === "note"
          ? "visual"
          : parsed.config.mode === "ear"
            ? "audio"
            : parsed.config.presentation,
      sessionType: parsed.shared
        ? parsed.config.length
        : parsed.config.mode === "note"
          ? useGameStore.getState().settings.questionLimit
            ? "ten"
            : useGameStore.getState().settings.timeLimit
              ? "timed"
              : "free"
          : parsed.config.mode === "ear"
            ? useEarTrainingStore.getState().settings.questionLimit
              ? "ten"
              : useEarTrainingStore.getState().settings.sessionType === "timed"
                ? "timed"
                : "free"
            : parsed.config.length,
    });
    // Overlay query changes do not reset a running session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, apply]);
  useEffect(() => {
    setSettingsOpen(
      search.get("settings") === "open" && search.get("leaderboard") !== "open",
    );
    setLeaderboardOpen(search.get("leaderboard") === "open");
  }, [search]);
  const mode = config.mode;
  const effective: PracticeConfig = useMemo(
    () =>
      mode === "note"
        ? {
            ...config,
            clef: note.clef,
            keySignature: note.keySignature,
            ledgerAbove: note.staffRange.ledgerLinesAbove,
            ledgerBelow: note.staffRange.ledgerLinesBelow,
            answerMode: note.answerMode,
            enableSound: note.enableSound,
            enableAccidentals: note.enableAccidentals,
            accidentalProbability: note.accidentalProbability,
            length: note.questionLimit
              ? "ten"
              : note.timeLimit
                ? "timed"
                : "free",
            timeLimit: note.timeLimit ?? 60,
          }
        : mode === "ear"
          ? {
              ...config,
              answerMode: ear.inputMode,
              noteSet: ear.noteSet,
              octaveMin: ear.octaveRange.min,
              octaveMax: ear.octaveRange.max,
              enableSound: ear.enableSound,
              length: ear.questionLimit
                ? "ten"
                : ear.sessionType === "timed"
                  ? "timed"
                  : "free",
              timeLimit: ear.timeLimit ?? 60,
            }
          : config,
    [config, mode, note, ear],
  );
  configRef.current = effective;
  const dailyConfig = useMemo(
    () => defaultConfig(mode, config.difficulty),
    [mode, config.difficulty],
  );
  const dailyKey = `${daily ? challengeDay : day}:${mode}:${config.difficulty}`;
  dailyKeyRef.current = dailyKey;
  useEffect(() => {
    if (daily && challengeDay) {
      apply(dailyConfig);
      useGameStore.getState().resetGame();
      useEarTrainingStore.getState().resetSession();
      useTheoryStore.getState().reset();
    }
  }, [daily, challengeDay, dailyConfig, apply]);
  const dailyQuestions = useMemo(() => {
    if (!daily || !challengeDay) return null;
    const random = seededRandom(dailyKey);
    return {
      note: Array.from({ length: 10 }, () =>
        generateQuestion(
          { ...useGameStore.getState().settings, ...noteSettings(dailyConfig) },
          random,
        ),
      ),
      ear: Array.from({ length: 10 }, () =>
        generateEarTrainingQuestion(
          {
            ...useEarTrainingStore.getState().settings,
            ...earSettings(dailyConfig),
          },
          random,
        ),
      ),
      theory: Array.from({ length: 10 }, () =>
        generateTheoryQuestion(dailyConfig, random),
      ),
    };
  }, [daily, challengeDay, dailyKey, dailyConfig]);
  const updateQuery = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    router.replace(p.size ? `${pathname}?${p}` : pathname, { scroll: false });
  };
  const choose = (next: PracticeConfig) => {
    setDaily(false);
    setConfig(next);
    apply(next);
    useTheoryStore.getState().reset();
    router.replace(`${pathname}?${serializePracticeConfig(next)}`, {
      scroll: false,
    });
  };
  const changeMode = (next: TrainingMode) => {
    trackPracticeModeChanged(next);
    setSettingsOpen(false);
    setLeaderboardOpen(false);
    choose(defaultConfig(next));
  };
  const changePractice = () => {
    setDaily(false);
    useGameStore.getState().resetGame();
    useEarTrainingStore.getState().resetSession();
    useTheoryStore.getState().reset();
    updateQuery({ daily: null });
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLSelectElement>("[data-practice-mode]")
        ?.focus(),
    );
  };
  const save = useCallback((completion: PracticeCompletion) => {
    const snapshot = activeRun.current?.config ?? configRef.current;
    if (snapshot.mode !== completion.mode) return;
    const entry = {
      ...completion,
      at: Date.now(),
      configuration: serializePracticeConfig(snapshot),
    };
    const key =
      completion.kind === "daily" ? activeRun.current?.dailyKey : undefined;
    const next = appendHistory(recordRef.current, entry, key);
    recordRef.current = next;
    setLearning(next);
    setAvailable(writeLearningData(next));
    trackLearningEvent("completed", {
      mode: completion.mode,
      difficulty: completion.difficulty,
      presentation:
        snapshot.mode === "note"
          ? "visual"
          : snapshot.mode === "ear"
            ? "audio"
            : snapshot.presentation,
      sessionType: snapshot.length,
      kind: completion.kind,
      completed: completion.completed,
      total: completion.total,
      correct: completion.correct,
      hasMistakes: completion.total > completion.correct,
    });
  }, []);
  const noteComplete = useCallback(
    (result: GameResult, kind: SessionKind) => {
      const groups = new Map<
        string,
        { id: string; total: number; correct: number }
      >();
      for (const answer of result.answers) {
        const id = answer.question?.clef ?? "treble";
        const group = groups.get(id) ?? { id, total: 0, correct: 0 };
        group.total++;
        if (answer.isCorrect) group.correct++;
        groups.set(id, group);
      }
      save({
        mode: "note",
        kind,
        difficulty: configRef.current.difficulty,
        total: result.totalQuestions,
        correct: result.correctAnswers,
        elapsedMs: result.totalTime,
        completed: result.completed ?? false,
        categories: [...groups.values()],
      });
    },
    [save],
  );
  const earComplete = useCallback(
    (result: EarTrainingResult, kind: SessionKind) =>
      save({
        mode: "ear",
        kind,
        difficulty: configRef.current.difficulty,
        total: result.totalQuestions,
        correct: result.correctAnswers,
        elapsedMs: result.totalTime,
        completed: result.completed ?? false,
        categories: [],
      }),
    [save],
  );
  const theoryComplete = useCallback(
    (result: TheoryResult) => {
      const groups = new Map<
        string,
        { id: string; total: number; correct: number }
      >();
      for (const answer of result.answers) {
        const id =
          answer.question.task === "quality"
            ? `quality_${answer.question.answer}`
            : answer.question.task === "interval"
              ? answer.question.answer
              : answer.question.task === "inversion"
                ? `inversion_${answer.question.answer}`
                : answer.question.task === "direction"
                  ? answer.question.answer
                  : `progression_${answer.question.answer}`;
        const g = groups.get(id) ?? { id, total: 0, correct: 0 };
        g.total++;
        if (answer.correct) g.correct++;
        groups.set(id, g);
      }
      save({
        mode: configRef.current.mode,
        kind: result.kind,
        difficulty: configRef.current.difficulty,
        total: result.totalQuestions,
        correct: result.correctAnswers,
        elapsedMs: result.totalTime,
        completed: result.completed,
        categories: [...groups.values()],
      });
    },
    [save],
  );
  useEffect(() => {
    const started = (kind: SessionKind, restarted: boolean) => {
      const snapshot = { ...configRef.current };
      activeRun.current = {
        config: snapshot,
        dailyKey: kind === "daily" ? dailyKeyRef.current : undefined,
      };
      trackLearningEvent("started", {
        mode: snapshot.mode,
        difficulty: snapshot.difficulty,
        presentation:
          snapshot.mode === "note"
            ? "visual"
            : snapshot.mode === "ear"
              ? "audio"
              : snapshot.presentation,
        sessionType: snapshot.length,
        kind,
        entryStart: !entryStarted.current,
      });
      entryStarted.current = true;
      if (kind === "review")
        trackLearningEvent("review_started", {
          mode: snapshot.mode,
          difficulty: snapshot.difficulty,
          kind,
        });
      else if (restarted)
        trackLearningEvent("result_restarted", {
          mode: snapshot.mode,
          difficulty: snapshot.difficulty,
          kind,
        });
    };
    const a = useGameStore.subscribe((next, previous) => {
      if (next.sessionId && next.sessionId !== previous.sessionId)
        started(next.sessionKind, previous.gameState === "finished");
    });
    const b = useEarTrainingStore.subscribe((next, previous) => {
      if (next.sessionId && next.sessionId !== previous.sessionId)
        started(next.sessionKind, previous.sessionState === "finished");
    });
    const d = useTheoryStore.subscribe((next, previous) => {
      if (next.state === "playing" && next.generation !== previous.generation)
        started(next.kind, previous.state === "finished");
    });
    return () => {
      a();
      b();
      d();
    };
  }, []);
  const share = async () => {
    const url = new URL(pathname, window.location.origin);
    url.search = serializePracticeConfig(effective);
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url.toString());
      setNotice(c.copied);
      setShareFallback("");
    } catch {
      setNotice(c.copyFailed);
      setShareFallback(url.toString());
    }
  };
  const button =
    "min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold";
  const sharedProps = {
    mode,
    onModeChange: changeMode,
    settingsOpen,
    onSettingsOpen: () => {
      setSettingsOpen(true);
      setLeaderboardOpen(false);
      trackPracticeSettingsOpened(mode);
      updateQuery({ settings: "open", leaderboard: null });
    },
    onSettingsClose: () => {
      setSettingsOpen(false);
      trackPracticeSettingsClosed(mode);
      updateQuery({ settings: null, leaderboard: null });
    },
    onLeaderboardOpen: () => {
      setLeaderboardOpen(true);
      setSettingsOpen(false);
      updateQuery({ leaderboard: "open", settings: null });
    },
    onChangePractice: changePractice,
  };
  return (
    <AppShell
      leaderboardOpen={leaderboardOpen}
      onLeaderboardOpen={() => {
        setLeaderboardOpen(true);
        setSettingsOpen(false);
        trackLeaderboardTickerOpened("practice");
        updateQuery({ leaderboard: "open", settings: null });
      }}
      onLeaderboardClose={() => {
        setLeaderboardOpen(false);
        updateQuery({ leaderboard: null, settings: null });
      }}
    >
      <details className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
        <summary className="min-h-8 cursor-pointer text-sm font-bold">
          {c.preset} · {c.difficulty} · {c.share}
        </summary>
        <div className="mt-3 grid gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-bold text-slate-500">
              {c.preset}
              <select
                className={button}
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  const next = defaultConfig(
                    value === "bass" || value === "treble"
                      ? "note"
                      : value === "chord"
                        ? "chord"
                        : "interval",
                    value === "interval" ? "basic" : "beginner",
                  );
                  if (value === "bass") next.clef = "bass";
                  choose(next);
                }}
              >
                <option value="">{c.preset}</option>
                {[
                  ["treble", c.treblePreset],
                  ["bass", c.bassPreset],
                  ["direction", c.directionPreset],
                  ["interval", c.intervalPreset],
                  ["chord", c.chordPreset],
                ].map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-slate-500">
              {c.difficulty}
              <select
                className={button}
                value={config.difficulty}
                onChange={(e) =>
                  choose(
                    defaultConfig(
                      mode,
                      e.target.value as PracticeConfig["difficulty"],
                    ),
                  )
                }
              >
                {(["beginner", "basic", "advanced", "custom"] as const).map(
                  (level) => (
                    <option key={level} value={level}>
                      {c[level]}
                    </option>
                  ),
                )}
              </select>
            </label>
            {(mode === "interval" || mode === "chord") && (
              <label className="grid gap-1 text-xs font-bold text-slate-500">
                {c.sessionType}
                <select
                  className={button}
                  value={effective.length}
                  onChange={(e) =>
                    choose({
                      ...effective,
                      length: e.target.value as PracticeConfig["length"],
                    })
                  }
                >
                  {(["ten", "free", "timed"] as const).map((length) => (
                    <option key={length} value={length}>
                      {c[length]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(mode === "interval" || mode === "chord") &&
              effective.length === "timed" && (
                <select
                  aria-label={t.timer.timeLimit}
                  className={button}
                  value={effective.timeLimit}
                  onChange={(e) =>
                    choose({ ...effective, timeLimit: Number(e.target.value) })
                  }
                >
                  {[30, 60, 180].map((value) => (
                    <option key={value} value={value}>
                      {value} {t.units.seconds}
                    </option>
                  ))}
                </select>
              )}
            <button
              type="button"
              className={button}
              onClick={() => void share()}
            >
              {c.share}
            </button>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            {c.leaderboardNotice}
          </p>
          {parsed.shared && (
            <p className="text-xs text-slate-500">{c.sharedSettings}</p>
          )}
          {parsed.invalid && (
            <p role="status" className="text-sm text-amber-800">
              {c.invalidSettings}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          {shareFallback && (
            <input
              aria-label={c.share}
              readOnly
              value={shareFallback}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded border p-2 text-sm"
            />
          )}
        </div>
      </details>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#ded6f7] bg-[#faf9fe] p-3">
        <div>
          <h2 className="text-sm font-bold">
            {daily && challengeDay !== day ? c.activeDaily : c.daily} ·{" "}
            {day ? `${daily ? challengeDay : day} UTC` : t.leaderboard.loading}{" "}
            {learning.daily[dailyKey] ? "✓" : ""}
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            {daily ? c.dailyNotice : c.dailyDate}
          </p>
          {learning.daily[dailyKey] && (
            <p className="text-xs font-bold text-[#5b21b6]">{c.dailyDone}</p>
          )}
        </div>
        <button
          type="button"
          className={button}
          disabled={!day}
          onClick={() => {
            if (!daily) setChallengeDay(utcDay());
            setDaily(!daily);
            updateQuery({ daily: daily ? null : "1" });
          }}
        >
          {daily ? c.normalPractice : c.dailyStart}
        </button>
        {daily && challengeDay !== day && (
          <button
            type="button"
            className={button}
            onClick={() => setChallengeDay(day)}
          >
            {c.dailyStart} · {day}
          </button>
        )}
      </div>
      {daily && !challengeDay ? (
        <p role="status" className="p-4 text-sm text-slate-500">
          {t.leaderboard.loading}
        </p>
      ) : mode === "note" ? (
        <NotePracticeMode
          key={`note-${daily ? dailyKey : "normal"}`}
          {...sharedProps}
          runOptions={
            dailyQuestions
              ? {
                  kind: "daily",
                  questions: dailyQuestions.note,
                  questionLimit: 10,
                }
              : undefined
          }
          onComplete={noteComplete}
        />
      ) : mode === "ear" ? (
        <EarPracticeMode
          key={`ear-${daily ? dailyKey : "normal"}`}
          {...sharedProps}
          runOptions={
            dailyQuestions
              ? {
                  kind: "daily",
                  questions: dailyQuestions.ear,
                  questionLimit: 10,
                }
              : undefined
          }
          onComplete={earComplete}
        />
      ) : (
        <TheoryPracticeMode
          key={`${mode}-${daily ? dailyKey : "normal"}`}
          {...sharedProps}
          config={daily ? dailyConfig : effective}
          onConfigChange={choose}
          runOptions={
            dailyQuestions
              ? { kind: "daily", questions: dailyQuestions.theory }
              : undefined
          }
          onComplete={theoryComplete}
        />
      )}
      <LearningHistory
        data={learning}
        available={available}
        onReset={() => {
          const next = emptyLearningData();
          recordRef.current = next;
          setLearning(next);
          setAvailable(writeLearningData(next));
          setNotice(c.historyCleared);
        }}
        onPractice={choose}
      />
    </AppShell>
  );
}
