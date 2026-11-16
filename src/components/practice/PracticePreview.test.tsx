import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTranslation } from "@/lib/i18n/translations";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locale";
import { theoryLabel } from "@/lib/practice/theoryLabel";
import { defaultConfig, type PracticeConfig } from "@/lib/practice/config";
import type { TrainingMode } from "@/lib/practice/types";
import * as music from "@/lib/music/utils";
import * as theory from "@/lib/music/theory";
import * as audio from "@/lib/music/audio";
import { useGameStore } from "@/store/gameStore";
import { useEarTrainingStore } from "@/store/earTrainingStore";
import { useTheoryStore } from "@/store/theoryStore";
import NotePracticeMode from "./NotePracticeMode";
import EarPracticeMode from "./EarPracticeMode";
import TheoryPracticeMode from "./TheoryPracticeMode";

const { locale, scores } = vi.hoisted(() => ({
  locale: { value: "en" as Language },
  scores: [] as {
    clef: ClefType;
    keySignature: number;
    events: { notes: unknown[] }[];
  }[],
}));
vi.mock("@/hooks/useTranslation", async () => {
  const { getTranslation } = await import("@/lib/i18n/translations");
  return {
    useTranslation: () => ({
      t: getTranslation(locale.value),
      language: locale.value,
      locale: locale.value,
      isInitialized: true,
    }),
  };
});
vi.mock("./ModeSwitcher", () => ({
  default: () => <nav data-practice-mode />,
}));
vi.mock("./StableNotationSurface", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./StableNotationSurface")>()),
  default: ({
    children,
    placeholder,
    concealed,
    staffRange,
  }: {
    children:
      | React.ReactNode
      | ((viewport: {
          width: number;
          height: number;
          onReady: () => void;
        }) => React.ReactNode);
    placeholder?:
      | React.ReactNode
      | ((viewport: { width: number; height: number }) => React.ReactNode);
    concealed?: boolean;
    staffRange?: GameSettings["staffRange"];
  }) => (
    <div
      data-practice-notation
      data-answer-revealed={!concealed}
      data-test-ledger-above={staffRange?.ledgerLinesAbove}
      data-test-ledger-below={staffRange?.ledgerLinesBelow}
    >
      {typeof children === "function"
        ? children({ width: 320, height: 112, onReady: () => {} })
        : children}
      <div data-notation-placeholder aria-hidden="true">
        {typeof placeholder === "function"
          ? placeholder({ width: 320, height: 112 })
          : placeholder}
      </div>
    </div>
  ),
}));
vi.mock("@/components/notation/AlphaTabNotationView", () => ({
  default: ({ score }: { score: (typeof scores)[number] }) => {
    scores.push(score);
    return <svg data-notation-renderer="test" />;
  },
}));
vi.mock("@/lib/music/audio", () => ({
  initializeAudio: vi.fn(),
  playPianoNote: vi.fn(),
  stopAllNotes: vi.fn(),
  playSequence: vi.fn(),
  playChord: vi.fn(),
  playArpeggio: vi.fn(),
}));
vi.mock("@/lib/music/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/music/utils")>();
  return {
    ...actual,
    generateQuestion: vi.fn(actual.generateQuestion),
    generateEarTrainingQuestion: vi.fn(actual.generateEarTrainingQuestion),
  };
});
vi.mock("@/lib/music/theory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/music/theory")>();
  return {
    ...actual,
    generateTheoryQuestion: vi.fn(actual.generateTheoryQuestion),
  };
});

