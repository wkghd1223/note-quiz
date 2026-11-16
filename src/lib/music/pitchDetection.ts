import { estimatePitch } from "./estimatePitch";

const MIN_DETECTABLE_FREQUENCY = 65;
// C6 is the top supported note. Include its upper half-semitone so a small
// estimation error does not reject C6 before nearest-note conversion.
const MAX_DETECTABLE_FREQUENCY = 1046.502261 * 2 ** (50 / 1200);
const MIN_SIGNAL_RMS = 0.015;

const CHROMATIC_NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
): number | null {
  const { hz, rms } = estimatePitch(buffer, sampleRate);
  return hz !== null &&
    rms >= MIN_SIGNAL_RMS &&
    hz >= MIN_DETECTABLE_FREQUENCY &&
    hz <= MAX_DETECTABLE_FREQUENCY
    ? hz
    : null;
}

export function frequencyToNote(frequency: number): Note | null {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return null;
  }

  const midi = Math.round(12 * Math.log2(frequency / 440) + 69);
  const noteName = CHROMATIC_NOTES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;

  if (octave < 0 || octave > 8) {
    return null;
  }

  return {
    name: noteName.replace("#", "") as NoteName,
    accidental: noteName.includes("#") ? "sharp" : "natural",
    octave: octave as Octave,
  };
}

export function getPitchKey(note: Note): string {
  const accidental = note.accidental === "sharp" ? "#" : "";
  return `${note.name}${accidental}`;
}

export function formatDetectedNote(note: Note | null): string {
  if (!note) {
    return "--";
  }

  const accidental = note.accidental === "sharp" ? "#" : "";
  return `${note.name}${accidental}${note.octave}`;
}
