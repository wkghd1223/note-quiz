import type { synth } from "@coderline/alphatab";

export interface PianoNote {
  midi: number;
  /** The caller's existing 95% articulation, in seconds. */
  durationSec: number;
}

const soundFontUrl = "/alphatab/soundfont/sonivox.sf2";
const maxBufferBytes = 64 * 1024 * 1024;
let fontRequest: Promise<Uint8Array> | undefined;

function soundFont(): Promise<Uint8Array> {
  fontRequest ??= fetch(soundFontUrl)
    .then(async (response) => {
      if (!response.ok) throw new Error("Piano soundfont could not load");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 12 || bytes.length > 4 * 1024 * 1024)
        throw new Error("Invalid piano soundfont size");
      return bytes;
    })
    .catch((error: unknown) => {
      fontRequest = undefined;
      throw error;
    });
  return fontRequest;
}

export function pianoNoteKey(note: PianoNote): string {
  if (
    !Number.isInteger(note.midi) ||
    note.midi < 0 ||
    note.midi > 127 ||
    !Number.isFinite(note.durationSec) ||
    note.durationSec < 0.02 ||
    note.durationSec > 10
  )
    throw new RangeError("Invalid piano note");
  return `${note.midi}:${note.durationSec}`;
}

/** Fits within the caller's remaining 5% articulation gap, including short notes. */
export function pianoReleaseSec(durationSec: number): number {
  return Math.min(0.035, durationSec / 20);
}

/** No audio output, AudioContext or real-time playback; used only by offline export. */
function offlineOutput(sampleRate: number): synth.ISynthOutput {
  const event = { on: () => () => {}, off: () => {} };
  return {
    sampleRate,
    ready: event,
    sampleRequest: event,
    samplesPlayed: event,
    open() {},
    play() {},
    pause() {},
    destroy() {},
    addSamples() {},
    resetSamples() {},
    activate() {},
    async enumerateOutputDevices() {
      return [];
    },
    async setOutputDevice() {},
    async getOutputDevice() {
      return null;
    },
  };
}

/** Validate and deinterleave native stereo PCM, trimming only trailing block rounding. */
export function pianoBuffer(
  context: Pick<AudioContext, "sampleRate" | "createBuffer">,
  note: PianoNote,
  samples: Float32Array | undefined,
): AudioBuffer {
  pianoNoteKey(note);
  const frames = Math.ceil(
    (note.durationSec + pianoReleaseSec(note.durationSec)) * context.sampleRate,
  );
  if (
    !samples ||
    samples.length % 2 !== 0 ||
    samples.length < frames * 2 ||
    samples.length > (frames + 64) * 2
  )
    throw new Error("Invalid piano PCM length");
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (!Number.isFinite(sample)) throw new Error("Invalid piano PCM sample");
    if (i < frames * 2) peak = Math.max(peak, Math.abs(sample));
  }
  if (peak === 0 || peak > 1) throw new Error("Invalid piano PCM level");
  const buffer = context.createBuffer(2, frames, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = new Float32Array(frames);
    const releaseStart = Math.floor(note.durationSec * context.sampleRate);
    for (let i = 0; i < frames; i++) {
      const attack = Math.min(1, i / (context.sampleRate * 0.001));
      const release =
        i < releaseStart
          ? 1
          : (frames - 1 - i) / Math.max(1, frames - 1 - releaseStart);
      data[i] = samples[i * 2 + channel] * attack * release;
    }
    buffer.copyToChannel(data, channel);
  }
  return buffer;
}

/** Prepare only this exercise's unique notes; the only shared cache is font bytes. */
export async function preparePianoBuffers(
  context: Pick<AudioContext, "sampleRate" | "createBuffer">,
  notes: readonly PianoNote[],
  isCurrent: () => boolean,
): Promise<Map<string, AudioBuffer>> {
  if (
    !Number.isFinite(context.sampleRate) ||
    context.sampleRate < 8000 ||
    context.sampleRate > 192000
  )
    throw new RangeError("Invalid piano sample rate");
  if (notes.length > 128) throw new RangeError("Too many piano notes");
  const unique = new Map(
    notes.map((note) => [pianoNoteKey(note), { ...note }]),
  );
  let bytes = 0;
  for (const note of unique.values())
    bytes +=
      Math.ceil(
        (note.durationSec + pianoReleaseSec(note.durationSec)) *
          context.sampleRate,
      ) * 8;
  if (bytes > maxBufferBytes)
    throw new RangeError("Piano buffers exceed session limit");
  const result = new Map<string, AudioBuffer>();
  if (!isCurrent() || unique.size === 0) return result;
  const [alphaTab, font] = await Promise.all([
    import("@coderline/alphatab"),
    soundFont(),
  ]);
  if (!isCurrent()) return result;
  const player = new alphaTab.synth.AlphaSynth(
    offlineOutput(context.sampleRate),
    0,
  );
  try {
    let loadError: Error | undefined;
    const unsubscribe = player.soundFontLoadFailed.on((error) => {
      loadError = error;
    });
    player.loadSoundFont(font, false);
    unsubscribe();
    if (loadError) {
      fontRequest = undefined;
      throw loadError;
    }
    for (const [key, note] of unique) {
      if (!isCurrent()) return new Map();
      const midi = new alphaTab.midi.MidiFile();
      midi.division = 960;
      midi.addEvent(new alphaTab.midi.TempoChangeEvent(0, 1000000));
      midi.addEvent(new alphaTab.midi.ProgramChangeEvent(0, 0, 0, 0));
      midi.addEvent(new alphaTab.midi.NoteOnEvent(0, 0, 0, note.midi, 90));
      midi.addEvent(
        new alphaTab.midi.NoteOffEvent(
          0,
          Math.round(note.durationSec * 960),
          0,
          note.midi,
          0,
        ),
      );
      const total = note.durationSec + pianoReleaseSec(note.durationSec);
      midi.addEvent(
        new alphaTab.midi.EndOfTrackEvent(
          0,
          Math.ceil((total + 64 / context.sampleRate) * 960),
        ),
      );
      const options = new alphaTab.synth.AudioExportOptions();
      options.sampleRate = context.sampleRate;
      options.masterVolume = 0.32;
      options.metronomeVolume = 0;
      options.useSyncPoints = false;
      const exporter = player.exportAudio(options, midi, [], new Map());
      result.set(
        key,
        pianoBuffer(context, note, exporter.render(total * 1000)?.samples),
      );
      // Preparation yields only; no wall-clock timer participates in playback.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    return isCurrent() ? result : new Map();
  } catch (error) {
    fontRequest = undefined;
    throw error;
  } finally {
    player.destroy();
  }
}
