import type { ImportedHead, ScoreClef, ScoreStep } from "./types";

export const steps: readonly ScoreStep[] = ["C", "D", "E", "F", "G", "A", "B"];
const natural = [0, 2, 4, 5, 7, 9, 11];
const sharpOrder = ["F", "C", "G", "D", "A", "E", "B"];
const mod = (n: number, divisor: number) => ((n % divisor) + divisor) % divisor;

export interface Spelling {
  step: ScoreStep;
  octave: number;
  alter: number;
}

export function staffPosition(pitch: Spelling) {
  return pitch.octave * 7 + steps.indexOf(pitch.step);
}

export function fromPosition(position: number, alter = 0): Spelling {
  return {
    step: steps[mod(position, 7)],
    octave: Math.floor(position / 7),
    alter,
  };
}

export function midiOf(pitch: Spelling) {
  return (
    12 * (pitch.octave + 1) + natural[steps.indexOf(pitch.step)] + pitch.alter
  );
}

export function keyAlter(step: ScoreStep, fifths: number) {
  if (!fifths) return 0;
  const i = sharpOrder.indexOf(step);
  const order = fifths > 0 ? i : 6 - i;
  return Math.sign(fifths) * Math.floor((Math.abs(fifths) + 6 - order) / 7);
}

export function shiftedKey(fifths: number, shift: number) {
  if (mod(shift, 12) === 0) return fifths;
  const target = mod(fifths * 7 + shift, 12);
  const choices = Array.from({ length: 15 }, (_, i) => i - 7).filter(
    (f) => mod(f * 7, 12) === target,
  );
  return choices.sort(
    (a, b) =>
      Math.abs(a) - Math.abs(b) || Math.abs(a - fifths) - Math.abs(b - fifths),
  )[0];
}

/** The same interval spelling is used in both directions, including enharmonic keys. */
function letterShift(fifths: number, shift: number) {
  const start = mod(fifths * 4, 7);
  const endFifths = shiftedKey(fifths, shift);
  const end = mod(endFifths * 4, 7);
  const startMidi = natural[start] + keyAlter(steps[start], fifths);
  const endMidi = natural[end] + keyAlter(steps[end], endFifths);
  return end - start + 7 * Math.round((shift + startMidi - endMidi) / 12);
}

export function displayedPitch(
  pitch: Spelling,
  fifths: number,
  shift: number,
): Spelling {
  const result = fromPosition(
    staffPosition(pitch) + letterShift(fifths, shift),
  );
  result.alter = midiOf(pitch) + shift - midiOf(result);
  return result;
}

export function sourcePitch(
  shown: Spelling,
  fifths: number,
  shift: number,
): Spelling {
  const result = fromPosition(
    staffPosition(shown) - letterShift(fifths, shift),
  );
  result.alter = midiOf(shown) - shift - midiOf(result);
  return result;
}

export function soundingShift(
  head: ImportedHead | undefined,
  semitones: number,
) {
  return semitones + (head ? Math.round(head.midi - midiOf(head)) : 0);
}

export function bottomStaffPosition(clef: ScoreClef) {
  const anchor =
    clef.sign === "F" ? 3 * 7 + 3 : clef.sign === "C" ? 4 * 7 : 4 * 7 + 4;
  return anchor + (clef.octaveChange ?? 0) * 7 - (clef.line - 1) * 2;
}

export function pitchLabel(p: Spelling) {
  const accidental =
    { "-2": "𝄫", "-1": "♭", "0": "", "1": "♯", "2": "𝄪" }[String(p.alter)] ??
    `(${p.alter > 0 ? "+" : ""}${p.alter})`;
  return `${p.step}${accidental}${p.octave}`;
}
