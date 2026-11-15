import { describe, it, expect, vi } from "vitest";
import { createProgressSession } from "./progressSession";
import { PROGRESS_KEY } from "./progress";
describe("client-only shared in-memory progress", () => {
  it("does not access browser storage during creation or server rendering", () => {
    const getItem = vi.fn(() => null),
      s = createProgressSession({ getItem, setItem: vi.fn() });
    expect(s.getServerSnapshot().hydrated).toBe(false);
    expect(s.getSnapshot().hydrated).toBe(false);
    expect(getItem).not.toHaveBeenCalled();
    s.hydrate();
    s.hydrate();
    expect(getItem).toHaveBeenCalledTimes(1);
  });
  it("retains in-memory settings across subscriber route lifetimes when storage is blocked", () => {
    const s = createProgressSession({
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("blocked");
      },
    });
    const first = vi.fn(),
      unsubscribe = s.subscribe(first);
    s.hydrate();
    s.update((p) => ({ ...p, selectedInstrumentProfileId: "voice" }));
    unsubscribe();
    const next = vi.fn();
    s.subscribe(next);
    s.hydrate();
    expect(s.getSnapshot().progress.selectedInstrumentProfileId).toBe("voice");
    expect(s.getSnapshot().warning).toBe("unavailable");
    s.update((p) => ({ ...p, selectedInstrumentProfileId: "flute" }));
    expect(next).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(2);
  });
  it("keeps corrupt durable data untouched while sharing session progress until explicit reset", () => {
    let raw = "broken";
    const setItem = vi.fn((key: string, value: string) => {
      expect(key).toBe(PROGRESS_KEY);
      raw = value;
    });
    const s = createProgressSession({ getItem: () => raw, setItem });
    s.hydrate();
    s.update((p) => ({ ...p, selectedInstrumentProfileId: "voice" }));
    expect(s.getSnapshot().warning).toBe("corrupt");
    expect(s.getSnapshot().progress.selectedInstrumentProfileId).toBe("voice");
    expect(setItem).not.toHaveBeenCalled();
    s.reset();
    expect(setItem).toHaveBeenCalledOnce();
    expect(s.getSnapshot().warning).toBeNull();
  });
});
