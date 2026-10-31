import { getNoteFrequency } from "./utils";

class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private resuming: Promise<void> | null = null;
  private volume = 0.3;

  async initialize(): Promise<void> {
    if (!this.context || this.context.state === "closed") {
      if (typeof window === "undefined")
        throw new Error("Audio is not available");
      const AudioContextConstructor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextConstructor) throw new Error("Audio is not supported");
      const context = new AudioContextConstructor();
      const master = context.createGain();
      master.gain.value = this.volume;
      master.connect(context.destination);
      this.context = context;
      this.master = master;
    }
    // Browsers can suspend a previously initialized context after backgrounding.
    if (this.context.state !== "running") {
      this.resuming ??= this.context.resume().finally(() => {
        this.resuming = null;
      });
      await this.resuming;
    }
  }

  getAudioContext(): AudioContext {
    if (!this.context || this.context.state === "closed")
      throw new Error("Audio context is not initialized");
    return this.context;
  }
  getMasterGain(): GainNode {
    if (!this.master) throw new Error("Audio context is not initialized");
    return this.master;
  }
  setVolume(volume: number) {
    this.volume = Number.isFinite(volume)
      ? Math.max(0, Math.min(1, volume))
      : 0.3;
    if (this.master) this.master.gain.value = this.volume;
  }
  dispose() {
    const context = this.context;
    this.context = null;
    this.master = null;
    this.resuming = null;
    if (context && context.state !== "closed")
      void context.close().catch(() => {});
  }
}

const audioManager = new AudioManager();
interface ActiveVoice {
  stop: () => void;
}
const activeVoices = new Set<ActiveVoice>();
let playbackGeneration = 0;

/** Cancel both sounding and future scheduled notes. Pending playback settles safely. */
export function stopAllNotes(): void {
  playbackGeneration++;
  for (const voice of Array.from(activeVoices)) voice.stop();
}

function scheduleVoice(
  note: Note,
  start: number,
  duration: number,
  volume: number,
  waveType: OscillatorType,
  piano: boolean,
): Promise<void> {
  const context = audioManager.getAudioContext();
  const gain = context.createGain();
  gain.connect(audioManager.getMasterGain());
  const frequency = getNoteFrequency(note);
  // Harmonic weights sum to one, so a chord's voices retain a bounded peak.
  const harmonics = piano
    ? [1 / 1.42, 0.28 / 1.42, 0.1 / 1.42, 0.04 / 1.42]
    : [1];
  const nodes = harmonics.flatMap((weight, index) => {
    if (frequency * (index + 1) >= (context.sampleRate || 44100) / 2) return [];
    const oscillator = context.createOscillator();
    const harmonicGain = context.createGain();
    oscillator.type = waveType;
    oscillator.frequency.setValueAtTime(frequency * (index + 1), start);
    harmonicGain.gain.value = weight;
    oscillator.connect(harmonicGain);
    harmonicGain.connect(gain);
    return [{ oscillator, harmonicGain }];
  });
  const end = start + duration;
  const attackEnd = start + Math.min(0.01, duration / 4);
  const decayEnd = start + Math.min(0.17, duration / 2);
  const releaseStart = Math.max(decayEnd, end - Math.min(0.28, duration / 3));
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, attackEnd);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, volume * (piano ? 0.24 : 0.7)),
    decayEnd,
  );
  gain.gain.setValueAtTime(
    Math.max(0.0001, volume * (piano ? 0.24 : 0.7)),
    releaseStart,
  );
  gain.gain.linearRampToValueAtTime(0.0001, end);

  return new Promise<void>((resolve) => {
    let settled = false;
    const voice: ActiveVoice = { stop: () => finish(true) };
    function finish(stop: boolean) {
      if (settled) return;
      settled = true;
      activeVoices.delete(voice);
      for (const { oscillator, harmonicGain } of nodes) {
        oscillator.onended = null;
        if (stop) {
          try {
            oscillator.stop(context.currentTime);
          } catch {
            /* Already ended. */
          }
        }
        oscillator.disconnect();
        harmonicGain.disconnect();
      }
      gain.disconnect();
      resolve();
    }
    // All harmonics share exactly the same start/end time.
    nodes[0].oscillator.onended = () => finish(false);
    activeVoices.add(voice);
    for (const { oscillator } of nodes) {
      oscillator.start(start);
      oscillator.stop(end);
    }
  });
}

async function playGroups(
  groups: readonly (readonly Note[])[],
  durationMs: number,
  gapMs: number,
  waveType: OscillatorType,
  piano: boolean,
): Promise<void> {
  stopAllNotes();
  const generation = playbackGeneration;
  if (!groups.length) return;
  if (
    groups.length > 64 ||
    groups.some((group) => !group.length || group.length > 16)
  )
    throw new RangeError("Invalid audio sequence");
  // Validate before creating audio nodes, including unsupported notes.
  groups.forEach((group) => group.forEach(getNoteFrequency));
  const duration =
    Math.max(
      40,
      Math.min(10000, Number.isFinite(durationMs) ? durationMs : 650),
    ) / 1000;
  const gap =
    Math.max(0, Math.min(2000, Number.isFinite(gapMs) ? gapMs : 120)) / 1000;
  try {
    await audioManager.initialize();
  } catch (error) {
    if (generation !== playbackGeneration) return;
    throw error;
  }
  if (generation !== playbackGeneration) return;
  const start = audioManager.getAudioContext().currentTime + 0.01;
  const promises = groups.flatMap((group, index) =>
    group.map((note) =>
      scheduleVoice(
        note,
        start + index * (duration + gap),
        duration,
        1 / group.length,
        waveType,
        piano,
      ),
    ),
  );
  await Promise.all(promises);
}

export function playNote(
  note: Note,
  duration = 1000,
  waveType: OscillatorType = "sine",
): Promise<void> {
  return playGroups([[note]], duration, 0, waveType, false);
}
export function playPianoNote(note: Note, duration = 1000): Promise<void> {
  return playGroups([[note]], duration, 0, "sine", true);
}
export function playChord(
  notes: Note[],
  duration = 1000,
  waveType: OscillatorType = "sine",
): Promise<void> {
  return playGroups([notes], duration, 0, waveType, false);
}
export function playArpeggio(
  notes: Note[],
  noteDuration = 500,
  gap = 100,
  waveType: OscillatorType = "sine",
): Promise<void> {
  return playGroups(
    notes.map((note) => [note]),
    noteDuration,
    gap,
    waveType,
    false,
  );
}
/** One clock for the entire interval, chord or tonal-context progression. */
export function playSequence(
  groups: Note[][],
  duration = 650,
  gap = 120,
): Promise<void> {
  return playGroups(groups, duration, gap, "sine", true);
}
export function setVolume(volume: number): void {
  audioManager.setVolume(volume);
}
export function initializeAudio(): Promise<void> {
  return audioManager.initialize();
}
export function disposeAudio(): void {
  stopAllNotes();
  audioManager.dispose();
}
export function getAudioContextState(): AudioContextState | null {
  try {
    return audioManager.getAudioContext().state;
  } catch {
    return null;
  }
}
