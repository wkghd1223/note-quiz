"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaMicrophone } from "react-icons/fa";
import { useTranslation } from "@/hooks/useTranslation";
import { useMicrophonePitch } from "@/hooks/useMicrophonePitch";
import MicrophoneSignalDisplay from "./MicrophoneSignal";

interface MicrophoneInputProps {
  onSubmit: (note: Note) => void;
  disabled?: boolean;
  selectedNote?: Note | null;
  /** Session/question identity. Changing it cancels capture without submitting. */
  captureKey?: string;
}

const MicrophoneInput: React.FC<MicrophoneInputProps> = ({
  onSubmit,
  disabled = false,
  captureKey,
}) => {
  const { t } = useTranslation();
  const {
    permissionState,
    isListening,
    detectedNote,
    detectedLabel,
    signalRef,
    startListening,
    stopListening,
  } = useMicrophonePitch();

  const [isHolding, setIsHolding] = useState(false);
  const held = useRef<{
    captureKey: string | undefined;
    gesture: "pointer" | "keyboard" | "click";
    pointerId?: number;
    target?: HTMLButtonElement;
    key?: string;
  } | null>(null);
  const latest = useRef({ disabled, captureKey, onSubmit });
  latest.current = { disabled, captureKey, onSubmit };
  const mounted = useRef(true);
  const generation = useRef(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreClick = useRef(false);

  const endCapture = useCallback(
    (submit: boolean, defer = false) => {
      const hold = held.current;
      held.current = null;
      const serial = ++generation.current;
      if (blurTimer.current !== null) clearTimeout(blurTimer.current);
      blurTimer.current = null;
      const note = stopListening();
      if (mounted.current) setIsHolding(false);
      if (
        hold?.gesture === "pointer" &&
        hold.pointerId !== undefined &&
        hold.target?.hasPointerCapture(hold.pointerId)
      ) {
        hold.target.releasePointerCapture(hold.pointerId);
      }
      const canSubmit = () =>
        mounted.current &&
        !latest.current.disabled &&
        hold?.captureKey === latest.current.captureKey &&
        !document.hidden &&
        document.hasFocus();
      if (!submit || !hold || !note || !canSubmit()) return;
      const commit = () => {
        if (generation.current === serial && canSubmit())
          latest.current.onSubmit(note);
      };
      // Window blur/visibility events must be able to cancel a button-blur commit.
      if (defer) blurTimer.current = setTimeout(commit, 0);
      else commit();
    },
    [stopListening],
  );

  const cancelCapture = useCallback(() => endCapture(false), [endCapture]);
  const beginCapture = (gesture: NonNullable<typeof held.current>) => {
    if (latest.current.disabled || held.current || document.hidden) return;
    if (blurTimer.current !== null) clearTimeout(blurTimer.current);
    blurTimer.current = null;
    generation.current++;
    held.current = gesture;
    setIsHolding(true);
    void startListening();
  };
  const finishGesture = () => {
    // Consume a browser's synthesized keyboard click; SR-only clicks still work.
    ignoreClick.current = true;
    if (clickTimer.current !== null) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      ignoreClick.current = false;
    }, 0);
    endCapture(true);
  };

  useEffect(() => {
    cancelCapture();
  }, [captureKey, cancelCapture]);
  useEffect(() => {
    if (disabled) cancelCapture();
  }, [disabled, cancelCapture]);
  useEffect(() => {
    mounted.current = true;
    const onVisibility = () => {
      if (document.hidden) cancelCapture();
    };
    window.addEventListener("blur", cancelCapture);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted.current = false;
      window.removeEventListener("blur", cancelCapture);
      document.removeEventListener("visibilitychange", onVisibility);
      cancelCapture();
      if (clickTimer.current !== null) clearTimeout(clickTimer.current);
    };
  }, [cancelCapture]);

  return (
    <div className="rounded-[1.5rem] border border-[#ece7fb] bg-[linear-gradient(180deg,_#ffffff_0%,_#faf9fe_100%)] p-4 shadow-[0_12px_30px_rgba(76,29,149,0.06)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6d28d9]">
            {t.microphone.title}
          </p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            {t.microphone.description}
          </p>
        </div>
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-microphone-status
          className={`inline-grid max-w-full rounded-full px-3 py-1 text-center text-xs font-bold leading-4 ${isListening ? "bg-[#dcfce7] text-[#166534]" : "bg-[#ede9fe] text-[#5b21b6]"}`}
        >
          <span
            className={`col-start-1 row-start-1 ${isListening ? "invisible" : ""}`}
            aria-hidden={isListening}
          >
            {t.microphone.ready}
          </span>
          <span
            className={`col-start-1 row-start-1 ${isListening ? "" : "invisible"}`}
            aria-hidden={!isListening}
          >
            {t.microphone.listening}
          </span>
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="rounded-[1.25rem] border border-[#e2e8f0] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              {t.microphone.detectedNote}
            </p>
            <MicrophoneSignalDisplay
              signal={signalRef}
              listening={isListening}
            />
          </div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <div className="text-3xl font-black tracking-[-0.05em] text-slate-950 sm:text-4xl">
                {detectedLabel}
              </div>
              <p className="mt-2 grid text-sm text-slate-500">
                <span
                  className={`col-start-1 row-start-1 ${detectedNote ? "invisible" : ""}`}
                  aria-hidden={!!detectedNote}
                >
                  {t.microphone.noNoteDetected}
                </span>
                <span
                  className={`col-start-1 row-start-1 ${detectedNote ? "" : "invisible"}`}
                  aria-hidden={!detectedNote}
                >
                  {t.microphone.quietRoomHint}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid content-start gap-3">
          <button
            type="button"
            data-microphone-hold
            aria-pressed={isHolding}
            aria-label={
              isHolding
                ? t.microphone.stopListening
                : t.microphone.startListening
            }
            disabled={disabled}
            onPointerDown={(event) => {
              if (
                event.button !== 0 ||
                !event.isPrimary ||
                disabled ||
                held.current
              )
                return;
              event.preventDefault();
              event.currentTarget.focus({ preventScroll: true });
              event.currentTarget.setPointerCapture(event.pointerId);
              beginCapture({
                gesture: "pointer",
                pointerId: event.pointerId,
                target: event.currentTarget,
                captureKey,
              });
            }}
            onPointerUp={(event) => {
              if (
                held.current?.gesture === "pointer" &&
                held.current.pointerId === event.pointerId
              )
                finishGesture();
            }}
            onPointerCancel={cancelCapture}
            onLostPointerCapture={(event) => {
              if (
                held.current?.gesture === "pointer" &&
                held.current.pointerId === event.pointerId
              )
                cancelCapture();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelCapture();
                return;
              }
              if (event.key !== " " && event.key !== "Enter") return;
              event.preventDefault();
              if (event.repeat) return;
              beginCapture({ gesture: "keyboard", key: event.key, captureKey });
            }}
            onKeyUp={(event) => {
              if (event.key !== " " && event.key !== "Enter") return;
              event.preventDefault();
              if (
                held.current?.gesture === "keyboard" &&
                held.current.key === event.key
              )
                finishGesture();
            }}
            onBlur={() => {
              if (held.current) endCapture(true, true);
            }}
            onClick={(event) => {
              event.preventDefault();
              if (
                event.detail !== 0 ||
                ignoreClick.current ||
                held.current?.gesture === "pointer" ||
                held.current?.gesture === "keyboard"
              )
                return;
              if (held.current) endCapture(true);
              else beginCapture({ gesture: "click", captureKey });
            }}
            onContextMenu={(event) => {
              if (held.current) event.preventDefault();
            }}
            className={`inline-flex min-h-12 min-w-0 touch-none select-none items-center justify-center gap-2 rounded-[1.2rem] px-4 py-3 text-center text-sm font-bold leading-5 text-white shadow-[0_12px_30px_rgba(76,29,149,0.12)] ${disabled ? "cursor-not-allowed bg-slate-300" : isHolding ? "bg-slate-900" : "bg-gradient-to-r from-[#5b21b6] to-[#7c3aed]"}`}
          >
            <FaMicrophone aria-hidden="true" className="shrink-0" />
            <span className="grid min-w-0 [overflow-wrap:anywhere]">
              <span
                className={`col-start-1 row-start-1 ${isHolding ? "invisible" : ""}`}
                aria-hidden={isHolding}
              >
                {t.microphone.startListening}
              </span>
              <span
                className={`col-start-1 row-start-1 ${isHolding ? "" : "invisible"}`}
                aria-hidden={!isHolding}
              >
                {t.microphone.stopListening}
              </span>
            </span>
          </button>
        </div>
      </div>

      {(permissionState === "denied" || permissionState === "unsupported") && (
        <p className="mt-4 rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm font-medium text-[#991b1b]">
          {permissionState === "denied"
            ? t.microphone.permissionDenied
            : t.microphone.unsupported}
        </p>
      )}
    </div>
  );
};

export default MicrophoneInput;
