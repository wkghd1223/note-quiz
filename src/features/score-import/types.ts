import type { BeatCueOptions } from "@/features/challenge/audio/beat-cues";

export type ScoreStep = "C" | "D" | "E" | "F" | "G" | "A" | "B";

export interface ScoreMeter {
  beats: number;
  beatType: number;
  displayBeats?: string;
  symbol?: "common" | "cut";
}

export interface ScoreClef {
  sign: string;
  line: number;
  octaveChange?: number;
}

export interface WrittenHead {
  id: string;
  source: Element;
  /** Explicit MusicXML notehead value, omitted for the instrument's default. */
  shape?: string;
  /** Quarter-note units. A secondary chord note can end before the next beat. */
  duration: number;
}

export interface ImportedUnpitchedHead extends WrittenHead {
  /** A staff position for engraving only. An omitted position uses the middle line. */
  display?: { step: ScoreStep; octave: number };
}

export interface ImportedHead extends WrittenHead {
  step: ScoreStep;
  octave: number;
  alter: number;
  /** Sounding pitch, including the instrument's written transposition. */
  midi: number;
}

export interface ImportedEvent {
  id: string;
  /** First note of this chord, or the rest element's enclosing note. */
  source: Element;
  /** Offset from the written bar start, in quarters. */
  start: number;
  duration: number;
  heads: ImportedHead[];
  /** Written percussion or speaking-voice notes have no sounding MIDI pitch. */
  unpitchedHeads?: ImportedUnpitchedHead[];
  noteType: string;
  dots: number;
  tuplet?: { actual: number; normal: number };
  /** Written attributes in force at the event, including mid-measure changes. */
  divisions: number;
  fifths: number;
  keyMode?: string;
  /** Instrument transposition at this written slot, including rests. */
  transpose?: number;
  clef: ScoreClef;
}

export interface ImportedBar {
  index: number;
  label: string;
  source: Element;
  duration: number;
  divisions: number;
  meter: ScoreMeter;
  clef: ScoreClef;
  fifths: number;
  /** Written key mode and instrument displacement at the bar opening. */
  keyMode?: string;
  transpose?: number;
  events: ImportedEvent[];
}

export interface ImportedLane {
  id: string;
  label: string;
  partId: string;
  staff: string;
  voice: string;
  bars: ImportedBar[];
}

export interface ScoreIssue {
  /** MusicXML construct or error category, never raw XML. */
  code: string;
  partId?: string;
  staff?: string;
  voice?: string;
  barIndex?: number;
  blocksPractice: boolean;
}

export type ScoreFormat = "musicxml" | "musescore" | "midi";

export interface ImportedScore {
  document: XMLDocument;
  file?: File;
  sourceFormat?: ScoreFormat;
  /** Printed excerpt retained for comparison with the editable recognition draft. */
  sourceExcerpt?: { image: Blob; page: number };
  /** A chosen melody head for each recognized chord the learner reduced. */
  practiceHeads?: ReadonlySet<Element>;
  title: string;
  lanes: ImportedLane[];
  issues: ScoreIssue[];
}

export interface ScoreOptions extends BeatCueOptions {
  fromBar: number;
  toBar: number;
  semitones: number;
  speed: number;
  repeats: boolean;
}

export interface ImportedTarget {
  id: string;
  eventId: string;
  barIndex: number;
  startSec: number;
  endSec: number;
  /** Empty for silence, otherwise all pitches sounding together. */
  midis: number[];
}

export interface ImportedTimeline {
  targets: ImportedTarget[];
  /** Written quarter-note position for each constant-tempo span in play order. */
  tempoSpans?: {
    barIndex: number;
    startBeat: number;
    startSec: number;
    endSec: number;
    quartersPerSecond: number;
  }[];
  sourceBpm?: number;
  beatCues?: { timeSec: number; kind: "bar" | "beat" }[];
  /** Each written note or rest retains its own cursor interval across ties. */
  cursor?: {
    barIndex: number;
    eventId: string;
    startSec: number;
    endSec: number;
  }[];
  visits?: { barIndex: number; startSec: number; endSec: number }[];
  notes: { midi: number; startSec: number; endSec: number }[];
  durationSec: number;
  countIn: { pulses: number; pulseSec: number };
}
