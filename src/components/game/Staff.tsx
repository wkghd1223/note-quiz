"use client";

import React from "react";
import { Note, ClefType, KeySignature } from "@/types/music";
import {
  getNotePositionOnStaff,
  needsLedgerLines,
  getLedgerLinePositions,
} from "@/lib/music/utils";

interface StaffProps {
  clef: ClefType;
  keySignature: KeySignature;
  note?: Note;
  width?: number;
  height?: number;
  className?: string;
}

interface ClefProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

const Staff: React.FC<StaffProps> = ({
  clef,
  keySignature,
  note,
  width = 400,
  height = 200,
  className = "",
}) => {
  // 오선지 기본 설정
  const staffLineSpacing = 20;
  const staffStartY = height / 2 - staffLineSpacing * 2;
  const staffLineLength = staffLineSpacing * 4;
  const clefX = 40;
  const keySignatureX = clefX + 100;
  const noteX =
    keySignatureX +
    (keySignature.sharps.length + keySignature.flats.length) * 15 +
    40;

  // 음표 위치 계산
  const notePosition = note ? getNotePositionOnStaff(note, clef) : null;
  const noteY =
    notePosition !== null
      ? staffStartY + (8 - notePosition) * (staffLineSpacing / 2)
      : 0;

  // 보조선 계산
  const ledgerLines =
    notePosition !== null && needsLedgerLines(notePosition)
      ? getLedgerLinePositions(notePosition)
      : [];

  return (
    <div className={`staff-container ${className}`}>
      <svg width={width} height={height} className="staff-svg">
        {/* 오선지 배경 */}
        <rect
          width={width}
          height={height}
          fill="white"
          stroke="#e5e7eb"
          strokeWidth="1"
        />

        {/* 오선 (5줄) */}
        {[0, 1, 2, 3, 4].map((lineIndex) => (
          <line
            key={`staff-line-${lineIndex}`}
            x1={20}
            y1={staffStartY + lineIndex * staffLineSpacing}
            x2={width - 20}
            y2={staffStartY + lineIndex * staffLineSpacing}
            stroke="#000"
            strokeWidth="1"
          />
        ))}

        {/* 음자리표 */}
        <g
          transform={`translate(${clefX}, ${staffStartY + staffLineSpacing * 2})`}
        >
          {clef === "treble" && (
            <TrebleClef
              y={-1 * staffStartY + staffLineSpacing / 2}
              height={staffLineLength + staffLineSpacing * 2}
            />
          )}
          {clef === "bass" && (
            <BassClef
              y={-1 * staffStartY + staffLineSpacing}
              height={staffLineLength - staffLineSpacing}
            />
          )}
          {clef === "alto" && (
            <AltoClef
              y={-1 * staffStartY + staffLineSpacing}
              height={staffLineLength}
            />
          )}
          {clef === "tenor" && (
            <TenorClef y={-1 * staffStartY} height={staffLineLength} />
          )}
        </g>

        {/* 조표 */}
        {keySignature.sharps.length > 0 && (
          <g>
            {keySignature.sharps.map((sharpNote, index) => (
              <g
                key={`sharp-${index}`}
                transform={`translate(${keySignatureX + index * 15}, ${getAccidentalY(sharpNote, clef, staffStartY, staffLineSpacing, "sharp")})`}
              >
                <SharpSymbol />
              </g>
            ))}
          </g>
        )}

        {keySignature.flats.length > 0 && (
          <g>
            {keySignature.flats.map((flatNote, index) => (
              <g
                key={`flat-${index}`}
                transform={`translate(${keySignatureX + index * 15}, ${getAccidentalY(flatNote, clef, staffStartY, staffLineSpacing, "flat")})`}
              >
                <FlatSymbol />
              </g>
            ))}
          </g>
        )}

        {/* 보조선 */}
        {ledgerLines.map((linePosition) => (
          <line
            key={`ledger-${linePosition}`}
            x1={noteX - 20}
            y1={staffStartY + (8 - linePosition) * (staffLineSpacing / 2)}
            x2={noteX + 20}
            y2={staffStartY + (8 - linePosition) * (staffLineSpacing / 2)}
            stroke="#000"
            strokeWidth="1"
          />
        ))}

        {/* 음표 */}
        {note && notePosition !== null && (
          <g transform={`translate(${noteX}, ${noteY})`}>
            <QuarterNote />
            {/* 조표가 적용된 음표의 임시표 */}
            {note.accidental === "sharp" && (
              <g transform="translate(-25, 0)">
                <SharpSymbol />
              </g>
            )}
            {note.accidental === "flat" && (
              <g transform="translate(-25, 0)">
                <FlatSymbol />
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
};

// 높은음자리표 SVG
const TrebleClef: React.FC<ClefProps> = ({
  x = -20,
  y = 0,
  width,
  height = 80,
}) => <image href="/g-clef.svg" x={x} y={y} width={width} height={height} />;

// 낮은음자리표 SVG
const BassClef: React.FC<ClefProps> = ({
  x = -20,
  y = 0,
  width,
  height = 100,
}) => <image href="/bass-clef.svg" x={x} y={y} width={width} height={height} />;

// 알토음자리표 SVG
const AltoClef: React.FC<ClefProps> = ({
  x = -20,
  y = 0,
  width,
  height = 100,
}) => <image href="/alto-clef.svg" x={x} y={y} width={width} height={height} />;

// 테너음자리표 SVG
const TenorClef: React.FC<ClefProps> = ({
  x = -20,
  y = -25,
  width,
  height = 80,
}) => <image href="/alto-clef.svg" x={x} y={y} width={width} height={height} />;

// 4분음표 SVG
const QuarterNote: React.FC = () => (
  <g>
    <ellipse cx="0" cy="0" rx="11" ry="8" fill="#000" transform="rotate(-20)" />
    <rect x="9" y="-45" width="2" height="45" fill="#000" />
  </g>
);

// 샾 기호 SVG
const SharpSymbol: React.FC = () => (
  <g>
    <rect x="-1" y="-15" width="1" height="30" fill="#000" />
    <rect x="3" y="-15" width="1" height="30" fill="#000" />
    <rect x="-3" y="-8" width="8" height="1" fill="#000" />
    <rect x="-3" y="2" width="8" height="1" fill="#000" />
  </g>
);

// 플랫 기호 SVG
const FlatSymbol: React.FC = () => (
  <g>
    <rect x="0" y="-20" width="1" height="35" fill="#000" />
    <path d="M1,-5 Q8,-8 12,-2 Q16,4 12,10 Q8,16 1,13 Z" fill="#000" />
  </g>
);

// 조표 위치 계산 함수
function getAccidentalY(
  noteName: string,
  clef: ClefType,
  staffStartY: number,
  staffLineSpacing: number,
  accidentalType: "sharp" | "flat"
): number {
  // 각 음자리표별 조표 위치 매핑
  const positions: Record<ClefType, Record<string, number>> = {
    treble: {
      F: staffStartY + staffLineSpacing * 0.5, // F5
      C: staffStartY + staffLineSpacing * 1.5, // C5
      G: staffStartY + staffLineSpacing * 0, // G5
      D: staffStartY + staffLineSpacing * 2, // D5
      A: staffStartY + staffLineSpacing * 0.5, // A4
      E: staffStartY + staffLineSpacing * 2.5, // E5
      B: staffStartY + staffLineSpacing * 1, // B4
    },
    bass: {
      B: staffStartY + staffLineSpacing * 1, // B3
      E: staffStartY + staffLineSpacing * 2.5, // E3
      A: staffStartY + staffLineSpacing * 0.5, // A3
      D: staffStartY + staffLineSpacing * 2, // D3
      G: staffStartY + staffLineSpacing * 0, // G3
      C: staffStartY + staffLineSpacing * 1.5, // C3
      F: staffStartY + staffLineSpacing * 0.5, // F2
    },
    alto: {
      F: staffStartY + staffLineSpacing * 0.5,
      C: staffStartY + staffLineSpacing * 2,
      G: staffStartY + staffLineSpacing * 0.5,
      D: staffStartY + staffLineSpacing * 2.5,
      A: staffStartY + staffLineSpacing * 1,
      E: staffStartY + staffLineSpacing * 3,
      B: staffStartY + staffLineSpacing * 1.5,
    },
    tenor: {
      F: staffStartY + staffLineSpacing * 0.5,
      C: staffStartY + staffLineSpacing * 2,
      G: staffStartY + staffLineSpacing * 0.5,
      D: staffStartY + staffLineSpacing * 2.5,
      A: staffStartY + staffLineSpacing * 1,
      E: staffStartY + staffLineSpacing * 3,
      B: staffStartY + staffLineSpacing * 1.5,
    },
  };

  return positions[clef][noteName] || staffStartY + staffLineSpacing * 2;
}

export default Staff;
