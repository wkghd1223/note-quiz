"use client";
import React, { memo, useMemo, useState } from "react";
import { noteToString } from "@/lib/music/utils";
import { theoryToScore } from "@/lib/notation/theory-to-score";
import { notationRenderer } from "@/lib/notation/score";
import AlphaTabNotationView from "@/components/notation/AlphaTabNotationView";
import PracticeStaffFallback from "./PracticeStaffFallback";
import { KEY_SIGNATURES } from "@/lib/music/constants";
import StableNotationSurface from "./StableNotationSurface";
import type { BasicStaffRange } from "@/lib/notation/basic-staff";

const EMPTY_NOTES: Note[] = [];

function MusicNotation({
  notes,
  chord = false,
  label,
  revealed = true,
  compact = false,
  staffRange,
}: {
  notes: Note[];
  chord?: boolean;
  label: string;
  revealed?: boolean;
  compact?: boolean;
  staffRange?: BasicStaffRange;
}) {
  const [failed, setFailed] = useState(false);
  // Unrevealed answers never enter the renderer or its SVG/accessibility tree.
  const visibleNotes = revealed ? notes : EMPTY_NOTES;
  const score = useMemo(
    () => theoryToScore(visibleNotes, visibleNotes.length ? chord : false),
    [visibleNotes, chord],
  );
  const legacy = notationRenderer() === "legacy" || failed;
  return (
    <StableNotationSurface
      revision={score}
      concealed={!revealed}
      staffRange={staffRange}
      className={compact ? "h-[112px] sm:h-[160px]" : undefined}
    >
      {({ width, height, onReady }) =>
        legacy ? (
          <PracticeStaffFallback
            width={width}
            height={height}
            keySignature={KEY_SIGNATURES.C}
            notes={visibleNotes}
            chord={chord}
            accidentals={visibleNotes.map((note) =>
              note.accidental === "natural" ? null : note.accidental,
            )}
            label={
              revealed
                ? `${label}: ${notes.map(noteToString).join(", ")}`
                : label
            }
            onReady={onReady}
          />
        ) : (
          <AlphaTabNotationView
            score={score}
            fittedBasic
            accessibleLabel={
              revealed
                ? `${label}: ${notes.map(noteToString).join(", ")}`
                : label
            }
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="mx-auto h-full w-full rounded-lg bg-white"
            onRender={onReady}
            onError={() => setFailed(true)}
          />
        )
      }
    </StableNotationSurface>
  );
}

export default memo(MusicNotation);
