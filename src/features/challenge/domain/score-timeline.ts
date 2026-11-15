import { concertMidi, type InstrumentProfile } from "./instrument-profile";
import { beatsPerMeasure, type ExerciseDefinition } from "./stage";
import type {
  PerformanceEvent,
  PlaybackTransition,
  TargetEvent,
} from "./performance";
import { buildPlaybackPlan } from "./playback-order";
export function beatToSeconds(beat: number, bpm: number): number {
  if (!Number.isFinite(beat) || !Number.isFinite(bpm) || bpm <= 0)
    throw new Error("invalidTimeline");
  return (beat * 60) / bpm;
}
function straightTimeline(
  stage: ExerciseDefinition,
  profile: InstrumentProfile,
  audioStartSec: number,
  tempoScale = 1,
): TargetEvent[] {
  if (
    !Number.isFinite(audioStartSec) ||
    audioStartSec < 0 ||
    ![0.7, 0.85, 1].includes(tempoScale)
  )
    throw new Error("invalidTimeline");
  return stage.events.map((event, index) => ({
    stageEventId: event.id,
    kind: event.kind,
    targetConcertMidi:
      event.kind === "note" ? concertMidi(event.writtenMidi!, profile) : null,
    startAudioSec:
      audioStartSec + beatToSeconds(event.startBeat, stage.bpm * tempoScale),
    endAudioSec:
      audioStartSec +
      beatToSeconds(
        event.startBeat + event.durationBeats,
        stage.bpm * tempoScale,
      ),
    requiresDistinctAttack:
      stage.scoring.required.includes("rearticulation") &&
      index > 0 &&
      event.kind === "note" &&
      stage.events[index - 1].kind === "note" &&
      stage.events[index - 1].writtenMidi === event.writtenMidi,
  }));
}
export interface PlaybackTimeline {
  targets: TargetEvent[];
  transitions: PlaybackTransition[];
  durationSec: number;
  endAudioSec: number;
}
/** The timeline clock includes rewind gaps; targets include only scored music. */
export function buildPlaybackTimeline(
  stage: ExerciseDefinition,
  profile: InstrumentProfile,
  audioStartSec: number,
  tempoScale = 1,
): PlaybackTimeline {
  // Keep the no-navigation path byte-for-byte compatible at the target boundary.
  const straight = straightTimeline(stage, profile, audioStartSec, tempoScale);
  const plan = buildPlaybackPlan(stage);
  const bpm = stage.bpm * tempoScale;
  const barBeats = beatsPerMeasure(stage);
  let targets = straight;
  if (stage.barNavigation?.length) {
    const performed = plan.visits.flatMap((visit) =>
      stage.events
        .filter(
          (event) =>
            Math.floor(event.startBeat / barBeats) === visit.sourceBarIndex,
        )
        .map((event) => ({ event, visit })),
    );
    targets = performed.map(({ event, visit }, index) => {
      const startBeat =
        visit.startBeat + event.startBeat - visit.sourceBarIndex * barBeats;
      const previous = performed[index - 1]?.event;
      return {
        stageEventId: JSON.stringify([event.id, visit.visit]),
        sourceEventId: event.id,
        sourceBarIndex: visit.sourceBarIndex,
        visit: visit.visit,
        occurrenceIndex: visit.occurrenceIndex,
        kind: event.kind,
        targetConcertMidi:
          event.kind === "note"
            ? concertMidi(event.writtenMidi!, profile)
            : null,
        startAudioSec: audioStartSec + beatToSeconds(startBeat, bpm),
        endAudioSec:
          audioStartSec + beatToSeconds(startBeat + event.durationBeats, bpm),
        requiresDistinctAttack:
          stage.scoring.required.includes("rearticulation") &&
          event.kind === "note" &&
          previous?.kind === "note" &&
          previous.writtenMidi === event.writtenMidi,
      };
    });
  }
  const durationSec = beatToSeconds(plan.durationBeats, bpm);
  return {
    targets,
    transitions: plan.transitions.map(
      ({ startBeat, endBeat, ...transition }) => ({
        ...transition,
        startAudioSec: audioStartSec + beatToSeconds(startBeat, bpm),
        endAudioSec: audioStartSec + beatToSeconds(endBeat, bpm),
      }),
    ),
    durationSec,
    endAudioSec: audioStartSec + durationSec,
  };
}
export function buildScoreTimeline(
  stage: ExerciseDefinition,
  profile: InstrumentProfile,
  audioStartSec: number,
  tempoScale = 1,
): TargetEvent[] {
  return buildPlaybackTimeline(stage, profile, audioStartSec, tempoScale)
    .targets;
}
/** Half-open interval: the destination note is eligible exactly at gap end. */
export function playbackTransitionAt(
  transitions: PlaybackTransition[],
  audioTimeSec: number,
): PlaybackTransition | null {
  return (
    transitions.find(
      (transition) =>
        audioTimeSec >= transition.startAudioSec - 1e-9 &&
        audioTimeSec < transition.endAudioSec - 1e-9,
    ) ?? null
  );
}
/** Never clip a hold that began on a note: overlong durations must still fail. */
export function filterPlaybackInput(
  input: PerformanceEvent[],
  transitions: PlaybackTransition[],
  offsetMs = 0,
): PerformanceEvent[] {
  return input.filter(
    (event) =>
      !playbackTransitionAt(transitions, event.onsetAudioSec - offsetMs / 1000),
  );
}
export function sampleTimeSec(
  index: number,
  sampleRate: number,
  origin = 0,
): number {
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    !Number.isFinite(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 192000 ||
    !Number.isFinite(origin)
  )
    throw new Error("invalidSampleClock");
  return origin + index / sampleRate;
}
