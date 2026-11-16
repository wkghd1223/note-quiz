import type { StageEvent } from "@/features/challenge/domain/stage";

export const melodyQuarterWidth = 74;
const denseMelodyQuarterWidth = 92;

/** Preserve native final-note clearance for persisted or notation-only sixteenths. */
export function melodyQuarterWidthFor(stage: {
  events: readonly Pick<StageEvent, "durationBeats" | "noteValue">[];
}): number {
  return stage.events.some(
    (event) =>
      !Number.isFinite(event.durationBeats) ||
      event.durationBeats < 1 / 3 ||
      (event.noteValue ?? 0) >= 16,
  )
    ? denseMelodyQuarterWidth
    : melodyQuarterWidth;
}
