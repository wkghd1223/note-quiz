import type {
  ImportedScore,
  ScoreOptions,
} from "@/features/score-import/types";

import type { MelodyGeneration } from "./domain/generator";

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

export type ScoreDraftRef = { current: ScoreDraft | null };

export interface GeneratedScoreDraft extends ScoreDraftRef {
  generation: Extract<MelodyGeneration, { ok: true }>;
  seed: number;
  open: boolean;
}

// Locale navigation remounts the layout in the same browser document.
// Only keep the score and edit history here. Audio belongs to the page.
let browserDraft: ScoreDraftRef | undefined;

export function getScoreDraft(): ScoreDraftRef {
  if (typeof window === "undefined") return { current: null };
  return (browserDraft ??= { current: null });
}

let generatedDraft: GeneratedScoreDraft | null = null;

export function getGeneratedScoreDraft() {
  return generatedDraft;
}

export function setGeneratedScoreDraft(draft: GeneratedScoreDraft | null) {
  generatedDraft = draft;
}

export function hasScoreEdits(draft: ScoreDraftRef | null | undefined) {
  return !!draft?.current && draft.current.score !== draft.current.original;
}

export function releaseScoreDraft() {
  if (browserDraft) browserDraft.current = null;
  browserDraft = undefined;
  generatedDraft = null;
}
