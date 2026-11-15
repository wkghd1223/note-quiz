export function clampInputOffset(value: number): number {
  return Number.isFinite(value)
    ? Math.max(-250, Math.min(250, Math.round(value)))
    : 0;
}

/** Suggested combined reaction/device offset, never an automatic hardware calibration. */
export function suggestInputOffset(errorsMs: readonly number[]): {
  offsetMs: number;
  reliable: boolean;
} {
  const finite = errorsMs.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length < 6) return { offsetMs: 0, reliable: false };
  const median = finite[Math.floor(finite.length / 2)];
  const deviations = finite
    .map((value) => Math.abs(value - median))
    .sort((a, b) => a - b);
  return {
    offsetMs: clampInputOffset(median),
    reliable:
      deviations[Math.floor(deviations.length / 2)] <= 60 &&
      Math.abs(median) <= 250,
  };
}
