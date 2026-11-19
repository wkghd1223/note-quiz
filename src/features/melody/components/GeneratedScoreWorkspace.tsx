"use client";

import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { settingsActionClassName } from "@/components/practice/SettingsControls";
import ScorePracticeWorkspace from "@/features/score-import/ScorePracticeWorkspace";
import { editableMelody } from "../domain/editable-score";
import type { GeneratedScoreDraft } from "../score-draft";
import { melodySourceCopy } from "../sources";

export default function GeneratedScoreWorkspace({
  draft,
  onOriginal,
}: {
  draft: GeneratedScoreDraft;
  onOriginal: () => void;
}) {
  const { language } = useTranslation();
  const words = melodySourceCopy[language];
  const [original] = useState(
    () =>
      draft.current?.original ??
      editableMelody(draft.generation, words.generated),
  );
  return (
    <ScorePracticeWorkspace
      original={original}
      draft={draft}
      initialCues={{
        metronome: draft.generation.settings.metronome,
        barBell: draft.generation.settings.barBell,
      }}
      title={words.generated}
      headerAction={(locked) => (
        <button
          type="button"
          className={settingsActionClassName}
          disabled={locked}
          onClick={onOriginal}
        >
          {words.originalMelody}
        </button>
      )}
    />
  );
}
