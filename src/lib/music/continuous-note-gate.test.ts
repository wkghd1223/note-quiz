import { describe, expect, it } from "vitest";
import {
  createContinuousNoteGate,
  type ContinuousNoteObservation,
} from "./continuous-note-gate";

type Gate = ReturnType<typeof createContinuousNoteGate>;
const observation = (
  ms: number,
  pitchKey: string | null = "A:4",
  overrides: Partial<ContinuousNoteObservation> = {},
) => ({
  timeSec: ms / 1000,
  pitchKey,
  quiet: false,
  eligible: true,
  questionKey: "q1",
  ...overrides,
});
function span(
  gate: Gate,
  start: number,
  end: number,
  pitch = "A:4",
  overrides = {},
) {
  return Array.from({ length: Math.floor((end - start) / 20) + 1 }, (_, i) =>
    gate.observe(observation(start + i * 20, pitch, overrides)),
  ).filter(Boolean).length;
}

describe("hands-free note submission gate (observed time, target independent)", () => {
  it("requires the same MIDI/octave for500ms and latches before returning one submission", () => {
    const gate = createContinuousNoteGate();
    expect(span(gate, 0, 480)).toBe(0);
    expect(gate.observe(observation(499))).toBe(false);
    expect(gate.observe(observation(500))).toBe(true);
    expect(span(gate, 520, 1600)).toBe(0);
  });
  it("never rearms a held answer on question/lock change or unpitched loud input", () => {
    const gate = createContinuousNoteGate();
    expect(span(gate, 0, 500)).toBe(1);
    expect(span(gate, 520, 1000, "A:4", { eligible: false })).toBe(0);
    expect(span(gate, 1020, 1600, "A:4", { questionKey: "q2" })).toBe(0);
    for (let ms = 1620; ms <= 1900; ms += 20)
      expect(gate.observe(observation(ms, null, { questionKey: "q2" }))).toBe(
        false,
      );
    expect(span(gate, 1920, 2500, "A:4", { questionKey: "q2" })).toBe(0);
  });
  it("rearms the same pitch only after120ms observed quiet, and still needs a fresh500ms", () => {
    const gate = createContinuousNoteGate();
    span(gate, 0, 500);
    for (let ms = 520; ms <= 620; ms += 20)
      gate.observe(observation(ms, null, { quiet: true }));
    expect(span(gate, 640, 1200)).toBe(0);
    for (let ms = 1220; ms <= 1340; ms += 20)
      gate.observe(observation(ms, null, { quiet: true, eligible: false }));
    expect(span(gate, 1360, 1840)).toBe(0);
    expect(gate.observe(observation(1860))).toBe(true);
  });
  it("allows a genuinely stable new legato pitch/octave while discarding a transient octave", () => {
    const gate = createContinuousNoteGate();
    span(gate, 0, 500);
    expect(span(gate, 520, 900, "A:5")).toBe(0);
    expect(span(gate, 920, 1500)).toBe(0);
    expect(span(gate, 1520, 2000, "A:3")).toBe(0);
    expect(gate.observe(observation(2020, "A:3"))).toBe(true);
  });
  it("does not queue locked candidates and restarts eligibility/question debounce", () => {
    const gate = createContinuousNoteGate();
    expect(span(gate, 0, 400)).toBe(0);
    expect(span(gate, 420, 1000, "A:4", { eligible: false })).toBe(0);
    expect(span(gate, 1020, 1400)).toBe(0);
    expect(span(gate, 1420, 1900, "A:4", { questionKey: "q2" })).toBe(0);
    expect(gate.observe(observation(1920, "A:4", { questionKey: "q2" }))).toBe(
      true,
    );
  });
  it.each(["gap", "duplicate", "backwards", "invalid", "unknown"])(
    "discards stale candidates on %s while preserving the voiced latch",
    (reason) => {
      const gate = createContinuousNoteGate();
      span(gate, 0, 400);
      if (reason === "gap") gate.observe(observation(1000));
      if (reason === "duplicate") gate.observe(observation(400));
      if (reason === "backwards") gate.observe(observation(399));
      if (reason === "invalid") gate.observe(observation(NaN));
      if (reason === "unknown") gate.observe(observation(420, null));
      const start = reason === "gap" ? 1020 : 440;
      expect(span(gate, start, start + 460)).toBe(0);
      expect(span(gate, start + 480, start + 520)).toBe(1);
      gate.observe(observation(start + 540, null));
      expect(span(gate, start + 560, start + 1200)).toBe(0);
    },
  );
});
