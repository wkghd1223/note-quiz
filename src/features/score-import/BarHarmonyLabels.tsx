import { memo } from "react";
import { displayedPitch, steps } from "./editor-pitch";
import { lineCursorX, type LineBar } from "./editor-layout";
import { scoreBeatOf } from "./model";
import { direct, first, value } from "./score-xml";
import type { ImportedBar, ScoreStep } from "./types";

const suffixes: Record<string, string> = {
  major: "",
  minor: "m",
  diminished: "dim",
  augmented: "aug",
  dominant: "7",
  "major-seventh": "maj7",
  "minor-seventh": "m7",
  "half-diminished": "ø7",
  "diminished-seventh": "dim7",
  "suspended-second": "sus2",
  "suspended-fourth": "sus4",
};

function degreeLabels(harmony: Element) {
  const labels: string[] = [];
  for (const degree of direct(harmony, "degree")) {
    if (degree.getAttribute("print-object") === "no") continue;
    const number = value(degree, "degree-value");
    const alter = Number(value(degree, "degree-alter") ?? 0);
    const type = value(degree, "degree-type");
    if (
      !number ||
      !/^\d+$/.test(number) ||
      !Number.isInteger(alter) ||
      Math.abs(alter) > 2
    )
      return null;
    if (type !== "add" && type !== "alter" && type !== "subtract") return null;
    const accidental = (alter < 0 ? "♭" : "♯").repeat(Math.abs(alter));
    const prefix =
      type === "subtract" ? "no" : type === "add" && !alter ? "add" : "";
    labels.push(prefix + accidental + number);
  }
  return labels.length ? "(" + labels.join(",") + ")" : "";
}

function pitchName(
  harmony: Element,
  tag: "root" | "bass",
  fifths: number,
  shift: number,
) {
  const pitch = first(harmony, tag);
  if (!pitch) return "";
  const step = value(pitch, tag + "-step") as ScoreStep;
  const alter = Number(value(pitch, tag + "-alter") ?? 0);
  if (!steps.includes(step) || !Number.isInteger(alter)) return "";
  const shown = displayedPitch({ step, alter, octave: 4 }, fifths, shift);
  return (
    shown.step +
    (shown.alter < 0 ? "♭" : "♯").repeat(Math.min(3, Math.abs(shown.alter)))
  );
}

/** The chord changes share the horizontal beat positions of the melody. */
export default memo(function BarHarmonyLabels({
  bar,
  staff,
  layout,
  semitones,
  top,
}: {
  bar: ImportedBar;
  staff: string;
  layout: LineBar;
  semitones: number;
  top: number;
}) {
  return direct(bar.source, "harmony").map((harmony, i) => {
    if (
      harmony.getAttribute("print-object") === "no" ||
      (value(harmony, "staff") ?? "1") !== staff
    )
      return null;
    const beat = scoreBeatOf(harmony);
    if (!Number.isFinite(beat) || beat < 0 || beat >= bar.duration) return null;
    const event = bar.events.findLast((e) => e.start <= beat);
    const fifths = event?.fifths ?? bar.fifths;
    const shift = semitones + (event?.transpose ?? bar.transpose ?? 0);
    const root = pitchName(harmony, "root", fifths, shift);
    const bass = pitchName(harmony, "bass", fifths, shift);
    const kind = first(harmony, "kind");
    const degrees = degreeLabels(harmony);
    if (degrees === null || direct(harmony, "kind").length > 1) return null;
    const name = root
      ? root +
        (kind?.getAttribute("text") ??
          suffixes[kind?.textContent?.trim() ?? "major"] ??
          kind?.textContent ??
          "")
      : value(harmony, "function");
    if (!name) return null;
    return (
      <text
        key={i}
        data-chord-label
        x={lineCursorX(bar, layout, beat) - layout.left - 5}
        y={top + 17}
        fontSize="13"
        fontWeight="600"
        fill="#475569"
        pointerEvents="none"
      >
        {name}
        {degrees}
        {bass && "/" + bass}
      </text>
    );
  });
});