vi.mock("@/store/gameStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store/gameStore")>();
  // Rendering fixture reads explicitly configured idle state, without subscriptions.
  const useGameStore = Object.assign(
    <T,>(
      selector?: (state: ReturnType<typeof actual.useGameStore.getState>) => T,
    ) =>
      selector
        ? selector(actual.useGameStore.getState())
        : actual.useGameStore.getState(),
    actual.useGameStore,
  );
  return { ...actual, useGameStore };
});
vi.mock("@/store/earTrainingStore", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/store/earTrainingStore")>();
  // Rendering fixture reads explicitly configured idle state, without subscriptions.
  const useEarTrainingStore = Object.assign(
    <T,>(
      selector?: (
        state: ReturnType<typeof actual.useEarTrainingStore.getState>,
      ) => T,
    ) =>
      selector
        ? selector(actual.useEarTrainingStore.getState())
        : actual.useEarTrainingStore.getState(),
    actual.useEarTrainingStore,
  );
  return { ...actual, useEarTrainingStore };
});
vi.mock("@/store/theoryStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store/theoryStore")>();
  // Rendering fixture reads explicitly configured idle state, without subscriptions.
  const useTheoryStore = Object.assign(
    <T,>(
      selector?: (
        state: ReturnType<typeof actual.useTheoryStore.getState>,
      ) => T,
    ) =>
      selector
        ? selector(actual.useTheoryStore.getState())
        : actual.useTheoryStore.getState(),
    actual.useTheoryStore,
  );
  return { ...actual, useTheoryStore };
});
const startLabels: Record<Language, string> = {
  en: "Start practice",
  ko: "연습 시작",
  ja: "練習を開始",
  es: "Empezar práctica",
  de: "Übung starten",
  fr: "Commencer",
  zh: "开始练习",
  pt: "Iniciar prática",
};
const noop = () => {};
const common = {
  onModeChange: noop,
  settingsOpen: false,
  onSettingsOpen: noop,
  onSettingsClose: noop,
  onLeaderboardOpen: noop,
};
function renderMode(
  mode: TrainingMode,
  progression = false,
  settingsIntro?: React.ReactNode,
  configOverrides?: Partial<PracticeConfig>,
) {
  const modeProps = { ...common, settingsIntro };
  return renderToStaticMarkup(
    mode === "note" ? (
      <NotePracticeMode mode={mode} {...modeProps} />
    ) : mode === "ear" ? (
      <EarPracticeMode mode={mode} {...modeProps} />
    ) : (
      <TheoryPracticeMode
        mode={mode}
        {...modeProps}
        config={{
          ...defaultConfig(mode),
          ...(progression ? { task: "progression" } : {}),
          ...configOverrides,
        }}
        onConfigChange={noop}
        onComplete={noop}
        onChangePractice={noop}
      />
    ),
  );
}
function inputMarkup(markup: string) {
  const start = markup.search(/<div\b[^>]*data-practice-input/);
  if (start < 0) return "";
  const tags = /<\/?div\b[^>]*>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let match = tags.exec(markup); match; match = tags.exec(markup)) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (!depth) return markup.slice(start, tags.lastIndex);
  }
  throw new Error("Unbalanced practice input markup");
}

function expectBlank(markup: string, staffCount: number) {
  expect(markup.match(/data-practice-notation="true"/g)).toHaveLength(
    staffCount,
  );
  expect(markup.match(/data-answer-revealed="false"/g)).toHaveLength(
    staffCount,
  );
  expect(markup).toContain('data-practice-phase="idle"');
  expect(markup).not.toContain("<ellipse");
  expect(scores).toHaveLength(staffCount);
  for (const score of scores)
    expect(score.events.flatMap((event) => event.notes)).toEqual([]);
  expect(music.generateQuestion).not.toHaveBeenCalled();
  expect(music.generateEarTrainingQuestion).not.toHaveBeenCalled();
  expect(theory.generateTheoryQuestion).not.toHaveBeenCalled();
  expect(audio.initializeAudio).not.toHaveBeenCalled();
  expect(audio.playPianoNote).not.toHaveBeenCalled();
  expect(audio.playSequence).not.toHaveBeenCalled();
  expect(audio.playChord).not.toHaveBeenCalled();
  expect(audio.playArpeggio).not.toHaveBeenCalled();
  expect(useGameStore.getState().currentQuestion).toBeNull();
  expect(useEarTrainingStore.getState().currentQuestion).toBeNull();
  expect(useTheoryStore.getState().current).toBeNull();
}

beforeEach(() => {
  locale.value = "en";
  useGameStore.getState().resetSettings();
  useEarTrainingStore.getState().resetSettings();
  useTheoryStore.getState().reset();
  vi.clearAllMocks();
  scores.length = 0;
});

