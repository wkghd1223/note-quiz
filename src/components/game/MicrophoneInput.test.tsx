import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MicrophoneInput from "./MicrophoneInput";
import { getTranslation } from "@/lib/i18n/translations";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locale";

type Slot = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => ({
  slots: [] as Slot[],
  cursor: 0,
  effects: [] as Array<() => void>,
  language: "en" as Language,
  focused: true,
  pitch: {
    permissionState: "granted",
    isListening: false,
    detectedNote: null as Note | null,
    detectedLabel: "--",
    signalRef: { current: {} },
    currentNote: null as Note | null,
  },
  start: vi.fn(),
  stop: vi.fn(),
}));
// A persistent node-only hook harness dispatches actual JSX event handlers and
// cleanup effects. Browser geometry/pointer delivery are verified by root QA.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const same = (a?: unknown[], b?: unknown[]) =>
    !!a &&
    !!b &&
    a.length === b.length &&
    a.every((value, index) => Object.is(value, b[index]));
  return {
    ...actual,
    useRef: (current: unknown) => {
      const index = h.cursor++;
      h.slots[index] ??= { value: { current } };
      return h.slots[index].value;
    },
    useState: (initial: unknown) => {
      const index = h.cursor++;
      h.slots[index] ??= { value: initial };
      return [
        h.slots[index].value,
        (value: unknown) => {
          h.slots[index].value = value;
        },
      ];
    },
    useCallback: (callback: unknown, deps: unknown[]) => {
      const index = h.cursor++;
      if (!same(h.slots[index]?.deps, deps))
        h.slots[index] = { value: callback, deps };
      return h.slots[index].value;
    },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      const index = h.cursor++;
      const previous = h.slots[index];
      if (!same(previous?.deps, deps)) {
        h.slots[index] = { deps, cleanup: previous?.cleanup };
        h.effects.push(() => {
          previous?.cleanup?.();
          h.slots[index].cleanup = effect() || undefined;
        });
      }
    },
  };
});
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: getTranslation(h.language) }),
}));
vi.mock("@/hooks/useMicrophonePitch", () => ({
  useMicrophonePitch: () => ({
    ...h.pitch,
    startListening: h.start,
    stopListening: h.stop,
  }),
}));
vi.mock("./MicrophoneSignal", () => ({
  default: () => <span data-signal-fixture />,
}));

