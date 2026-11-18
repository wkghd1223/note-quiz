import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MicrophoneInput from "./MicrophoneInput";
import { getTranslation } from "@/lib/i18n/translations";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locale";
import type { MicrophoneInputQuality } from "@/lib/music/input-quality";
import type { ContinuousMicrophoneCapture } from "@/hooks/useMicrophonePitch";

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
    inputQuality: "inactive" as MicrophoneInputQuality,
    detectedNote: null as Note | null,
    detectedLabel: "--",
    signalRef: { current: {} },
    currentNote: null as Note | null,
  },
  start: vi.fn(),
  stop: vi.fn(),
  continuousCapture: undefined as ContinuousMicrophoneCapture | undefined,
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
    sessionActive: true,
    sessionKey: "s1",
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
    inputQuality: "inactive",
    detectedNote: null,
    currentNote: null,
    detectedLabel: "--",
  });
  h.start.mockReset();
  h.stop.mockReset();
  h.continuousCapture = undefined;
  h.start.mockImplementation(
    async (continuous?: ContinuousMicrophoneCapture) => {
      h.continuousCapture = continuous;
      h.pitch.currentNote = null;
      h.pitch.detectedNote = null;
      h.pitch.detectedLabel = "--";
      h.pitch.isListening = true;
      return true;
    },
  );
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
    "shows shared input status without numeric pitch diagnostics in %s",
    (language) => {
      h.language = language;
      h.pitch.isListening = true;
      const t = getTranslation(language).microphone;
      for (const [quality, text] of [
        ["weak", t.inputWeak],
        ["uncertain", t.inputUncertain],
        ["clipping", t.inputClipping],
      ] as const) {
        h.pitch.isListening = true;
        h.pitch.inputQuality = quality;
        const markup = renderToStaticMarkup(render());
        expect(markup).toContain(text);
        expect(markup).toContain(`data-microphone-quality="${quality}"`);
        expect(markup).not.toMatch(/Hz|cents|¢|confidence/i);
      }
    },
  );

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
        expect(markup.match(/<button\b/g)).toHaveLength(2);
        expect(
          find(tree, "data-microphone-controls")!.props.className,
        ).toContain("grid-cols-2");
        expect(
          find(tree, "data-microphone-controls")!.props.className,
        ).toContain("items-stretch");
        const toggle = find(tree, "data-microphone-continuous")!;
        expect(renderToStaticMarkup(toggle)).toContain(
          getTranslation(language).microphone.continuousListening,
        );
        expect(toggle.props["aria-pressed"]).toBe(false);
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