describe.each(SUPPORTED_LOCALES)("%s practice idle", (language) => {
  it("uses the approved shared start value and names that button in the instruction", () => {
    const t = getTranslation(language);
    expect(t.startGame).toBe(startLabels[language]);
    expect(t.messages.startGameInstruction).toContain(t.startGame);
    expect(t.home.howToUse.step1.title).toBe(t.startGame);
    expect(t.home.howToUse.step1.description).toContain(t.startGame);
  });
  it.each(["note", "ear", "interval", "chord"] as const)(
    "shows an empty staff and the shared primary action for %s without creating a question",
    (mode) => {
      locale.value = language;
      const markup = renderMode(mode);
      expectBlank(markup, 1);
      const buttons = [
        ...markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g),
      ].map((match) => match[1].replace(/<[^>]*>/g, ""));
      expect(
        buttons.filter((text) => text === startLabels[language]),
      ).toHaveLength(1);
    },
  );
  it("reserves all four empty progression cells before a question exists", () => {
    locale.value = language;
    expectBlank(renderMode("chord", true), 4);
  });
});

it.each(["treble", "bass", "alto", "tenor"] as const)(
  "reflects %s and a configured key without generating a note",
  (clef) => {
    useGameStore
      .getState()
      .updateSettings({ clef, keySignature: "Bb", answerMode: "microphone" });
    const markup = renderMode("note");
    expectBlank(markup, 1);
    expect(markup).toContain(`data-preview-clef="${clef}"`);
    expect(markup).toContain('data-preview-key="Bb Major"');
    expect(markup).not.toContain("/flat-sign.svg");
    expect(scores[0]).toMatchObject({ clef, keySignature: -2, events: [] });
  },
);
it("uses neutral treble/C for random settings, without sampling a future answer", () => {
  useGameStore
    .getState()
    .updateSettings({ clef: "random", keySignature: "random" });
  const markup = renderMode("note");
  expectBlank(markup, 1);
  expect(markup).toContain('data-preview-clef="treble"');
  expect(markup).toContain('data-preview-key="C Major"');
  expect(scores[0]).toMatchObject({
    clef: "treble",
    keySignature: 0,
    events: [],
  });
});

function finishSession(
  mode: TrainingMode,
  answered: boolean,
  progression = false,
) {
  if (mode === "note") {
    useGameStore.getState().startGame();
    const question = useGameStore.getState().currentQuestion!;
    if (answered) {
      useGameStore.getState().submitAnswer(question.displayNote);
      useGameStore
        .getState()
        .setFeedback({ message: "Correct!", type: "success" });
    }
    useGameStore.getState().endGame();
  } else if (mode === "ear") {
    useEarTrainingStore.getState().startSession();
    if (answered)
      useEarTrainingStore
        .getState()
        .submitAnswer(
          useEarTrainingStore.getState().currentQuestion!.targetNote,
        );
    useEarTrainingStore.getState().endSession();
  } else {
    const config = {
      ...defaultConfig(mode),
      ...(progression ? { task: "progression" as const } : {}),
    };
    useTheoryStore.getState().start(config);
    if (answered)
      useTheoryStore
        .getState()
        .submit(useTheoryStore.getState().current!.answer);
    useTheoryStore.getState().end();
  }
  vi.clearAllMocks();
  scores.length = 0;
}
describe.each([false, true])("finished with answered=%s", (answered) => {
  it.each(["note", "ear", "interval", "chord"] as const)(
    "keeps %s notation before its result, clears judgment, and freezes inputs",
    (mode) => {
      finishSession(mode, answered);
      const markup = renderMode(mode);
      expect(markup).toContain('data-practice-phase="finished"');
      expect(markup.match(/data-practice-notation="true"/g)).toHaveLength(1);
      expect(markup).toContain('data-feedback-visible="false"');
      expect(markup.indexOf("data-practice-result")).toBeGreaterThan(
        markup.indexOf("data-practice-input"),
      );
      expect(markup).toContain(getTranslation("en").learning.restart);
      expect(scores).toHaveLength(1);
      const notes = scores.flatMap((score) =>
        score.events.flatMap((event) => event.notes),
      );
      if (answered) expect(notes.length).toBeGreaterThan(0);
      else expect(notes).toEqual([]);
      const input = inputMarkup(markup);
      expect([...input.matchAll(/<button\b/g)].length).toBeGreaterThan(0);
      for (const button of input.matchAll(/<button\b([^>]*)>/g))
        expect(button[1]).toContain("disabled");
      expect(audio.initializeAudio).not.toHaveBeenCalled();
      expect(audio.playPianoNote).not.toHaveBeenCalled();
    },
  );
  it("keeps all four progression cells through finish", () => {
    finishSession("chord", answered, true);
    const markup = renderMode("chord", true);
    expect(markup.match(/data-practice-notation="true"/g)).toHaveLength(4);
    expect(markup).toContain('data-practice-phase="finished"');
    expect(markup).toContain('data-feedback-visible="false"');
    expect(scores).toHaveLength(4);
    for (const score of scores) {
      const notes = score.events.flatMap((event) => event.notes);
      if (answered) expect(notes.length).toBeGreaterThan(0);
      else expect(notes).toEqual([]);
    }
  });
});

