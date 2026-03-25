const MIN_DETECTABLE_FREQUENCY = 65;
const MAX_DETECTABLE_FREQUENCY = 1047;
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
  sampleRate: number
): number | null {
  let rms = 0;

  for (let i = 0; i < buffer.length; i += 1) {
    rms += buffer[i] * buffer[i];
  }

  rms = Math.sqrt(rms / buffer.length);

  if (rms < MIN_SIGNAL_RMS) {
    return null;
  }

  let bestOffset = -1;
  let bestCorrelation = 0;
  let foundGoodCorrelation = false;

  const maxSamples = Math.floor(buffer.length / 2);

  for (let offset = 8; offset < maxSamples; offset += 1) {
    let correlation = 0;

    for (let i = 0; i < maxSamples; i += 1) {
      correlation += Math.abs(buffer[i] - buffer[i + offset]);
    }

    correlation = 1 - correlation / maxSamples;

    if (correlation > 0.9 && correlation > bestCorrelation) {
      foundGoodCorrelation = true;
      bestCorrelation = correlation;
      bestOffset = offset;
    } else if (foundGoodCorrelation) {
      break;
    }
  }

  if (bestOffset === -1) {
    return null;
  }

  const frequency = sampleRate / bestOffset;

  if (
    Number.isNaN(frequency) ||
    frequency < MIN_DETECTABLE_FREQUENCY ||
    frequency > MAX_DETECTABLE_FREQUENCY
  ) {
    return null;
  }

  return frequency;
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
