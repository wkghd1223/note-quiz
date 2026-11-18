import { describe, expect, it } from "vitest";
import {
  bottomStaffPosition,
  displayedPitch,
  fromPosition,
  keyAlter,
  midiOf,
  shiftedKey,
  sourcePitch,
  staffPosition,
} from "./editor-pitch";
import type { Spelling } from "./editor-pitch";

describe("dragging written pitches in a transposed score", () => {
  it("saves the note one staff step above the displayed transposed D as D in the original key", () => {
    const middleC: Spelling = { step: "C", octave: 4, alter: 0 };
    const shown = displayedPitch(middleC, 0, 2);
    expect(shown).toEqual({ step: "D", octave: 4, alter: 0 });
    const moved = fromPosition(staffPosition(shown) + 1);
    moved.alter = keyAlter(moved.step, shiftedKey(0, 2));
    expect(sourcePitch(moved, 0, 2)).toEqual({
      step: "D",
      octave: 4,
      alter: 0,
    });
  });

  it("preserves the pitch and spelling across flat keys and octave boundaries", () => {
    const note: Spelling = { step: "C", octave: 4, alter: -1 };
    for (const key of [-7, -3, 0, 4, 7])
      for (const shift of [-14, -6, -1, 0, 1, 6, 19]) {
        const shown = displayedPitch(note, key, shift);
        expect(midiOf(shown)).toBe(midiOf(note) + shift);
        expect(sourcePitch(shown, key, shift)).toEqual(note);
      }
  });

  it("maps the same concert pitch to a different vertical position after a clef change", () => {
    expect(bottomStaffPosition({ sign: "G", line: 2 })).toBe(
      staffPosition({ step: "E", octave: 4, alter: 0 }),
    );
    expect(bottomStaffPosition({ sign: "F", line: 4 })).toBe(
      staffPosition({ step: "G", octave: 2, alter: 0 }),
    );
    expect(bottomStaffPosition({ sign: "C", line: 3 })).toBe(
      staffPosition({ step: "F", octave: 3, alter: 0 }),
    );
  });
});
