import {
  emptyMicrophoneSignal,
  updateMicrophoneSignal,
  type MicrophoneSignal,
} from "@/lib/music/microphoneSignal";
import type { InputFrame, PerformanceEvent } from "../domain/performance";
import { createPitchAnalyzer, hasReliablePitch } from "./pitch";
import { NoteEventDetector, microphoneEnergyGates } from "./onset-offset";
import { createInputQualityObserver } from "@/lib/music/input-quality";
import { pianoNoteKey, preparePianoBuffers, type PianoNote } from "./piano";

export type ChallengeAudioError =
  | "unsupported"
  | "denied"
  | "missing-device"
  | "device-busy"
  | "suspended"
  | "audio-error";

export function classifyAudioError(error: unknown): ChallengeAudioError {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "missing-device";
  if (name === "NotReadableError" || name === "AbortError")
    return "device-busy";
  return "audio-error";
}

/** Short click / high inharmonic bell PCM, shared by scheduling and fixtures. */
export function beatCuePcm(
  sampleRate: number,
  kind: "beat" | "bar",
): Float32Array {
  const duration = kind === "bar" ? 0.045 : 0.028;
  const pcm = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = 0x6d2b79f5,
    previous = 0;
  for (let i = 0; i < pcm.length; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 0xffffffff) * 2 - 1;
    const click =
      (noise - previous) * Math.exp(-t * (kind === "bar" ? 95 : 240));
    previous = noise;
    const bell =
      kind === "bar"
        ? (Math.sin(2 * Math.PI * 2639 * t) +
            0.65 * Math.sin(2 * Math.PI * 4177 * t) +
            0.4 * Math.sin(2 * Math.PI * 5987 * t)) *
          Math.exp(-t * 95)
        : 0;
    // Short fade-in/out prevents a buffer edge from adding a second click.
    const edge = Math.min(1, t / 0.001, (duration - t) / 0.004);
    pcm[i] = (0.045 * click + 0.02 * bell) * Math.max(0, edge);
  }
  return pcm;
}

interface SessionCallbacks {
  signal?: MicrophoneSignal;
  onFrame: (frame: InputFrame) => void;
  /** Synchronous analysis only. The worklet reclaims this window on return. */
  onSamples?: (
    pcm: Float32Array,
    sampleRate: number,
    frame: InputFrame & { pitchAudioTimeSec: number },
    energyGate: number,
  ) => void;
  onEvent: (event: PerformanceEvent) => void;
  onError: (error: ChallengeAudioError) => void;
}

/** Owns one audio clock. Construct/resume from an explicit user gesture only. */
export class ChallengeAudioSession {
  readonly context: AudioContext;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private capture: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  readonly signal: MicrophoneSignal;
  private detector = new NoteEventDetector();
  private generation = 0;
  private disposed = false;
  private collectAfter = Infinity;
  private collectionPrefix = "mic";
  private collectionStarted = false;
  private calibration: number[] = [];
  private pendingCalibration: Array<{
    audioTimeSec: number;
    hopEndAudioSec: number;
    rms: number;
  }> = [];
  private noiseFloor = 0.003;
  private tones = new Set<AudioScheduledSourceNode>();
  private lastUiFrame = -Infinity;
  private lastCaptureAudioSec = -Infinity;
  private pianoGeneration = 0;
  private pianoBuffers = new Map<string, AudioBuffer>();
  appliedSettings: MediaTrackSettings | null = null;

  constructor(private callbacks: SessionCallbacks) {
    this.signal = callbacks.signal ?? emptyMicrophoneSignal();
    this.context = new AudioContext();
    this.context.onstatechange = () => {
      if (!this.disposed && this.context.state === "suspended")
        callbacks.onError("suspended");
    };
  }

  get processedThroughAudioSec(): number {
    return this.lastCaptureAudioSec;
  }

  get finalizedBeforeAudioSec(): number {
    return this.detector.finalizedBeforeAudioSec;
  }

