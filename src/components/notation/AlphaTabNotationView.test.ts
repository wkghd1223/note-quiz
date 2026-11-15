import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { LayoutMode, SystemsLayoutMode, model } from "@coderline/alphatab";
import AlphaTabNotationView, {
  type AlphaTabNotationViewProps,
} from "./AlphaTabNotationView";
import { writtenNote, type NotationScore } from "@/lib/notation/score";

interface Emitter<T> {
  on: (handler: (value: T) => void) => void;
  trigger: (value: T) => void;
}
interface ApiProbe {
  options: {
    core: { smuflFontSources: Map<unknown, string> };
    display: {
      layoutMode: LayoutMode;
      systemsLayoutMode: SystemsLayoutMode;
      resources: { staffLineColor: string };
    };
  };
  renderScore: Mock<
    (
      score: model.Score,
      tracks?: number[],
      hints?: { reuseViewport?: boolean },
    ) => void
  >;
  destroy: Mock<() => void>;
  renderer: { width: number; resizeRender: Mock<() => void> };
  error: Emitter<Error>;
  renderFinished: Emitter<{ totalWidth: number; totalHeight: number }>;
  postRenderFinished: Emitter<void>;
}
const harness = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  refCursor: 0,
  effectCursor: 0,
  effects: [] as { deps?: readonly unknown[]; cleanup?: () => void }[],
  pending: [] as (() => void)[],
  apis: [] as ApiProbe[],
  resize: undefined as (() => void) | undefined,
  frames: [] as FrameRequestCallback[],
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef: (initial: unknown) => {
      const index = harness.refCursor++;
      return (harness.refs[index] ??= { current: initial });
    },
    useEffect: (
      effect: () => void | (() => void),
      deps?: readonly unknown[],
    ) => {
      const index = harness.effectCursor++,
        previous = harness.effects[index];
      if (
        !previous ||
        !deps ||
        !previous.deps ||
        deps.some((value, i) => !Object.is(value, previous.deps![i]))
      ) {
        harness.effects[index] = { ...previous, deps };
        harness.pending.push(() => {
          previous?.cleanup?.();
          const cleanup = effect();
          harness.effects[index].cleanup =
            typeof cleanup === "function" ? cleanup : undefined;
        });
      }
    },
  };
});
vi.mock("@coderline/alphatab", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@coderline/alphatab")>();
  const emitter = <T>(): Emitter<T> => {
    const handlers: ((value: T) => void)[] = [];
    return {
      on: (handler) => {
        handlers.push(handler);
      },
      trigger: (value) => handlers.forEach((handler) => handler(value)),
    };
  };
  return {
    ...actual,
    AlphaTabApi: class {
      renderScore = vi.fn();
      destroy = vi.fn();
      renderer = { width: 0, resizeRender: vi.fn() };
      error = emitter<Error>();
      renderFinished = emitter<{ totalWidth: number; totalHeight: number }>();
      postRenderFinished = emitter<void>();
      boundsLookup = null;
      constructor(
        _element: unknown,
        readonly options: ApiProbe["options"],
      ) {
        harness.apis.push(this);
      }
    },
  };
});

let observedWidth: number;
let host: {
  style: Record<string, string>;
  dataset: Record<string, string>;
  replaceChildren: Mock;
  closest: Mock;
  querySelectorAll: Mock;
};
beforeEach(() => {
  harness.refs = [];
  harness.effects = [];
  harness.pending = [];
  harness.apis = [];
  harness.frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    harness.frames.push(callback);
    return harness.frames.length;
  });
  observedWidth = 620;
  host = {
    style: {},
    dataset: {},
    replaceChildren: vi.fn(),
    closest: vi.fn(() => ({
      getBoundingClientRect: () => ({ width: observedWidth }),
    })),
    querySelectorAll: vi.fn(() => []),
  };
  harness.refs[0] = { current: host };
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        harness.resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  for (const effect of harness.effects) effect.cleanup?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const score = (): NotationScore => ({
  clef: "treble",
  keySignature: 0,
  events: [
    {
      id: "written-a",
      duration: 4,
      notes: [writtenNote({ name: "C", octave: 4, accidental: null })],
    },
  ],
});
function render(props: AlphaTabNotationViewProps) {
  harness.refCursor = 0;
  harness.effectCursor = 0;
  AlphaTabNotationView(props);
  for (const effect of harness.pending.splice(0)) effect();
}
function finish(api: ApiProbe, totalWidth = 800, totalHeight = 200) {
  api.renderFinished.trigger({ totalWidth, totalHeight });
  api.postRenderFinished.trigger();
}
function color(api: ApiProbe, call: number) {
  return api.renderScore.mock.calls[
    call
  ][0].tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].style?.colors.get(
    model.NoteSubElement.StandardNotationNoteHead,
  )?.rgba;
}

