import { buildPlaybackPlan } from "../domain/playback-order";
import { beatsPerMeasure, type ExerciseDefinition } from "../domain/stage";

export interface BeatCueOptions {
  metronome?: boolean;
  barBell?: boolean;
}

/** Cues share the score clock, including compound meter and resumed positions. */
export function beatCues(
  stage: ExerciseDefinition,
  options: BeatCueOptions,
  tempoScale = 1,
  fromSec = 0,
): { timeSec: number; kind: "beat" | "bar" }[] {
  if (!options.metronome && !options.barBell) return [];
  const quarterSec = 60 / (stage.bpm * tempoScale);
  const barBeats = beatsPerMeasure(stage);
  const pulse =
    stage.timeSignature[0] === 6 && stage.timeSignature[1] === 8 ? 1.5 : 1;
  return buildPlaybackPlan(stage).visits.flatMap((visit) =>
    Array.from({ length: Math.round(barBeats / pulse) }, (_, index) => ({
      timeSec: (visit.startBeat + index * pulse) * quarterSec,
      kind:
        index === 0 && options.barBell ? ("bar" as const) : ("beat" as const),
      enabled: (index === 0 && options.barBell) || options.metronome,
    }))
      .filter((cue) => cue.enabled && cue.timeSec >= fromSec - 1e-7)
      .map(({ timeSec, kind }) => ({ timeSec, kind })),
  );
}
