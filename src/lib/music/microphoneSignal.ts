export interface MicrophoneSignal {
  rms: number;
  frequencyHz: number | null;
  /** Actual analyzer magnitudes, normalized to 0..1. Never animated random data. */
  bins: Float32Array;
}

export function emptyMicrophoneSignal(): MicrophoneSignal {
  return { rms: 0, frequencyHz: null, bins: new Float32Array(24) };
}

export function updateMicrophoneSignal(
  signal: MicrophoneSignal,
  timeData: Float32Array,
  frequencyData: Float32Array,
  sampleRate: number,
  frequencyHz: number | null,
): void {
  let energy = 0;
  for (const value of timeData) energy += value * value;
  signal.rms =
    Number.isFinite(energy) && timeData.length
      ? Math.sqrt(energy / timeData.length)
      : 0;
  signal.frequencyHz = frequencyHz;
  for (let i = 0; i < signal.bins.length; i++) {
    const lowHz = 65 * (2000 / 65) ** (i / signal.bins.length);
    const highHz = 65 * (2000 / 65) ** ((i + 1) / signal.bins.length);
    const low = Math.max(
      0,
      Math.floor((lowHz * frequencyData.length * 2) / sampleRate),
    );
    const high = Math.min(
      frequencyData.length - 1,
      Math.max(
        low,
        Math.ceil((highHz * frequencyData.length * 2) / sampleRate),
      ),
    );
    let peak = -100;
    for (let j = low; j <= high; j++) peak = Math.max(peak, frequencyData[j]);
    signal.bins[i] =
      signal.rms < 0.003 ? 0 : Math.max(0, Math.min(1, (peak + 90) / 70));
  }
}
