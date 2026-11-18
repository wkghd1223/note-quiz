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
  change((source) => {
    const copy = map.get(source);
    if (!copy) throw new Error("staleSelection");
    return copy;
  });
  return { ...parseScoreDocument(document), file: score.file };
}
