import { direct, first, set } from "./score-xml";
import type { ImportedScore } from "./types";

/** alphaTab caches unpitched staff positions by instrument ID and display pitch.
 * Keep that cache local to each written staff/clef without changing the score. */
export function scopeUnpitchedInstruments(root: Element, score: ImportedScore) {
  const source = score.document.documentElement;
  const originals = source.getElementsByTagNameNS(
    source.namespaceURI,
    "unpitched",
  );
  if (!originals.length) return;
  // Splitting display measures retains the order of every written note.
  const rendered = root.getElementsByTagNameNS(root.namespaceURI, "unpitched");
  const copies = new WeakMap<Element, Element>();
  for (let i = 0; i < originals.length; i++) {
    copies.set(originals[i].parentElement!, rendered[i].parentElement!);
  }
  const list = first(root, "part-list");
  const definitions = new Map(
    (list ? direct(list, "score-part") : []).map((part) => [
      part.getAttribute("id"),
      part,
    ]),
  );
  const usedIds = new Set(
    Array.from(root.querySelectorAll("[id]"), (el) => el.getAttribute("id")),
  );
  let serial = 0;
  const scopes = new Map<string, Map<string, string>>();
  for (const lane of score.lanes) {
    for (const bar of lane.bars) {
      for (const event of bar.events) {
        for (const head of event.unpitchedHeads ?? []) {
          const note = copies.get(head.source);
          if (!note) continue;
          const instrument = direct(note, "instrument").at(-1);
          const id = instrument?.getAttribute("id") ?? "";
          const key = JSON.stringify([lane.partId, id]);
          const context = JSON.stringify([
            lane.staff,
            event.clef.sign,
            event.clef.line,
            event.clef.octaveChange ?? 0,
          ]);
          const known = scopes.get(key);
          if (!known) {
            scopes.set(key, new Map([[context, id]]));
            continue;
          }
          let alias = known.get(context);
          if (alias === id) continue;
          if (alias === undefined) {
            do {
              alias = `NoteQuiz-Unpitched-${++serial}`;
            } while (usedIds.has(alias));
            known.set(context, alias);
            const part = definitions.get(lane.partId);
            if (part && id) {
              for (const tag of [
                "score-instrument",
                "midi-device",
                "midi-instrument",
              ]) {
                const definition = direct(part, tag).find(
                  (el) => el.getAttribute("id") === id,
                );
                if (!definition) continue;
                const clone = definition.cloneNode(true) as Element;
                clone.setAttribute("id", alias);
                definition.after(clone);
              }
            }
          }
          (instrument ?? set(note, "instrument")).setAttribute("id", alias);
        }
      }
    }
  }
}