it.each(["note", "ear", "interval", "chord"] as const)(
  "forwards optional settings intro before existing %s settings",
  (mode) => {
    const markup = renderMode(
      mode,
      false,
      <div data-settings-intro-test>Intro fixture</div>,
    );
    const aside = markup.slice(
      markup.indexOf("data-practice-settings"),
      markup.indexOf("</aside>"),
    );
    expect(aside).toContain("data-settings-intro-test");
    expect(aside.indexOf("data-settings-intro-test")).toBeLessThan(
      aside.lastIndexOf("<select"),
    );
    expect(markup.match(/data-settings-intro-test/g)).toHaveLength(2);
  },
);

it("hides only paused judgment and resumes the store's remaining feedback transition", () => {
  vi.useFakeTimers();
  try {
    useGameStore.getState().startGame();
    const question = useGameStore.getState().currentQuestion!;
    useGameStore.getState().submitAnswer(question.displayNote);
    useGameStore
      .getState()
      .setFeedback({ message: "Correct!", type: "success" });
    vi.advanceTimersByTime(200);
    useGameStore.getState().pauseGame();
    const feedback = useGameStore.getState().feedback;
    const paused = renderMode("note");
    expect(paused).toContain('data-feedback-visible="false"');
    expect(answerToastMarkup(paused)).not.toContain(
      "data-answer-toast-details",
    );
    expect(answerToastMarkup(paused)).not.toContain("Correct!");
    vi.advanceTimersByTime(5000);
    expect(renderMode("note")).toContain('data-feedback-visible="false"');
    expect(useGameStore.getState().feedback).toBe(feedback);
    expect(useGameStore.getState().currentQuestion).toBe(question);
    useGameStore.getState().resumeGame();
    const resumed = renderMode("note");
    expect(resumed).toContain('data-feedback-visible="true"');
    expect(answerToastMarkup(resumed)).toContain("data-answer-toast-details");
    expect(answerToastMarkup(resumed)).toContain(
      music.noteToString(question.displayNote),
    );
    vi.advanceTimersByTime(649);
    expect(useGameStore.getState().currentQuestion).toBe(question);
    vi.advanceTimersByTime(1);
    expect(useGameStore.getState().currentQuestion).not.toBe(question);
    expect(useGameStore.getState().feedback).toBeNull();
  } finally {
    useGameStore.getState().resetGame();
    vi.useRealTimers();
  }
});

it("places theory help by the title while preserving answer and component details", () => {
  finishSession("chord", true, true);
  const markup = renderMode("chord", true);
  const c = getTranslation("en").learning;
  const header = markup.slice(0, markup.indexOf("data-practice-control-dock"));
  expect(header).toContain("data-practice-description");
  expect(header).toContain(c.tonic);
  expect(markup).not.toContain("data-practice-explanation");
  expect(answerToastMarkup(markup)).not.toContain("data-answer-toast-details");
  const result = markup.slice(markup.indexOf("data-practice-result"));
  expect(result).toContain(c.review);
});

it.each(SUPPORTED_LOCALES)(
  "orders direction answers higher, same, lower in one row for %s",
  (language) => {
    locale.value = language;
    const config = defaultConfig("interval");
    useTheoryStore.getState().start(config);
    const markup = renderMode("interval");
    const input = inputMarkup(markup);
    const c = getTranslation(language).learning;
    expect(input).toContain("grid-cols-3");
    const labels = [
      ...input.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g),
    ].map((match) => match[1].trim());
    expect(labels).toEqual([c.higher, c.same, c.lower]);
  },
);

