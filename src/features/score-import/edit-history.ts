import { parseScoreDocument } from "./model";
import type { ImportedScore } from "./types";

export type ScoreChange = (copy: (source: Element) => Element) => void;

/** Apply a command to an isolated document. Source references keep their
 * identity even when the command inserts or removes siblings in its copy. */
export function editScore(
  score: ImportedScore,
  change: ScoreChange,
): ImportedScore {
  const document = score.document.cloneNode(true) as XMLDocument;
  const originals = score.document.getElementsByTagName("*");
  const copies = Array.from(document.getElementsByTagName("*"));
  const map = new WeakMap<Element, Element>();
  for (let i = 0; i < copies.length; i++) map.set(originals[i], copies[i]);
  // Meter edits can split one note into several tied clones. Tag the working
  // copy for the duration of the edit so each new segment keeps the choice.
  const marker = "data-note-quiz-practice-head";
  for (const source of score.practiceHeads ?? [])
    map.get(source)?.setAttribute(marker, "");
  change((source) => {
    const copy = map.get(source);
    if (!copy) throw new Error("staleSelection");
    return copy;
  });
  const practiceHeads = new Set<Element>();
  if (score.practiceHeads?.size) {
    for (const note of document.querySelectorAll(`note[${marker}]`)) {
      note.removeAttribute(marker);
      if (note.querySelector("pitch")) practiceHeads.add(note);
    }
  }
  return {
    ...parseScoreDocument(document),
    file: score.file,
    sourceFormat: score.sourceFormat,
    ...(score.sourceExcerpt && { sourceExcerpt: score.sourceExcerpt }),
    ...(practiceHeads.size > 0 && { practiceHeads }),
  };
}
