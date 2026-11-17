import { KEY_SIGNATURES, NOTE_NAMES } from "@/lib/music/constants";
import { buildChord } from "@/lib/music/theory";
import { noteToMidi } from "@/lib/music/utils";
import type { ExerciseDefinition } from "@/features/challenge/domain/stage";

export type TonalMode = "major" | "minor";
const majorTonics = [
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "C#",
  "F",
  "Bb",
  "Eb",
  "Ab",
  "Db",
  "Gb",
  "Cb",
] as const;
const minorTonics = [
  "A",
  "E",
  "B",
  "F#",
  "C#",
  "D",
  "G",
  "C",
  "F",
  "Bb",
  "Eb",
  "Ab",
] as const;
export type TonalityId =
  | `${(typeof majorTonics)[number]}-major`
  | `${(typeof minorTonics)[number]}-minor`;
export interface Tonality {
  id: TonalityId;
  tonic: string;
  mode: TonalMode;
  keySignature: string;
}
const minorKeys = [
  "C",
  "G",
  "D",
  "A",
  "E",
  "F",
  "Bb",
  "Eb",
  "Ab",
  "Db",
  "Gb",
  "Cb",
];
export const melodyTonalities: readonly Tonality[] = [
  ...majorTonics.map(
    (tonic): Tonality => ({
      id: `${tonic}-major`,
      tonic,
      mode: "major",
      keySignature: tonic,
    }),
  ),
  ...minorTonics.map(
    (tonic, i): Tonality => ({
      id: `${tonic}-minor`,
      tonic,
      mode: "minor",
      keySignature: minorKeys[i],
    }),
  ),
];
export function getTonality(id: unknown): Tonality | undefined {
  return melodyTonalities.find((tonality) => tonality.id === id);
}
export const HARMONY_CATALOG_VERSION = 1;
export type PatternId =
  | "major-basic"
  | "major-cycle"
  | "major-two-five"
  | "major-contrast"
  | "major-descending"
  | "minor-basic"
  | "minor-cycle"
  | "minor-fifths"
  | "minor-contrast";
export type ProgressionChoice = "none" | "random" | PatternId;
type TriadQuality = "major" | "minor" | "diminished";
export interface HarmonyDegree {
  degree: number;
  quality: TriadQuality;
}
export interface HarmonyPattern {
  id: PatternId;
  mode: TonalMode;
  bars: readonly HarmonyDegree[];
}
const major = (degree: number): HarmonyDegree => ({ degree, quality: "major" });
const minor = (degree: number): HarmonyDegree => ({ degree, quality: "minor" });
const diminished = (degree: number): HarmonyDegree => ({
  degree,
  quality: "diminished",
});
export const melodyPatterns: readonly HarmonyPattern[] = [
  {
    id: "major-basic",
    mode: "major",
    bars: [
      major(1),
      major(4),
      major(5),
      major(1),
      major(1),
      major(4),
      major(5),
      major(1),
    ],
  },
  {
    id: "major-cycle",
    mode: "major",
    bars: [
      major(1),
      minor(6),
      major(4),
      major(5),
      major(1),
      major(4),
      major(5),
      major(1),
    ],
  },
  {
    id: "major-two-five",
    mode: "major",
    bars: [
      major(1),
      minor(6),
      minor(2),
      major(5),
      major(1),
      major(4),
      major(5),
      major(1),
    ],
  },
  {
    id: "major-contrast",
    mode: "major",
    bars: [
      major(1),
      major(5),
      minor(6),
      major(4),
      minor(2),
      major(5),
      major(1),
      major(1),
    ],
  },
  {
    id: "major-descending",
    mode: "major",
    bars: [
      major(1),
      major(5),
      major(4),
      minor(3),
      minor(2),
      major(5),
      major(1),
      major(1),
    ],
  },
  {
    id: "minor-basic",
    mode: "minor",
    bars: [
      minor(1),
      minor(4),
      major(5),
      minor(1),
      minor(1),
      minor(4),
      major(5),
      minor(1),
    ],
  },
  {
    id: "minor-cycle",
    mode: "minor",
    bars: [
      minor(1),
      major(6),
      minor(4),
      major(5),
      minor(1),
      minor(4),
      major(5),
      minor(1),
    ],
  },
  {
    id: "minor-fifths",
    mode: "minor",
    bars: [
      minor(1),
      minor(4),
      major(7),
      major(3),
      major(6),
      diminished(2),
      major(5),
      minor(1),
    ],
  },
  {
    id: "minor-contrast",
    mode: "minor",
    bars: [
      minor(1),
      major(6),
      major(3),
      major(7),
      minor(4),
      major(6),
      major(5),
      minor(1),
    ],
  },
];
export const patternsForTonality = (id: TonalityId) =>
  melodyPatterns.filter((pattern) => pattern.mode === getTonality(id)?.mode);
export function progressionLabel(pattern: HarmonyPattern): string {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII"];
  const labels = pattern.bars.map(({ degree, quality }) =>
    quality === "major"
      ? romans[degree - 1]
      : romans[degree - 1].toLowerCase() +
        (quality === "diminished" ? "°" : ""),
  );
  return `${labels.slice(0, 4).join("–")} / ${labels.slice(4).join("–")}`;
}
export interface MelodyPitch {
  midi: number;
  spelling: string;
}
export interface BarHarmony extends HarmonyDegree {
  barIndex: number;
  label: string;
  tones: readonly Note[];
}
export interface MelodyExercise extends ExerciseDefinition {
  harmony?: {
    catalogVersion: number;
    patternId: PatternId;
    tonalityId: TonalityId;
    bars: readonly BarHarmony[];
  };
}
export function patternHarmony(
  tonality: Tonality,
  pattern: HarmonyPattern,
): BarHarmony[] {
  const key = KEY_SIGNATURES[tonality.keySignature];
  const tonicIndex = NOTE_NAMES.indexOf(tonality.tonic[0] as NoteName);
  return pattern.bars.map(({ degree, quality }, barIndex) => {
    const name = NOTE_NAMES[(tonicIndex + degree - 1) % 7];
    const accidental = key.sharps.includes(name)
      ? "sharp"
      : key.flats.includes(name)
        ? "flat"
        : "natural";
    const root: Note = { name, octave: 4, accidental };
    const tones = buildChord(root, quality);
    const label =
      name +
      (accidental === "sharp" ? "#" : accidental === "flat" ? "b" : "") +
      (quality === "minor" ? "m" : quality === "diminished" ? "dim" : "");
    return { barIndex, degree, quality, label, tones };
  });
}
/** Transpose written letters, preserving octave spelling across B#/Cb. */
export function chordPitches(
  tones: readonly Note[],
  minMidi: number,
  maxMidi: number,
): MelodyPitch[] {
  return tones
    .flatMap((tone) =>
      Array.from({ length: 6 }, (_, i) => {
        const note = { ...tone, octave: (i + 2) as Octave };
        return {
          midi: noteToMidi(note),
          spelling: `${note.name}${note.accidental === "sharp" ? "#" : note.accidental === "flat" ? "b" : ""}${note.octave}`,
        };
      }),
    )
    .filter(({ midi }) => midi >= minMidi && midi <= maxMidi)
    .sort((a, b) => a.midi - b.midi);
}
