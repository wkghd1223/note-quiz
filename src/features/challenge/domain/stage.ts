import { validatePlaybackNavigation } from "./playback-order";

export type Skill = "pitch" | "duration" | "onset" | "rest" | "rearticulation";
export type InputProfileId =
  | "sustained-mic-v1"
  | "touch-keyboard-v1"
  | "onset-only-v1";
export interface StageEvent {
  id: string;
  kind: "note" | "rest";
  startBeat: number;
  durationBeats: number;
  writtenMidi?: number;
  writtenSpelling?: string;
  /** Written denominator, independent of performed quarter-note duration. */
  noteValue?: 1 | 2 | 4 | 8 | 16;
  dots?: 0 | 1;
  /** Three written eighths performed in the time of two eighths. */
  tuplet?: { numerator: 3; denominator: 2; groupId: string };
}
export type PlaybackDirection =
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
export interface BarNavigation {
  barIndex: number;
  repeatStart?: boolean;
  /** An end repeat defaults to two total passes. repeatCount also implies an end. */
  repeatEnd?: boolean;
  repeatCount?: number;
  /** segno/coda mark bar starts; Fine, To Coda and return instructions act at bar ends. */
  directions?: PlaybackDirection[];
}
export interface ExerciseDefinition {
  id: string;
  lessonTags: Skill[];
  timeSignature: [number, number];
  measures: number;
  bpm: number;
  clef: "treble" | "bass" | "alto" | "tenor";
  keySignature: string;
  events: StageEvent[];
  barNavigation?: BarNavigation[];
  scoring: {
    version: 1;
    required: Skill[];
    thresholds: "easy-v1" | "normal-v1";
  };
  supportedInputProfiles: InputProfileId[];
}
/** Fixed curriculum metadata is deliberately absent from random exercises. */
export interface StageDefinition extends ExerciseDefinition {
  world: 1 | 2 | 3 | 4;
  sequence: number;
  titleKey: string;
  objectiveKey: string;
  prerequisites: string[];
}
/** Timeline and BPM use quarter-note units, including compound meters. */
export function beatsPerMeasure(
  source: Pick<ExerciseDefinition, "timeSignature"> | readonly [number, number],
): number {
  const [numerator, denominator] =
    "timeSignature" in source ? source.timeSignature : source;
  if (
    !Number.isSafeInteger(numerator) ||
    numerator < 1 ||
    numerator > 32 ||
    ![1, 2, 4, 8, 16, 32].includes(denominator)
  )
    throw new Error("invalidTimeSignature");
  return (numerator * 4) / denominator;
}
const finite = (v: number) => Number.isFinite(v);
export function validateStages(stages: StageDefinition[]): string[] {
  const errors: string[] = [];
  const byId = new Map(stages.map((s) => [s.id, s]));
  if (byId.size !== stages.length) errors.push("duplicateStageId");
  for (const s of stages) {
    const report = (error: string) => errors.push(`${s.id}:${error}`);
    if (!/^w[1-4]-s[1-6]$/.test(s.id) || s.id !== `w${s.world}-s${s.sequence}`)
      report("identity");
    if (
      !Number.isInteger(s.measures) ||
      s.measures < 1 ||
      s.timeSignature[0] !== 4 ||
      s.timeSignature[1] !== 4
    )
      report("meter");
    if (!finite(s.bpm) || s.bpm <= 0 || s.scoring.version !== 1)
      report("scoringVersionOrTempo");
    if (
      !["pitch", "duration"].every((r) =>
        s.scoring.required.includes(r as Skill),
      )
    )
      report("mandatoryPitchDuration");
    if (!s.events.some((e) => e.kind === "note")) report("noNotes");
    let cursor = 0;
    const ids = new Set<string>();
    for (const e of s.events) {
      if (ids.has(e.id)) report("duplicateEventId");
      ids.add(e.id);
      if (
        !finite(e.startBeat) ||
        !finite(e.durationBeats) ||
        e.durationBeats <= 0 ||
        Math.abs(e.startBeat - cursor) > 1e-8
      )
        report("timelineCoverage");
      if (
        e.kind === "note" &&
        (!Number.isInteger(e.writtenMidi) ||
          e.writtenMidi! < 0 ||
          e.writtenMidi! > 127 ||
          !e.writtenSpelling)
      )
        report("pitch");
      if (
        e.kind === "rest" &&
        (e.writtenMidi !== undefined || e.writtenSpelling !== undefined)
      )
        report("restPitch");
      cursor = e.startBeat + e.durationBeats;
    }
    if (Math.abs(cursor - s.measures * 4) > 1e-8) report("measureDuration");
    for (const error of validatePlaybackNavigation(s)) report(error);
    if (!s.titleKey || !s.objectiveKey) report("translationKey");
    for (const p of s.prerequisites)
      if (!byId.has(p)) report("missingPrerequisite");
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) {
      errors.push(`${id}:prerequisiteCycle`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const p of byId.get(id)?.prerequisites ?? []) visit(p);
    visiting.delete(id);
    visited.add(id);
  };
  stages.forEach((s) => visit(s.id));
  return errors;
}
