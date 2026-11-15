/** Device presentation time, without guessing a fixed Bluetooth/speaker delay.
 * Capture timestamps remain on the original audio clock for event measurement.
 */
export function playbackAudioTime(
  context: { currentTime: number; getOutputTimestamp?: () => AudioTimestamp },
  performanceMs = performance.now(),
): number {
  const stamp = context.getOutputTimestamp?.();
  const age =
    stamp?.performanceTime === undefined
      ? Infinity
      : performanceMs - stamp.performanceTime;
  if (!stamp?.contextTime || age < 0 || age > 250) return context.currentTime;
  const presented = stamp.contextTime + age / 1000;
  return Number.isFinite(presented)
    ? Math.max(0, Math.min(context.currentTime, presented))
    : context.currentTime;
}
