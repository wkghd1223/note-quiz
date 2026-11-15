import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeLocalStorage } from "./safeLocalStorage";

describe("safe local storage", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("skips only a value already present under the same key", () => {
    const write = vi.spyOn(localStorage, "setItem");
    safeLocalStorage.setItem("note", "one");
    safeLocalStorage.setItem("note", "one");
    expect(write).toHaveBeenCalledTimes(1);
    safeLocalStorage.setItem("ear", "one");
    safeLocalStorage.setItem("note", "two");
    expect(write).toHaveBeenCalledTimes(3);
    expect(safeLocalStorage.getItem("note")).toBe("two");
  });

  it("observes external overwrites, removal and clears without a stale cache", () => {
    safeLocalStorage.setItem("note", "original");
    localStorage.setItem("note", "external");
    const write = vi.spyOn(localStorage, "setItem");
    safeLocalStorage.setItem("note", "original");
    expect(write).toHaveBeenCalledTimes(1);
    safeLocalStorage.removeItem("note");
    expect(safeLocalStorage.getItem("note")).toBeNull();
    safeLocalStorage.setItem("note", "original");
    expect(write).toHaveBeenCalledTimes(2);
    localStorage.clear();
    safeLocalStorage.setItem("note", "original");
    expect(write).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem("note")).toBe("original");
  });

  it("still attempts a write when reading is blocked", () => {
    const read = vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    const write = vi.spyOn(localStorage, "setItem");
    expect(safeLocalStorage.getItem("note")).toBeNull();
    expect(() => safeLocalStorage.setItem("note", "value")).not.toThrow();
    expect(write).toHaveBeenCalledWith("note", "value");
    read.mockRestore();
    expect(localStorage.getItem("note")).toBe("value");
  });

  it("retries identical content after a failed write and failed removal", () => {
    const write = vi
      .spyOn(localStorage, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    expect(() => safeLocalStorage.setItem("note", "value")).not.toThrow();
    expect(localStorage.getItem("note")).toBeNull();
    safeLocalStorage.setItem("note", "value");
    expect(write).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("note")).toBe("value");
    vi.spyOn(localStorage, "removeItem").mockImplementationOnce(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    expect(() => safeLocalStorage.removeItem("note")).not.toThrow();
    expect(localStorage.getItem("note")).toBe("value");
    safeLocalStorage.removeItem("note");
    expect(localStorage.getItem("note")).toBeNull();
  });

  it("remains callable when localStorage itself is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(safeLocalStorage.getItem("note")).toBeNull();
    expect(() => safeLocalStorage.setItem("note", "value")).not.toThrow();
    expect(() => safeLocalStorage.removeItem("note")).not.toThrow();
  });
});
