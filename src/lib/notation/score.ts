/** Renderer-independent written music. Never used for answer validation or audio. */
export interface WrittenNote {
  step: NoteName;
  octave: number;
  alter: -1 | 0 | 1;
  explicitAccidental: Accidental | null;
  /** Sounding MIDI pitch, including the written accidental/key signature. */
  midi: number;
}

export interface NotationEvent {
  id: string;
  notes: readonly WrittenNote[];
  /** A denominator: 4 = quarter note. Empty notes = rest. */
  duration: 1 | 2 | 4 | 8 | 16;
  dots?: number;
  /** A complete eighth-triplet group, performed as three in the time of two. */
  tuplet?: { numerator: 3; denominator: 2; groupId: string };
  /** Zero-based bar, omitted for legacy one-bar exercises. */
  barIndex?: number;
}

export type NotationDirection =
  | "segno"
  | "coda"
  | "fine"
  | "toCoda"
  | "daCapo"
  | "daCapoAlFine"
  | "daCapoAlCoda"
  | "dalSegno"
  | "dalSegnoAlFine"
  | "dalSegnoAlCoda";

/** Engraving metadata only; performed repeat/jump expansion belongs to the caller. */
export interface NotationBar {
  repeatStart?: boolean;
  /** Total passes, including the first pass (2 means play twice). */
  repeatCount?: number;
  directions?: readonly NotationDirection[];
}

export interface NotationScore {
  /** Opt-in audio-time spacing, in native alphaTab units per quarter note. */
  timeSpacing?: { quarterWidth: number };
  clef: ClefType;
  /** Signed circle-of-fifths count, -7 (Cb) through +7 (C#). */
  keySignature: number;
  events: readonly NotationEvent[];
  timeSignature?: { numerator: number; denominator: number };
  showTimeSignature?: boolean;
  /** Indexed by the zero-based written bar, not performed occurrence. */
  bars?: readonly NotationBar[];
}

export type NotationEventColors = Readonly<Record<string, string>>;
export type NotationLayout = "page" | "horizontal";

export interface NotationEventBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** alphaTab's timely beat center, for aligning onset to a fixed playhead. */
  anchorX?: number;
}

export interface NotationMeasureBounds {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Timed body, excluding the initial clef/key/meter and visual barline inset. */
  timeStartX?: number;
  timeWidth?: number;
}

/** All coordinates use the view's SVG viewBox, not screen/CSS pixels. */
export interface NotationRenderResult {
  events: readonly NotationEventBounds[];
  width: number;
  height: number;
  /** Written-bar edges from alphaTab, in the same viewBox coordinates. */
  measures?: readonly NotationMeasureBounds[];
  /** Actual engraved width before clipping; useful for a horizontal rail. */
  contentWidth?: number;
}

const SEMITONES: Record<NoteName, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
export function writtenNote(
  note: Note,
  explicitAccidental: Accidental | null = note.accidental,
): WrittenNote {
  const alter =
    note.accidental === "sharp" ? 1 : note.accidental === "flat" ? -1 : 0;
  return {
    step: note.name,
    octave: note.octave,
    alter,
    explicitAccidental,
    midi: (note.octave + 1) * 12 + SEMITONES[note.name] + alter,
  };
}

export function notationRenderer(): "legacy" | "alphaTab" {
  return process.env.NEXT_PUBLIC_NOTATION_RENDERER === "legacy"
    ? "legacy"
    : "alphaTab";
}
