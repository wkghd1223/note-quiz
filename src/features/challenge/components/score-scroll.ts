import type { NotationRenderResult } from "@/lib/notation/score";
import type { AttemptResult, PlaybackTransition } from "../domain/performance";

export interface ScoreCursorTarget {
  stageEventId: string;
  sourceEventId: string;
  sourceBarIndex: number;
  visit: number;
  startAudioSec: number;
  endAudioSec: number;
  kind: "note" | "rest";
}

/** Explicit count-in projection; normal negative elapsed values remain clamped. */
export interface ScorePreRoll {
  remainingSec: number;
  durationSec: number;
  baseElapsedSec: number;
}

export const matchedNoteColor = "#15803d";
export const incorrectNoteColor = "#b91c1c";

/** Project the audio clock onto engraved coordinates, never onto guessed spacing. */
export function scoreCursorPosition(
  targets: readonly ScoreCursorTarget[],
  transitions: readonly PlaybackTransition[],
  render: NotationRenderResult,
  elapsed: number,
  reducedMotion = false,
  preRoll: ScorePreRoll | null = null,
): { x: number; barIndex: number; rewinding: boolean } {
  const anchor = (target: ScoreCursorTarget) => {
    const bounds = render.events.find(
      (event) => event.id === target.sourceEventId,
    );
    return bounds?.anchorX ?? bounds?.x ?? 0;
  };
  const barEnd = (target: ScoreCursorTarget) => {
    const bar = render.measures?.find(
      (measure) => measure.index === target.sourceBarIndex,
    );
    return bar
      ? bar.timeStartX !== undefined && bar.timeWidth !== undefined
        ? bar.timeStartX + bar.timeWidth
        : bar.x + bar.width
      : anchor(target) + 64;
  };
  if (
    preRoll &&
    preRoll.durationSec > 0 &&
    preRoll.remainingSec > 0 &&
    Number.isFinite(preRoll.remainingSec) &&
    Number.isFinite(preRoll.durationSec) &&
    Number.isFinite(preRoll.baseElapsedSec)
  ) {
    const base = scoreCursorPosition(
      targets,
      transitions,
      render,
      preRoll.baseElapsedSec,
      reducedMotion,
    );
    const currentIndex = targets.findIndex(
      (target) => target.endAudioSec > preRoll.baseElapsedSec + 1e-8,
    );
    const current = targets[currentIndex];
    if (!current) return base;
    const next = targets[currentIndex + 1];
    // Use the local engraved spacing, including resume targets. Do not infer
    // a pre-roll from elapsed alone: paused/repeat positions retain their rules.
    const endX =
      next &&
      next.sourceBarIndex <= current.sourceBarIndex + 1 &&
      !transitions.some(
        (jump) =>
          jump.startAudioSec >= current.endAudioSec - 1e-8 &&
          jump.endAudioSec <= next.startAudioSec + 1e-8,
      )
        ? anchor(next)
        : barEnd(current);
    const speed =
      Math.max(0, endX - anchor(current)) /
      (current.endAudioSec - current.startAudioSec);
    return {
      ...base,
      // Linear essential timing remains visible with reduced motion; rewind
      // easing and normal per-note movement still follow that preference.
      x: base.x - speed * Math.min(preRoll.durationSec, preRoll.remainingSec),
      rewinding: false,
    };
  }
  const transition = transitions.find(
    (jump) => elapsed >= jump.startAudioSec && elapsed < jump.endAudioSec,
  );
  if (transition) {
    const next = targets.find(
      (target) => target.startAudioSec >= transition.endAudioSec - 1e-8,
    )!;
    let previous = targets[0];
    for (let index = targets.length - 1; index >= 0; index--) {
      if (targets[index].endAudioSec <= transition.startAudioSec + 1e-8) {
        previous = targets[index];
        break;
      }
    }
    const fraction = Math.max(
      0,
      Math.min(
        1,
        (elapsed - transition.startAudioSec) /
          (transition.endAudioSec - transition.startAudioSec),
      ),
    );
    const eased = reducedMotion ? 1 : fraction * fraction * (3 - 2 * fraction);
    return {
      x: barEnd(previous) + (anchor(next) - barEnd(previous)) * eased,
      barIndex: transition.toBar,
      rewinding: true,
    };
  }
  const index = targets.findIndex(
    (target) => target.endAudioSec > elapsed + 1e-8,
  );
  const current = targets[index < 0 ? targets.length - 1 : index];
  if (!current) return { x: 0, barIndex: 0, rewinding: false };
  const next = index >= 0 ? targets[index + 1] : undefined;
  const hasJump =
    next &&
    (next.sourceBarIndex > current.sourceBarIndex + 1 ||
      transitions.some(
        (jump) =>
          jump.startAudioSec >= current.endAudioSec - 1e-8 &&
          jump.endAudioSec <= next.startAudioSec + 1e-8,
      ));
  const endX = next && !hasJump ? anchor(next) : barEnd(current);
  // Essential playback must remain aligned with the audio clock even when
  // decorative rewind animation is reduced.
  const fraction = Math.max(
    0,
    Math.min(
      1,
      (elapsed - current.startAudioSec) /
        (current.endAudioSec - current.startAudioSec),
    ),
  );
  return {
    x: anchor(current) + (endX - anchor(current)) * fraction,
    barIndex: current.sourceBarIndex,
    rewinding: false,
  };
}

/** One written glyph can be visited repeatedly; show only its current pass's result. */
export function scoreNoteColors(
  targets: readonly ScoreCursorTarget[],
  transitions: readonly PlaybackTransition[],
  result: AttemptResult | null,
  elapsed: number,
  scoreRests: boolean,
): Readonly<Record<string, string>> {
  if (!result) return {};
  const visits = new Map<number, number>();
  // Retain feedback during the return animation, then clear the whole repeated
  // range for its next pass before any of those notes reaches the play line.
  for (const jump of transitions) {
    if (jump.endAudioSec > elapsed) continue;
    for (let bar = jump.toBar; bar <= jump.fromBar; bar++) {
      const upcoming = targets.find(
        (target) =>
          target.sourceBarIndex === bar &&
          target.startAudioSec >= jump.endAudioSec - 1e-8,
      );
      if (upcoming) visits.set(bar, upcoming.visit);
    }
  }
  for (const target of targets) {
    if (!visits.has(target.sourceBarIndex))
      visits.set(target.sourceBarIndex, 1);
    if (target.startAudioSec <= elapsed + 1e-8) {
      visits.set(
        target.sourceBarIndex,
        Math.max(visits.get(target.sourceBarIndex)!, target.visit),
      );
    }
  }
  const notes = new Map(result.notes.map((note) => [note.stageEventId, note]));
  const colors: Record<string, string> = {};
  for (const target of targets) {
    if (target.visit !== visits.get(target.sourceBarIndex)) continue;
    const note = notes.get(target.stageEventId);
    if (note)
      colors[target.sourceEventId] =
        note.status === "passed" ? matchedNoteColor : incorrectNoteColor;
    else if (
      scoreRests &&
      target.kind === "rest" &&
      elapsed >= target.endAudioSec + 0.12
    ) {
      colors[target.sourceEventId] = result.restViolations.includes(
        target.stageEventId,
      )
        ? incorrectNoteColor
        : matchedNoteColor;
    }
  }
  return colors;
}
