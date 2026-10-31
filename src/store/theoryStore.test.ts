import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTheoryStore } from "./theoryStore";
import { defaultConfig } from "@/lib/practice/config";
describe("theory session lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    useTheoryStore.getState().reset();
  });
  afterEach(() => {
    useTheoryStore.getState().reset();
    vi.useRealTimers();
  });
  it("accepts one answer per question and finishes after feedback on ten", () => {
    useTheoryStore.getState().start(defaultConfig("interval"));
    for (let i = 0; i < 10; i++) {
      const s = useTheoryStore.getState();
      expect(s.submit(s.current!.answer)).toBe(true);
      expect(useTheoryStore.getState().submit(s.current!.answer)).toBe(false);
      if (i === 9) expect(useTheoryStore.getState().state).toBe("playing");
      vi.advanceTimersByTime(900);
    }
    expect(useTheoryStore.getState().result?.totalQuestions).toBe(10);
    expect(useTheoryStore.getState().result?.completed).toBe(true);
  });
  it("uses exact timed boundary and ends once", () => {
    useTheoryStore
      .getState()
      .start(defaultConfig("chord"), { length: "timed", duration: 30 });
    useTheoryStore.getState().tick(31_250);
    const result = useTheoryStore.getState().result;
    expect(result?.totalTime).toBe(30000);
    useTheoryStore.getState().end();
    expect(useTheoryStore.getState().result).toBe(result);
  });
  it("old transition cannot advance new run", () => {
    useTheoryStore.getState().start(defaultConfig("interval"));
    const s = useTheoryStore.getState();
    s.submit(s.current!.answer);
    s.start(defaultConfig("chord"));
    const q = useTheoryStore.getState().current;
    vi.advanceTimersByTime(1000);
    expect(useTheoryStore.getState().current).toBe(q);
  });
  it("review is separate and retains missed type", () => {
    useTheoryStore.getState().start(defaultConfig("interval", "basic"));
    const s = useTheoryStore.getState();
    const wrong = s.current!.options.find((a) => a !== s.current!.answer)!;
    s.submit(wrong);
    s.end();
    s.review();
    expect(useTheoryStore.getState().kind).toBe("review");
    expect(useTheoryStore.getState().answers).toHaveLength(0);
    expect(useTheoryStore.getState().current?.type).toBe(s.current!.type);
  });
  it("free practice does not stop at ten", () => {
    useTheoryStore.getState().start(defaultConfig("chord"), { length: "free" });
    for (let i = 0; i < 11; i++) {
      const s = useTheoryStore.getState();
      s.submit(s.current!.answer);
      vi.advanceTimersByTime(900);
    }
    expect(useTheoryStore.getState().state).toBe("playing");
  });
});

describe("authoritative theory finish", () => {
  afterEach(() => useTheoryStore.getState().reset());
  it("clamps an explicit Finish after the timed boundary, before a tick", () => {
    const store = useTheoryStore.getState();
    store.start(defaultConfig("interval"), { length: "timed", duration: 30 });
    store.end(useTheoryStore.getState().startedAt + 30250);
    expect(useTheoryStore.getState().result).toMatchObject({
      totalTime: 30000,
      completed: true,
    });
  });
});
