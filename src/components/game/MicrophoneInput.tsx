"use client";

import React from "react";
import { FaMicrophone, FaPause, FaCheckCircle } from "react-icons/fa";
import { useTranslation } from "@/hooks/useTranslation";
import { useMicrophonePitch } from "@/hooks/useMicrophonePitch";

interface MicrophoneInputProps {
  onSubmit: (note: Note) => void;
  disabled?: boolean;
  selectedNote?: Note | null;
}

const MicrophoneInput: React.FC<MicrophoneInputProps> = ({
  onSubmit,
  disabled = false,
  selectedNote,
}) => {
  const { t } = useTranslation();
  const {
    permissionState,
    isListening,
    detectedNote,
    detectedLabel,
    startListening,
    stopListening,
  } = useMicrophonePitch();

  const statusLabel = isListening ? t.microphone.listening : t.microphone.ready;
  const canSubmit = !!detectedNote && !disabled;

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
          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${
            isListening
              ? "bg-[#dcfce7] text-[#166534]"
              : "bg-[#ede9fe] text-[#5b21b6]"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="rounded-[1.25rem] border border-[#e2e8f0] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            {t.microphone.detectedNote}
          </p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <div className="text-3xl font-black tracking-[-0.05em] text-slate-950 sm:text-4xl">
                {detectedLabel}
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {detectedNote
                  ? t.microphone.quietRoomHint
                  : t.microphone.noNoteDetected}
              </p>
            </div>
            {selectedNote && (
              <div className="rounded-2xl bg-[#faf9fe] px-3 py-2 text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  {t.messages.yourAnswer}
                </p>
                <p className="mt-1 text-base font-black text-[#5b21b6]">
                  {selectedNote.name}
                  {selectedNote.accidental === "sharp" && "#"}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3">
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={disabled}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[1.2rem] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(76,29,149,0.12)] transition-transform ${
              disabled
                ? "cursor-not-allowed bg-slate-300"
                : isListening
                  ? "bg-slate-900 hover:-translate-y-0.5"
                  : "bg-gradient-to-r from-[#5b21b6] to-[#7c3aed] hover:-translate-y-0.5"
            }`}
          >
            {isListening ? <FaPause /> : <FaMicrophone />}
            {isListening
              ? t.microphone.stopListening
              : t.microphone.startListening}
          </button>

          <button
            onClick={() => {
              if (detectedNote) {
                onSubmit(detectedNote);
              }
            }}
            disabled={!canSubmit}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[1.2rem] px-4 py-3 text-sm font-bold transition-transform ${
              canSubmit
                ? "bg-[#ecfdf5] text-[#166534] shadow-[0_12px_30px_rgba(16,185,129,0.12)] hover:-translate-y-0.5"
                : "cursor-not-allowed bg-slate-100 text-slate-400"
            }`}
          >
            <FaCheckCircle />
            {t.microphone.submitDetectedNote}
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
