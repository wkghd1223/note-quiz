import { matchEvents } from "./matching";
import type { ScoringProfile } from "./instrument-profile";
import type {
  AttemptResult,
  NoteResult,
  PerformanceEvent,
  ReasonCode,
  TargetEvent,
} from "./performance";
const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);
const unit = (n: unknown): n is number => finite(n) && n >= 0 && n <= 1;
const round = (n: number) => Math.round(n * 100) / 100;
function validEvent(e: PerformanceEvent): boolean {
  return (
    typeof e.eventId === "string" &&
    finite(e.onsetAudioSec) &&
    e.onsetAudioSec >= -0.5 &&
    (e.offsetAudioSec === null ||
      (finite(e.offsetAudioSec) && e.offsetAudioSec > e.onsetAudioSec)) &&
    (e.observedMidi === null ||
      (Number.isInteger(e.observedMidi) &&
        e.observedMidi >= 0 &&
        e.observedMidi <= 127)) &&
    (e.medianCents === null || finite(e.medianCents)) &&
    unit(e.validPitchRatio) &&
    unit(e.confidence) &&
    unit(e.attackConfidence) &&
    (!e.pitchSamples ||
      e.pitchSamples.every(
        (s) =>
          finite(s.audioTimeSec) &&
          (s.midi === null ||
            (Number.isInteger(s.midi) && s.midi >= 0 && s.midi <= 127)) &&
          (s.cents === null || finite(s.cents)) &&
          unit(s.confidence),
      ))
  );
}
function unionDuration(intervals: [number, number][]): number {
  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0,
    start = 0,
    end = 0;
  for (const [a, b] of intervals) {
    if (a > end) {
      total += end - start;
      start = a;
      end = b;
    } else end = Math.max(end, b);
  }
  return total + end - start;
}
export function scoreAttempt(
  input: PerformanceEvent[],
  targets: TargetEvent[],
  profile: ScoringProfile,
  offsetMs = 0,
): AttemptResult {
  const validProfile =
    profile.version === 1 &&
    profile.required.includes("pitch") &&
    profile.required.includes("duration") &&
    unit(profile.validPitchRatio) &&
    unit(profile.confidenceThreshold) &&
    unit(profile.attackConfidenceThreshold) &&
    finite(profile.pitchToleranceCents) &&
    profile.pitchToleranceCents > 0 &&
    finite(profile.durationToleranceRatio) &&
    profile.durationToleranceRatio > 0 &&
    finite(profile.onsetToleranceSec) &&
    profile.onsetToleranceSec > 0 &&
    finite(profile.restToleranceSec) &&
    profile.restToleranceSec >= 0;
  const validTargets =
    targets.length > 0 &&
    new Set(targets.map((t) => t.stageEventId)).size === targets.length &&
    targets.every(
      (t) =>
        finite(t.startAudioSec) &&
        finite(t.endAudioSec) &&
        t.startAudioSec >= 0 &&
        t.endAudioSec > t.startAudioSec &&
        (t.kind === "rest"
          ? t.targetConcertMidi === null
          : Number.isInteger(t.targetConcertMidi) &&
            t.targetConcertMidi! >= 0 &&
            t.targetConcertMidi! <= 127),
    );
  const validOffset = finite(offsetMs) && Math.abs(offsetMs) <= 250;
  const invalidInput = input.some((e) => !validEvent(e));
  const events = input.filter(validEvent);
  const supported =
    profile.supported && validProfile && validTargets && validOffset;
  const matches = supported
    ? matchEvents(events, targets, offsetMs)
    : new Map<string, PerformanceEvent>();
  const requiredOnset = profile.required.includes("onset");
  const notes: NoteResult[] = targets
    .filter((t) => t.kind === "note")
    .map((target) => {
      const event = matches.get(target.stageEventId);
      const reasons: ReasonCode[] = [];
      let pitchPass = false,
        durationPass = false,
        onsetPass = !requiredOnset,
        distinctAttackPass = !target.requiresDistinctAttack;
      let pitchScore = 0,
        durationScore = 0,
        onsetScore: number | null = requiredOnset ? 0 : null;
      let status: NoteResult["status"] = "failed";
      if (!supported) {
        status = "unscorable";
        reasons.push("unsupportedInput");
      } else if (!event) {
        status = "missed";
        reasons.push("missed");
        if (
          target.requiresDistinctAttack &&
          events.some(
            (e) =>
              e.onsetAudioSec - offsetMs / 1000 < target.startAudioSec &&
              (e.offsetAudioSec ?? e.onsetAudioSec) - offsetMs / 1000 >
                target.startAudioSec &&
              e.observedMidi === target.targetConcertMidi,
          )
        )
          reasons.push("missingAttack");
      } else if (
        event.inputMethod !== profile.inputMethod ||
        event.offsetAudioSec === null ||
        event.observedMidi === null ||
        event.medianCents === null ||
        event.confidence < profile.confidenceThreshold
      ) {
        status = "unscorable";
        reasons.push(
          event.inputMethod !== profile.inputMethod
            ? "unsupportedInput"
            : "noSignal",
        );
      } else {
        const samples = event.pitchSamples;
        const ratio =
          samples && samples.length > 0
            ? samples.filter(
                (sample) =>
                  sample.midi !== null &&
                  sample.cents !== null &&
                  sample.confidence >= profile.confidenceThreshold &&
                  Math.abs(
                    (sample.midi - target.targetConcertMidi!) * 100 +
                      sample.cents,
                  ) <= profile.pitchToleranceCents,
              ).length / samples.length
            : Math.abs(
                  (event.observedMidi - target.targetConcertMidi!) * 100 +
                    event.medianCents,
                ) <= profile.pitchToleranceCents
              ? event.validPitchRatio
              : 0;
        pitchScore = ratio * 100;
        pitchPass = ratio + 1e-9 >= profile.validPitchRatio;
        const duration = target.endAudioSec - target.startAudioSec;
        const actualDuration = event.offsetAudioSec - event.onsetAudioSec;
        const relativeError = Math.abs(actualDuration - duration) / duration;
        durationScore = Math.max(0, 1 - relativeError) * 100;
        durationPass = relativeError <= profile.durationToleranceRatio + 1e-9;
        const onsetError =
          event.onsetAudioSec - offsetMs / 1000 - target.startAudioSec;
        const tolerance = Math.min(profile.onsetToleranceSec, duration * 0.3);
        if (requiredOnset) {
          onsetPass = Math.abs(onsetError) <= tolerance + 1e-9;
          onsetScore =
            Math.max(0, 1 - Math.abs(onsetError) / (tolerance * 4)) * 100;
        }
        distinctAttackPass =
          !target.requiresDistinctAttack ||
          event.attackConfidence >= profile.attackConfidenceThreshold;
        if (!pitchPass) reasons.push("wrongPitch");
        if (!durationPass)
          reasons.push(actualDuration < duration ? "tooShort" : "tooLong");
        if (!onsetPass) reasons.push(onsetError < 0 ? "early" : "late");
        if (!distinctAttackPass) reasons.push("missingAttack");
        status =
          pitchPass && durationPass && onsetPass && distinctAttackPass
            ? "passed"
            : "failed";
      }
      return {
        stageEventId: target.stageEventId,
        eventId: event?.eventId ?? null,
        status,
        pitchPass,
        durationPass,
        onsetPass,
        distinctAttackPass,
        reasons,
        pitchScore: round(pitchScore),
        durationScore: round(durationScore),
        onsetScore: onsetScore === null ? null : round(onsetScore),
      };
    });
  const restViolations =
    supported && profile.required.includes("rest")
      ? targets
          .filter(
            (t) =>
              t.kind === "rest" &&
              unionDuration(
                events
                  .filter(
                    (e) =>
                      e.confidence >= profile.confidenceThreshold &&
                      e.observedMidi !== null,
                  )
                  .map((e): [number, number] => [
                    Math.max(
                      t.startAudioSec,
                      e.onsetAudioSec - offsetMs / 1000,
                    ),
                    Math.min(
                      t.endAudioSec,
                      (e.offsetAudioSec ??
                        Math.max(
                          ...targets.map((target) => target.endAudioSec),
                        )) -
                        offsetMs / 1000,
                    ),
                  ])
                  .filter(([a, b]) => b > a),
              ) >
                profile.restToleranceSec + 1e-9,
          )
          .map((t) => t.stageEventId)
      : [];
  const mean = (key: "pitchScore" | "durationScore" | "onsetScore") =>
    notes.length
      ? notes.reduce((sum, n) => sum + (n[key] ?? 0), 0) / notes.length
      : 0;
  const breakdown = {
    pitch: round(mean("pitchScore")),
    duration: round(mean("durationScore")),
    onset: requiredOnset ? round(mean("onsetScore")) : null,
  };
  // Only measured dimensions enter the normalized weighted score. No duration free pass.
  const score = round(
    (breakdown.pitch * 50 +
      breakdown.duration * 20 +
      (breakdown.onset ?? 0) * 30) /
      (requiredOnset ? 100 : 70),
  );
  const notePassRate = notes.length
    ? notes.filter((n) => n.status === "passed").length / notes.length
    : 0;
  const unscorable =
    !supported || invalidInput || notes.some((n) => n.status === "unscorable");
  let stars: AttemptResult["stars"] = 0;
  if (
    !unscorable &&
    restViolations.length === 0 &&
    notePassRate >= 0.8 &&
    score >= 70
  )
    stars =
      notePassRate >= 0.95 && score >= 95
        ? 3
        : notePassRate >= 0.85 && score >= 85
          ? 2
          : 1;
  return {
    scoringVersion: 1,
    score,
    stars,
    cleared: stars > 0,
    notePassRate,
    unscorable,
    notes,
    restViolations,
    breakdown,
  };
}
