/** Reproducible local exercises. The seed contains date/configuration only. */
export function seededRandom(seed: string): () => number {
  let value = 2166136261;
  for (const character of seed)
    value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return () => {
    value += 0x6d2b79f5;
    let next = Math.imul(value ^ (value >>> 15), value | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
