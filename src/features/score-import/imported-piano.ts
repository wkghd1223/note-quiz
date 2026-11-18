import {
  pianoNoteKey,
  preparePianoBuffers,
} from "@/features/challenge/audio/piano";
import type { ImportedTimeline } from "./types";

/** One local piano sample per required key, shared across repeats and note
 * lengths. Rendering an entire imported piece into one PCM buffer can exceed
 * the browser memory budget even for a modest score. */
export async function prepareImportedPiano(
  context: AudioContext,
  notes: ImportedTimeline["notes"],
  current: () => boolean,
) {
  const perKey = new Map<number, number>();
  for (const { midi, startSec, endSec } of notes) {
    const length = Math.max(0.12, Math.min(1.2, endSec - startSec));
    perKey.set(midi, Math.max(perKey.get(midi) ?? 0, length));
  }
  const requests = [...perKey].map(([midi, durationSec]) => ({
    midi,
    durationSec,
  }));
  const buffers = await preparePianoBuffers(
    {
      // alphaTab 1.9's Sonivox export produces non-finite samples at 32 kHz.
      // Render on its supported 44.1 kHz clock: Web Audio resamples each
      // buffer to the output device, and even all 128 keys fit the 64 MiB cap.
      sampleRate: 44100,
      createBuffer: context.createBuffer.bind(context),
    },
    requests,
    current,
  );
  return (midi: number, at: number, duration: number) => {
    const sampleLength = perKey.get(midi);
    if (!sampleLength) return;
    const buffer = buffers.get(
      pianoNoteKey({ midi, durationSec: sampleLength }),
    );
    if (!buffer) return;
    const source = context.createBufferSource();
    const envelope = context.createGain();
    source.buffer = buffer;
    source.connect(envelope);
    envelope.connect(context.destination);
    envelope.gain.setValueAtTime(0.85, at);
    if (duration > sampleLength) {
      // Use a whole number of fundamental periods in the sustain loop. Let
      // the gain decay on long ties rather than retriggering the piano attack.
      const hz = 440 * 2 ** ((midi - 69) / 12);
      const cycles = Math.max(1, Math.round(0.18 * hz));
      source.loop = true;
      source.loopEnd = sampleLength - 0.035;
      source.loopStart = Math.max(0.02, source.loopEnd - cycles / hz);
      envelope.gain.setValueAtTime(0.85, at + sampleLength - 0.04);
      envelope.gain.exponentialRampToValueAtTime(0.3, at + duration - 0.02);
    } else envelope.gain.setValueAtTime(0.85, at + duration * 0.9);
    envelope.gain.linearRampToValueAtTime(0, at + duration);
    source.onended = () => {
      source.disconnect();
      envelope.disconnect();
    };
    source.start(at);
    source.stop(at + duration);
  };
}
