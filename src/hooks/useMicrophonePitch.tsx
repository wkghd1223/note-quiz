"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  emptyMicrophoneSignal,
  updateMicrophoneSignal,
  type MicrophoneSignal,
} from "@/lib/music/microphoneSignal";
import {
  detectPitch,
  formatDetectedNote,
  frequencyToNote,
  getPitchKey,
} from "@/lib/music/pitchDetection";

type MicrophonePermissionState =
  | "idle"
  | "granted"
  | "denied"
  | "unsupported"
  | "error";

interface UseMicrophonePitchReturn {
  permissionState: MicrophonePermissionState;
  isListening: boolean;
  detectedNote: Note | null;
  detectedLabel: string;
  signalRef: RefObject<MicrophoneSignal>;
  startListening: () => Promise<void>;
  stopListening: () => Note | null;
}

// Scoring may ignore octave; a capture must retain the actual detected pitch.
const detectedPitchKey = (note: Note) => `${getPitchKey(note)}:${note.octave}`;

export function useMicrophonePitch(): UseMicrophonePitchReturn {
  const [permissionState, setPermissionState] =
    useState<MicrophonePermissionState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [detectedNote, setDetectedNote] = useState<Note | null>(null);

  const detectedNoteRef = useRef<Note | null>(null);
  const requestGeneration = useRef(0);
  const mounted = useRef(true);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const candidateKeyRef = useRef<string | null>(null);
  const candidateStartRef = useRef<number>(0);
  const bufferRef = useRef<Float32Array | null>(null);
  const signalRef = useRef<MicrophoneSignal>(emptyMicrophoneSignal());

  const stopListening = useCallback(() => {
    const note = detectedNoteRef.current;
    detectedNoteRef.current = null;
    requestGeneration.current++;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();

    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
    }

    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    bufferRef.current = null;
    signalRef.current = emptyMicrophoneSignal();
    candidateKeyRef.current = null;
    candidateStartRef.current = 0;

    if (mounted.current) {
      setIsListening(false);
      setDetectedNote(null);
    }
    return note;
  }, []);

  const startListening = useCallback(async () => {
    stopListening();
    if (!mounted.current) return;
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof window.AudioContext === "undefined"
    ) {
      setPermissionState("unsupported");
      return;
    }

    const generation = requestGeneration.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!mounted.current || generation !== requestGeneration.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const audioContext = new window.AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = audioContext.sampleRate >= 88200 ? 4096 : 2048;
      analyser.smoothingTimeConstant = 0.25;

      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);
      const frequencyBuffer = new Float32Array(analyser.frequencyBinCount);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      bufferRef.current = buffer;

      setPermissionState("granted");
      setIsListening(true);

      const tick = () => {
        if (!mounted.current || generation !== requestGeneration.current)
          return;
        const currentAnalyser = analyserRef.current;
        const currentAudioContext = audioContextRef.current;
        const currentBuffer = bufferRef.current;

        if (!currentAnalyser || !currentAudioContext || !currentBuffer) {
          return;
        }

        currentAnalyser.getFloatTimeDomainData(currentBuffer);
        const frequency = detectPitch(
          currentBuffer,
          currentAudioContext.sampleRate,
        );
        currentAnalyser.getFloatFrequencyData(frequencyBuffer);
        updateMicrophoneSignal(
          signalRef.current,
          currentBuffer,
          frequencyBuffer,
          currentAudioContext.sampleRate,
          frequency,
        );

        if (!frequency) {
          candidateKeyRef.current = null;
          candidateStartRef.current = 0;
          frameRef.current = requestAnimationFrame(tick);
          return;
        }

        const nextNote = frequencyToNote(frequency);
        if (!nextNote) {
          frameRef.current = requestAnimationFrame(tick);
          return;
        }

        const nextKey = detectedPitchKey(nextNote);
        const now = performance.now();

        if (candidateKeyRef.current !== nextKey) {
          candidateKeyRef.current = nextKey;
          candidateStartRef.current = now;
        } else if (now - candidateStartRef.current >= 220) {
          const previous = detectedNoteRef.current;
          if (!previous || detectedPitchKey(previous) !== nextKey) {
            detectedNoteRef.current = nextNote;
            setDetectedNote(nextNote);
          }
        }

        frameRef.current = requestAnimationFrame(tick);
      };

      frameRef.current = requestAnimationFrame(tick);
    } catch (error) {
      if (!mounted.current || generation !== requestGeneration.current) return;
      setPermissionState(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "denied"
          : "error",
      );
      stopListening();
    }
  }, [stopListening]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopListening();
    };
  }, [stopListening]);

  return {
    permissionState,
    isListening,
    detectedNote,
    detectedLabel: formatDetectedNote(detectedNote),
    signalRef,
    startListening,
    stopListening,
  };
}