  async resume() {
    await this.context.resume();
    if (this.context.state !== "running")
      throw new Error("Audio context did not resume");
  }

  async connectMicrophone(): Promise<boolean> {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      !this.context.audioWorklet ||
      typeof AudioWorkletNode === "undefined"
    ) {
      this.callbacks.onError("unsupported");
      return false;
    }
    const generation = ++this.generation;
    try {
      // Unlock while the permission-triggering user gesture is still active.
      await this.resume();
      if (this.disposed || generation !== this.generation) return false;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      if (this.disposed || generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      this.stream = stream;
      this.appliedSettings = stream.getAudioTracks()[0]?.getSettings() ?? null;
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (!this.disposed) this.callbacks.onError("missing-device");
        };
      });
      await this.context.audioWorklet.addModule("/audio/challenge-capture.js");
      if (this.disposed || generation !== this.generation) return false;
      const source = this.context.createMediaStreamSource(stream);
      const capture = new AudioWorkletNode(this.context, "challenge-capture", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      const frequencyData = new Float32Array(analyser.frequencyBinCount);
      const pitchAnalyzer = createPitchAnalyzer(
        this.context.sampleRate,
        this.context.sampleRate > 48000 ? 4096 : 2048,
      );
      const qualityObserver = createInputQualityObserver();
      this.calibration = [];
      this.pendingCalibration = [];
      this.noiseFloor = 0.003;
      this.lastUiFrame = this.lastCaptureAudioSec = -Infinity;
      this.analyser = analyser;
      this.source = source;
      this.capture = capture;
      capture.onprocessorerror = () => this.callbacks.onError("audio-error");
      capture.port.onmessage = ({ data }) => {
        if (
          this.disposed ||
          generation !== this.generation ||
          data.type !== "frame"
        )
          return;
        const pcm = new Float32Array(data.buffer as ArrayBuffer);
        if (data.droppedHops > 0) {
          capture.port.postMessage({ type: "release", buffer: pcm.buffer }, [
            pcm.buffer,
          ]);
          this.callbacks.onError("audio-error");
          return;
        }
        const estimate = pitchAnalyzer.analyze(pcm, data.sampleRate);
        const frame: InputFrame & { pitchAudioTimeSec: number } = {
          streamSampleIndex: data.streamSampleIndex,
          audioTimeSec: data.audioTimeSec,
          pitchAudioTimeSec: data.pitchAudioTimeSec,
          rms: data.rms,
          detectedHz: estimate.hz,
          confidence: estimate.confidence,
          isVoiced: hasReliablePitch(estimate.hz, estimate.confidence),
        };
        this.lastCaptureAudioSec = frame.audioTimeSec;
        const windowDuration = pcm.length / data.sampleRate;
        if (
          this.calibration.length < 70 &&
          !frame.isVoiced &&
          frame.audioTimeSec < this.collectAfter &&
          Number.isFinite(windowDuration) &&
          windowDuration > 0
        ) {
          const previous = this.pendingCalibration.at(-1);
          if (
            previous &&
            (frame.audioTimeSec <= previous.audioTimeSec ||
              frame.audioTimeSec - previous.audioTimeSec > windowDuration)
          )
            this.pendingCalibration = [];
          const hopEndAudioSec = frame.audioTimeSec + 256 / data.sampleRate;
          this.pendingCalibration.push({
            audioTimeSec: frame.audioTimeSec,
            hopEndAudioSec,
            rms: frame.rms,
          });
          const windowStart = Number.isFinite(data.pitchAudioTimeSec)
            ? data.pitchAudioTimeSec - windowDuration / 2
            : hopEndAudioSec - windowDuration;
          // A full ring can still contain a zero-to-voice onset. Keep its hop
          // provisional until a later unvoiced analysis window is wholly past
          // that hop. Periodic context below discards overlapping candidates.
          let confirmed = false;
          while (
            this.calibration.length < 70 &&
            this.pendingCalibration[0]?.hopEndAudioSec <= windowStart
          ) {
            this.calibration.push(this.pendingCalibration.shift()!.rms);
            confirmed = true;
          }
          // Only metadata is retained, for at most one analysis window + hop.
          this.pendingCalibration = this.pendingCalibration.slice(
            -Math.ceil(pcm.length / 512) - 1,
          );
          if (confirmed) {
            const sorted = [...this.calibration].sort((a, b) => a - b);
            this.noiseFloor = Math.max(
              0.001,
              sorted[Math.floor(sorted.length * 0.3)],
            );
          }
        } else this.pendingCalibration = [];
        const active = frame.audioTimeSec >= this.collectAfter;
        const energyGate = microphoneEnergyGates(this.noiseFloor).enter;
        frame.inputQuality = qualityObserver.observe(
          estimate,
          frame.audioTimeSec,
          energyGate,
          active,
          frame.rms,
        );
        if (active)
          this.callbacks.onSamples?.(pcm, data.sampleRate, frame, energyGate);
        if (frame.audioTimeSec - this.lastUiFrame >= 0.05) {
          this.lastUiFrame = frame.audioTimeSec;
          // Read actual PCM and spectral magnitudes from the same stream. These
          // display samples never enter event timestamps or scoring.
          analyser.getFloatFrequencyData(frequencyData);
          updateMicrophoneSignal(
            this.signal,
            pcm,
            frequencyData,
            this.context.sampleRate,
            estimate.hz,
            { rms: frame.rms },
            frame.inputQuality,
          );
          this.callbacks.onFrame(frame);
        }
        // Return transferable buffers: bounded pool on the real-time thread.
        capture.port.postMessage({ type: "release", buffer: pcm.buffer }, [
          pcm.buffer,
        ]);
        if (frame.audioTimeSec >= this.collectAfter) {
          if (!this.collectionStarted) {
            this.detector.reset(this.collectionPrefix, this.noiseFloor);
            this.collectionStarted = true;
          }
          for (const event of this.detector.accept(frame))
            this.callbacks.onEvent(event);
        }
      };
      source.connect(capture);
      source.connect(analyser);
      // Worklet output is all-zero silence; never monitor mic through speakers.
      capture.connect(this.context.destination);
      return true;
    } catch (error) {
      if (!this.disposed && generation === this.generation) {
        this.stopMicrophone();
        this.callbacks.onError(classifyAudioError(error));
      }
      return false;
    }
  }

  beginCollection(prefix: string, afterAudioSec: number) {
    this.pendingCalibration = [];
    this.detector.reset(prefix, this.noiseFloor);
    this.collectionPrefix = prefix;
    this.collectionStarted = false;
    this.collectAfter = afterAudioSec;
  }

  endCollection(flush = true) {
    this.pendingCalibration = [];
    const wasCollecting = this.collectAfter !== Infinity;
    this.collectAfter = Infinity;
    if (flush && wasCollecting) {
      // Main-thread delivery may lag the output clock. Do not fabricate a hold
      // through PCM that has not actually been analyzed yet.
      const end = Number.isFinite(this.lastCaptureAudioSec)
        ? this.lastCaptureAudioSec
        : this.context.currentTime;
      for (const event of this.detector.flush(end))
        this.callbacks.onEvent(event);
    } else this.detector.reset("paused", this.noiseFloor);
  }

  /** Absolute AudioContext time; silence/dispose cancels even future cues. */
  beatCue(startAudioSec: number, kind: "beat" | "bar") {
    if (this.disposed || !Number.isFinite(startAudioSec)) return;
    const pcm = beatCuePcm(this.context.sampleRate, kind);
    const buffer = this.context.createBuffer(
      1,
      pcm.length,
      this.context.sampleRate,
    );
    buffer.copyToChannel(pcm, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    this.tones.add(source);
    source.onended = () => {
      this.tones.delete(source);
      source.disconnect();
    };
    const start = Math.max(this.context.currentTime, startAudioSec);
    source.start(start);
    source.stop(start + buffer.duration);
  }

  async preparePiano(notes: readonly PianoNote[]): Promise<void> {
    if (this.disposed) return;
    const generation = ++this.pianoGeneration;
    this.pianoBuffers.clear();
    const current = () => !this.disposed && generation === this.pianoGeneration;
    try {
      const buffers = await preparePianoBuffers(this.context, notes, current);
      if (current()) this.pianoBuffers = buffers;
    } catch (error) {
      if (current()) throw error;
    }
  }

  /** Synchronous scheduling after preparePiano; never creates a second clock. */
  pianoTone(
    midi: number,
    startAudioSec: number,
    durationSec: number,
    gain = 1,
  ) {
    if (this.disposed) return;
    if (
      !Number.isFinite(startAudioSec) ||
      startAudioSec < 0 ||
      !Number.isFinite(gain) ||
      gain < 0 ||
      gain > 1
    )
      throw new RangeError("Invalid piano schedule");
    const buffer = this.pianoBuffers.get(pianoNoteKey({ midi, durationSec }));
    if (!buffer) throw new Error("Piano note was not prepared");
    const source = this.context.createBufferSource();
    const volume = this.context.createGain();
    source.buffer = buffer;
    volume.gain.setValueAtTime(gain, startAudioSec);
    source.connect(volume);
    volume.connect(this.context.destination);
    this.tones.add(source);
    source.onended = () => {
      this.tones.delete(source);
      source.disconnect();
      volume.disconnect();
    };
    source.start(startAudioSec);
    source.stop(startAudioSec + buffer.duration);
  }

  tone(midi: number, start: number, duration: number, gain = 0.12) {
    if (this.disposed) return;
    const oscillator = this.context.createOscillator();
    const volume = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    volume.gain.setValueAtTime(0, start);
    volume.gain.linearRampToValueAtTime(gain, start + 0.008);
    volume.gain.setValueAtTime(gain, start + Math.max(0.01, duration - 0.02));
    volume.gain.linearRampToValueAtTime(0, start + duration);
    oscillator.connect(volume);
    volume.connect(this.context.destination);
    this.tones.add(oscillator);
    oscillator.onended = () => {
      this.tones.delete(oscillator);
      oscillator.disconnect();
      volume.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  /** Touch-only feedback. Caller releases on pointer/key up, cancel and pause. */
  holdTone(midi: number): () => void {
    if (this.disposed) return () => {};
    const oscillator = this.context.createOscillator();
    const volume = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    volume.gain.setValueAtTime(0, now);
    volume.gain.linearRampToValueAtTime(0.1, now + 0.008);
    oscillator.connect(volume);
    volume.connect(this.context.destination);
    this.tones.add(oscillator);
    oscillator.onended = () => {
      this.tones.delete(oscillator);
      oscillator.disconnect();
      volume.disconnect();
    };
    oscillator.start();
    let released = false;
    return () => {
      if (released || this.disposed || !this.tones.has(oscillator)) return;
      released = true;
      const at = this.context.currentTime;
      volume.gain.cancelScheduledValues(at);
      volume.gain.setValueAtTime(volume.gain.value, at);
      volume.gain.linearRampToValueAtTime(0, at + 0.02);
      oscillator.stop(at + 0.025);
    };
  }

  silence() {
    this.pianoGeneration++;
    this.pianoBuffers.clear();
    for (const tone of this.tones) {
      try {
        tone.stop();
      } catch {
        /* already ended */
      }
    }
    this.tones.clear();
  }

  stopMicrophone() {
    this.generation++;
    this.endCollection(false);
    this.capture?.port.postMessage({ type: "stop" });
    if (this.capture) this.capture.port.onmessage = null;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.analyser = null;
    this.signal.rms = 0;
    this.signal.frequencyHz = null;
    this.signal.inputQuality = "inactive";
    this.signal.bins.fill(0);
    this.capture?.disconnect();
    this.capture?.port.close();
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.capture = null;
    this.source = null;
    this.stream = null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.silence();
    this.stopMicrophone();
    this.context.onstatechange = null;
    void this.context.close();
  }
}