it.each(SUPPORTED_LOCALES)(
  "names 44px speaker controls and offers octave examples in %s",
  (language) => {
    locale.value = language;
    const c = getTranslation(language).learning;
    const idle = renderMode("interval");
    expect(idle).toContain(`aria-label="${c.example}"`);
    expect(idle).toContain(`title="${c.example}"`);
    expect(idle).toContain('<option value="P8">');
    expect(idle).not.toContain('<option value="P1">');
    expect(idle).toContain('<option value="M3">');
    expect(idle).toContain('<option value="P5">');
    expect(idle).not.toContain("h-16 w-full");
    expect(
      theory.getTheoryOptions({
        ...defaultConfig("interval"),
        task: "interval",
      }),
    ).toEqual(["P1", "M3", "P5"]);
    useTheoryStore.getState().start(defaultConfig("interval"));
    const active = renderMode("interval");
    const speaker = [
      ...active.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g),
    ].find((match) => match[1].includes(`aria-label="${c.play}"`));
    expect(speaker).toBeDefined();
    expect(speaker![1]).toContain(`title="${c.play}"`);
    expect(speaker![1]).toContain("h-11 w-11");
    expect(speaker![2]).toContain("<svg");
    expect(speaker![2]).not.toContain(c.play);
  },
);

it.each(["note", "ear", "interval", "chord"] as const)(
  "keeps %s finished actions outside its result and reserves them before finish",
  (mode) => {
    const idle = renderMode(mode);
    const idleResults = idle.slice(idle.indexOf('data-action-state="results"'));
    expect(idleResults).toContain('aria-hidden="true"');
    expect(idleResults).toContain('data-practice-action="restart"');
    finishSession(mode, true);
    const markup = renderMode(mode);
    const resultIndex = markup.indexOf("data-practice-result");
    expect(markup.indexOf('data-practice-action="view-results"')).toBeLessThan(
      markup.indexOf('data-practice-action="restart"'),
    );
    expect(markup.indexOf('data-practice-action="restart"')).toBeLessThan(
      resultIndex,
    );
    const result = markup.slice(resultIndex);
    expect(result).toContain(getTranslation("en").learning.review);
    expect(result).not.toContain(getTranslation("en").learning.restart);
    expect(result).not.toContain(getTranslation("en").learning.changePractice);
  },
);

function answerToastMarkup(markup: string) {
  return markup.slice(
    markup.indexOf("data-practice-feedback"),
    markup.indexOf("data-practice-notation"),
  );
}

function startAndAnswer(mode: TrainingMode, correct: boolean) {
  const t = getTranslation(locale.value);
  if (mode === "note") {
    useGameStore.getState().startGame();
    const question = useGameStore.getState().currentQuestion!;
    const note = correct
      ? question.displayNote
      : {
          ...question.displayNote,
          name:
            question.displayNote.name === "C" ? ("D" as const) : ("C" as const),
        };
    const judged = useGameStore.getState().submitAnswer(note);
    useGameStore.getState().setFeedback({
      message: judged ? t.messages.correct : t.messages.incorrect,
      type: judged ? "success" : "error",
    });
    const answer = useGameStore.getState().answers.at(-1)!;
    return [
      `${t.messages.yourAnswer}: ${music.noteToString(answer.note)}`,
      `${t.messages.correctAnswer}: ${music.noteToString(answer.correctNote)}`,
    ];
  }
  if (mode === "ear") {
    useEarTrainingStore.getState().startSession();
    const target = useEarTrainingStore.getState().currentQuestion!.targetNote;
    const note = correct
      ? target
      : {
          ...target,
          name: target.name === "C" ? ("D" as const) : ("C" as const),
        };
    useEarTrainingStore.getState().submitAnswer(note);
    const answer = useEarTrainingStore.getState().answers.at(-1)!;
    return [
      `${t.messages.yourAnswer}: ${music.noteToString(answer.note)}`,
      `${t.messages.correctAnswer}: ${music.noteToString(answer.correctNote)}`,
    ];
  }
  useTheoryStore.getState().start(defaultConfig(mode));
  const question = useTheoryStore.getState().current!;
  const answer = correct
    ? question.answer
    : question.options.find((value) => value !== question.answer)!;
  useTheoryStore.getState().submit(answer);
  return [
    `${t.learning.yourAnswer}: ${theoryLabel(t.learning, answer)}`,
    `${t.learning.answer}: ${theoryLabel(t.learning, question.answer)}`,
    `${t.learning.components}: ${question.notes.map(music.noteToString).join(" · ")}`,
  ];
}

