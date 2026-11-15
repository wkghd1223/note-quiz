import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTranslation } from "@/lib/i18n/translations";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locale";
import { defaultConfig } from "@/lib/practice/config";
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
vi.mock("./StableNotationSurface", () => ({
  default: ({
    children,
    placeholder,
    concealed,
  }: {
    children:
      | React.ReactNode
      | ((viewport: {
          width: number;
          height: number;
          onReady: () => void;
        }) => React.ReactNode);
    placeholder:
      | React.ReactNode
      | ((viewport: { width: number; height: number }) => React.ReactNode);
    concealed?: boolean;
  }) => (
    <div data-practice-notation data-answer-revealed={!concealed}>
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
    expect(markup).toContain("/flat-sign.svg");
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
    expect(paused).toContain(getTranslation("en").messages.correctAnswer);
    vi.advanceTimersByTime(5000);
    expect(renderMode("note")).toContain('data-feedback-visible="false"');
    expect(useGameStore.getState().feedback).toBe(feedback);
    expect(useGameStore.getState().currentQuestion).toBe(question);
    useGameStore.getState().resumeGame();
    expect(renderMode("note")).toContain('data-feedback-visible="true"');
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

it("keeps the existing help before conditional theory answer details when finishing", () => {
  finishSession("chord", true, true);
  const markup = renderMode("chord", true);
  const explanation = markup.slice(
    markup.indexOf("data-practice-explanation"),
    markup.indexOf("data-practice-input"),
  );
  expect(explanation.indexOf(getTranslation("en").learning.tonic)).toBeLessThan(
    explanation.indexOf(getTranslation("en").learning.yourAnswer),
  );
});
