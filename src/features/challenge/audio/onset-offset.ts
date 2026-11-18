import type { InputFrame, PerformanceEvent } from "../domain/performance";
import { frequencyPitch } from "./pitch";
import { hasReliablePitch } from "@/lib/music/estimatePitch";

export const microphoneEnergyGates = (noiseFloor: number) => ({
  enter: Math.max(0.008, noiseFloor * 3),
  exit: Math.max(0.004, noiseFloor * 1.7),
});

interface ActiveSound {
  onset: number;
  lastVoiced: number;
  energySince: number;
  quietSince: number | null;
  pitchChangeSince: number | null;
  /** Continuous departure from the retained anchor, independent of rounding. */
  pitchDepartureSince: number | null;
  changedMidi: number | null;
  midi: number | null;
  attackConfidence: number;
  peak: number;
  dipSince: number | null;
  samples: NonNullable<PerformanceEvent["pitchSamples"]>;
}

/** Stateful signal segmentation, independent of UI frames and the old 220ms gate. */
export class NoteEventDetector {
  private active: ActiveSound | null = null;
  private serial = 0;
  private lastTime = -Infinity;
  private lastPitchTime = -Infinity;
  private noiseFloor = 0.003;
  private prefix = "mic";

  reset(prefix: string, noiseFloor = this.noiseFloor) {
    this.active = null;
    this.serial = 0;
    this.lastTime = -Infinity;
    this.lastPitchTime = -Infinity;
    this.prefix = prefix;
    this.noiseFloor = Math.max(0.001, Math.min(0.04, noiseFloor));
  }

  /** All sounds starting before this audio time have emitted their final event. */
  get finalizedBeforeAudioSec(): number {
    // A legato change can be backdated to the pitch-window center. An open
    // sound can still change its measured length, so never finalize past it.
    return Math.min(this.lastPitchTime, this.active?.onset ?? Infinity);
  }

  accept(
    frame: InputFrame & { pitchAudioTimeSec?: number },
  ): PerformanceEvent[] {
    if (
      !Number.isFinite(frame.audioTimeSec) ||
      frame.audioTimeSec <= this.lastTime ||
      !Number.isFinite(frame.rms) ||
      frame.rms < 0
    )
      return [];
    this.lastTime = frame.audioTimeSec;
    const { enter, exit } = microphoneEnergyGates(this.noiseFloor);
    const pitch =
      frame.detectedHz === null ? null : frequencyPitch(frame.detectedHz);
    const reliable =
      frame.isVoiced && pitch !== null && hasReliablePitch(frame.detectedHz, frame.confidence);
    // Only pitch evidence follows the analysis-window center. Energy onset
    // and offset retain the recent-hop clock instead of shifting every event.
    const pitchTime = Number.isFinite(frame.pitchAudioTimeSec)
      ? Math.min(frame.audioTimeSec, frame.pitchAudioTimeSec!)
      : frame.audioTimeSec;
    this.lastPitchTime = pitchTime;
    const sample = {
      audioTimeSec: pitchTime,
      midi: reliable ? pitch.midi : null,
      cents: reliable ? pitch.cents : null,
      confidence: reliable ? frame.confidence : 0,
    };
    const result: PerformanceEvent[] = [];
    if (!this.active) {
      if (frame.rms >= enter) {
        this.active = this.start(frame, reliable ? pitch.midi : null);
        this.active.samples.push(sample);
      }
      return result;
    }
    const sound = this.active;
    if (frame.rms < exit) {
      sound.quietSince ??= frame.audioTimeSec;
      // A partial hop at the edge of silence can look like a deep volume dip.
      // Let silence hysteresis handle it instead of inventing a reattack when
      // a brief dropout returns.
      sound.dipSince = null;
      // Hysteresis may join a brief dropout to the held note. Keep that
      // unvoiced time in its pitch denominator; otherwise intermittent sound
      // can look like a perfect continuous hold. close() trims release silence.
      sound.samples.push({
        audioTimeSec: frame.audioTimeSec,
        midi: null,
        cents: null,
        confidence: 0,
      });
      if (frame.audioTimeSec - sound.quietSince >= 0.06) {
        const event = this.close(sound.quietSince);
        if (event) result.push(event);
      }
      return result;
    }
    // A renewed attack after a continuous note can confirm a shorter quiet
    // interval than release alone. A hop may straddle both edges of a real
    // articulation gap. Brief/intermittent energy must retain hysteresis.
    if (
      sound.quietSince !== null &&
      (frame.audioTimeSec - sound.quietSince >= 0.06 ||
        (frame.audioTimeSec - sound.quietSince >= 0.05 &&
          sound.quietSince - sound.energySince >= 0.06 &&
          frame.rms >= enter))
    ) {
      const event = this.close(sound.quietSince);
      if (event) result.push(event);
      this.active = this.start(frame, reliable ? pitch.midi : null);
      this.active.samples.push(sample);
      return result;
    }
    if (sound.quietSince !== null) sound.energySince = frame.audioTimeSec;
    sound.quietSince = null;
    sound.lastVoiced = frame.audioTimeSec;
    // A dip + a renewed attack distinguishes repeated notes from a long hold.
    if (frame.rms < sound.peak * 0.4) sound.dipSince ??= frame.audioTimeSec;
    const reattack =
      sound.dipSince !== null &&
      frame.rms > sound.peak * 0.65 &&
      frame.audioTimeSec - sound.dipSince >= 0.025 &&
      frame.audioTimeSec - sound.dipSince <= 0.15 &&
      frame.audioTimeSec - sound.onset > 0.12;
    if (reattack) {
      const event = this.close(sound.dipSince!);
      if (event) result.push(event);
      this.active = this.start(frame, reliable ? pitch.midi : null);
      this.active.samples.push(sample);
      return result;
    }
    // Do not retain a dip candidate until an unrelated later crescendo.
    if (frame.rms >= sound.peak * 0.4) sound.dipSince = null;
    sound.peak = Math.max(frame.rms, sound.peak * 0.998);
    if (reliable && sound.midi === null) sound.midi = pitch.midi;
    // Hysteresis around the retained semitone avoids interpreting a vibrato
    // excursion across the nearest-note rounding boundary as a legato note.
    const changedPitch =
      reliable &&
      sound.midi !== null &&
      pitch.midi !== sound.midi &&
      Math.abs(pitch.midi + pitch.cents / 100 - sound.midi) >= 0.75;
    if (changedPitch) {
      // Candidate rounding can restart the debounce while an attack is still
      // finding its fundamental. Preserve when that recovery actually began.
      sound.pitchDepartureSince ??= Math.max(sound.onset, pitchTime);
      if (sound.changedMidi !== pitch.midi) {
        sound.changedMidi = pitch.midi;
        sound.pitchChangeSince = Math.max(sound.onset, pitchTime);
      }
      if (
        sound.pitchChangeSince !== null &&
        pitchTime - sound.pitchChangeSince >= 0.06
      ) {
        const changeTime = sound.pitchChangeSince;
        // A pitch settling during the physical attack must not discard that
        // measured onset as a sub-minimum fragment (or invent a second attack).
        if (sound.pitchDepartureSince - sound.onset < 0.06) {
          sound.midi = pitch.midi;
          sound.pitchChangeSince = null;
          sound.pitchDepartureSince = null;
          sound.changedMidi = null;
          sound.samples.push(sample);
          return result;
        }
        const changedSamples = sound.samples.filter(
          (item) => item.audioTimeSec >= changeTime,
        );
        sound.samples = sound.samples.filter(
          (item) => item.audioTimeSec < changeTime,
        );
        const event = this.close(changeTime);
        if (event) result.push(event);
        this.active = this.start(
          { ...frame, audioTimeSec: changeTime },
          pitch.midi,
        );
        this.active.samples = [...changedSamples, sample];
        // Legato pitch movement is not evidence of a new physical attack.
        this.active.attackConfidence = 0;
        return result;
      }
    } else {
      sound.pitchChangeSince = null;
      sound.pitchDepartureSince = null;
      sound.changedMidi = null;
    }
    sound.samples.push(sample);
    return result;
  }