describe.each(SUPPORTED_LOCALES)("%s detailed answer feedback", (language) => {
  it.each(["note", "ear", "interval", "chord"] as const)(
    "renders %s submitted/correct details only in its current toast and clears them on next/finish",
    (mode) => {
      vi.useFakeTimers();
      try {
        locale.value = language;
        for (const correct of [false, true]) {
          const details = startAndAnswer(mode, correct);
          const markup = renderMode(mode);
          const toast = answerToastMarkup(markup);
          expect(toast).toContain('data-feedback-visible="true"');
          expect(toast).toContain(`data-correct="${correct}"`);
          expect(toast).toContain("data-answer-toast-details");
          for (const detail of details) expect(toast).toContain(detail);
          expect(markup).not.toContain("data-practice-explanation");
          expect(markup.indexOf("data-answer-toast-details")).toBeLessThan(
            markup.indexOf("data-practice-notation"),
          );
          // Stores retain answer history, but the next prompt must not disclose it.
          vi.advanceTimersByTime(mode === "note" ? 850 : 900);
          const next = answerToastMarkup(renderMode(mode));
          expect(next).toContain('data-feedback-visible="false"');
          expect(next).not.toContain("data-answer-toast-details");
          for (const detail of details) expect(next).not.toContain(detail);
          if (mode === "note") useGameStore.getState().endGame();
          else if (mode === "ear") useEarTrainingStore.getState().endSession();
          else useTheoryStore.getState().end();
          const finished = renderMode(mode);
          expect(answerToastMarkup(finished)).not.toContain(
            "data-answer-toast-details",
          );
          const answers =
            mode === "note"
              ? useGameStore.getState().gameResult?.answers
              : mode === "ear"
                ? useEarTrainingStore.getState().result?.answers
                : useTheoryStore.getState().result?.answers;
          expect(answers).toHaveLength(1);
          // Incorrect answer detail remains available in the result history.
          if (!correct) {
            const history = finished.slice(
              finished.indexOf("data-practice-result"),
            );
            for (const detail of details.slice(0, 2))
              expect(history).toContain(detail);
          }
        }
      } finally {
        useGameStore.getState().resetGame();
        useEarTrainingStore.getState().resetSession();
        useTheoryStore.getState().reset();
        vi.useRealTimers();
      }
    },
  );
});

it.each(SUPPORTED_LOCALES)(
  "keeps note and ear instructions under the title in %s",
  (language) => {
    locale.value = language;
    const t = getTranslation(language);
    for (const mode of ["note", "ear"] as const) {
      const markup = renderMode(mode);
      const header = markup.slice(
        0,
        markup.indexOf("data-practice-control-dock"),
      );
      expect(header).toContain("data-practice-description");
      expect(header).toContain(
        mode === "note"
          ? t.messages.startGameInstruction.replaceAll('"', "&quot;")
          : t.earTraining.description,
      );
      expect(markup).not.toContain("data-practice-explanation");
      if (mode === "note") {
        expect(header).toContain(t.learning.leaderboardNotice);
        useGameStore.getState().startGame();
        expect(renderMode(mode)).not.toContain(
          t.messages.startGameInstruction.replaceAll('"', "&quot;"),
        );
        useGameStore.getState().resetGame();
      }
    }
  },
);

it.each(["interval", "chord"] as const)(
  "does not disclose unanswered audio %s detail",
  (mode) => {
    useTheoryStore.getState().start(defaultConfig(mode));
    const markup = renderMode(mode);
    expect(answerToastMarkup(markup)).not.toContain(
      "data-answer-toast-details",
    );
    expect(markup).toContain('data-answer-revealed="false"');
    expect(scores.at(-1)?.events.flatMap((event) => event.notes)).toEqual([]);
  },
);

