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
      <svg
        width={width}
        style={{
          minHeight: `${height}px`,
          padding: "20px 0",
          margin: "50px 0 60px 0",
          overflow: "visible",
        }}
        className="staff-svg"
      >
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
                transform={`translate(${keySignatureX + index * 12 - 40}, ${getAccidentalY(sharpNote, clef, staffStartY, staffLineSpacing, "sharp")})`}
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
                transform={`translate(${keySignatureX + index * 10 - 40}, ${getAccidentalY(flatNote, clef, staffStartY, staffLineSpacing, "flat")})`}
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
            <QuarterNote position={notePosition} />
            {/* 조표가 적용된 음표의 임시표 */}
            {note.accidental === "sharp" && (
              <g transform="translate(-25, -20)">
                <SharpSymbol />
              </g>
            )}
            {note.accidental === "flat" && (
              <g transform="translate(-25, -20)">
                <FlatSymbol />
              </g>
            )}
            {note.accidental === "natural" &&
              (keySignature.sharps.includes(note.name) ||
                keySignature.flats.includes(note.name)) && (
                <g transform="translate(-25, 0)">
                  <NaturalSymbol />
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
  x = 0,
  y = 0,
  width,
  height = 80,
}) => <image href="/g-clef.svg" x={x} y={y} width={width} height={height} />;

// 낮은음자리표 SVG
const BassClef: React.FC<ClefProps> = ({
  x = -10,
  y = 0,
  width,
  height = 100,
}) => <image href="/bass-clef.svg" x={x} y={y} width={width} height={height} />;

// 알토음자리표 SVG
const AltoClef: React.FC<ClefProps> = ({
  x = 0,
  y = 0,
  width,
  height = 100,
}) => <image href="/alto-clef.svg" x={x} y={y} width={width} height={height} />;

// 테너음자리표 SVG
const TenorClef: React.FC<ClefProps> = ({
  x = 0,
  y = -25,
  width,
  height = 80,
}) => <image href="/alto-clef.svg" x={x} y={y} width={width} height={height} />;

// 4분음표 SVG
interface QuarterNoteProps {
  position: number;
}

const QuarterNote: React.FC<QuarterNoteProps> = ({ position }) => {
  // 3선(가운데 선)은 position 4에 해당
  // 3선보다 위에 있으면 막대기를 아래로, 아래에 있으면 막대기를 위로
  const stemDown = position > 4;

  return (
    <g>
      <ellipse
        cx="0"
        cy="0"
        rx="11"
        ry="8"
        fill="#000"
        transform="rotate(-20)"
      />
      {stemDown ? (
        // 막대기 아래로 (왼쪽에 위치)
        <rect x="-11" y="0" width="2" height="45" fill="#000" />
      ) : (
        // 막대기 위로 (오른쪽에 위치)
        <rect x="9" y="-45" width="2" height="45" fill="#000" />
      )}
    </g>
  );
};

// 샾 기호 SVG
const SharpSymbol: React.FC = () => (
  <image href="/sharp-sign.svg" height={35} y={2} />
);

// 플랫 기호 SVG
const FlatSymbol: React.FC = () => (
  <image href="/flat-sign.svg" height={35} y={-4} />
);

// natural 기호 SVG
const NaturalSymbol: React.FC = () => (
  <image href="/natural-sign.svg" height={35} />
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
      F:
        staffStartY +
        staffLineSpacing * (accidentalType === "sharp" ? -1 : 2.5), // F5
      C: staffStartY + staffLineSpacing * 0.5, // C5
      G:
        staffStartY +
        staffLineSpacing * (accidentalType === "sharp" ? -1.5 : 2), // G5
      D: staffStartY + staffLineSpacing * 0, // D5
      A: staffStartY + staffLineSpacing * 1.5, // A4
      E: staffStartY + staffLineSpacing * -0.5, // E5
      B: staffStartY + staffLineSpacing * 1, // B4
    },
    bass: {
      F:
        staffStartY + staffLineSpacing * (accidentalType === "sharp" ? 0 : 3.5), // F5
      C: staffStartY + staffLineSpacing * 1.5, // C5
      G:
        staffStartY +
        staffLineSpacing * (accidentalType === "sharp" ? -0.5 : 3), // G5
      D: staffStartY + staffLineSpacing * 1, // D5
      A: staffStartY + staffLineSpacing * 2.5, // A4
      E: staffStartY + staffLineSpacing * 0.5, // E5
      B: staffStartY + staffLineSpacing * 2, // B4
    },
    alto: {
      F:
        staffStartY +
        staffLineSpacing * (accidentalType === "sharp" ? -0.5 : 3), // F5
      C: staffStartY + staffLineSpacing * 1, // C5
      G:
        staffStartY +
        staffLineSpacing * (accidentalType === "sharp" ? -1 : 2.5), // G5
      D: staffStartY + staffLineSpacing * 0.5, // D5
      A: staffStartY + staffLineSpacing * 2, // A4
      E: staffStartY + staffLineSpacing * 0, // E5
      B: staffStartY + staffLineSpacing * 1.5, // B4
    },
    tenor: {
      F: staffStartY + staffLineSpacing * (accidentalType === "sharp" ? 2 : 2), // F5
      C: staffStartY + staffLineSpacing * 0, // C5
      G:
        staffStartY +
        staffLineSpacing * (accidentalType === "sharp" ? 1.5 : 1.5), // G5
      D: staffStartY + staffLineSpacing * -0.5, // D5
      A: staffStartY + staffLineSpacing * 1, // A4
      E: staffStartY + staffLineSpacing * -1, // E5
      B: staffStartY + staffLineSpacing * 0.5, // B4
    },
  };

  return positions[clef][noteName] || staffStartY + staffLineSpacing * 2;
}

export default Staff;
