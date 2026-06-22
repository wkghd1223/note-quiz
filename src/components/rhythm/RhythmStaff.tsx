"use client";

import React from "react";
import { getNotePositionOnStaff } from "@/lib/music/utils";

export type RhythmNoteValue = "quarter" | "eighth" | "sixteenth" | "triplet";

export interface RhythmSequenceItem {
  note: Note;
  duration: RhythmNoteValue;
}

export interface RhythmAnswerState {
  submitted: NoteName | null;
  status: "pending" | "correct" | "wrong" | "missed";
}

interface RhythmStaffProps {
  items: RhythmSequenceItem[];
  activeIndex: number | null;
  answers: RhythmAnswerState[];
}

const NOTE_SPACING = 118;
const NOTE_HEAD_RX = 11;
const NOTE_HEAD_RY = 8;
const STEM_LENGTH = 46;

type NoteRenderMeta = {
  x: number;
  y: number;
  stemDown: boolean;
  beamY: number;
};

const RhythmStaff: React.FC<RhythmStaffProps> = ({
  items,
  activeIndex,
  answers,
}) => {
  const width = 760;
  const height = 264;
  const staffLineSpacing = 20;
  const staffStartY = 92;

  const noteMeta = items.map((item, index) => {
    const position = getNotePositionOnStaff(item.note, "treble");
    const y = staffStartY + (8 - position) * (staffLineSpacing / 2);
    const x = 248 + index * NOTE_SPACING;
    const stemDown = position > 4;

    return {
      x,
      y,
      stemDown,
      beamY: stemDown ? y + STEM_LENGTH : y - STEM_LENGTH,
    } satisfies NoteRenderMeta;
  });

  const beamGroups = getBeamGroups(items);

  return (
    <div className="rounded-[1.75rem] border border-[#e7e1f5] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] sm:p-5">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible rounded-[1.4rem] border border-[#d9e0ea] bg-[#fbfcff] p-3 sm:p-5"
      >
        {[0, 1, 2, 3, 4].map((lineIndex) => (
          <line
            key={lineIndex}
            x1={72}
            y1={staffStartY + lineIndex * staffLineSpacing}
            x2={width - 48}
            y2={staffStartY + lineIndex * staffLineSpacing}
            stroke="#cbd5e1"
            strokeWidth="1.8"
          />
        ))}

        <image href="/g-clef.svg" x="70" y="58" width="54" height="126" />
        <text
          x="146"
          y="124"
          fill="#64748b"
          fontSize="60"
          fontWeight="500"
          fontFamily="Georgia, serif"
          textAnchor="middle"
        >
          C
        </text>

        {items.map((item, index) => {
          const meta = noteMeta[index];
          const answer = answers[index];
          const isActive = activeIndex === index;
          const color =
            answer.status === "correct"
              ? "#10b981"
              : answer.status === "wrong"
                ? "#ef4444"
                : answer.status === "missed"
                  ? "#f59e0b"
                  : isActive
                    ? "#6d28d9"
                    : "#111827";

          return (
            <g key={`${item.note.name}-${item.note.octave}-${index}`}>
              {isActive && (
                <rect
                  x={meta.x - 40}
                  y={staffStartY - 56}
                  width="80"
                  height="154"
                  rx="22"
                  fill="rgba(109, 40, 217, 0.07)"
                />
              )}

              <NoteHead x={meta.x} y={meta.y} color={color} />
              <Stem x={meta.x} y={meta.y} color={color} stemDown={meta.stemDown} />

              <text
                x={meta.x}
                y={214}
                textAnchor="middle"
                fill={isActive ? "#6d28d9" : "#64748b"}
                fontSize="16"
                fontWeight="800"
              >
                {index + 1}
              </text>
            </g>
          );
        })}

        {beamGroups.map((group, groupIndex) => {
          const first = noteMeta[group.start];
          const last = noteMeta[group.end];
          const beamColor =
            group.indices.some((index) => answers[index]?.status === "wrong")
              ? "#ef4444"
              : group.indices.some((index) => answers[index]?.status === "missed")
                ? "#f59e0b"
                : group.indices.some((index) => answers[index]?.status === "correct")
                  ? "#10b981"
                  : group.indices.includes(activeIndex ?? -1)
                    ? "#6d28d9"
                    : "#111827";
          const y = first.stemDown ? Math.max(first.beamY, last.beamY) : Math.min(first.beamY, last.beamY);

          return (
            <g key={`${group.type}-${group.start}-${group.end}-${groupIndex}`}>
              <Beam
                x1={first.x + (first.stemDown ? -10 : 12)}
                x2={last.x + (last.stemDown ? -10 : 12)}
                y={y}
                color={beamColor}
              />
              {group.type === "sixteenth" && (
                <Beam
                  x1={first.x + (first.stemDown ? -10 : 12)}
                  x2={last.x + (last.stemDown ? -10 : 12)}
                  y={y + (first.stemDown ? -10 : 10)}
                  color={beamColor}
                />
              )}
              {group.type === "triplet" && (
                <text
                  x={(first.x + last.x) / 2}
                  y={y + (first.stemDown ? -12 : 18)}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="18"
                  fontWeight="700"
                >
                  3
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const NoteHead: React.FC<{
  x: number;
  y: number;
  color: string;
}> = ({ x, y, color }) => (
  <ellipse
    cx={x}
    cy={y}
    rx={NOTE_HEAD_RX}
    ry={NOTE_HEAD_RY}
    fill={color}
    transform={`rotate(-20 ${x} ${y})`}
  />
);

const Stem: React.FC<{
  x: number;
  y: number;
  color: string;
  stemDown: boolean;
}> = ({ x, y, color, stemDown }) =>
  stemDown ? (
    <rect x={x - 11} y={y} width="2" height={STEM_LENGTH} fill={color} />
  ) : (
    <rect x={x + 9} y={y - STEM_LENGTH} width="2" height={STEM_LENGTH} fill={color} />
  );

const Beam: React.FC<{
  x1: number;
  x2: number;
  y: number;
  color: string;
}> = ({ x1, x2, y, color }) => (
  <rect
    x={Math.min(x1, x2)}
    y={y}
    width={Math.abs(x2 - x1)}
    height="6"
    fill={color}
    rx="2"
  />
);

function getBeamGroups(items: RhythmSequenceItem[]) {
  const groups: Array<{
    start: number;
    end: number;
    indices: number[];
    type: RhythmNoteValue;
  }> = [];

  let index = 0;

  while (index < items.length) {
    const current = items[index]?.duration;

    if (current === "quarter") {
      index += 1;
      continue;
    }

    let end = index;
    while (end + 1 < items.length && items[end + 1]?.duration === current) {
      end += 1;
    }

    if (end > index) {
      groups.push({
        start: index,
        end,
        indices: Array.from({ length: end - index + 1 }, (_, offset) => index + offset),
        type: current,
      });
    }

    index = end + 1;
  }

  return groups;
}

export default RhythmStaff;