it.each([
  ["interval", "interval"],
  ["chord", "quality"],
  ["chord", "inversion"],
  ["chord", "progression"],
] as const)(
  "preserves %s/%s mode-specific audio answer and component details",
  (mode, task) => {
    vi.useFakeTimers();
    try {
      useTheoryStore.getState().start({ ...defaultConfig(mode), task });
      const question = useTheoryStore.getState().current!;
      expect(
        answerToastMarkup(
          renderMode(mode, task === "progression", undefined, { task }),
        ),
      ).not.toContain("data-answer-toast-details");
      const answer = question.options.find(
        (value) => value !== question.answer,
      )!;
      useTheoryStore.getState().submit(answer);
      const toast = answerToastMarkup(
        renderMode(mode, task === "progression", undefined, { task }),
      );
      const c = getTranslation("en").learning;
      expect(toast).toContain(`${c.yourAnswer}: ${theoryLabel(c, answer)}`);
      expect(toast).toContain(
        `${c.answer}: ${theoryLabel(c, question.answer)}`,
      );
      expect(toast).toContain(
        `${c.components}: ${question.notes.map(music.noteToString).join(" · ")}`,
      );
      useTheoryStore.getState().end();
      const result = renderMode(mode, task === "progression", undefined, {
        task,
      });
      expect(answerToastMarkup(result)).not.toContain(
        "data-answer-toast-details",
      );
      expect(result.slice(result.indexOf("data-practice-result"))).toContain(
        theoryLabel(c, answer),
      );
    } finally {
      useTheoryStore.getState().reset();
      vi.useRealTimers();
    }
  },
);

function renderedRanges(markup: string) {
  const above = [...markup.matchAll(/data-test-ledger-above="(\d+)"/g)].map(
    (match) => Number(match[1]),
  );
  const below = [...markup.matchAll(/data-test-ledger-below="(\d+)"/g)].map(
    (match) => Number(match[1]),
  );
  return above.map((ledgerLinesAbove, index) => ({
    ledgerLinesAbove,
    ledgerLinesBelow: below[index],
  }));
}

it("reserves note range from the pinned session settings through feedback and finish", () => {
  const range = { ledgerLinesAbove: 5, ledgerLinesBelow: 5 };
  useGameStore.getState().updateSettings({ staffRange: range });
  expect(renderedRanges(renderMode("note"))).toEqual([range]);
  useGameStore.getState().startGame();
  // Separate the editable settings fixture from the pinned active session.
  useGameStore.setState({
    settings: {
      ...useGameStore.getState().settings,
      staffRange: { ledgerLinesAbove: 0, ledgerLinesBelow: 0 },
    },
  });
  expect(renderedRanges(renderMode("note"))).toEqual([range]);
  const question = useGameStore.getState().currentQuestion!;
  useGameStore.getState().submitAnswer(question.displayNote);
  useGameStore.getState().setFeedback({ message: "Correct!", type: "success" });
  expect(renderedRanges(renderMode("note"))).toEqual([range]);
  useGameStore.getState().endGame();
  expect(renderedRanges(renderMode("note"))).toEqual([range]);
});

it("reserves the full ear octave pool before revealing any note and throughout feedback", () => {
  const range = { ledgerLinesAbove: 2, ledgerLinesBelow: 5 };
  useEarTrainingStore
    .getState()
    .updateSettings({ octaveRange: { min: 3, max: 5 } });
  expect(renderedRanges(renderMode("ear"))).toEqual([range]);
  useEarTrainingStore.getState().startSession();
  expect(renderedRanges(renderMode("ear"))).toEqual([range]);
  const target = useEarTrainingStore.getState().currentQuestion!.targetNote;
  useEarTrainingStore.getState().submitAnswer(target);
  expect(renderedRanges(renderMode("ear"))).toEqual([range]);
  useEarTrainingStore.getState().endSession();
  expect(renderedRanges(renderMode("ear"))).toEqual([range]);
});

it.each([
  ["interval", "interval", 1],
  ["chord", "quality", 0],
  ["chord", "inversion", 3],
  ["chord", "progression", 2],
] as const)(
  "keeps the fixed possible %s/%s range stable before/after answer disclosure",
  (mode, task, ledgerLinesAbove) => {
    const render = () =>
      renderMode(mode, task === "progression", undefined, { task });
    const ranges = Array.from(
      { length: task === "progression" ? 4 : 1 },
      () => ({ ledgerLinesAbove, ledgerLinesBelow: 5 }),
    );
    expect(renderedRanges(render())).toEqual(ranges);
    useTheoryStore.getState().start({ ...defaultConfig(mode), task });
    expect(renderedRanges(render())).toEqual(ranges);
    useTheoryStore.getState().submit(useTheoryStore.getState().current!.answer);
    expect(renderedRanges(render())).toEqual(ranges);
    useTheoryStore.getState().end();
    expect(renderedRanges(render())).toEqual(ranges);
  },
);
