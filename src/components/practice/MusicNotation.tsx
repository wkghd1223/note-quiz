"use client";
import React from "react";
import {
  getNotePositionOnStaff,
  getLedgerLinePositions,
  needsLedgerLines,
  noteToString,
} from "@/lib/music/utils";
/** Uses the same staff coordinates and clef asset as the existing note exercise. */
export default function MusicNotation({
  notes,
  chord = false,
  label,
}: {
  notes: Note[];
  chord?: boolean;
  label: string;
}) {
  const ys = notes.map(
    (note) => 130 + (8 - getNotePositionOnStaff(note, "treble")) * 10,
  );
  const top = Math.min(0, ...ys.map((y) => y - 55)),
    bottom = Math.max(260, ...ys.map((y) => y + 55));
  const width = chord ? 360 : 420;
  return (
    <svg
      role="img"
      aria-label={`${label}: ${notes.map(noteToString).join(", ")}`}
      viewBox={`0 ${top} ${width} ${bottom - top}`}
      className="mx-auto max-h-64 w-full rounded-lg bg-white"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1={12}
          x2={width - 12}
          y1={130 + i * 20}
          y2={130 + i * 20}
          stroke="#c8d0dd"
          strokeWidth="1.6"
        />
      ))}
      <image href="/g-clef.svg" x={25} y={90} height={120} />
      {notes.map((note, i) => {
        const y = ys[i],
          x = chord ? 200 + (i % 2) * 2 : 160 + i * 100;
        const pos = getNotePositionOnStaff(note, "treble");
        return (
          <g key={i}>
            {needsLedgerLines(pos) &&
              getLedgerLinePositions(pos).map((p) => (
                <line
                  key={p}
                  x1={x - 17}
                  x2={x + 17}
                  y1={130 + (8 - p) * 10}
                  y2={130 + (8 - p) * 10}
                  stroke="#334155"
                />
              ))}
            {note.accidental && note.accidental !== "natural" && (
              <text x={x - 25 - i * 2} y={y + 7} fontSize={28}>
                {note.accidental === "sharp" ? "♯" : "♭"}
              </text>
            )}
            <ellipse
              cx={x}
              cy={y}
              rx={11}
              ry={8}
              fill="#0f172a"
              transform={`rotate(-20 ${x} ${y})`}
            />
            <line
              x1={x + 9}
              x2={x + 9}
              y1={y}
              y2={y - 45}
              stroke="#0f172a"
              strokeWidth={2}
            />
          </g>
        );
      })}
    </svg>
  );
}
