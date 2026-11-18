import type { TargetEvent } from "../domain/performance";
import type { ChallengeAudioSession } from "./microphone";

export interface ReferencePlayback {
  durationSec: number;
  tones: { midi: number; offsetSec: number; durationSec: number }[];
}
// Equivalent beat boundaries can differ after subtraction/multiplication. A
// nanosecond overlap is numerical roundoff, far below one PCM sample; never
// turn it into a piano note or use the piano minimum duration as a filter.
const boundaryRoundoffSec = 1e-9;

/** Keep written rests and trailing silence; only target notes make sound. */
export function referencePlayback(
  targets: readonly TargetEvent[],
  startSec: number,
  endSec: number,
): ReferencePlayback {
  if (
    !Number.isFinite(startSec) ||
    !Number.isFinite(endSec) ||
    endSec <= startSec
  )
    throw new RangeError("Invalid reference range");
  return {
    durationSec: endSec - startSec,
    tones: targets.flatMap((target) => {
      const start = Math.max(startSec, target.startAudioSec);
      const end = Math.min(endSec, target.endAudioSec);
      return target.kind === "note" &&
        target.targetConcertMidi !== null &&
        end - start > boundaryRoundoffSec
        ? [
            {
              midi: target.targetConcertMidi,
              offsetSec: start - startSec,
              durationSec: (end - start) * 0.95,
            },
          ]
        : [];
    }),
  };
}
/** Both example and review use the existing piano, clock and cancellation owner. */
export async function scheduleReferencePlayback(
  audio: Pick<ChallengeAudioSession, "context" | "preparePiano" | "pianoTone">,
  playback: ReferencePlayback,
  current: () => boolean,
): Promise<number | null> {
  await audio.preparePiano(
    playback.tones.map(({ midi, durationSec }) => ({ midi, durationSec })),
  );
  if (!current()) return null;
  const start = audio.context.currentTime + 0.08;
  for (const tone of playback.tones)
    audio.pianoTone(tone.midi, start + tone.offsetSec, tone.durationSec);
  return start;
}
