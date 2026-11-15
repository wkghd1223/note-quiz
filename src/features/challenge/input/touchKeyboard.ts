import type { PerformanceEvent } from "../domain/performance";

/** One active monophonic key, measured with the same AudioContext clock as targets. */
export class TouchKeyboardInput {
  private held: { key: string; midi: number; onset: number } | null = null;
  private sequence = 0;
  constructor(private emit: (event: PerformanceEvent) => void) {}

  down(key: string, midi: number, audioTimeSec: number): boolean {
    if (
      this.held ||
      !Number.isInteger(midi) ||
      midi < 0 ||
      midi > 127 ||
      !Number.isFinite(audioTimeSec)
    )
      return false;
    this.held = { key, midi, onset: audioTimeSec };
    return true;
  }

  up(key: string, audioTimeSec: number): boolean {
    const held = this.held;
    if (!held || held.key !== key || !Number.isFinite(audioTimeSec))
      return false;
    this.held = null;
    if (audioTimeSec <= held.onset) return false;
    this.emit({
      eventId: `touch-${++this.sequence}`,
      inputMethod: "touch",
      onsetAudioSec: held.onset,
      offsetAudioSec: audioTimeSec,
      observedMidi: held.midi,
      medianCents: 0,
      validPitchRatio: 1,
      confidence: 1,
      attackConfidence: 1,
    });
    return true;
  }

  release(audioTimeSec: number) {
    if (this.held) this.up(this.held.key, audioTimeSec);
  }
  cancel() {
    this.held = null;
  }
  get currentMidi() {
    return this.held?.midi ?? null;
  }
}
