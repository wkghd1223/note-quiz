"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { MicrophoneSignal } from "@/lib/music/microphoneSignal";

/** Decorative spectrum reflects current PCM; status text changes only on silence/sound. */
export default function MicrophoneSignalDisplay({
  signal,
  listening,
  expanded = false,
}: {
  signal: RefObject<MicrophoneSignal>;
  listening: boolean;
  expanded?: boolean;
}) {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const surface = canvas.current;
    const context = surface?.getContext("2d");
    if (!context || !surface) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let lastDraw = -Infinity;
    let previousActive = false;
    const draw = (now: number) => {
      if (now - lastDraw >= (reduced.matches ? 250 : 50)) {
        lastDraw = now;
        const value = signal.current;
        const nextActive = listening && value.rms >= 0.003;
        if (nextActive !== previousActive) {
          previousActive = nextActive;
          setActive(nextActive);
        }
        context.clearRect(0, 0, surface.width, surface.height);
        context.fillStyle = nextActive ? "#7c3aed" : "#cbd5e1";
        value.bins.forEach((magnitude, index) => {
          const height = Math.max(2, nextActive ? magnitude * 26 : 2);
          context.fillRect(index * 5, 30 - height, 3, height);
        });
      }
      frame = requestAnimationFrame(draw);
    };
    if (!listening) setActive(false);
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [listening, signal]);
  const label = active ? t.microphone.signalActive : t.microphone.signalQuiet;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-2"
      role="img"
      aria-label={`${t.microphone.signal}: ${label}`}
      title={label}
    >
      <canvas
        ref={canvas}
        width={120}
        height={32}
        className={expanded ? "h-8 w-40 sm:w-48" : "h-6 w-[90px]"}
        aria-hidden="true"
      />
    </span>
  );
}