function toggle(tree = render()) {
  return find(tree, "data-microphone-continuous")!
    .props as React.ButtonHTMLAttributes<HTMLButtonElement>;
}
describe("continuous microphone ownership", () => {
  it("preserves legacy hold-only consumers until they provide explicit session/output ownership", () => {
    const tree = render({ sessionKey: undefined });
    expect(find(tree, "data-microphone-continuous")).toBeUndefined();
    controls(tree).onKeyDown!(keyboard("Enter"));
    const note = detect();
    controls(tree).onKeyUp!(keyboard("Enter"));
    expect(submit).toHaveBeenCalledExactlyOnceWith(note);
  });
  it("blocks hands-free ON during app output while retaining hold's focused button-blur submission", () => {
    const tree = render({ continuousAllowed: () => false });
    expect(toggle(tree).disabled).toBe(true);
    toggle(tree).onClick!(click());
    expect(h.start).not.toHaveBeenCalled();
    const hold = controls(tree);
    hold.onKeyDown!(keyboard("Enter"));
    const note = detect();
    hold.onBlur!({} as React.FocusEvent<HTMLButtonElement>);
    vi.runOnlyPendingTimers();
    expect(submit).toHaveBeenCalledExactlyOnceWith(note);
  });
  it("uses a stable toggle label, retains one capture across questions/locks and rejects stale question callbacks", () => {
    const change = vi.fn();
    toggle(render({ onContinuousChange: change })).onClick!(click());
    const capture = h.continuousCapture!;
    expect(capture.getContext()).toEqual({ eligible: true, questionKey: "q1" });
    render({ disabled: true, captureKey: "q1", onContinuousChange: change });
    expect(capture.getContext().eligible).toBe(false);
    expect(h.pitch.isListening).toBe(true);
    const next = render({ captureKey: "q2", onContinuousChange: change });
    expect(capture.getContext()).toEqual({ eligible: true, questionKey: "q2" });
    capture.onSubmit(detect(), "q1");
    expect(submit).not.toHaveBeenCalled();
    const note = detect();
    capture.onSubmit(note, "q2");
    expect(submit).toHaveBeenCalledExactlyOnceWith(note);
    expect(toggle(next)["aria-pressed"]).toBe(true);
    expect(h.start).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledExactlyOnceWith(true, expect.any(Function));
  });
  it.each(["off", "pause", "session", "hidden", "windowblur", "unmount"])(
    "%s cancels continuous capture and late submissions",
    (reason) => {
      toggle().onClick!(click());
      const capture = h.continuousCapture!;
      if (reason === "off")
        toggle(render({ disabled: true })).onClick!(click());
      if (reason === "pause") render({ sessionActive: false });
      if (reason === "session") render({ sessionKey: "s2" });
      if (reason === "hidden") {
        doc.hidden = true;
        doc.dispatchEvent(new Event("visibilitychange"));
      }
      if (reason === "windowblur") {
        h.focused = false;
        win.dispatchEvent(new Event("blur"));
      }
      if (reason === "unmount") unmount();
      capture.onSubmit({ name: "A", octave: 4, accidental: null }, "q1");
      expect(capture.getContext().eligible).toBe(false);
      expect(submit).not.toHaveBeenCalled();
      expect(h.pitch.isListening).toBe(false);
    },
  );
  it("switches hold→continuous→hold without releasing a stale answer or owning two captures", () => {
    const hold = controls();
    hold.onPointerDown!(pointer());
    detect();
    toggle().onClick!(click());
    expect(submit).not.toHaveBeenCalled();
    const old = h.continuousCapture!;
    controls().onKeyDown!(keyboard("Enter"));
    expect(old.getContext().eligible).toBe(false);
    expect(submit).not.toHaveBeenCalled();
    expect(h.start).toHaveBeenCalledTimes(3);
    const note = detect();
    controls().onKeyUp!(keyboard("Enter"));
    expect(submit).toHaveBeenCalledExactlyOnceWith(note);
  });
  it("keeps OFF available while permission is pending or feedback is locked", async () => {
    let resolve!: (started: boolean) => void;
    h.start.mockImplementation(
      () =>
        new Promise<boolean>((yes) => {
          resolve = yes;
        }),
    );
    toggle().onClick!(click());
    const locked = toggle(render({ disabled: true }));
    expect(locked.disabled).toBe(false);
    expect(locked["aria-pressed"]).toBe(true);
    locked.onClick!(click());
    resolve(false);
    await Promise.resolve();
    expect(toggle()["aria-pressed"]).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });
  it("turns OFF after a failed/denied start without changing focus guards", async () => {
    h.start.mockResolvedValue(false);
    const change = vi.fn();
    toggle(render({ onContinuousChange: change })).onClick!(click());
    await Promise.resolve();
    expect(toggle()["aria-pressed"]).toBe(false);
    expect(change.mock.calls).toEqual([[true, expect.any(Function)], [false]]);
    h.focused = false;
    toggle().onClick!(click());
    expect(h.start).toHaveBeenCalledOnce();
  });
  it("reads the authoritative submit guard without restarting capture or assuming stale props are eligible", () => {
    let eligible = true;
    toggle(render({ canSubmit: () => eligible })).onClick!(click());
    const capture = h.continuousCapture!;
    eligible = false;
    capture.onSubmit(detect(), "q1");
    expect(capture.getContext().eligible).toBe(false);
    expect(submit).not.toHaveBeenCalled();
    expect(h.pitch.isListening).toBe(true);
  });
});
