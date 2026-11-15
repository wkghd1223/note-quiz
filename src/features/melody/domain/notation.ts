import {
  beatsPerMeasure,
  type ExerciseDefinition,
  type StageEvent,
} from "@/features/challenge/domain/stage";
import { KEY_SIGNATURES } from "@/lib/music/constants";
import type { NotationEvent, NotationScore } from "@/lib/notation/score";

/** Legacy fixtures lack explicit engraving metadata; only known written values
 * are inferred. A floating tuplet duration must never become denominator 12.
 */
function writtenRhythm(
  event: StageEvent,
): Pick<NotationEvent, "duration" | "dots" | "tuplet"> {
  if (event.noteValue !== undefined)
    return {
      duration: event.noteValue,
      dots: event.dots ?? 0,
      ...(event.tuplet ? { tuplet: { ...event.tuplet } } : {}),
    };
  for (const duration of [1, 2, 4, 8, 16] as const) {
    if (event.durationBeats === 4 / duration) return { duration, dots: 0 };
    if (event.durationBeats === 6 / duration) return { duration, dots: 1 };
  }
  throw new Error("unsupportedWrittenDuration");
}

/** Pure mapper shared by random exercises and historical bar-level oracles. */
export function exerciseScore(exercise: ExerciseDefinition): NotationScore {
  const key = KEY_SIGNATURES[exercise.keySignature];
  if (!key) throw new Error("invalidKeySignature");
  const barBeats = beatsPerMeasure(exercise);
  return {
    clef: exercise.clef,
    keySignature: key.sharps.length - key.flats.length,
    timeSignature: {
      numerator: exercise.timeSignature[0],
      denominator: exercise.timeSignature[1],
    },
    showTimeSignature: true,
    bars: Array.from({ length: exercise.measures }, (_, bar) => {
      const navigation = exercise.barNavigation?.find(
        (entry) => entry.barIndex === bar,
      );
      return {
        repeatStart: navigation?.repeatStart,
        repeatCount:
          navigation?.repeatCount ?? (navigation?.repeatEnd ? 2 : undefined),
        directions: navigation?.directions,
      };
    }),
    events: exercise.events.map((event) => ({
      id: event.id,
      ...writtenRhythm(event),
      // Generated positions are exact tick quotients; epsilon only protects a
      // historical computed boundary from binary floating point roundoff.
      barIndex: Math.floor((event.startBeat + 1e-9) / barBeats),
      notes:
        event.kind === "rest"
          ? []
          : [
              {
                step: event.writtenSpelling![0] as NoteName,
                octave: Number(event.writtenSpelling!.match(/-?\d+$/)![0]),
                alter: event.writtenSpelling!.includes("#")
                  ? (1 as const)
                  : event.writtenSpelling!.includes("b")
                    ? (-1 as const)
                    : (0 as const),
                explicitAccidental: null,
                midi: event.writtenMidi!,
              },
            ],
    })),
  };
}