  flush(audioTimeSec: number): PerformanceEvent[] {
    const sound = this.active;
    if (!sound) return [];
    const event = this.close(sound.quietSince ?? audioTimeSec);
    return event ? [event] : [];
  }

  private start(frame: InputFrame, midi: number | null): ActiveSound {
    return {
      onset: frame.audioTimeSec,
      lastVoiced: frame.audioTimeSec,
      energySince: frame.audioTimeSec,
      quietSince: null,
      pitchChangeSince: null,
      pitchDepartureSince: null,
      changedMidi: null,
      midi,
      attackConfidence: 1,
      peak: frame.rms,
      dipSince: null,
      samples: [],
    };
  }

  private close(offset: number): PerformanceEvent | null {
    const sound = this.active;
    this.active = null;
    if (!sound || offset - sound.onset < 0.06) return null;
    const samples = sound.samples
      .filter(
        (item) =>
          item.audioTimeSec >= sound.onset && item.audioTimeSec < offset,
      )
      .sort((a, b) => a.audioTimeSec - b.audioTimeSec);
    const voiced = samples.filter(
      (item) => item.midi !== null && hasReliablePitch(440 * 2 ** ((item.midi - 69) / 12), item.confidence),
    );
    const exactMidi = voiced
      .map((item) => item.midi! + (item.cents ?? 0) / 100)
      .sort((a, b) => a - b);
    const median = exactMidi.length
      ? exactMidi[Math.floor(exactMidi.length / 2)]
      : null;
    return {
      eventId: `${this.prefix}-${++this.serial}`,
      inputMethod: "microphone",
      onsetAudioSec: sound.onset,
      offsetAudioSec: offset,
      observedMidi: median === null ? null : Math.round(median),
      medianCents: median === null ? null : (median - Math.round(median)) * 100,
      validPitchRatio: samples.length ? voiced.length / samples.length : 0,
      confidence: voiced.length
        ? voiced.reduce((sum, item) => sum + item.confidence, 0) / voiced.length
        : 0,
      attackConfidence: sound.attackConfidence,
      pitchSamples: samples,
    };
  }
}
