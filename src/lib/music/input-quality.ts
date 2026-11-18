import { hasReliablePitch, type PitchEstimate } from "./estimatePitch";

export type MicrophoneInputQuality = "inactive" | "weak" | "uncertain" | "stable" | "clipping";

/** Shared observed-time hysteresis, independent of targets and scoring.
 * Gates come from the owning input path. Clipping uses the same original PCM
 * >=0.98 full-scale fraction everywhere; a single loud sample is insufficient.
 */
export function createInputQualityObserver() {
  let weakSince: number | null = null;
  let clippingSince: number | null = null;
  let lastTime = -Infinity;
  let quality: MicrophoneInputQuality = "inactive";
  return {
    reset() {
      weakSince = clippingSince = null;
      lastTime = -Infinity;
      quality = "inactive";
    },
    observe(
      estimate: PitchEstimate,
      timeSec: number,
      energyGate: number,
      active = true,
      rms = estimate.rms,
    ): MicrophoneInputQuality {
      if (!active || !Number.isFinite(timeSec)) {
        this.reset();
        return "inactive";
      }
      if (timeSec <= lastTime) return quality;
      // A missing observation interval cannot prove sustained weak/clipped PCM.
      if (timeSec - lastTime > 0.25) weakSince = clippingSince = null;
      lastTime = timeSec;
      if (rms < energyGate) weakSince ??= timeSec;
      else weakSince = null;
      if (estimate.peak >= 0.98 && estimate.clippingRatio >= 0.01) clippingSince ??= timeSec;
      else clippingSince = null;
      if (clippingSince !== null && timeSec - clippingSince >= 0.2 - 1e-9) quality = "clipping";
      else if (weakSince !== null && timeSec - weakSince >= 0.2 - 1e-9) quality = "weak";
      else quality = rms >= energyGate && hasReliablePitch(estimate.hz, estimate.confidence) ? "stable" : "uncertain";
      return quality;
    },
  };
}
