"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  startListening: () => Promise<void>;
  stopListening: () => void;
}

export function useMicrophonePitch(): UseMicrophonePitchReturn {
  const [permissionState, setPermissionState] =
    useState<MicrophonePermissionState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [detectedNote, setDetectedNote] = useState<Note | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const candidateKeyRef = useRef<string | null>(null);
  const candidateStartRef = useRef<number>(0);
  const bufferRef = useRef<Float32Array | null>(null);

  const stopListening = useCallback(() => {
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
      void audioContextRef.current.close();
    }

    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    bufferRef.current = null;
    candidateKeyRef.current = null;
    candidateStartRef.current = 0;

    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof window.AudioContext === "undefined"
    ) {
      setPermissionState("unsupported");
      return;
    }

    stopListening();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioContext = new window.AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.25;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      bufferRef.current = buffer;

      setPermissionState("granted");
      setIsListening(true);

      const tick = () => {
        const currentAnalyser = analyserRef.current;
        const currentAudioContext = audioContextRef.current;
        const currentBuffer = bufferRef.current;

        if (!currentAnalyser || !currentAudioContext || !currentBuffer) {
          return;
        }

        currentAnalyser.getFloatTimeDomainData(currentBuffer);
        const frequency = detectPitch(
          currentBuffer,
          currentAudioContext.sampleRate
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

        const nextKey = getPitchKey(nextNote);
        const now = performance.now();

        if (candidateKeyRef.current !== nextKey) {
          candidateKeyRef.current = nextKey;
          candidateStartRef.current = now;
        } else if (now - candidateStartRef.current >= 220) {
          setDetectedNote((previous) => {
            const previousKey = previous ? getPitchKey(previous) : null;
            return previousKey === nextKey ? previous : nextNote;
          });
        }

        frameRef.current = requestAnimationFrame(tick);
      };

      frameRef.current = requestAnimationFrame(tick);
    } catch (error) {
      setPermissionState(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "denied"
          : "error"
      );
      stopListening();
    }
  }, [stopListening]);

  useEffect(() => stopListening, [stopListening]);

  return {
    permissionState,
    isListening,
    detectedNote,
    detectedLabel: formatDetectedNote(detectedNote),
    startListening,
    stopListening,
  };
}
