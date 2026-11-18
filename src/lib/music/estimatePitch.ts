/** YIN periodicity is signal evidence, not probability of the intended note. */
export const PITCH_MIN_CONFIDENCE = 0.8;
export const hasReliablePitch = (hz: number | null, confidence: number) =>
  hz !== null && Number.isFinite(hz) && confidence >= PITCH_MIN_CONFIDENCE;

export interface PitchEstimate {
  hz: number | null;
  /** Original YIN confidence (1 - cumulative mean normalized difference). */
  confidence: number;
  rms: number;
  peak: number;
  /** Fraction of original PCM samples at >= 0.98 full scale. */
  clippingRatio: number;
}
export interface PitchAnalyzer {
  analyze(pcm: Float32Array, sampleRate?: number): PitchEstimate;
}

/** Original YIN inference with capture-owned scratch. PCM is never retained. */
export function createPitchAnalyzer(
  sampleRate: number,
  windowLength: number,
): PitchAnalyzer {
  let configuredRate = NaN,
    configuredLength = 0,
    stride = 1;
  let data = new Float32Array(0);
  let difference = new Float64Array(0);
  const configure = (length: number, rate: number) => {
    configuredRate = rate;
    configuredLength = length;
    stride = Math.max(1, Math.floor(rate / 22050));
    data = new Float32Array(Math.floor(length / stride));
    const maxTau = Math.min(
      Math.floor(rate / stride / 50),
      Math.floor(data.length / 2),
    );
    difference = new Float64Array(maxTau + 1);
  };
  if (Number.isFinite(sampleRate) && sampleRate >= 8000 && windowLength >= 256)
    configure(windowLength, sampleRate);
  return {
    analyze(pcm, rateOverride = sampleRate) {
      const sampleRate = rateOverride;
      const result: PitchEstimate = {
        hz: null,
        confidence: 0,
        rms: 0,
        peak: 0,
        clippingRatio: 0,
      };
      if (
        !Number.isFinite(sampleRate) ||
        sampleRate < 8000 ||
        pcm.length < 256
      ) {
        return result;
      }
      let energy = 0,
        peak = 0,
        clipped = 0;
      for (const value of pcm) {
        if (!Number.isFinite(value)) return result;
        energy += value * value;
        peak = Math.max(peak, Math.abs(value));
        if (Math.abs(value) >= 0.98) clipped++;
      }
      const rms = Math.sqrt(energy / pcm.length);
      result.rms = rms;
      result.peak = peak;
      result.clippingRatio = clipped / pcm.length;
      if (rms < 0.003) return result;

      // Averaging before decimation reduces high-frequency aliases and CPU cost.
      if (sampleRate !== configuredRate || pcm.length !== configuredLength)
        configure(pcm.length, sampleRate);
      const rate = sampleRate / stride;
      // Float32 += rounding is part of the original decimation; clear reused scratch.
      data.fill(0);
      for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < stride; j++)
          data[i] += pcm[i * stride + j] / stride;
      }
      // Search below the accepted 65Hz band too, so a lower tone's unfinished
      // trough cannot be clamped into a false in-range pitch at the search edge.
      const maxTau = Math.min(
        Math.floor(rate / 50),
        Math.floor(data.length / 2),
      );
      // Search above the accepted voice band too. Skipping its true first period
      // can misidentify an out-of-range high tone as an in-range subharmonic.
      const minTau = 2;
      const window = data.length - maxTau;

      difference[0] = 1;
      let running = 0;
      for (let tau = 1; tau <= maxTau; tau++) {
        let sum = 0;
        for (let i = 0; i < window; i++) {
          const delta = data[i] - data[i + tau];
          sum += delta * delta;
        }
        running += sum;
        difference[tau] = running === 0 ? 1 : (sum * tau) / running;
      }
      let tau = minTau;
      while (tau < maxTau && difference[tau] > 0.15) tau++;
      if (tau === maxTau) return result;
      while (tau + 1 < maxTau && difference[tau + 1] < difference[tau]) tau++;
      // A weak fundamental under a loud upper harmonic can satisfy YIN's first
      // threshold at a fraction of the true period. Compare interpolated troughs:
      // a pure high note also has troughs at multiples, but no material improvement.
      const periodError = (index: number) => {
        const left = difference[index - 1];
        const center = difference[index];
        const right = difference[index + 1];
        const denominator = 2 * (2 * center - right - left);
        const correction = denominator ? (right - left) / denominator : 0;
        const lag = (index + Math.max(-1, Math.min(1, correction))) * stride;
        const whole = Math.floor(lag),
          fraction = lag - whole;
        let cross = 0,
          firstPower = 0,
          shiftedPower = 0;
        // Compare at the original sample rate. Coarse YIN trough heights can
        // otherwise favor a lower octave merely due to sample-grid alignment.
        for (let i = 0; i + whole + 1 < pcm.length; i++) {
          const shifted =
            pcm[i + whole] * (1 - fraction) + pcm[i + whole + 1] * fraction;
          cross += pcm[i] * shifted;
          firstPower += pcm[i] ** 2;
          shiftedPower += shifted ** 2;
        }
        const power = Math.sqrt(firstPower * shiftedPower);
        return power ? Math.max(0, 1 - cross / power) : 1;
      };
      const firstError = periodError(tau);
      if (firstError > 0.005) {
        const frequencyAt = (index: number) => {
          const left = difference[index - 1],
            center = difference[index],
            right = difference[index + 1];
          const denominator = 2 * (2 * center - right - left);
          return (
            rate / (index + (denominator ? (right - left) / denominator : 0))
          );
        };
        const spectralPower = (hz: number) => {
          let real = 0,
            imaginary = 0;
          for (let i = 0; i < pcm.length; i++) {
            const value =
              pcm[i] *
              (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (pcm.length - 1)));
            const phase = (2 * Math.PI * hz * i) / sampleRate;
            real += value * Math.cos(phase);
            imaginary += value * Math.sin(phase);
          }
          return real ** 2 + imaginary ** 2;
        };
        const firstPower = spectralPower(frequencyAt(tau));
        for (let candidate = tau + 1; candidate < maxTau; candidate++) {
          if (
            difference[candidate] > difference[candidate - 1] ||
            difference[candidate] >= difference[candidate + 1]
          )
            continue;
          const error = periodError(candidate);
          // Frequency modulation penalizes a longer period more than its upper
          // harmonic. In that case require actual fundamental spectral energy,
          // rather than forcing its error to beat the shorter period's error.
          if (
            error < firstError * 0.5 ||
            (error < 0.08 &&
              spectralPower(frequencyAt(candidate)) > firstPower * 0.001)
          ) {
            tau = candidate;
            break;
          }
        }
      }
      const left = difference[tau - 1];
      const center = difference[tau];
      const right = difference[tau + 1];
      const denominator = 2 * (2 * center - right - left);
      const correction = denominator ? (right - left) / denominator : 0;
      const hz = rate / (tau + Math.max(-1, Math.min(1, correction)));
      const confidence = Math.max(0, Math.min(1, 1 - center));
      result.confidence = confidence;
      if (hz >= 65 && hz <= 1100 && confidence >= PITCH_MIN_CONFIDENCE)
        result.hz = hz;
      return result;
    },
  };
}

/** Stateless convenience; capture adapters retain their own analyzer instance. */
export function estimatePitch(
  pcm: Float32Array,
  sampleRate: number,
): PitchEstimate {
  return createPitchAnalyzer(sampleRate, pcm.length).analyze(pcm);
}

export function frequencyPitch(
  hz: number,
): { midi: number; cents: number } | null {
  if (!Number.isFinite(hz) || hz <= 0) return null;
  const exact = 69 + 12 * Math.log2(hz / 440);
  const midi = Math.round(exact);
  return { midi, cents: (exact - midi) * 100 };
}
