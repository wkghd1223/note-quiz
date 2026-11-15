"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type EarPracticeMode from "@/components/practice/EarPracticeMode";
import type NotePracticeMode from "@/components/practice/NotePracticeMode";
import type TheoryPracticeMode from "@/components/practice/TheoryPracticeMode";
import PracticeHistoryPanel from "@/components/practice/PracticeHistoryPanel";
import {
  settingsSelectClassName,
  settingsActionClassName,
} from "@/components/practice/SettingsControls";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/gameStore";
import { useEarTrainingStore } from "@/store/earTrainingStore";
import { useTheoryStore, type TheoryResult } from "@/store/theoryStore";
import {
  defaultConfig,
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
  trackPracticeModeChanged,
  trackPracticeSettingsClosed,
  trackPracticeSettingsOpened,
  trackLearningEvent,
} from "@/lib/analytics";

import {
  configWithNoteSettings,
  configWithEarSettings,
  practiceConfigSignature,
  parseRoutedPracticeConfig,
  practiceConfigurationHref,
} from "@/lib/practice/routing";

import {
  createPracticeUrlIntent,
  patchPracticeQuery,
  practiceSettingsHref,
} from "@/lib/practice/settingsNavigation";

export interface PracticeModeRenderProps {
  sessionKey: string;
  noteProps: React.ComponentProps<typeof NotePracticeMode>;
  earProps: React.ComponentProps<typeof EarPracticeMode>;
  theoryProps: React.ComponentProps<typeof TheoryPracticeMode>;
}
export default function PracticeClient({
  mode: routeMode,
  children,
}: {
  mode: TrainingMode;
  children: (props: PracticeModeRenderProps) => React.ReactNode;
}) {
  const router = useRouter(),
    pathname = usePathname(),
    search = useSearchParams(),
    { t } = useTranslation(),
    c = t.learning;
  const signature = useMemo(
    () => practiceConfigSignature(search.toString(), routeMode),
    [search, routeMode],
  );
  const parsed = useMemo(
    () => parseRoutedPracticeConfig(signature, routeMode),
    [signature, routeMode],
  );
  const [config, setConfig] = useState(parsed.config),
    [daily, setDaily] = useState(search.get("daily") === "1"),
    // The prerendered page can be older than the browser's UTC date.
    [day, setDay] = useState(""),
    [challengeDay, setChallengeDay] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [learning, setLearning] = useState<LearningData>(emptyLearningData),
    [available, setAvailable] = useState(true),
    [notice, setNotice] = useState("");
  const urlIntentRef = useRef<ReturnType<
    typeof createPracticeUrlIntent
  > | null>(null);
  if (!urlIntentRef.current)
    urlIntentRef.current = createPracticeUrlIntent(
      `${pathname}${search.size ? `?${search}` : ""}`,
    );
  const appliedSignature = useRef<string | null>(null);
  const replaceUrl = useCallback(
    (href: string) => {
      router.replace(urlIntentRef.current!.replace(href), { scroll: false });
    },
    [router],
  );
  const latestHref = () =>
    `${urlIntentRef.current!.href.split("#")[0]}${window.location.hash}`;
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
  const applyingConfig = useRef(false);
  const apply = useCallback((next: PracticeConfig) => {
    applyingConfig.current = true;
    try {
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
    } finally {
      applyingConfig.current = false;
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
    const href = `${pathname}${search.size ? `?${search}` : ""}${window.location.hash}`;
    if (!urlIntentRef.current!.observe(href)) return;
    setSettingsOpen(
      search.get("settings") === "open" && search.get("leaderboard") !== "open",
    );
    if (appliedSignature.current === signature) return;
    appliedSignature.current = signature;
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
  }, [signature, search, pathname, apply]);
  const mode = routeMode;
  const effective: PracticeConfig = useMemo(
    () =>
      mode === "note"
        ? configWithNoteSettings(config, note)
        : mode === "ear"
          ? configWithEarSettings(config, ear)
          : config,
    [config, mode, note, ear],
  );
  configRef.current = effective;
  useEffect(() => {
    const persistSettings = (next: PracticeConfig) => {
      if (applyingConfig.current) return;
      configRef.current = next;
      replaceUrl(
        practiceSettingsHref(
          next,
          `${urlIntentRef.current!.href.split("#")[0]}${window.location.hash}`,
        ),
      );
    };
    if (mode === "note")
      return useGameStore.subscribe((next, previous) => {
        if (next.settings !== previous.settings)
          persistSettings(
            configWithNoteSettings(configRef.current, next.settings),
          );
      });
    if (mode === "ear")
      return useEarTrainingStore.subscribe((next, previous) => {
        if (next.settings !== previous.settings)
          persistSettings(
            configWithEarSettings(configRef.current, next.settings),
          );
      });
  }, [mode, replaceUrl]);
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
    replaceUrl(patchPracticeQuery(latestHref(), next));
  };
  const choose = (next: PracticeConfig) => {
    if (next.mode !== mode) {
      router.push(practiceConfigurationHref(next, pathname), { scroll: false });
      return;
    }
    configRef.current = next;
    setConfig(next);
    apply(next);
    useTheoryStore.getState().reset();
    replaceUrl(practiceSettingsHref(next, latestHref()));
  };
  const changeMode = (next: TrainingMode) => {
    if (next === mode) return;
    trackPracticeModeChanged(next);
    choose(defaultConfig(next));
  };
  const normalPractice = () => {
    setDaily(false);
    useGameStore.getState().resetGame();
    useEarTrainingStore.getState().resetSession();
    useTheoryStore.getState().reset();
    updateQuery({ daily: null });
  };
  const changePractice = () => {
    normalPractice();
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLInputElement>(
          '[data-practice-mode] input[type="radio"]:checked',
        )
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
  const settingsIntro = (
    <div
      data-practice-settings-intro
      className="grid gap-3 border-b border-slate-200 pb-4"
    >
      <div className="grid min-w-0 gap-3">
        <label className="grid gap-1 text-xs font-bold text-slate-500">
          {c.preset}
          <select
            className={settingsSelectClassName}
            value=""
            onChange={(e) => {
              const value = e.target.value;
              if (!value) return;
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
            className={settingsSelectClassName}
            value={config.difficulty}
            onChange={(e) =>
              choose(
                defaultConfig(
                  configRef.current.mode,
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
              className={settingsSelectClassName}
              value={effective.length}
              onChange={(e) =>
                choose({
                  ...configRef.current,
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
              className={settingsSelectClassName}
              value={effective.timeLimit}
              onChange={(e) =>
                choose({
                  ...configRef.current,
                  timeLimit: Number(e.target.value),
                })
              }
            >
              {[30, 60, 180].map((value) => (
                <option key={value} value={value}>
                  {value} {t.units.seconds}
                </option>
              ))}
            </select>
          )}
      </div>
      {parsed.shared && (
        <p className="text-xs text-slate-500">{c.sharedSettings}</p>
      )}
      <p className="text-xs leading-5 text-slate-500">{c.leaderboardNotice}</p>
      {daily && (
        <button
          type="button"
          className={settingsActionClassName}
          onClick={normalPractice}
        >
          {c.normalPractice}
        </button>
      )}
    </div>
  );
  const headerActions = (
    <PracticeHistoryPanel
      mode={mode}
      notice={notice}
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
  );
  const sharedProps = {
    mode,
    onModeChange: changeMode,
    settingsOpen,
    settingsIntro,
    headerActions,
    onSettingsOpen: () => {
      setSettingsOpen(true);
      trackPracticeSettingsOpened(mode);
      updateQuery({ settings: "open", leaderboard: null });
    },
    onSettingsClose: () => {
      setSettingsOpen(false);
      trackPracticeSettingsClosed(mode);
      updateQuery({ settings: null, leaderboard: null });
    },
    onLeaderboardOpen: () => {
      setSettingsOpen(false);
      updateQuery({ leaderboard: "open", settings: null });
    },
    onChangePractice: changePractice,
  };
  return (
    <>
      {parsed.invalid && (
        <p role="status" className="mb-3 text-sm text-amber-800">
          {c.invalidSettings}
        </p>
      )}
      {daily && !challengeDay ? (
        <p role="status" className="p-4 text-sm text-slate-500">
          {t.leaderboard.loading}
        </p>
      ) : (
        children({
          sessionKey: `${mode}-${daily ? dailyKey : "normal"}`,
          noteProps: {
            ...sharedProps,
            runOptions: dailyQuestions
              ? {
                  kind: "daily",
                  questions: dailyQuestions.note,
                  questionLimit: 10,
                }
              : undefined,
            onComplete: noteComplete,
          },
          earProps: {
            ...sharedProps,
            runOptions: dailyQuestions
              ? {
                  kind: "daily",
                  questions: dailyQuestions.ear,
                  questionLimit: 10,
                }
              : undefined,
            onComplete: earComplete,
          },
          theoryProps: {
            ...sharedProps,
            config: daily ? dailyConfig : effective,
            onConfigChange: choose,
            runOptions: dailyQuestions
              ? {
                  kind: "daily",
                  questions: dailyQuestions.theory,
                }
              : undefined,
            onComplete: theoryComplete,
          },
        })
      )}
    </>
  );
}
