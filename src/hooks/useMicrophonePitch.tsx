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
  MIN_SIGNAL_RMS,
} from "@/lib/music/pitchDetection";
import { createPitchAnalyzer } from "@/lib/music/estimatePitch";
import {
  createInputQualityObserver,
  type MicrophoneInputQuality,
} from "@/lib/music/input-quality";
import { createContinuousNoteGate } from "@/lib/music/continuous-note-gate";

export interface ContinuousMicrophoneCapture {
  /** Read current eligibility without another frame subscription or render. */
  getContext: () => { eligible: boolean; questionKey?: string };
  onSubmit: (note: Note, questionKey?: string) => void;
}

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
  inputQuality: MicrophoneInputQuality;
  signalRef: RefObject<MicrophoneSignal>;
  startListening: (
    continuous?: ContinuousMicrophoneCapture,
  ) => Promise<boolean>;
  stopListening: () => Note | null;
}

// Scoring may ignore octave; a capture must retain the actual detected pitch.
const detectedPitchKey = (note: Note) => `${getPitchKey(note)}:${note.octave}`;

export function useMicrophonePitch(): UseMicrophonePitchReturn {
  const [permissionState, setPermissionState] =
    useState<MicrophonePermissionState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [detectedNote, setDetectedNote] = useState<Note | null>(null);
  const [inputQuality, setInputQuality] =
    useState<MicrophoneInputQuality>("inactive");
  const qualityRef = useRef<MicrophoneInputQuality>("inactive");
  const displayedKeyRef = useRef<string | null>(null);

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
    displayedKeyRef.current = null;
    qualityRef.current = "inactive";

    if (mounted.current) {
      setIsListening(false);
      setDetectedNote(null);
      setInputQuality("inactive");
    }
    return note;
  }, []);

  const startListening = useCallback(
    async (continuous?: ContinuousMicrophoneCapture) => {
      stopListening();
      if (!mounted.current) return false;
      if (
        typeof window === "undefined" ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof window.AudioContext === "undefined"
      ) {
        setPermissionState("unsupported");
        return false;
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
          return false;
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
        const pitchAnalyzer = createPitchAnalyzer(
          audioContext.sampleRate,
          buffer.length,
        );
        const qualityObserver = createInputQualityObserver();
        const continuousGate = continuous ? createContinuousNoteGate() : null;

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
          const estimate = pitchAnalyzer.analyze(currentBuffer);
          const frequency = detectPitch(
            currentBuffer,
            currentAudioContext.sampleRate,
            estimate,
          );
          const now = performance.now();
          const observationTime = currentAudioContext.currentTime ?? now / 1000;
          const quality = qualityObserver.observe(
            { ...estimate, hz: frequency },
            observationTime,
            MIN_SIGNAL_RMS,
          );
          if (quality !== qualityRef.current) {
            qualityRef.current = quality;
            setInputQuality(quality);
          }
          currentAnalyser.getFloatFrequencyData(frequencyBuffer);
          updateMicrophoneSignal(
            signalRef.current,
            currentBuffer,
            frequencyBuffer,
            currentAudioContext.sampleRate,
            frequency,
            estimate,
            quality,
          );
          const nextNote =
            frequency && quality === "stable"
              ? frequencyToNote(frequency)
              : null;
          if (continuous && continuousGate) {
            const context = continuous.getContext();
            const validPcm = currentBuffer.every(Number.isFinite);
            if (
              continuousGate.observe({
                timeSec: observationTime,
                pitchKey: nextNote ? detectedPitchKey(nextNote) : null,
                quiet:
                  validPcm &&
                  Number.isFinite(estimate.rms) &&
                  estimate.rms < MIN_SIGNAL_RMS,
                ...context,
                eligible: context.eligible && validPcm,
              }) &&
              nextNote
            )
              continuous.onSubmit(nextNote, context.questionKey);
            // Submission may synchronously end the session or switch input modes.
            if (!mounted.current || generation !== requestGeneration.current)
              return;
          }

          if (!nextNote) {
            candidateKeyRef.current = null;
            candidateStartRef.current = 0;
            if (displayedKeyRef.current !== null) {
              displayedKeyRef.current = null;
              setDetectedNote(null);
            }
            frameRef.current = requestAnimationFrame(tick);
            return;
          }

          const nextKey = detectedPitchKey(nextNote);

          if (candidateKeyRef.current !== nextKey) {
            candidateKeyRef.current = nextKey;
            candidateStartRef.current = now;
          } else if (now - candidateStartRef.current >= 220) {
            detectedNoteRef.current = nextNote;
            if (displayedKeyRef.current !== nextKey) {
              displayedKeyRef.current = nextKey;
              setDetectedNote(nextNote);
            }
          }

          frameRef.current = requestAnimationFrame(tick);
        };

        frameRef.current = requestAnimationFrame(tick);
        return true;
      } catch (error) {
        if (!mounted.current || generation !== requestGeneration.current)
          return false;
        setPermissionState(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "denied"
            : "error",
        );
        stopListening();
        return false;
      }
    },
    [stopListening],
  );

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
    inputQuality,
    signalRef,
    startListening,
    stopListening,
  };
}
