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