let win: EventTarget;
let doc: EventTarget & { hidden: boolean; hasFocus: () => boolean };
let submit: ReturnType<typeof vi.fn>;
let target: HTMLButtonElement;
let captured: boolean;
type Props = React.ComponentProps<typeof MicrophoneInput>;
function render(overrides: Partial<Props> = {}) {
  h.cursor = 0;
  const tree = MicrophoneInput({
    onSubmit: submit,
    captureKey: "q1",
    ...overrides,
  }) as React.ReactElement;
  for (const effect of h.effects.splice(0)) effect();
  return tree;
}
function find(
  node: React.ReactNode,
  attribute: string,
): React.ReactElement<Record<string, unknown>> | undefined {
  if (!React.isValidElement<Record<string, unknown>>(node)) return;
  if (attribute in node.props) return node;
  for (const child of React.Children.toArray(
    node.props.children as React.ReactNode,
  )) {
    const found = find(child, attribute);
    if (found) return found;
  }
}
function controls(tree = render()) {
  return find(tree, "data-microphone-hold")!
    .props as React.ButtonHTMLAttributes<HTMLButtonElement>;
}
function pointer(id = 1, extra = {}) {
  return {
    button: 0,
    isPrimary: true,
    pointerId: id,
    currentTarget: target,
    preventDefault: vi.fn(),
    ...extra,
  } as unknown as React.PointerEvent<HTMLButtonElement>;
}
function keyboard(key: string, repeat = false) {
  return {
    key,
    repeat,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLButtonElement>;
}
function click(detail = 0) {
  return {
    detail,
    preventDefault: vi.fn(),
  } as unknown as React.MouseEvent<HTMLButtonElement>;
}
function detect() {
  const note: Note = { name: "A", octave: 4, accidental: null };
  h.pitch.currentNote = note;
  h.pitch.detectedNote = note;
  h.pitch.detectedLabel = "A4";
  return note;
}
function unmount() {
  for (const slot of h.slots) {
    slot.cleanup?.();
    slot.cleanup = undefined;
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  h.slots.length = 0;
  h.effects.length = 0;
  h.cursor = 0;
  h.language = "en";
  h.focused = true;
  Object.assign(h.pitch, {
    isListening: false,
    detectedNote: null,
    currentNote: null,
    detectedLabel: "--",
  });
  h.start.mockReset();
  h.stop.mockReset();
  h.start.mockImplementation(async () => {
    h.pitch.currentNote = null;
    h.pitch.detectedNote = null;
    h.pitch.detectedLabel = "--";
    h.pitch.isListening = true;
  });
  h.stop.mockImplementation(() => {
    const note = h.pitch.currentNote;
    h.pitch.currentNote = null;
    h.pitch.detectedNote = null;
    h.pitch.detectedLabel = "--";
    h.pitch.isListening = false;
    return note;
  });
  win = new EventTarget();
  doc = Object.assign(new EventTarget(), {
    hidden: false,
    hasFocus: () => h.focused,
  });
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  submit = vi.fn();
  captured = false;
  target = {
    focus: vi.fn(),
    setPointerCapture: vi.fn(() => {
      captured = true;
    }),
    hasPointerCapture: vi.fn(() => captured),
    releasePointerCapture: vi.fn(() => {
      captured = false;
    }),
  } as unknown as HTMLButtonElement;
});
afterEach(() => {
  unmount();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("hold-to-detect microphone input", () => {
  it("captures a primary pointer and submits the current stable note once on release", () => {
    const button = controls();
    button.onPointerDown!(pointer());
    const note = detect();
    expect(target.setPointerCapture).toHaveBeenCalledWith(1);
    expect(submit).not.toHaveBeenCalled();
    button.onPointerUp!(pointer());
    button.onPointerUp!(pointer());
    button.onLostPointerCapture!(pointer());
    button.onClick!(click(1));
    expect(submit).toHaveBeenCalledExactlyOnceWith(note);
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(h.start).toHaveBeenCalledOnce();
    expect(h.pitch.isListening).toBe(false);
  });

  it("does not submit a silent hold or a stale note from a previous hold", () => {
    const button = controls();
    detect();
    button.onPointerDown!(pointer());
    button.onPointerUp!(pointer());
    expect(submit).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers();
    button.onPointerDown!(pointer());
    const note = detect();
    button.onPointerUp!(pointer());
    expect(submit).toHaveBeenCalledExactlyOnceWith(note);
  });

  it.each([" ", "Enter"])(
    "supports %s hold/release, ignores repeat, and consumes the synthesized click",
    (key) => {
      const button = controls();
      const down = keyboard(key);
      button.onKeyDown!(down);
      button.onKeyDown!(keyboard(key, true));
      const note = detect();
      button.onKeyUp!(keyboard(key));
      button.onClick!(click());
      button.onKeyUp!(keyboard(key));
      expect(down.preventDefault).toHaveBeenCalled();
      expect(h.start).toHaveBeenCalledOnce();
      expect(submit).toHaveBeenCalledExactlyOnceWith(note);
    },
  );

  it("ignores unrelated pointer/key releases", () => {
    const button = controls();
    button.onPointerDown!(pointer());
    detect();
    button.onPointerUp!(pointer(2));
    button.onKeyUp!(keyboard("Enter"));
    expect(submit).not.toHaveBeenCalled();
    button.onPointerCancel!(pointer());
    expect(h.pitch.isListening).toBe(false);
  });

  it.each([
    "pointercancel",
    "lostcapture",
    "Escape",
    "windowblur",
    "hidden",
    "disabled",
    "unmount",
    "newquestion",
  ])("%s cancels capture without submitting", (reason) => {
    const button = controls();
    button.onPointerDown!(pointer());
    detect();
    if (reason === "pointercancel") button.onPointerCancel!(pointer());
    if (reason === "lostcapture") {
      captured = false;
      button.onLostPointerCapture!(pointer());
    }
    if (reason === "Escape") button.onKeyDown!(keyboard("Escape"));
    if (reason === "windowblur") {
      h.focused = false;
      win.dispatchEvent(new Event("blur"));
    }
    if (reason === "hidden") {
      doc.hidden = true;
      doc.dispatchEvent(new Event("visibilitychange"));
    }
    if (reason === "disabled") render({ disabled: true });
    if (reason === "unmount") unmount();
    if (reason === "newquestion") render({ captureKey: "q2" });
    button.onPointerUp!(pointer());
    vi.runOnlyPendingTimers();
    expect(submit).not.toHaveBeenCalled();
    expect(h.pitch.currentNote).toBeNull();
    expect(h.pitch.isListening).toBe(false);
  });

  it("button blur submits once while the document remains focused", () => {
    const button = controls();
    button.onKeyDown!(keyboard(" "));
    const note = detect();
    button.onBlur!({} as React.FocusEvent<HTMLButtonElement>);
    expect(h.pitch.isListening).toBe(false);
    expect(submit).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers();
    button.onKeyUp!(keyboard(" "));
    expect(submit).toHaveBeenCalledExactlyOnceWith(note);
  });

  it("window loss cancels the pending button-blur submission", () => {
    const button = controls();
    button.onKeyDown!(keyboard("Enter"));
    detect();
    button.onBlur!({} as React.FocusEvent<HTMLButtonElement>);
    h.focused = false;
    win.dispatchEvent(new Event("blur"));
    vi.runOnlyPendingTimers();
    expect(submit).not.toHaveBeenCalled();
  });

  it("a new question invalidates pending blur submission before release", () => {
    const button = controls();
    button.onKeyDown!(keyboard("Enter"));
    detect();
    button.onBlur!({} as React.FocusEvent<HTMLButtonElement>);
    render({ captureKey: "q2" });
    vi.runOnlyPendingTimers();
    expect(submit).not.toHaveBeenCalled();
  });

  it("supports same-button screen-reader click start/finish without pointer or key events", () => {
    const button = controls();
    button.onClick!(click());
    const note = detect();
    button.onClick!(click());
    button.onClick!(click(1));
    expect(h.start).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledExactlyOnceWith(note);
  });

  it("does not start when disabled or with a secondary pointer", () => {
    controls(render({ disabled: true })).onPointerDown!(pointer());
    const button = controls();
    button.onPointerDown!(pointer(1, { button: 2 }));
    button.onPointerDown!(pointer(2, { isPrimary: false }));
    expect(h.start).not.toHaveBeenCalled();
  });

  it.each(SUPPORTED_LOCALES)(
    "reserves both status/control label heights without truncation in %s",
    (language) => {
      h.language = language;
      const ready = render();
      const button = controls(ready);
      button.onKeyDown!(keyboard(" "));
      detect();
      const listening = render();
      for (const tree of [ready, listening]) {
        const markup = renderToStaticMarkup(tree);
        expect(markup.match(/<button\b/g)).toHaveLength(1);
        expect(markup).not.toContain(
          getTranslation(language).microphone.submitDetectedNote,
        );
        expect(markup).not.toContain("truncate");
        const status = find(tree, "data-microphone-status")!;
        expect(status.props.className).toContain("inline-grid");
        for (const region of [status, find(tree, "data-microphone-hold")!]) {
          const text = renderToStaticMarkup(region);
          expect(text.match(/col-start-1 row-start-1/g)).toHaveLength(2);
          expect(
            text.match(/aria-hidden="true"/g)?.length,
          ).toBeGreaterThanOrEqual(1);
        }
      }
      const selected = renderToStaticMarkup(
        render({ selectedNote: { name: "A", octave: 4, accidental: null } }),
      );
      expect(selected).not.toContain(
        getTranslation(language).messages.yourAnswer,
      );
    },
  );
});
