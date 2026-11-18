import { frequencyPitch, hasReliablePitch } from "@/lib/music/estimatePitch";
import type { InputFrame } from "@/features/challenge/domain/performance";
import { createChordDetector } from "./chord-detection";
import type { ImportedTarget } from "./types";

type CaptureFrame = InputFrame & { pitchAudioTimeSec: number };

/** Low adjacent fundamentals need a longer observation than the monophonic
 * worklet window. Assemble only contiguous samples from the current target.
 * The oldest samples are discarded, and the window is released on pause. */
class SpectralWindow {
  private readonly samples: Float32Array;
  private filled = 0;
  private endSample = -Infinity;
  private readonly detect = createChordDetector();

  constructor(
    private target: ImportedTarget,
    private rate: number,
  ) {
    const frequencies = [...new Set(target.midis)]
      .map((midi) => 440 * 2 ** ((midi - 69) / 12))
      .sort((a, b) => a - b);
    let separation = Infinity;
    for (let i = 1; i < frequencies.length; i++)
      separation = Math.min(separation, frequencies[i] - frequencies[i - 1]);
    const seconds = Math.min(
      0.34,
      0.58 * (target.endSec - target.startSec),
      Math.max(0.04, 3.5 / frequencies[0], 2.8 / separation),
    );
    this.samples = new Float32Array(Math.max(1, Math.floor(rate * seconds)));
  }

  matches(pcm: Float32Array, lastSample: number, endSec: number): boolean {
    const startSample = lastSample - pcm.length;
    const from = Math.max(
      startSample,
      Math.round(lastSample - (endSec - this.target.startSec) * this.rate),
    );
    const to = Math.min(
      lastSample,
      Math.round(lastSample - (endSec - this.target.endSec) * this.rate),
    );
    if (from > this.endSample) this.filled = 0;
    const first = Math.max(from, this.endSample, to - this.samples.length);
    if (to <= first) return false;
    const count = to - first;
    const retained = Math.min(this.filled, this.samples.length - count);
    this.samples.copyWithin(0, this.filled - retained, this.filled);
    this.samples.set(
      pcm.subarray(first - startSample, to - startSample),
      retained,
    );
    this.filled = retained + count;
    this.endSample = to;
    return (
      this.filled === this.samples.length &&
      this.detect(this.samples, this.rate, this.target.midis)
    );
  }
}

export class ImportedJudgment {
  readonly results: Record<string, boolean> = Object.create(null);
  private index = 0;
  private matchedSec = 0;
  private continuousSec = 0;
  private longestSec = 0;
  private latestFrame = -Infinity;
  private lastAttack = -Infinity;
  private quietSince: number | null = null;
  private peak = 0;
  private spectralWindow: SpectralWindow | null = null;
  private previousMatched = false;

  constructor(private readonly targets: readonly ImportedTarget[]) {}

  get settledCount() {
    return this.index;
  }

  /** Partial measured time remains valid; sound on opposite sides of a
   * pause is never counted as one simultaneous or continuous observation. */
  breakCapture() {
    this.continuousSec = 0;
    this.latestFrame = -Infinity;
    this.lastAttack = -Infinity;
    this.quietSince = null;
    this.peak = 0;
    this.previousMatched = false;
    this.spectralWindow = null;
  }

  private settle() {
    const target = this.targets[this.index];
    const duration = target.endSec - target.startSec;
    // A chord needs a fresh, sustained coincidence; three separate detections
    // can never add up to a match. Silence and a held single note are measured
    // over their own written lengths.
    this.results[target.id] =
      target.midis.length > 1
        ? this.longestSec >= Math.min(0.075, duration * 0.28)
        : this.matchedSec >= duration * (target.midis.length ? 0.65 : 0.8);
    this.index++;
    this.matchedSec = 0;
    this.continuousSec = 0;
    this.longestSec = 0;
    this.spectralWindow = null;
  }

  accept(
    pcm: Float32Array,
    rate: number,
    frame: CaptureFrame,
    energyGate: number,
    zeroAudioSec: number,
  ) {
    const time = frame.audioTimeSec - zeroAudioSec;
    if (!Number.isFinite(time) || time < 0 || time <= this.latestFrame) return;
    const dt = Math.min(512 / rate, time - this.latestFrame);
    if (time - this.latestFrame > (1.5 * 512) / rate) {
      this.continuousSec = 0;
      this.previousMatched = false;
    }
    this.latestFrame = time;
    const enter = Math.max(energyGate, this.peak * 0.4);
    if (frame.rms < enter) this.quietSince ??= time;
    else {
      if (
        this.peak < energyGate ||
        (this.quietSince !== null && time - this.quietSince >= 0.025)
      )
        this.lastAttack = time;
      this.quietSince = null;
    }
    this.peak = Math.max(frame.rms, this.peak * 0.98);
    while (
      this.index < this.targets.length &&
      time >= this.targets[this.index].endSec
    )
      this.settle();
    const target = this.targets[this.index];
    if (!target || time < target.startSec) return;
    const previous = this.targets[this.index - 1];
    const repeat =
      previous &&
      previous.endSec >= target.startSec - 1e-7 &&
      previous.midis.length === target.midis.length &&
      target.midis.every((midi) => previous.midis.includes(midi));
    let matches = false;
    if (!target.midis.length) {
      matches = frame.rms < energyGate;
    } else if (
      frame.rms >= energyGate &&
      frame.inputQuality !== "clipping" &&
      (!repeat || this.lastAttack >= target.startSec - 0.055)
    ) {
      // The shared voice estimator accepts 65–1100 Hz (C2–C6 keys).
      // Imported instrument parts can lie outside that band.
      const single = target.midis.length === 1 ? target.midis[0] : null;
      if (single !== null && single >= 36 && single <= 84) {
        const pitch =
          frame.detectedHz === null ? null : frequencyPitch(frame.detectedHz);
        matches =
          hasReliablePitch(frame.detectedHz, frame.confidence) &&
          frame.pitchAudioTimeSec - zeroAudioSec >= target.startSec &&
          pitch?.midi === single &&
          Math.abs(pitch.cents) <= 45;
      } else {
        this.spectralWindow ??= new SpectralWindow(target, rate);
        const endSec =
          frame.pitchAudioTimeSec - zeroAudioSec + pcm.length / (2 * rate);
        matches = this.spectralWindow.matches(
          pcm,
          frame.streamSampleIndex,
          endSec,
        );
      }
    }
    const observed = Math.min(dt, time - target.startSec + dt / 2);
    if (matches) {
      this.matchedSec += observed;
      this.continuousSec = this.previousMatched
        ? this.continuousSec + observed
        : observed;
      this.longestSec = Math.max(this.longestSec, this.continuousSec);
    } else this.continuousSec = 0;
    this.previousMatched = matches;
  }

  finish() {
    while (this.index < this.targets.length) this.settle();
  }
}
