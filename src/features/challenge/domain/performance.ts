export type InputMethod = "microphone" | "touch" | "midi";
export interface InputFrame {
  streamSampleIndex: number;
  audioTimeSec: number;
  rms: number;
  detectedHz: number | null;
  confidence: number;
  isVoiced: boolean;
}
export interface PitchSample {
  audioTimeSec: number;
  midi: number | null;
  cents: number | null;
  confidence: number;
}
export interface PerformanceEvent {
  eventId: string;
  inputMethod: InputMethod;
  onsetAudioSec: number;
  offsetAudioSec: number | null;
  observedMidi: number | null;
  medianCents: number | null;
  validPitchRatio: number;
  confidence: number;
  attackConfidence: number;
  pitchSamples?: PitchSample[];
}
export type PlaybackJumpKind = "repeat" | "daCapo" | "dalSegno" | "toCoda";
export interface PlaybackTransition {
  startAudioSec: number;
  endAudioSec: number;
  fromBar: number;
  toBar: number;
  kind: PlaybackJumpKind;
}
export interface TargetEvent {
  stageEventId: string;
  /** Present on expanded navigation targets; stageEventId identifies this visit. */
  sourceEventId?: string;
  sourceBarIndex?: number;
  visit?: number;
  occurrenceIndex?: number;
  targetConcertMidi: number | null;
  startAudioSec: number;
  endAudioSec: number;
  kind: "note" | "rest";
  requiresDistinctAttack: boolean;
}
export type ReasonCode =
  | "wrongPitch"
  | "tooShort"
  | "tooLong"
  | "early"
  | "late"
  | "missed"
  | "noSignal"
  | "unsupportedInput"
  | "missingAttack"
  | "restViolation";
export interface NoteResult {
  stageEventId: string;
  eventId: string | null;
  status: "passed" | "failed" | "missed" | "unscorable";
  pitchPass: boolean;
  durationPass: boolean;
  onsetPass: boolean;
  distinctAttackPass: boolean;
  reasons: ReasonCode[];
  pitchScore: number;
  durationScore: number;
  onsetScore: number | null;
}
export interface AttemptResult {
  scoringVersion: 1;
  score: number;
  stars: 0 | 1 | 2 | 3;
  cleared: boolean;
  notePassRate: number;
  unscorable: boolean;
  notes: NoteResult[];
  restViolations: string[];
  breakdown: { pitch: number; duration: number; onset: number | null };
}
