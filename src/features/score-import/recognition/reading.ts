import { fromPosition, keyAlter } from "../editor-pitch";
import type { ScoreMeter } from "../types";

export interface ReadingContext {
  clef: "G" | "F";
  fifths: number;
  meter: ScoreMeter;
}

/** Positions count diatonic steps from the lowest staff line, independent of clef. */
export interface WrittenEvent {
  positions: number[];
  beats: number;
  type: "whole" | "half" | "quarter" | "eighth";
  dotted: boolean;
  accidentals?: { position: number; alter: number }[];
}

export interface StaffReading {
  clef: ReadingContext["clef"] | null;
  fifths: number | null;
  meter: ScoreMeter | null;
  bars: WrittenEvent[][];
}

export function resolveReading(reading: StaffReading, context: ReadingContext) {
  const { clef, fifths, meter } = context;
  if (
    !["G", "F"].includes(clef) ||
    !Number.isInteger(fifths) ||
    Math.abs(fifths) > 7 ||
    !Number.isInteger(meter.beats) ||
    meter.beats < 1 ||
    meter.beats > 32 ||
    ![2, 4, 8, 16].includes(meter.beatType)
  )
    throw new Error("unsupportedNotation");
  const capacity = (meter.beats * 4) / meter.beatType;
  const bars = reading.bars.map((events) => {
    const alterations = new Map<number, number>();
    return events.map((event) => {
      for (const { position, alter } of event.accidentals ?? [])
        alterations.set(position, alter);
      const heads = event.positions.map((position) => {
        const pitch = fromPosition((clef === "G" ? 30 : 18) + position); // E4 or G2
        const accidental = event.accidentals?.find(
          (a) => a.position === position,
        )?.alter;
        return {
          ...pitch,
          alter: alterations.get(position) ?? keyAlter(pitch.step, fifths),
          accidental,
        };
      });
      // A whole rest alone fills its measure, including in 3/4 and 6/8.
      const fullMeasureRest =
        events.length === 1 &&
        !heads.length &&
        event.type === "whole" &&
        !event.dotted;
      return {
        heads,
        beats: fullMeasureRest ? capacity : event.beats,
        type: event.type,
        dotted: event.dotted,
      };
    });
  });
  const barLengths = bars.map((events) =>
    events.reduce((sum, e) => sum + e.beats, 0),
  );
  // Only infer a pickup when the last partial bar accounts for its complement.
  const hasPickup =
    bars.length > 1 &&
    barLengths[0] < capacity &&
    barLengths[0] + barLengths[bars.length - 1] === capacity;
  if (
    !bars.length ||
    barLengths.some(
      (length, i) =>
        length <= 0 ||
        (length !== capacity &&
          !(hasPickup && (i === 0 || i === bars.length - 1))),
    )
  )
    throw new Error("meterMismatch");
  return { bars, hasPickup };
}
