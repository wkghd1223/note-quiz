import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotePracticeMode from "./NotePracticeMode";
import MicrophoneInput from "@/components/game/MicrophoneInput";
import GameControl from "@/components/game/GameControl";
import { useGameStore } from "@/store/gameStore";
import { getTranslation } from "@/lib/i18n/translations";
import {
  initializeAudio,
  playPianoNote,
  stopAllNotes,
} from "@/lib/music/audio";

type Slot = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => ({
  slots: [] as Slot[],
  cursor: 0,
  effects: [] as Array<() => void>,
}));
// Parent effects/callbacks run with real store transitions; audio is mocked.
// Children are inspected as JSX props. Native layout/audio belong to root QA.
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  const same = (a?: unknown[], b?: unknown[]) =>
    !!a &&
    !!b &&
    a.length === b.length &&
    a.every((x, i) => Object.is(x, b[i]));
  return {
    ...actual,
    useRef: (current: unknown) => {
      const i = h.cursor++;
      h.slots[i] ??= { value: { current } };
      return h.slots[i].value;
    },
    useState: (initial: unknown) => {
      const i = h.cursor++;
      h.slots[i] ??= { value: initial };
      return [
        h.slots[i].value,
        (value: unknown) => {
          h.slots[i].value = value;
        },
      ];
    },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      const i = h.cursor++,
        previous = h.slots[i];
      if (!same(previous?.deps, deps)) {
        h.slots[i] = { deps, cleanup: previous?.cleanup };
        h.effects.push(() => {
          previous?.cleanup?.();
          h.slots[i].cleanup = effect() || undefined;
        });
      }
    },
  };
});
vi.mock("zustand/react/shallow", () => ({
  useShallow: (selector: unknown) => selector,
}));
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: getTranslation("en") }),
}));
vi.mock("@/lib/music/audio", () => ({
  initializeAudio: vi.fn(),
  playPianoNote: vi.fn(),
  stopAllNotes: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({
  trackGameStart: vi.fn(),
  trackGameComplete: vi.fn(),
  trackLeaderboardSubmission: vi.fn(),
}));
vi.mock("@/store/gameStore", async (original) => {
  const actual = await original<typeof import("@/store/gameStore")>();
  return {
    ...actual,
    useGameStore: Object.assign(
      <T,>(
        selector: (state: ReturnType<typeof actual.useGameStore.getState>) => T,
      ) => selector(actual.useGameStore.getState()),
      actual.useGameStore,
    ),
  };
});

function render() {
  h.cursor = 0;
  const tree = NotePracticeMode({
    mode: "note",
    onModeChange: vi.fn(),
    settingsOpen: false,
    onSettingsOpen: vi.fn(),
    onSettingsClose: vi.fn(),
    onLeaderboardOpen: vi.fn(),
  });
  for (const effect of h.effects.splice(0)) effect();
  return tree;
}
function find(
  node: unknown,
  predicate: (element: React.ReactElement<Record<string, unknown>>) => boolean,
): React.ReactElement<Record<string, unknown>> | undefined {
  if (!React.isValidElement<Record<string, unknown>>(node)) return;
  if (predicate(node)) return node;
  for (const value of Object.values(node.props)) {
    for (const child of Array.isArray(value) ? value : [value]) {
      const found = find(child, predicate);
      if (found) return found;
    }
  }
}
function microphone(tree = render()) {
  return find(tree, (node) => node.type === MicrophoneInput)!
    .props as unknown as React.ComponentProps<typeof MicrophoneInput>;
}
async function start() {
  const control = find(render(), (node) => node.type === GameControl)!;
  await (control.props.onStart as () => Promise<void>)();
  // onStart intentionally discards its promise; flush initialization/start.
  await Promise.resolve();
  return render();
}
beforeEach(() => {
  vi.useFakeTimers();
  h.slots.length = 0;
  h.cursor = 0;
  h.effects.length = 0;
  useGameStore.getState().resetGame();
  useGameStore.getState().updateSettings({
    answerMode: "microphone",
    enableSound: true,
    timeLimit: undefined,
    questionLimit: null,
  });
  vi.mocked(initializeAudio).mockResolvedValue(undefined);
  vi.mocked(playPianoNote).mockResolvedValue(undefined);
  vi.clearAllMocks();
});
afterEach(() => {
  for (const slot of h.slots) slot.cleanup?.();
  useGameStore.getState().resetGame();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("note practice continuous microphone output/session integration", () => {
  it("cancels existing output before ON, suppresses automatic question sound and does not replay just because OFF", async () => {
    const tree = await start();
    expect(playPianoNote).toHaveBeenCalledTimes(1);
    const mic = microphone(tree);
    const stops = vi.mocked(stopAllNotes).mock.calls.length;
    mic.onContinuousChange!(true);
    expect(stopAllNotes).toHaveBeenCalledTimes(stops + 1);
    useGameStore.getState().advanceQuestion();
    render();
    expect(playPianoNote).toHaveBeenCalledTimes(1);
    microphone().onContinuousChange!(false);
    render();
    expect(playPianoNote).toHaveBeenCalledTimes(1);
    useGameStore.getState().advanceQuestion();
    render();
    expect(playPianoNote).toHaveBeenCalledTimes(2);
  });
  it("keeps sessionActive during feedback while blocking old/locked/question callbacks authoritatively", async () => {
    const mic = microphone(await start());
    expect(mic.sessionActive).toBe(true);
    expect(mic.canSubmit!()).toBe(true);
    const state = useGameStore.getState();
    mic.onSubmit(state.currentQuestion!.displayNote);
    // This reads store state before another render can update props.
    expect(mic.canSubmit!()).toBe(false);
    const locked = microphone();
    expect(locked.sessionActive).toBe(true);
    expect(locked.disabled).toBe(true);
    useGameStore.getState().advanceQuestion();
    expect(mic.canSubmit!()).toBe(false);
    expect(microphone().canSubmit!()).toBe(true);
  });
  it("closes submission synchronously before intentional replay, ends continuous mode eligibility and never auto-restarts it", async () => {
    const tree = await start(),
      mic = microphone(tree);
    const stop = vi.fn(() => mic.onContinuousChange!(false));
    mic.onContinuousChange!(true, stop);
    let resolve!: () => void;
    vi.mocked(playPianoNote).mockReturnValueOnce(
      new Promise<void>((yes) => {
        resolve = yes;
      }),
    );
    const replay = find(
      tree,
      (node) =>
        node.type === "button" &&
        node.props["aria-label"] === getTranslation("en").messages.playSound,
    )!;
    (replay.props.onClick as () => void)();
    expect(stop).toHaveBeenCalledOnce();
    expect(mic.continuousAllowed!()).toBe(false);
    expect(mic.canSubmit!()).toBe(true); // Hold's document-focused blur remains eligible.
    const playing = microphone();
    expect(playing.sessionActive).toBe(true);
    expect(playing.continuousAllowed!()).toBe(false);
    playing.onContinuousChange!(false); // Child's independently-tested cancellation effect.
    resolve();
    await Promise.resolve();
    await Promise.resolve();
    const finished = microphone();
    expect(finished.sessionActive).toBe(true);
    expect(finished.canSubmit!()).toBe(true);
    expect(finished.continuousAllowed!()).toBe(true);
    expect(playPianoNote).toHaveBeenCalledTimes(2);
  });
  it.each(["pause", "session", "input"])(
    "invalidates stale eligibility before rendering %s replacement",
    async (reason) => {
      const mic = microphone(await start());
      if (reason === "pause") useGameStore.getState().pauseGame();
      if (reason === "session") useGameStore.getState().startGame();
      if (reason === "input")
        useGameStore.setState((state) => ({
          sessionSettings: { ...state.sessionSettings, answerMode: "piano" },
        }));
      expect(mic.canSubmit!()).toBe(false);
      if (reason === "pause") expect(microphone().sessionActive).toBe(false);
      if (reason === "session")
        expect(microphone().sessionKey).not.toBe(mic.sessionKey);
      if (reason === "input")
        expect(
          find(render(), (node) => node.type === MicrophoneInput),
        ).toBeUndefined();
    },
  );

  it("does not let an older replay completion enable continuous capture during newer output", async () => {
    const tree = await start();
    let first!: () => void, second!: () => void;
    vi.mocked(playPianoNote)
      .mockReturnValueOnce(
        new Promise<void>((yes) => {
          first = yes;
        }),
      )
      .mockReturnValueOnce(
        new Promise<void>((yes) => {
          second = yes;
        }),
      );
    const replay = find(
      tree,
      (node) =>
        node.type === "button" &&
        node.props["aria-label"] === getTranslation("en").messages.playSound,
    )!;
    (replay.props.onClick as () => void)();
    (replay.props.onClick as () => void)();
    first();
    await Promise.resolve();
    await Promise.resolve();
    expect(microphone().continuousAllowed!()).toBe(false);
    second();
    await Promise.resolve();
    await Promise.resolve();
    expect(microphone().continuousAllowed!()).toBe(true);
  });
});
