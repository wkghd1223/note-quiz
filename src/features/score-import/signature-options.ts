import { keyAlter, steps } from "./editor-pitch";
import type { ScoreClef } from "./types";

export const clefs: ScoreClef[] = [
  { sign: "G", line: 2 },
  { sign: "F", line: 4 },
  { sign: "C", line: 3 },
  { sign: "C", line: 4 },
];
export const signatureText = (n: number, d: number) => `${n}/${d}`;
export const clefKeys = ["treble", "bass", "alto", "tenor"] as const;
export const clefValue = (c: ScoreClef) =>
  [c.sign, c.line, ...(c.octaveChange ? [c.octaveChange] : [])].join(":");
export const meters = [
  "2/4",
  "3/4",
  "4/4",
  "2/2",
  "3/8",
  "6/8",
  "9/8",
  "12/8",
  "5/4",
  "7/8",
];

export function keyName(
  fifths: number,
  mode: string | undefined,
  m: { majorTonality: string; minorTonality: string },
) {
  const tonic = (degree: number) => {
    const step = steps[(((fifths * 4 + degree) % 7) + 7) % 7];
    const alter = keyAlter(step, fifths);
    return step + (alter === 1 ? "♯" : alter === -1 ? "♭" : "");
  };
  if (mode === "minor" || mode === "aeolian")
    return m.minorTonality.replace("{key}", tonic(5));
  if (mode === "major" || mode === "ionian")
    return m.majorTonality.replace("{key}", tonic(0));
  const signature = fifths
    ? `${Math.abs(fifths)}${fifths > 0 ? "♯" : "♭"}`
    : "♮";
  const modes = [
    "ionian",
    "dorian",
    "phrygian",
    "lydian",
    "mixolydian",
    "aeolian",
    "locrian",
  ];
  if (mode) {
    const degree = modes.indexOf(mode);
    return degree >= 0 ? tonic(degree) + " · " + mode : signature;
  }
  return signature + " · " + tonic(0) + " / " + tonic(5) + "m";
}
