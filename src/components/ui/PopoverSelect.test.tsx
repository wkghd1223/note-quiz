import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PopoverSelect, { type PopoverSelectProps } from "./PopoverSelect";

// Node hook fixture exercises the actual effect/event wiring. Browser layout and
// native focus behavior are separately checked by verify-language-picker.cjs.
const hooks = vi.hoisted(() => ({
  cursor: 0, stateCursor: 0, refs: [] as Array<{ current: unknown }>,
  state: [false, -1] as unknown[], effects: [] as Array<() => void | (() => void)>,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useId: () => "picker-test",
  useRef: (initial: unknown) => hooks.refs[hooks.cursor++] ?? (hooks.refs[hooks.cursor - 1] = { current: initial }),
  useState: (initial: unknown) => {
    const index = hooks.stateCursor++;
    if (hooks.state[index] === undefined) hooks.state[index] = initial;
    return [hooks.state[index], (next: unknown) => { hooks.state[index] = next; }];
  },
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
}));

const options = [{ value: "en", label: "English" }, { value: "ru", label: "Русский" }] as const;
let props: PopoverSelectProps<string>;
const bodyStyle = new Map<string, { value: string; priority: string }>();
const target = new EventTarget();
const focus = vi.fn();
const panel = {
  open: false, style: { left: "", top: "", removeProperty: vi.fn() },
  showModal: vi.fn(() => { panel.open = true; }), close: vi.fn(() => { panel.open = false; }),
  getBoundingClientRect: () => ({ left: 100, right: 388, top: 90, bottom: 250, width: 288, height: 160 }),
};
const button = { isConnected: true, focus, getBoundingClientRect: () => ({ left: 200, right: 388, top: 40, bottom: 84 }) };
const item = () => ({ focus: vi.fn(), scrollIntoView: vi.fn() });
const items = [item(), item()];
const close = { focus: vi.fn() };

function render() {
  hooks.cursor = 0; hooks.stateCursor = 0; hooks.effects.length = 0;
  const tree = PopoverSelect(props);
  const [trigger, dialog] = tree.props.children;
  trigger.props.ref.current = button;
  dialog.props.ref.current = panel;
  dialog.props.children[0].props.children[1].props.ref.current = close;
  const rows = dialog.props.children[1].props.children;
  rows.forEach((row: React.ReactElement<{ ref: (value: unknown) => void }>, index: number) => row.props.ref(items[index]));
  return { trigger, dialog, rows };
}

beforeEach(() => {
  vi.clearAllMocks(); hooks.refs = []; hooks.state = [false, -1];
  bodyStyle.clear(); bodyStyle.set("overflow", { value: "clip", priority: "important" }); panel.open = false;
  props = { label: "Language", closeLabel: "Close", value: "en", options, onValueChange: vi.fn() };
  vi.stubGlobal("React", React);
  vi.stubGlobal("getComputedStyle", () => ({ direction: "ltr" }));
  vi.stubGlobal("document", { body: { style: {
    getPropertyValue: (key: string) => bodyStyle.get(key)?.value ?? "",
    getPropertyPriority: (key: string) => bodyStyle.get(key)?.priority ?? "",
    setProperty: (key: string, value: string, priority = "") => bodyStyle.set(key, { value, priority }),
    removeProperty: (key: string) => bodyStyle.delete(key),
  } }, activeElement: items[0] });
  vi.stubGlobal("window", { innerWidth: 1280, innerHeight: 900, matchMedia: () => ({ matches: true }), addEventListener: vi.fn(target.addEventListener.bind(target)), removeEventListener: vi.fn(target.removeEventListener.bind(target)) });
});
afterEach(() => vi.unstubAllGlobals());

describe("native modal lifecycle (Node effect fixture)", () => {
  it("announces the dialog popup and renders the RTL direction on the option button", () => {
    props.options = [options[0], { value: "rtl-fixture", label: "العربية", lang: "ar", dir: "rtl" }];
    const view = render();
    expect(view.trigger.props["aria-haspopup"]).toBe("dialog");
    expect(view.trigger.props["aria-controls"]).toBe(view.dialog.props.id);
    expect(renderToStaticMarkup(view.rows[1])).toMatch(/^<button\b[^>]*\bdir="rtl"/);
  });
  it("locks and restores the exact overflow, cleans listeners and tolerates StrictMode setup/cleanup/setup", () => {
    render().trigger.props.onClick(); render();
    const setup = hooks.effects[0];
    const cleanup = setup();
    expect(panel.showModal).toHaveBeenCalledOnce();
    expect(items[0].focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(bodyStyle.get("overflow")?.value).toBe("hidden");
    expect(window.addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), true);
    if (cleanup) cleanup();
    expect(bodyStyle.get("overflow")).toEqual({ value: "clip", priority: "important" });
    expect(window.removeEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), true);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    const secondCleanup = setup();
    expect(panel.open).toBe(true);
    if (secondCleanup) secondCleanup();
    expect(bodyStyle.get("overflow")).toEqual({ value: "clip", priority: "important" });
  });
  it("closes current-value selection without calling the consumer, and selects a different value once", () => {
    render().trigger.props.onClick();
    render().rows[0].props.onClick();
    expect(hooks.state[0]).toBe(false); expect(props.onValueChange).not.toHaveBeenCalled();
    render().trigger.props.onClick(); render().rows[1].props.onClick();
    expect(props.onValueChange).toHaveBeenCalledExactlyOnceWith("ru"); expect(hooks.state[0]).toBe(false);
  });
  it("leaves invalid values explicit, focuses close, and disables an empty picker", () => {
    props.value = "missing";
    let view = render();
    expect(view.trigger.props["aria-invalid"]).toBe(true);
    expect(view.trigger.props["aria-label"]).toBe("Language: missing");
    view.trigger.props.onClick(); render();
    const cleanup = hooks.effects[0]();
    expect(close.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(items[0].focus).not.toHaveBeenCalled();
    if (cleanup) cleanup();
    props.options = []; view = render();
    expect(view.trigger.props.disabled).toBe(true); expect(view.rows).toHaveLength(0);
    expect(props.onValueChange).not.toHaveBeenCalled();
  });
  it("does not interpret IME or modified input as typeahead, and preserves selected state while navigating", () => {
    const view = render();
    const event = (key: string, composing = false, ctrl = false) => ({ key, nativeEvent: { isComposing: composing }, keyCode: 0, ctrlKey: ctrl, preventDefault: vi.fn() });
    view.dialog.props.onKeyDown(event("r", true)); view.dialog.props.onKeyDown(event("r", false, true));
    expect(items[1].focus).not.toHaveBeenCalled();
    view.dialog.props.onKeyDown(event("ArrowDown"));
    expect(items[0].focus).toHaveBeenCalled(); expect(props.onValueChange).not.toHaveBeenCalled();
    expect(view.rows[0].props["aria-checked"]).toBe(true);
    expect(view.rows[1].props["aria-checked"]).toBe(false);
  });
});
