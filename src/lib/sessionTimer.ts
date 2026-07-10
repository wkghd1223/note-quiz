export function hasReachedTimeLimit(
  elapsedTime: number,
  timeLimitSeconds?: number,
): boolean {
  return Boolean(timeLimitSeconds && elapsedTime >= timeLimitSeconds * 1000);
}
