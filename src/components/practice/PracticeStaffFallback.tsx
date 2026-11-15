"use client";

import React, { useLayoutEffect } from "react";
import {
  getLedgerLinePositions,
  getNotePositionOnStaff,
  needsLedgerLines,
} from "@/lib/music/utils";

const keyOffsets: Record<
  ClefType,
  Record<"sharp" | "flat", readonly number[]>
> = {
  treble: {
    sharp: [-1, 0.5, -1.5, 0, 1.5, -0.5, 1],
    flat: [1, -0.5, 1.5, 0, 2, 0.5, 2.5],
  },
  bass: {
    sharp: [0, 1.5, -0.5, 1, 2.5, 0.5, 2],
    flat: [2, 0.5, 2.5, 1, 3, 1.5, 3.5],
  },
  alto: {
    sharp: [-0.5, 1, -1, 0.5, 2, 0, 1.5],
    flat: [1.5, 0, 2, 0.5, 2.5, 1, 3],
  },
  tenor: {
    sharp: [2, 0, 1.5, -0.5, 1, -1, 0.5],
    flat: [0.5, -1, 1, -0.5, 1.5, 0, 2],
  },
};

/** A single physical-coordinate fit for blank/loading/error states. No hidden answer notes. */
export default function PracticeStaffFallback({
  width,
  height,
  clef = "treble",
  keySignature,
  notes,
  accidentals,
  chord = false,
  label,
  onReady,
}: {
  width: number;
  height: number;
  clef?: ClefType;
  keySignature: KeySignature;
  notes: readonly Note[];
  accidentals?: readonly (Accidental | null)[];
  chord?: boolean;
  label?: string;
  onReady?: () => void;
}) {
  useLayoutEffect(() => {
    onReady?.();
  }, [onReady]);
  const gap = 10,
    top = height / 2 - gap * 2;
  const keys = keySignature.sharps.length
    ? keySignature.sharps
    : keySignature.flats;
  const alteration = keySignature.sharps.length ? "sharp" : "flat";
  const firstX = 48 + keys.length * 8 + 18;
  const positions = notes.map((note) => {
    const position = getNotePositionOnStaff(note, clef);
    return {
      position,
      y: top + ((8 - position) * gap) / 2,
      down: position > 4,
    };
  });
  const clefTop =
    clef === "treble" ? top - 20 : clef === "tenor" ? top - 12 : top - 2;
  const clefHeight = clef === "treble" ? 80 : 44;
  const minY = Math.min(
    clefTop,
    top - 10,
    ...positions.map(({ y, down }) => y - (down ? 7 : 32)),
  );
  const maxY = Math.max(
    clefTop + clefHeight,
    top + 50,
    ...positions.map(({ y, down }) => y + (down ? 32 : 7)),
  );
  const scale = Math.min(1, (height - 8) / (maxY - minY));
  // Match the native fitted-basic staff length, independently of vertical fit.
  const staffWidth = Math.min(width * 0.8, 560);
  const end = 6 + staffWidth / scale;
  const dx = (width - staffWidth) / 2 - 6 * scale;
  const dy = (height - (maxY - minY) * scale) / 2 - minY * scale;
  return (
    <svg
      role={label ? "img" : undefined}
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="h-full w-full"
      data-notation-fallback
    >
      <g
        transform={`translate(${dx} ${dy}) scale(${scale})`}
        aria-hidden="true"
      >
        <g data-staff-lines>
          {[0, 1, 2, 3, 4].map((line) => (
            <line
              key={line}
              x1={6}
              x2={end}
              y1={top + gap * line}
              y2={top + gap * line}
              stroke="#64748b"
              strokeWidth={1}
            />
          ))}
        </g>
        <image
          data-clef-glyph
          href={
            clef === "treble"
              ? "/g-clef.svg"
              : clef === "bass"
                ? "/bass-clef.svg"
                : "/alto-clef.svg"
          }
          x={10}
          y={clefTop}
          width={30}
          height={clefHeight}
        />
        {keys.map((name, index) => (
          <image
            key={`${name}-${index}`}
            href={alteration === "sharp" ? "/sharp-sign.svg" : "/flat-sign.svg"}
            x={46 + index * 8}
            y={top + keyOffsets[clef][alteration][index] * gap - 10}
            width={10}
            height={20}
          />
        ))}
        {positions.map(({ position, y, down }, index) => {
          const x = chord
            ? Math.max(firstX, end * 0.64) + (index % 2) * 2
            : firstX + ((end - firstX - 18) * (index + 1)) / (notes.length + 1);
          return (
            <g key={index}>
              {needsLedgerLines(position) &&
                getLedgerLinePositions(position).map((ledger) => (
                  <line
                    key={ledger}
                    x1={x - 9}
                    x2={x + 9}
                    y1={top + ((8 - ledger) * gap) / 2}
                    y2={top + ((8 - ledger) * gap) / 2}
                    stroke="#334155"
                  />
                ))}
              {accidentals?.[index] && (
                <text x={x - 17} y={y + 5} fontSize={17}>
                  {accidentals[index] === "sharp"
                    ? "♯"
                    : accidentals[index] === "flat"
                      ? "♭"
                      : "♮"}
                </text>
              )}
              <ellipse
                data-notehead
                cx={x}
                cy={y}
                rx={5.5}
                ry={4}
                fill="#0f172a"
                transform={`rotate(-20 ${x} ${y})`}
              />
              <line
                x1={x + (down ? -4.5 : 4.5)}
                x2={x + (down ? -4.5 : 4.5)}
                y1={y}
                y2={y + (down ? 30 : -30)}
                stroke="#0f172a"
                strokeWidth={1.2}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
