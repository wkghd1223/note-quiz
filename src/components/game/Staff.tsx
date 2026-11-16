"use client";

import React, { memo, useMemo, useState } from "react";
import { getNotePositionOnStaff } from "@/lib/music/utils";
import {
  legacyToScore,
  type LegacyStaffInput,
} from "@/lib/notation/legacy-to-score";
import { notationRenderer } from "@/lib/notation/score";
import AlphaTabNotationView from "@/components/notation/AlphaTabNotationView";
import LegacyStaff from "@/components/notation/legacy/Staff";
import StableNotationSurface, {
  practiceNotationFrameClassName,
} from "@/components/practice/StableNotationSurface";
import PracticeStaffFallback from "@/components/practice/PracticeStaffFallback";
import type { BasicStaffRange } from "@/lib/notation/basic-staff";

interface StaffProps extends LegacyStaffInput {
  width?: number;
  height?: number;
  className?: string;
  responsive?: boolean;
  stable?: boolean;
  staffRange?: BasicStaffRange;
}

function Staff(props: StaffProps) {
  const {
    clef,
    keySignature,
    note,
    originalNote,
    width = 400,
    height = 200,
    className = "",
    responsive = false,
    stable = false,
    staffRange,
  } = props;
  const [failed, setFailed] = useState(false);
  const score = useMemo(
    () => legacyToScore({ clef, keySignature, note, originalNote }),
    [clef, keySignature, note, originalNote],
  );
  const legacy = notationRenderer() === "legacy" || failed;
  if (stable)
    return (
      <StableNotationSurface
        revision={score}
        concealed={!note}
        staffRange={staffRange}
        className={`${practiceNotationFrameClassName} ${className}`}
      >
        {({ width: frameWidth, height: frameHeight, onReady }) =>
          legacy ? (
            <PracticeStaffFallback
              width={frameWidth}
              height={frameHeight}
              clef={clef}
              keySignature={keySignature}
              notes={note ? [note] : []}
              accidentals={score.events.flatMap((event) =>
                event.notes.map((written) => written.explicitAccidental),
              )}
              onReady={onReady}
            />
          ) : (
            <AlphaTabNotationView
              score={score}
              fittedBasic
              width={frameWidth}
              height={frameHeight}
              viewBox={`0 0 ${frameWidth} ${frameHeight}`}
              className="staff-svg h-full w-full rounded-lg bg-white"
              onRender={onReady}
              onError={() => setFailed(true)}
            />
          )
        }
      </StableNotationSurface>
    );
  if (legacy && !stable) return <LegacyStaff {...props} />;
  const y = note
    ? height / 2 - 40 + (8 - getNotePositionOnStaff(note, clef)) * 10
    : 0;
  const top = note ? Math.min(0, y - 50) : 0;
  const bottom = note ? Math.max(height, y + 50) : height;
  const engraving = legacy ? (
    <div data-notation-fallback className="h-full">
      <LegacyStaff {...props} className="h-full" />
    </div>
  ) : (
    <AlphaTabNotationView
      score={score}
      width={width}
      height={height}
      viewBox={`0 ${top} ${width} ${bottom - top}`}
      responsive={responsive}
      className={
        responsive
          ? "staff-svg h-auto w-full rounded-lg bg-white"
          : "staff-svg my-5 rounded-[1.75rem] border border-[#d9e0ea] bg-[#fbfcff] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.65)] md:my-8"
      }
      style={
        responsive
          ? undefined
          : {
              minHeight: `${height}px`,
              padding: "28px 0",
              overflow: "visible",
            }
      }
      onError={() => setFailed(true)}
    />
  );
  return <div className={`staff-container ${className}`}>{engraving}</div>;
}

export default memo(Staff);
