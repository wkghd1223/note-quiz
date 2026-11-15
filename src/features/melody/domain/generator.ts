import { beatsPerMeasure } from "@/features/challenge/domain/stage";
import type {
  ExerciseDefinition,
  StageEvent,
} from "@/features/challenge/domain/stage";
import {
  getMelodyPitches,
  validateMelodySettings,
  type MelodySettings,
} from "./settings";

/** Mulberry32: one bounded draw per choice, no rejection/retry loop. */
function randomSource(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** 24 ticks per quarter represent sixteenths, single dots and eighth triplets. */
export const MELODY_TICKS_PER_BEAT = 24;
interface Rhythm {
  ticks: number;
  noteValue: NonNullable<StageEvent["noteValue"]>;
  dots: 0 | 1;
  triplet?: boolean;
}
const baseValues = new Map<number, Rhythm["noteValue"]>([
  [0.25, 16],
  [0.5, 8],
  [1, 4],
  [2, 2],
  [4, 1],
]);
const restRhythms: Rhythm[] = [...baseValues].flatMap(([beats, noteValue]) => [
  { ticks: beats * MELODY_TICKS_PER_BEAT, noteValue, dots: 0 as const },
  { ticks: beats * MELODY_TICKS_PER_BEAT * 1.5, noteValue, dots: 1 as const },
]);

/** Eight complete bars. Notes use selected bases and optional dotted variants;
 * triplets are independent, complete three-eighth groups on quarter boundaries.
 * Automatic rests use written standard/dotted lengths, independently of the note
 * palette. Prefer one beat of breath in bars 2/4/6; when a note occupies the full
 * bar, use one whole-bar breath in bar 4 instead. Otherwise insert only a single
 * necessary fitting rest per bar. No adjacent rests within a bar or cross-bar
 * notes/ties. Necessary written rests may touch across a bar boundary (e.g.
 * half-note-only 3/4).
 */
export function generateMelody(
  input: MelodySettings,
  seed: number,
): ExerciseDefinition {
  const validation = validateMelodySettings(input);
  if (!validation.valid)
    throw new Error(`invalidMelodySettings:${validation.errors.join(",")}`);
  if (!Number.isSafeInteger(seed)) throw new Error("invalidMelodySeed");
  const settings = validation.settings;
  const random = randomSource(seed);
  const pitches = getMelodyPitches(settings);
  const events: StageEvent[] = [];
  const barTicks = beatsPerMeasure(settings) * MELODY_TICKS_PER_BEAT;
  const rhythms: Rhythm[] = settings.durations
    .flatMap((beats) => {
      const plain: Rhythm = {
        ticks: beats * MELODY_TICKS_PER_BEAT,
        noteValue: baseValues.get(beats)!,
        dots: 0,
      };
      return settings.dotted
        ? [plain, { ...plain, ticks: plain.ticks * 1.5, dots: 1 as const }]
        : [plain];
    })
    .filter((rhythm) => rhythm.ticks <= barTicks);
  if (settings.triplets)
    rhythms.push({ ticks: 24, noteValue: 8, dots: 0, triplet: true });
  let previous = -1,
    identicalRun = 0;
  const id = `melody-${seed}-${settings.clef}-${encodeURIComponent(settings.keySignature)}-${settings.minMidi}-${settings.maxMidi}-${settings.durations.join("_")}-${settings.bpm}-${settings.timeSignature.join("_")}-${Number(settings.dotted)}-${Number(settings.triplets)}`;
  const pickPitch = () => {
    const candidates = pitches.map((pitch, index) => ({
      pitch,
      index,
      weight:
        previous < 0
          ? 1
          : index === previous
            ? identicalRun >= 2 && pitches.length > 1
              ? 0
              : 0.5
            : 1 / Math.pow(Math.abs(index - previous), 2),
    }));
    let choice =
      random() * candidates.reduce((sum, item) => sum + item.weight, 0);
    const selected =
      candidates.find((item) => (choice -= item.weight) < 0) ??
      candidates[candidates.length - 1];
    identicalRun = selected.index === previous ? identicalRun + 1 : 1;
    previous = selected.index;
    return selected.pitch;
  };
  for (let bar = 0; bar < 8; bar++) {
    // Reachability is memoized on bounded integer offsets, never random retries.
    const cache = new Map<string, boolean>();
    const fitting = (start: number, end: number) =>
      rhythms.filter(
        (rhythm) =>
          start + rhythm.ticks <= end && (!rhythm.triplet || start % 24 === 0),
      );
    const canFill = (start: number, end: number): boolean => {
      if (start === end) return true;
      const key = `${start}:${end}`;
      if (!cache.has(key))
        cache.set(
          key,
          fitting(start, end).some((rhythm) =>
            canFill(start + rhythm.ticks, end),
          ),
        );
      return cache.get(key)!;
    };
    const emit = (start: number, rhythm: Rhythm, kind: "note" | "rest") => {
      const groupId = `${id}-g${events.length}`;
      const count = rhythm.triplet ? 3 : 1;
      for (let index = 0; index < count; index++) {
        const ticks = rhythm.ticks / count;
        const pitch = kind === "note" ? pickPitch() : null;
        events.push({
          id: `${id}-e${events.length}`,
          kind,
          startBeat:
            (bar * barTicks + start + index * ticks) / MELODY_TICKS_PER_BEAT,
          durationBeats: ticks / MELODY_TICKS_PER_BEAT,
          noteValue: rhythm.noteValue,
          dots: rhythm.dots,
          ...(rhythm.triplet
            ? {
                tuplet: {
                  numerator: 3 as const,
                  denominator: 2 as const,
                  groupId,
                },
              }
            : {}),
          ...(pitch
            ? { writtenMidi: pitch.midi, writtenSpelling: pitch.spelling }
            : {}),
        });
      }
    };
    const emitNotes = (start: number, end: number) => {
      while (start < end) {
        const candidates = fitting(start, end).filter((rhythm) =>
          canFill(start + rhythm.ticks, end),
        );
        const rhythm = candidates[Math.floor(random() * candidates.length)];
        emit(start, rhythm, "note");
        start += rhythm.ticks;
      }
    };
    const straight = canFill(0, barTicks);
    const breathingBar = [1, 3, 5].includes(bar);
    if (!breathingBar && straight) {
      emitNotes(0, barTicks);
      continue;
    }
    const previousRest = events.at(-1)?.kind === "rest";
    const breaths = restRhythms.flatMap((rest) => {
      const positions: { start: number; rest: Rhythm }[] = [];
      for (let start = 0; start + rest.ticks <= barTicks; start++) {
        const end = start + rest.ticks;
        if (
          rest.ticks === barTicks ||
          (bar === 0 && start === 0) ||
          (bar === 7 && end === barTicks)
        )
          continue;
        if (canFill(0, start) && canFill(end, barTicks))
          positions.push({ start, rest });
      }
      return positions;
    });
    if (breaths.length) {
      // Prefer a short, useful breath near the bar end; necessary rests minimize
      // silence instead. Seeded note choices provide the rhythmic variation.
      breaths.sort(
        (a, b) =>
          (straight
            ? Math.abs(a.rest.ticks - 24) - Math.abs(b.rest.ticks - 24)
            : a.rest.ticks - b.rest.ticks) || b.start - a.start,
      );
      const breath = breaths[0];
      emitNotes(0, breath.start);
      emit(breath.start, breath.rest, "rest");
      emitNotes(breath.start + breath.rest.ticks, barTicks);
    } else if (bar === 3 && straight && !previousRest) {
      const rest = restRhythms.find((rhythm) => rhythm.ticks === barTicks)!;
      emit(0, rest, "rest");
    } else if (straight) emitNotes(0, barTicks);
    else throw new Error("unfillableMelodyBar");
  }
  return {
    id,
    lessonTags: ["pitch", "duration", "onset", "rest"],
    timeSignature: [...settings.timeSignature],
    measures: 8,
    bpm: settings.bpm,
    clef: settings.clef,
    keySignature: settings.keySignature,
    events,
    scoring: {
      version: 1,
      required: ["pitch", "duration", "onset", "rest"],
      thresholds: "normal-v1",
    },
    supportedInputProfiles: ["sustained-mic-v1"],
  };
}
