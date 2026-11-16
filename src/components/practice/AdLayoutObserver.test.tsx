import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdLayoutObserver from "./AdLayoutObserver";

const harness = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
}));
vi.mock("react", () => ({
  useEffect: (effect: () => void | (() => void)) =>
    harness.effects.push(effect),
}));

// Native observer delivery and DOM geometry are controlled here; the mounted
// component, candidate discovery, mutation filtering and inset math are real.
class ElementFixture extends EventTarget {
  parentElement: ElementFixture | null = null;
  children: ElementFixture[] = [];
  className = "";
  attributes = new Set<string>();
  position = "static";
  rectangle = {
    left: 0,
    right: 390,
    top: 744,
    bottom: 844,
    width: 390,
    height: 100,
  };
  getBoundingClientRect = vi.fn(() => this.rectangle);

  append(child: ElementFixture) {
    child.parentElement = this;
    this.children.push(child);
  }
  remove(child: ElementFixture) {
    this.children = this.children.filter((candidate) => candidate !== child);
    child.parentElement = null;
  }
  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      const token = part.trim();
      return token.startsWith(".")
        ? this.className.split(" ").includes(token.slice(1))
        : this.attributes.has(token.slice(1, -1));
    });
  }
  contains(node: ElementFixture): boolean {
    return this === node || this.children.some((child) => child.contains(node));
  }
  closest(selector: string): ElementFixture | null {
    return this.matches(selector)
      ? this
      : (this.parentElement?.closest(selector) ?? null);
  }
  querySelectorAll(selector: string): ElementFixture[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class MutationFixture {
  static current: MutationFixture;
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(readonly callback: MutationCallback) {
    MutationFixture.current = this;
  }
  deliver(records: object[]) {
    this.callback(
      records as MutationRecord[],
      this as unknown as MutationObserver,
    );
  }
}
class ResizeFixture {
  static current: ResizeFixture;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(readonly callback: ResizeObserverCallback) {
    ResizeFixture.current = this;
  }
  deliver() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

let body: ElementFixture;
let rail: ElementFixture;
let windowEvents: EventTarget;
let documentEvents: EventTarget;
let visualEvents: EventTarget;
let queryAds: ReturnType<typeof vi.fn>;
let properties: Map<string, string>;
let frames: Map<number, FrameRequestCallback>;
let frameSerial: number;
let cleanup: (() => void) | undefined;

function mount() {
  AdLayoutObserver();
  cleanup = harness.effects[0]() || undefined;
  paint();
}
function paint() {
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(0);
}
function attribute(target: ElementFixture, attributeName = "style") {
  MutationFixture.current.deliver([
    { type: "attributes", target, attributeName },
  ]);
}
function childList(
  target: ElementFixture,
  addedNodes: ElementFixture[] = [],
  removedNodes: ElementFixture[] = [],
) {
  MutationFixture.current.deliver([
    { type: "childList", target, addedNodes, removedNodes },
  ]);
}
function footer(parent = body) {
  const wrapper = new ElementFixture();
  wrapper.className = "adunitwrapper";
  wrapper.position = "fixed";
  parent.append(wrapper);
  return wrapper;
}

beforeEach(() => {
  vi.useFakeTimers();
  harness.effects.length = 0;
  cleanup = undefined;
  properties = new Map();
  frames = new Map();
  frameSerial = 0;
  body = new ElementFixture();
  rail = new ElementFixture();
  body.append(rail);
  queryAds = vi.fn((selector: string) => body.querySelectorAll(selector));
  windowEvents = new EventTarget();
  documentEvents = new EventTarget();
  visualEvents = new EventTarget();
  vi.stubGlobal("Element", ElementFixture);
  vi.stubGlobal("MutationObserver", MutationFixture);
  vi.stubGlobal("ResizeObserver", ResizeFixture);
  vi.stubGlobal(
    "getComputedStyle",
    vi.fn((element: ElementFixture) => ({ position: element.position })),
  );
  vi.stubGlobal(
    "window",
    Object.assign(windowEvents, {
      innerWidth: 390,
      innerHeight: 844,
      visualViewport: Object.assign(visualEvents, {
        width: 390,
        height: 844,
        offsetLeft: 0,
        offsetTop: 0,
      }),
    }),
  );
  vi.stubGlobal(
    "document",
    Object.assign(documentEvents, {
      body,
      querySelectorAll: queryAds,
      documentElement: {
        style: {
          getPropertyValue: (name: string) => properties.get(name) ?? "",
          setProperty: (name: string, value: string) =>
            properties.set(name, value),
          removeProperty: (name: string) => properties.delete(name),
        },
      },
    }),
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      const id = ++frameSerial;
      frames.set(id, callback);
      return id;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => frames.delete(id)),
  );
});
afterEach(() => {
  cleanup?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("advertisement observation without practice-animation work", () => {
  it("does not search or measure ads for 60 unrelated rail transforms/recolors", () => {
    const wrapper = footer();
    mount();
    queryAds.mockClear();
    wrapper.getBoundingClientRect.mockClear();
    for (let frame = 0; frame < 60; frame++) {
      attribute(rail);
      attribute(rail, "class");
      const note = new ElementFixture();
      rail.append(note);
      childList(rail, [note]);
      paint();
    }
    expect(queryAds).not.toHaveBeenCalled();
    expect(wrapper.getBoundingClientRect).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it("remeasures ad styles and creative content using cached candidates", () => {
    const wrapper = footer();
    mount();
    expect(properties.get("--ad-bottom-inset")).toBe("116px");
    wrapper.rectangle = { ...wrapper.rectangle, top: 724, height: 120 };
    attribute(wrapper);
    const creative = new ElementFixture();
    wrapper.append(creative);
    childList(wrapper, [creative]);
    expect(frames.size).toBe(1);
    paint();
    expect(properties.get("--ad-bottom-inset")).toBe("136px");
    expect(queryAds).toHaveBeenCalledTimes(1);
  });

  it("reacts to an ad ancestor's positioning changes", () => {
    const ancestor = new ElementFixture();
    body.append(ancestor);
    const wrapper = footer(ancestor);
    wrapper.position = "static";
    ancestor.position = "fixed";
    mount();
    expect(properties.get("--ad-bottom-inset")).toBe("116px");
    ancestor.position = "static";
    attribute(ancestor, "class");
    paint();
    expect(properties.get("--ad-bottom-inset")).toBe("0px");
    expect(queryAds).toHaveBeenCalledTimes(1);
  });

  it("discovers a nested inserted wrapper and releases a removed subtree", () => {
    mount();
    const group = new ElementFixture();
    const wrapper = footer(group);
    body.append(group);
    childList(body, [group]);
    paint();
    expect(properties.get("--ad-bottom-inset")).toBe("116px");
    expect(ResizeFixture.current.observe).toHaveBeenCalledWith(wrapper);
    body.remove(group);
    childList(body, [], [group]);
    paint();
    expect(properties.get("--ad-bottom-inset")).toBe("0px");
    expect(ResizeFixture.current.unobserve).toHaveBeenCalledWith(wrapper);
  });

  it.each(["class", "data-slot-id", "data-slotid"])(
    "updates membership when %s is assigned and then removed",
    (name) => {
      const wrapper = new ElementFixture();
      wrapper.position = "fixed";
      body.append(wrapper);
      mount();
      expect(properties.get("--ad-bottom-inset")).toBe("0px");
      if (name === "class") wrapper.className = "adhesion_wrapper";
      else wrapper.attributes.add(name);
      attribute(wrapper, name);
      paint();
      expect(properties.get("--ad-bottom-inset")).toBe("116px");
      if (name === "class") wrapper.className = "unrelated";
      else wrapper.attributes.delete(name);
      attribute(wrapper, name);
      paint();
      expect(properties.get("--ad-bottom-inset")).toBe("0px");
      expect(ResizeFixture.current.unobserve).toHaveBeenCalledWith(wrapper);
    },
  );

  it("remeasures creative sizes without a mutation or full-document search", () => {
    const wrapper = footer();
    mount();
    wrapper.rectangle = { ...wrapper.rectangle, top: 694, height: 150 };
    ResizeFixture.current.deliver();
    paint();
    expect(properties.get("--ad-bottom-inset")).toBe("166px");
    expect(queryAds).toHaveBeenCalledTimes(1);
  });

  it("retains resize, document scroll and visual viewport updates", () => {
    const wrapper = footer();
    mount();
    for (const [events, type] of [
      [windowEvents, "resize"],
      [documentEvents, "scroll"],
      [visualEvents, "resize"],
      [visualEvents, "scroll"],
    ] as const) {
      wrapper.getBoundingClientRect.mockClear();
      events.dispatchEvent(new Event(type));
      paint();
      expect(wrapper.getBoundingClientRect).toHaveBeenCalledOnce();
    }
    Object.assign(window.visualViewport!, { height: 700 });
    wrapper.rectangle = {
      ...wrapper.rectangle,
      top: 620,
      bottom: 700,
      height: 80,
    };
    visualEvents.dispatchEvent(new Event("resize"));
    paint();
    expect(properties.get("--practice-viewport-height")).toBe("700px");
    expect(properties.get("--ad-bottom-inset")).toBe("96px");
    expect(queryAds).toHaveBeenCalledTimes(1);
  });

  it("keeps the one-second discovery fallback", () => {
    mount();
    footer();
    vi.advanceTimersByTime(1000);
    paint();
    expect(properties.get("--ad-bottom-inset")).toBe("116px");
    expect(queryAds).toHaveBeenCalledTimes(2);
  });

  it("retains the 160-candidate measurement and size-observation limit", () => {
    const wrappers = Array.from({ length: 161 }, () => footer());
    mount();
    expect(ResizeFixture.current.observe).toHaveBeenCalledTimes(160);
    expect(wrappers[159].getBoundingClientRect).toHaveBeenCalledOnce();
    expect(wrappers[160].getBoundingClientRect).not.toHaveBeenCalled();
  });

  it("cleans up observers, pending work, events, timer and owned CSS values", () => {
    const wrapper = footer();
    mount();
    attribute(wrapper);
    expect(frames.size).toBe(1);
    cleanup?.();
    cleanup = undefined;
    expect(MutationFixture.current.disconnect).toHaveBeenCalledOnce();
    expect(ResizeFixture.current.disconnect).toHaveBeenCalledOnce();
    expect(properties.size).toBe(0);
    expect(frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    attribute(wrapper);
    ResizeFixture.current.deliver();
    windowEvents.dispatchEvent(new Event("resize"));
    documentEvents.dispatchEvent(new Event("scroll"));
    visualEvents.dispatchEvent(new Event("resize"));
    expect(frames.size).toBe(0);
  });
});
