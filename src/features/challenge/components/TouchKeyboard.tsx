"use client";
import { useEffect, useRef } from "react";
import type { ChallengeCopy } from "../i18n";
export const keyboardNotes = [
  { key: "a", midi: 60, name: "C4" },
  { key: "s", midi: 62, name: "D4" },
  { key: "d", midi: 64, name: "E4" },
  { key: "f", midi: 65, name: "F4" },
  { key: "g", midi: 67, name: "G4" },
  { key: "h", midi: 69, name: "A4" },
  { key: "j", midi: 71, name: "B4" },
];
export default function TouchKeyboard({
  enabled,
  heldMidi,
  c,
  down,
  up,
  cancel,
}: {
  enabled: boolean;
  heldMidi: number | null;
  c: ChallengeCopy;
  down: (key: string, midi: number) => void;
  up: (key: string) => void;
  cancel: () => void;
}) {
  const active = useRef<{ id: number; key: string } | null>(null);
  const controlKey = useRef<{ trigger: string; key: string } | null>(null);
  useEffect(() => {
    // Session cancellation (for example backgrounding) may happen while keyup
    // goes to another window. A genuine hold through a rewind remains owned.
    if (heldMidi === null) controlKey.current = null;
  }, [heldMidi]);
  useEffect(() => {
    // A rewind disables the focused button; keyup can then target the body.
    // Keep the physical release time instead of clipping a hold at the rewind.
    const release = (event: KeyboardEvent) => {
      const held = controlKey.current;
      if (!held || event.key !== held.trigger) return;
      event.preventDefault();
      event.stopPropagation();
      controlKey.current = null;
      up(held.key);
    };
    window.addEventListener("keyup", release, true);
    return () => window.removeEventListener("keyup", release, true);
  }, [up]);
  return (
    <section aria-label={c.touch} className="mt-4">
      <p id="challenge-key-hint" className="mb-3 text-sm text-slate-600">
        {c.touchHint}
      </p>
      <div className="grid grid-cols-4 gap-2 min-[360px]:grid-cols-7 min-[360px]:gap-0.5 sm:gap-2">
        {keyboardNotes.map((note) => (
          <button
            key={note.midi}
            type="button"
            data-midi={note.midi}
            aria-label={note.name}
            aria-describedby="challenge-key-hint"
            aria-pressed={heldMidi === note.midi}
            disabled={!enabled}
            onKeyDown={(e) => {
              if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                e.preventDefault();
                e.stopPropagation();
                if (controlKey.current) return;
                const key = `control-key-${note.midi}`;
                controlKey.current = { trigger: e.key, key };
                down(key, note.midi);
              }
            }}
            className={`flex min-h-16 touch-none select-none flex-col items-center justify-center rounded-xl border-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-800 disabled:opacity-50 ${heldMidi === note.midi ? "border-violet-800 bg-violet-100 text-violet-950" : "border-slate-300 bg-white text-slate-800 hover:border-violet-500"}`}
            onPointerDown={(e) => {
              if (active.current) return;
              e.preventDefault();
              const key = `pointer-${e.pointerId}`;
              active.current = { id: e.pointerId, key };
              e.currentTarget.setPointerCapture(e.pointerId);
              down(key, note.midi);
            }}
            onPointerUp={(e) => {
              if (active.current?.id !== e.pointerId) return;
              const key = active.current.key;
              active.current = null;
              up(key);
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={(e) => {
              if (active.current?.id === e.pointerId) {
                active.current = null;
                cancel();
              }
            }}
            onLostPointerCapture={(e) => {
              if (active.current?.id === e.pointerId) {
                active.current = null;
                cancel();
              }
            }}
          >
            <span>{note.name}</span>
            <span className="mt-2 text-xs font-normal text-slate-500">
              {note.key.toUpperCase()}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