describe("optional renderer lifecycle", () => {
  it("keeps default fitted page geometry and staff contrast", async () => {
    render({ score: score(), width: 620, height: 260 });
    await vi.waitFor(() => expect(harness.apis).toHaveLength(1));
    const api = harness.apis[0];
    await vi.waitFor(() => expect(api.renderScore).toHaveBeenCalledOnce());
    expect(api.options.display.layoutMode).toBe(LayoutMode.Page);
    expect(api.options.display.resources.staffLineColor).toBe("#64748b");
    finish(api);
    expect(host.style.transform).toBe("translate(0px, 52.5px) scale(0.775)");
  });

  it("extends a truly empty basic bar with native model weights and waits for its refit", async () => {
    const input = { ...score(), events: [] },
      onRender = vi.fn();
    render({
      score: input,
      fittedBasic: true,
      width: 299,
      height: 112,
      onRender,
    });
    await vi.waitFor(() => expect(harness.apis).toHaveLength(1));
    expect(harness.apis[0].renderScore).not.toHaveBeenCalled();
    expect(harness.frames).toHaveLength(1);
    for (const callback of harness.frames.splice(0)) callback(0);
    await vi.waitFor(() =>
      expect(harness.apis[0]?.renderScore).toHaveBeenCalledOnce(),
    );
    const api = harness.apis[0];
    expect(api.options.display.systemsLayoutMode).toBe(
      SystemsLayoutMode.UseModelLayout,
    );
    expect(
      api.renderScore.mock.calls[0][0].tracks[0].staves[0].bars[0].voices[0]
        .beats,
    ).toHaveLength(0);
    finish(api, 299, 144);
    expect(api.renderer.width).toBe(332);
    expect(api.renderer.resizeRender).toHaveBeenCalledOnce();
    expect(onRender).not.toHaveBeenCalled();
    expect(host.dataset.rendered).toBe("false");
    finish(api, 332, 144);
    expect(onRender).toHaveBeenCalledOnce();
    expect(host.style.transform).toContain(`scale(${112 / 144})`);
    expect(host.dataset.rendered).toBe("true");
    expect(host.dataset.eventPitches).toBe("");
    expect(api.renderScore).toHaveBeenCalledOnce();
  });

  it("caps a desktop basic staff length while preserving native glyph scale", async () => {
    const onRender = vi.fn();
    render({
      score: score(),
      fittedBasic: true,
      width: 708,
      height: 184,
      onRender,
    });
    await vi.waitFor(() => expect(harness.apis).toHaveLength(1));
    for (const callback of harness.frames.splice(0)) callback(0);
    await vi.waitFor(() =>
      expect(harness.apis[0]?.renderScore).toHaveBeenCalledOnce(),
    );
    const api = harness.apis[0];
    finish(api, 708, 172);
    expect(api.renderer.width).toBe(584);
    finish(api, 584, 172);
    expect(host.style.transform).toBe("translate(62px, 6px) scale(1)");
    expect(onRender).toHaveBeenCalledOnce();
  });

  it.each(["horizontal", "timeSpacing", "multipleBars"])(
    "does not alter %s layout when basic fitting is requested",
    async (kind) => {
      const input = score();
      if (kind === "timeSpacing") input.timeSpacing = { quarterWidth: 120 };
      if (kind === "multipleBars")
        input.events = [{ ...input.events[0], barIndex: 1 }];
      render({
        score: input,
        fittedBasic: true,
        layout: kind === "horizontal" ? "horizontal" : "page",
      });
      await vi.waitFor(() =>
        expect(harness.apis[0]?.renderScore).toHaveBeenCalledOnce(),
      );
      const api = harness.apis[0];
      expect(api.options.display.systemsLayoutMode).toBe(
        SystemsLayoutMode.Automatic,
      );
      finish(api);
      expect(api.renderer.resizeRender).not.toHaveBeenCalled();
      expect(host.dataset.rendered).toBe("true");
    },
  );

  it("uses existing error recovery if native basic refitting fails", async () => {
    const onError = vi.fn(),
      onRender = vi.fn();
    render({
      score: score(),
      fittedBasic: true,
      width: 299,
      height: 112,
      onError,
      onRender,
    });
    await vi.waitFor(() => expect(harness.apis).toHaveLength(1));
    for (const callback of harness.frames.splice(0)) callback(0);
    await vi.waitFor(() =>
      expect(harness.apis[0]?.renderScore).toHaveBeenCalledOnce(),
    );
    const api = harness.apis[0];
    api.renderer.resizeRender.mockImplementation(() => {
      throw new Error("Native resize failed");
    });
    finish(api, 299, 172);
    expect(onError).toHaveBeenCalledOnce();
    expect(api.destroy).toHaveBeenCalledOnce();
    expect(onRender).not.toHaveBeenCalled();
  });

  it("queues latest native colors on the same API and retains them on resize", async () => {
    const input = score(),
      changed = score(),
      onRender = vi.fn();
    changed.events = [
      {
        ...changed.events[0],
        notes: [writtenNote({ name: "G", octave: 4, accidental: null })],
      },
    ];
    render({
      score: input,
      layout: "horizontal",
      eventColors: { "written-a": "#15803d" },
      onRender,
    });
    await vi.waitFor(() =>
      expect(harness.apis[0]?.renderScore).toHaveBeenCalledOnce(),
    );
    const api = harness.apis[0];
    expect(api.options.display.layoutMode).toBe(LayoutMode.Horizontal);
    render({
      score: changed,
      layout: "horizontal",
      eventColors: { "written-a": "#dc2626" },
      onRender,
    });
    finish(api);
    expect(api.renderScore).toHaveBeenCalledTimes(2);
    expect(color(api, 0)).toBe("#15803D");
    expect(color(api, 1)).toBe("#DC2626");
    expect(
      api.renderScore.mock.calls[1][0].tracks[0].staves[0].bars[0].voices[0]
        .beats[0].notes[0].realValue,
    ).toBe(67);
    expect(onRender).not.toHaveBeenCalled();
    finish(api);
    expect(onRender).toHaveBeenCalledOnce();
    expect(host.style.transform).toBe("translate(0px, 30px) scale(1)");
    expect(onRender.mock.calls[0][0]).toMatchObject({
      width: 620,
      height: 260,
      contentWidth: 800,
    });
    render({
      score: changed,
      layout: "horizontal",
      eventColors: { "written-a": "#dc2626" },
      onRender,
    });
    expect(api.renderScore).toHaveBeenCalledTimes(2);
    vi.useFakeTimers();
    observedWidth = 720;
    harness.resize!();
    await vi.advanceTimersByTimeAsync(80);
    expect(api.renderScore).toHaveBeenCalledTimes(3);
    expect(color(api, 2)).toBe("#DC2626");
    finish(api);
    expect(harness.apis).toHaveLength(1);
    expect(api.destroy).not.toHaveBeenCalled();
    for (const effect of harness.effects) effect.cleanup?.();
    harness.effects = [];
    expect(api.destroy).toHaveBeenCalledOnce();
    expect(host.replaceChildren).toHaveBeenCalledOnce();
  });

  it("retains visible native engraving during color-only judgments without clearing its viewport", async () => {
    const input = score(),
      onRender = vi.fn();
    render({ score: input, layout: "horizontal", onRender });
    await vi.waitFor(() =>
      expect(harness.apis[0]?.renderScore).toHaveBeenCalledOnce(),
    );
    const api = harness.apis[0];
    finish(api);
    const transform = host.style.transform;
    expect(host.style.visibility).toBe("visible");
    render({
      score: input,
      layout: "horizontal",
      eventColors: { "written-a": "#15803d" },
      onRender,
    });
    expect(api.renderScore).toHaveBeenCalledTimes(2);
    expect(api.renderScore.mock.calls[1][2]).toEqual({ reuseViewport: true });
    expect(host.style.visibility).toBe("visible");
    expect(host.style.transform).toBe(transform);
    expect(host.replaceChildren).not.toHaveBeenCalled();
    // A newer judgment while the worker is busy must retain the same visible
    // staff until the final queued color map is rendered.
    render({
      score: input,
      layout: "horizontal",
      eventColors: { "written-a": "#dc2626" },
      onRender,
    });
    finish(api);
    expect(api.renderScore).toHaveBeenCalledTimes(3);
    expect(api.renderScore.mock.calls[2][2]).toEqual({ reuseViewport: true });
    expect(host.style.visibility).toBe("visible");
    expect(onRender).toHaveBeenCalledOnce();
    finish(api);
    expect(host.style.transform).toBe(transform);
    expect(color(api, 2)).toBe("#DC2626");
    expect(onRender).toHaveBeenCalledTimes(2);
    // A layout change must not opt into a stale engraving's viewport.
    vi.useFakeTimers();
    observedWidth = 720;
    harness.resize!();
    await vi.advanceTimersByTimeAsync(80);
    expect(api.renderScore.mock.calls[3][2]).toBeUndefined();
    expect(host.style.visibility).toBe("hidden");
  });

  it("routes an invalid color update through the existing error recovery", async () => {
    const input = score(),
      onError = vi.fn();
    render({ score: input, layout: "horizontal", onError });
    await vi.waitFor(() =>
      expect(harness.apis[0]?.renderScore).toHaveBeenCalledOnce(),
    );
    const api = harness.apis[0];
    finish(api);
    render({
      score: input,
      layout: "horizontal",
      eventColors: { "written-a": "rgb(" },
      onError,
    });
    expect(onError).toHaveBeenCalledOnce();
    expect(api.destroy).toHaveBeenCalledOnce();
    expect(api.renderScore).toHaveBeenCalledOnce();
  });

  it("retains bounded failure and public font-source retries, ignoring late events", async () => {
    const input = score(),
      onError = vi.fn(),
      onRender = vi.fn();
    vi.useFakeTimers();
    render({ score: input, layout: "horizontal", onError, onRender });
    await vi.waitFor(() =>
      expect(harness.apis[0]?.renderScore).toHaveBeenCalledOnce(),
    );
    const first = harness.apis[0],
      initialSources = [...first.options.core.smuflFontSources.values()];
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].message).toBe(
      "Notation rendering timed out",
    );
    expect(first.destroy).toHaveBeenCalledOnce();
    finish(first);
    expect(onRender).not.toHaveBeenCalled();
    for (const effect of harness.effects) effect.cleanup?.();
    harness.effects = [];
    harness.refs = [{ current: host }];
    vi.useRealTimers();
    render({ score: input, layout: "horizontal", onError, onRender });
    await vi.waitFor(() =>
      expect(harness.apis[1]?.renderScore).toHaveBeenCalledOnce(),
    );
    const retriedSources = [
      ...harness.apis[1].options.core.smuflFontSources.values(),
    ];
    expect(retriedSources).not.toEqual(initialSources);
    expect(retriedSources.every((url) => /\?retry=\d+$/.test(url))).toBe(true);
    finish(harness.apis[1]);
    expect(onRender).toHaveBeenCalledOnce();
  });
});
