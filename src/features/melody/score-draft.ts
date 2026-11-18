import type {
  ImportedScore,
  ScoreOptions,
} from "@/features/score-import/types";

type ScoreDraft = {
  original: ImportedScore;
  score: ImportedScore;
  past: ImportedScore[];
  future: ImportedScore[];
  laneId: string;
  barIndex: number;
  options: ScoreOptions;
  view: "line" | "full";
};

type DraftRef = { current: ScoreDraft | null };

// Locale navigation remounts the layout in the same browser document.
// Only keep the score and edit history here. Audio belongs to the page.
let browserDraft: DraftRef | undefined;

export function getScoreDraft(): DraftRef {
  if (typeof window === "undefined") return { current: null };
  return (browserDraft ??= { current: null });
}

export function releaseScoreDraft() {
  if (browserDraft) browserDraft.current = null;
  browserDraft = undefined;
}
