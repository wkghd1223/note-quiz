import type { PerformanceEvent, TargetEvent } from "./performance";
// Global monotone alignment: gaps allow a missed first note without shifting all
// later answers; each observed attack can be consumed only once.
export function matchEvents(
  input: PerformanceEvent[],
  targets: TargetEvent[],
  offsetMs = 0,
): Map<string, PerformanceEvent> {
  const notes = targets.filter((target) => target.kind === "note");
  const seen = new Set<string>();
  const events = input
    .filter((event) => {
      if (seen.has(event.eventId) || !Number.isFinite(event.onsetAudioSec))
        return false;
      seen.add(event.eventId);
      return true;
    })
    .sort(
      (a, b) =>
        a.onsetAudioSec - b.onsetAudioSec || a.eventId.localeCompare(b.eventId),
    );
  const n = notes.length,
    m = events.length;
  const cost = Array.from(
    { length: n + 1 },
    () => Array(m + 1).fill(Infinity) as number[],
  );
  const path = Array.from(
    { length: n + 1 },
    () => Array(m + 1).fill("") as string[],
  );
  cost[0][0] = 0;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      const update = (x: number, y: number, value: number, step: string) => {
        if (value < cost[x][y]) {
          cost[x][y] = value;
          path[x][y] = step;
        }
      };
      if (i < n) update(i + 1, j, cost[i][j] + 1.3, "miss");
      if (j < m) update(i, j + 1, cost[i][j] + 0.45, "extra");
      if (i < n && j < m) {
        const target = notes[i],
          event = events[j],
          duration = target.endAudioSec - target.startAudioSec;
        const delta = Math.abs(
          event.onsetAudioSec - offsetMs / 1000 - target.startAudioSec,
        );
        const window = Math.min(0.45, duration * 0.45);
        if (delta <= window + 1e-9) {
          const pitch =
            event.observedMidi === null
              ? 0.3
              : Math.min(
                  0.6,
                  Math.abs(event.observedMidi - target.targetConcertMidi!) *
                    0.15,
                );
          update(i + 1, j + 1, cost[i][j] + delta / window + pitch, "match");
        }
      }
    }
  const matches = new Map<string, PerformanceEvent>();
  let i = n,
    j = m;
  while (i > 0 || j > 0) {
    const step = path[i][j];
    if (step === "match") {
      matches.set(notes[i - 1].stageEventId, events[j - 1]);
      i--;
      j--;
    } else if (step === "miss") i--;
    else if (step === "extra") j--;
    else break;
  }
  return matches;
}
