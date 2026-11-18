/** Estimates the frequencies actually present in one capture window. The score
 * is consulted only after finding the spectral peaks. No prior pitch survives
 * into the next observation. */
interface SpectralPeak {
  hz: number;
  amplitude: number;
}

class WindowSpectrum {
  private readonly size: number;
  private readonly real: Float64Array;
  private readonly imaginary: Float64Array;
  private readonly power: Float64Array;
  private readonly reversal: Uint32Array;
  private readonly cos: Float64Array;
  private readonly sin: Float64Array;
  private readonly window: Float64Array;

  constructor(readonly length: number) {
    // Zero padding refines peak interpolation. The Hann window still has the
    // physical duration of the measured PCM and its associated resolution.
    this.size = 2 ** Math.ceil(Math.log2(2 * length));
    this.real = new Float64Array(this.size);
    this.imaginary = new Float64Array(this.size);
    this.power = new Float64Array(this.size / 2);
    this.reversal = new Uint32Array(this.size);
    this.cos = new Float64Array(this.size / 2);
    this.sin = new Float64Array(this.size / 2);
    this.window = Float64Array.from(
      { length },
      (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1)),
    );
    for (let i = 1; i < this.size; i++)
      this.reversal[i] =
        (this.reversal[i >> 1] >> 1) | (((i & 1) * this.size) / 2);
    for (let i = 0; i < this.cos.length; i++) {
      const angle = (-2 * Math.PI * i) / this.size;
      this.cos[i] = Math.cos(angle);
      this.sin[i] = Math.sin(angle);
    }
  }

  peaks(pcm: Float32Array, rate: number): SpectralPeak[] {
    const { real, imaginary, size, power } = this;
    real.fill(0);
    imaginary.fill(0);
    let energy = 0;
    for (let i = 0; i < pcm.length; i++) {
      const sample = pcm[i];
      if (!Number.isFinite(sample)) return [];
      energy += sample * sample;
      real[this.reversal[i]] = sample * this.window[i];
    }
    if (energy < this.length * 0.003 ** 2) return [];
    for (let width = 2; width <= size; width *= 2) {
      const half = width / 2;
      const stride = size / width;
      for (let start = 0; start < size; start += width) {
        for (let offset = 0; offset < half; offset++) {
          const a = start + offset;
          const b = a + half;
          const twiddle = stride * offset;
          const re =
            this.cos[twiddle] * real[b] - this.sin[twiddle] * imaginary[b];
          const im =
            this.sin[twiddle] * real[b] + this.cos[twiddle] * imaginary[b];
          real[b] = real[a] - re;
          imaginary[b] = imaginary[a] - im;
          real[a] += re;
          imaginary[a] += im;
        }
      }
    }
    let maxPower = 0;
    for (let i = 0; i < power.length; i++) {
      power[i] = real[i] ** 2 + imaginary[i] ** 2;
      maxPower = Math.max(maxPower, power[i]);
    }
    // Suppress Hann sidelobes as well as broadband noise. A sparse sine's DFT
    // magnitude scales with N; incoherent noise increases only with sqrt(N).
    const threshold = Math.max(
      maxPower * 0.0025,
      energy * this.length * 0.0015,
    );
    const peaks: SpectralPeak[] = [];
    for (let i = 2; i < power.length - 1; i++) {
      const peak = power[i];
      if (peak < threshold || peak <= power[i - 1] || peak < power[i + 1])
        continue;
      const left = Math.log(Math.max(Number.MIN_VALUE, power[i - 1]));
      const right = Math.log(Math.max(Number.MIN_VALUE, power[i + 1]));
      const center = Math.log(peak);
      const delta = (0.5 * (left - right)) / (left - 2 * center + right);
      const hz = ((i + Math.max(-0.5, Math.min(0.5, delta))) * rate) / size;
      peaks.push({ hz, amplitude: Math.sqrt(peak) });
    }
    return peaks;
  }
}

const centsApart = (a: number, b: number) => Math.abs(1200 * Math.log2(a / b));

function explainedByOvertone(peak: SpectralPeak, lower: SpectralPeak): boolean {
  const multiple = Math.round(peak.hz / lower.hz);
  if (
    multiple < 2 ||
    multiple > 12 ||
    centsApart(peak.hz, lower.hz * multiple) > 35
  )
    return false;
  // A partial at a higher key is not by itself another played note. For an
  // exact octave or twelfth require energy beyond an ordinary overtone of the
  // lower key. Ambiguous blends can consequently require a clearer attack.
  return peak.amplitude <= lower.amplitude * (1.45 / Math.sqrt(multiple * 1.6));
}

/** A long window can resolve two low neighbours even when a player alternates
 * them. Inspect its latest short slice as well. A single sustained key repeats
 * almost exactly after a few periods; a simultaneous non-harmonic neighbour
 * has a different phase at that lag. Exact octave blends remain subject to
 * the independent overtone check above. */
function recentlyOneTone(
  pcm: Float32Array,
  rate: number,
  hz: number,
  writtenHz: number,
  expected: readonly number[],
): boolean {
  const length = Math.ceil(rate * Math.max(0.007, 1.3 / hz));
  let lag = 0;
  for (let periods = 1; periods <= 3; periods++) {
    const candidate = (rate * periods) / hz;
    if (Math.ceil(candidate) + length >= pcm.length) break;
    let separation = 0;
    for (const other of expected) {
      const phase = (Math.PI * periods * other) / writtenHz;
      separation = Math.max(separation, Math.abs(Math.sin(phase)));
    }
    if (separation > 0.28) {
      lag = candidate;
      break;
    }
  }
  if (!lag) return false;
  const whole = Math.floor(lag);
  const fraction = lag - whole;
  const stride = Math.max(1, Math.floor(length / 384));
  let recentEnergy = 0,
    delayedEnergy = 0,
    cross = 0;
  for (let i = pcm.length - length; i < pcm.length; i += stride) {
    const recent = pcm[i];
    const delayed =
      pcm[i - whole] * (1 - fraction) + pcm[i - whole - 1] * fraction;
    recentEnergy += recent * recent;
    delayedEnergy += delayed * delayed;
    cross += recent * delayed;
  }
  return (
    cross > 0 && cross * cross > 0.9995 ** 2 * recentEnergy * delayedEnergy
  );
}

export function createChordDetector() {
  let spectrum: WindowSpectrum | undefined;
  return (
    pcm: Float32Array,
    rate: number,
    midis: readonly number[],
  ): boolean => {
    if (
      !Number.isFinite(rate) ||
      rate <= 0 ||
      pcm.length < 128 ||
      !midis.length
    )
      return false;
    if (spectrum?.length !== pcm.length)
      spectrum = new WindowSpectrum(pcm.length);
    const peaks = spectrum.peaks(pcm, rate);
    const expected = midis.map((midi) => 440 * 2 ** ((midi - 69) / 12));
    return expected.every((targetHz) => {
      const peak = peaks.find((item) => centsApart(item.hz, targetHz) <= 42);
      return (
        peak !== undefined &&
        !peaks.some((lower) => explainedByOvertone(peak, lower)) &&
        (expected.length === 1 ||
          (!recentlyOneTone(pcm, rate, peak.hz, targetHz, expected) &&
            !recentlyOneTone(pcm, rate, targetHz, targetHz, expected)))
      );
    });
  };
}
