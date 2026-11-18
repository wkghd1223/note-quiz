import type {
  AttemptResult,
  NoteResult,
  ReasonCode,
  TargetEvent,
} from "@/features/challenge/domain/performance";
import {
  beatsPerMeasure,
  type ExerciseDefinition,
} from "@/features/challenge/domain/stage";
import type { NotationRenderResult } from "@/lib/notation/score";

export type ReviewReason =
  | ReasonCode
  | "pitchCorrectTooShort"
  | "pitchCorrectTooLong";
export interface MelodyReviewEvent {
  stageEventId: string;
  sourceEventId: string;
  barIndex: number;
  ordinal: number;
  name: string | null;
  reasons: ReviewReason[];
}
const priority: readonly ReasonCode[] = [
  "unsupportedInput",
  "noSignal",
  "missed",
  "missingAttack",
  "wrongPitch",
  "tooShort",
  "tooLong",
  "early",
  "late",
];
/** Explanations only use the immutable judgment; never a current microphone frame. */
export function reviewReasons(note: NoteResult): ReviewReason[] {
  const reasons = new Set(note.reasons);
  if (note.status === "unscorable") reasons.add("noSignal");
  if (note.status === "missed") reasons.add("missed");
  return priority
    .filter((reason) => reasons.has(reason))
    .slice(0, 2)
    .map((reason) =>
      note.pitchPass && reason === "tooShort"
        ? "pitchCorrectTooShort"
        : note.pitchPass && reason === "tooLong"
          ? "pitchCorrectTooLong"
          : reason,
    );
}
export function melodyReviewEvents(
  stage: ExerciseDefinition,
  targets: readonly TargetEvent[],
  result: AttemptResult | null,
): MelodyReviewEvent[] {
  if (!result) return [];
  const notes = new Map(result.notes.map((note) => [note.stageEventId, note]));
  const rests = new Set(result.restViolations);
  const barBeats = beatsPerMeasure(stage);
  return targets.flatMap((target) => {
    const note = notes.get(target.stageEventId);
    const reasons =
      target.kind === "rest"
        ? rests.has(target.stageEventId)
          ? ["restViolation" as const]
          : []
        : note && note.status !== "passed"
          ? reviewReasons(note)
          : [];
    if (!reasons.length) return [];
    const sourceEventId = target.sourceEventId ?? target.stageEventId;
    const event = stage.events.find((event) => event.id === sourceEventId);
    if (!event) return [];
    const barIndex = Math.floor(event.startBeat / barBeats);
    const ordinal = stage.events.filter(
      (candidate) =>
        Math.floor(candidate.startBeat / barBeats) === barIndex &&
        candidate.startBeat <= event.startBeat,
    ).length;
    return [
      {
        stageEventId: target.stageEventId,
        sourceEventId,
        barIndex,
        ordinal,
        name: event.writtenSpelling ?? null,
        reasons,
      },
    ];
  });
}
/** Renderer bounds are already projected: only the chord band's Y offset is added. */
export function reviewEventBounds(
  render: NotationRenderResult | null,
  event: Pick<MelodyReviewEvent, "sourceEventId"> | undefined,
  labelBandHeight: number,
) {
  const bounds = render?.events.find(
    (bounds) => bounds.id === event?.sourceEventId,
  );
  return bounds ? { ...bounds, y: bounds.y + labelBandHeight } : null;
}
export function reviewEventAt(
  events: readonly Pick<MelodyReviewEvent, "stageEventId" | "sourceEventId">[],
  render: NotationRenderResult | null,
  x: number,
  y: number,
  labelBandHeight: number,
): string | null {
  let selected: string | null = null,
    distance = Infinity;
  for (const event of events) {
    const bounds = reviewEventBounds(render, event, labelBandHeight);
    if (
      !bounds ||
      x < bounds.x ||
      x > bounds.x + bounds.width ||
      y < bounds.y ||
      y > bounds.y + bounds.height
    )
      continue;
    const next = Math.hypot(
      x - bounds.x - bounds.width / 2,
      y - bounds.y - bounds.height / 2,
    );
    if (next < distance) {
      selected = event.stageEventId;
      distance = next;
    }
  }
  return selected;
}
export interface ReviewPointerStart {
  id: number;
  x: number;
  y: number;
  scrollLeft: number;
  moved: boolean;
}
export function reviewPointerMoved(
  start: ReviewPointerStart,
  x: number,
  y: number,
  scrollLeft: number,
): boolean {
  return (
    start.moved ||
    Math.hypot(x - start.x, y - start.y) > 8 ||
    Math.abs(scrollLeft - start.scrollLeft) > 4
  );
}
