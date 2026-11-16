import { describe, expect, it } from "vitest";
import { nextOptionIndex, popoverPosition, typeaheadMatch } from "./popover-select-interaction";

describe("popover positioning", () => {
  const viewport = { width: 1280, height: 900 };
  const panel = { width: 288, height: 470 };
  it("aligns the trailing LTR edge and leading RTL edge with a six pixel gap", () => {
    const anchor = { left: 800, right: 960, top: 40, bottom: 84 };
    expect(popoverPosition(anchor, panel, viewport, false)).toEqual({ left: 672, top: 90 });
    expect(popoverPosition(anchor, panel, viewport, true)).toEqual({ left: 800, top: 90 });
  });
  it("uses above placement and keeps the panel inside the viewport", () => {
    expect(popoverPosition({ left: 1200, right: 1280, top: 800, bottom: 844 }, panel, viewport, true)).toEqual({ left: 984, top: 324 });
    expect(popoverPosition({ left: 0, right: 44, top: 0, bottom: 44 }, panel, { width: 320, height: 480 }, false)).toEqual({ left: 8, top: 8 });
  });
});

describe("option focus without selection", () => {
  it("wraps arrows and implements Home/End without inventing an empty option", () => {
    expect(nextOptionIndex(8, 9, "ArrowDown")).toBe(0);
    expect(nextOptionIndex(0, 9, "ArrowUp")).toBe(8);
    expect(nextOptionIndex(-1, 9, "ArrowUp")).toBe(8);
    expect(nextOptionIndex(4, 9, "Home")).toBe(0);
    expect(nextOptionIndex(4, 9, "End")).toBe(8);
    expect(nextOptionIndex(0, 0, "Home")).toBe(-1);
  });
  it("matches native names case insensitively, searches after focus and leaves misses explicit", () => {
    const names = ["English", "Español", "Português (Brasil)", "Русский"];
    expect(typeaheadMatch(names, "e", 0)).toBe(1);
    expect(typeaheadMatch(names, "EN", 1)).toBe(0);
    expect(typeaheadMatch(names, "РУ", 0)).toBe(3);
    expect(typeaheadMatch(names, "missing", 0)).toBe(-1);
    expect(typeaheadMatch([], "e", -1)).toBe(-1);
  });
});
