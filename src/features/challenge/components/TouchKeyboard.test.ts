import React, { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TouchKeyboard from "./TouchKeyboard";
import type { ChallengeCopy } from "../i18n";
import type { PerformanceEvent } from "../domain/performance";
import { TouchKeyboardInput } from "../input/touchKeyboard";

const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  cursor: 0,
  cleanups: [] as (() => void)[],
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (initial: unknown) =>
    (hooks.refs[hooks.cursor++] ??= { current: initial }),
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) hooks.cleanups.push(cleanup);
  },
}));

type Node = ReactElement<{
  children?: Node | Node[];
  "data-midi"?: number;
  disabled?: boolean;
  onKeyDown?: (event: {
    key: string;
    repeat: boolean;
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => void;
}>;
function findKey(node: Node, midi: number): Node | undefined {
  if (node.props["data-midi"] === midi) return node;
  const children = [node.props.children].flat().filter(Boolean) as Node[];
  for (const child of children) {
    if (typeof child !== "object") continue;
    const found = findKey(child, midi);
    if (found) return found;
  }
}
function release(key: string) {
  const event = new Event("keyup", { cancelable: true });
  Object.defineProperty(event, "key", { value: key });
  window.dispatchEvent(event);
}
beforeEach(() => {
  hooks.refs = [];
  hooks.cursor = 0;
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => {
  hooks.cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.unstubAllGlobals();
});

describe("touch-key control release across a repeat transition", () => {
  it.each(["Enter", " "])(
    "%s accepts the first new press after session cancellation and an external keyup",
    (trigger) => {
      const input = new TouchKeyboardInput(vi.fn());
      let now = 1;
      const render = (enabled: boolean) => {
        hooks.cleanups.splice(0).forEach((cleanup) => cleanup());
        hooks.cursor = 0;
        return TouchKeyboard({
          enabled,
          heldMidi: input.currentMidi,
          c: { touch: "Touch keyboard", touchHint: "Hold a key" } as ChallengeCopy,
          down: (key, midi) => input.down(key, midi, now),
          up: (key) => input.up(key, now),
          cancel: () => input.cancel(),
        }) as Node;
      };
      const press = () =>
        findKey(render(true), 60)!.props.onKeyDown!({
          key: trigger,
          repeat: false,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        });
      press();
      expect(input.currentMidi).toBe(60);
      // Background pause cancels input; physical keyup is lost to another window.
      input.cancel();
      render(false);
      now = 3;
      press();
      expect(input.currentMidi).toBe(60);
      now = 4;
      release(trigger);
      expect(input.currentMidi).toBeNull();
    },
  );
  it.each(["Enter", " "])(
    "%s releases outside the disabled button without shortening the held note",
    (trigger) => {
      let now = 1;
      const events: PerformanceEvent[] = [];
      const input = new TouchKeyboardInput((event) => events.push(event));
      const up = (key: string) => input.up(key, now);
      const render = (enabled: boolean) => {
        hooks.cleanups.splice(0).forEach((cleanup) => cleanup());
        hooks.cursor = 0;
        return TouchKeyboard({
          enabled,
          heldMidi: input.currentMidi,
          c: {
            touch: "Touch keyboard",
            touchHint: "Hold a key",
          } as ChallengeCopy,
          down: (key, midi) => input.down(key, midi, now),
          up,
          cancel: () => input.cancel(),
        }) as Node;
      };
      findKey(render(true), 60)!.props.onKeyDown!({
        key: trigger,
        repeat: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      });
      now = 2;
      expect(findKey(render(false), 60)!.props.disabled).toBe(true);
      release("x");
      expect(input.currentMidi).toBe(60);
      expect(events).toEqual([]);
      now = 2.25;
      // The native browser moves focus to BODY when disabling the held key.
      // No button-local onKeyUp runs: only its owning window receives this.
      release(trigger);
      expect(input.currentMidi).toBeNull();
      expect(events).toEqual([
        expect.objectContaining({
          observedMidi: 60,
          onsetAudioSec: 1,
          offsetAudioSec: 2.25,
        }),
      ]);
      render(true);
      expect(input.down("key-s", 62, 3)).toBe(true);
      release(trigger);
      expect(input.currentMidi).toBe(62);
    },
  );
});
