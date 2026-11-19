import { scoreBeatOf } from "./model";
import { direct, first, value } from "./score-xml";
import type { ImportedBar, ImportedLane, ImportedScore } from "./types";

const eps = 1e-7;

export interface EngravedBar {
  original: number;
  beat: number;
  continues: boolean;
}

/** Partition only at existing onsets in every part. Never manufacture or shorten
 * a note to make a cut. Overlapping voices and spans use the line editor. */
function partition(bar: ImportedBar, cuts: number[]) {
  const groups: Element[][] = Array.from({ length: cuts.length + 1 }, () => []);
  let divisions = bar.divisions;
  let cursor = 0;
  let segment = 0;
  const voiced = new Set<number>();
  for (const el of Array.from(bar.source.children)) {
    let at = cursor;
    switch (el.localName) {
      case "attributes":
        at = scoreBeatOf(el);
        divisions = Number(value(el, "divisions") ?? divisions);
        break;
      case "note": {
        at = scoreBeatOf(el);
        const duration = Number(value(el, "duration")) / divisions;
        if (!(duration > 0) || el.getElementsByTagNameNS("*", "tuplet").length)
          return null;
        if (!first(el, "chord")) cursor = at + duration;
        const boundary = cuts.find((cut) => cut > at + eps);
        if (boundary !== undefined && at + duration > boundary + eps)
          return null;
        break;
      }
      case "barline": {
        const loc = el.getAttribute("location") ?? "right";
        if (loc !== "left" && loc !== "right") return null;
        groups[loc === "left" ? 0 : groups.length - 1].push(el);
        continue;
      }
      case "direction":
      case "sound":
      case "harmony":
      case "print":
        if (Number(value(el, "offset") ?? 0)) return null;
        break;
      default:
        return null;
    }
    while (segment < cuts.length && at >= cuts[segment] - eps) segment++;
    if (segment && at < cuts[segment - 1] - eps) return null;
    groups[segment].push(el);
    if (el.localName === "note") voiced.add(segment);
  }
  return voiced.size === groups.length ? groups : null;
}

export const staffBarId = (
  partId: string,
  staff: string | number,
  index: number,
) => JSON.stringify([partId, String(staff), index]);

export function fullScoreSignatures(score: ImportedScore) {
  const source = score.document.documentElement;
  const root = source.cloneNode(true) as Element;
  const boundaries = new Map<number, Set<number>>();
  const marked = new Map<string, ImportedLane>();
  const parts = new Map<string, ImportedLane>();
  const signCache = new WeakMap<
    Element,
    { beat: number; staff: string | null }[]
  >();
  for (const lane of score.lanes) {
    parts.set(lane.partId, lane);
    for (const bar of lane.bars) {
      let signs = signCache.get(bar.source);
      if (!signs) {
        signs = [];
        for (const a of direct(bar.source, "attributes")) {
          const beat = scoreBeatOf(a);
          if (beat <= eps) continue;
          for (const sign of Array.from(a.children)) {
            if (sign.localName !== "key" && sign.localName !== "clef") continue;
            signs.push({
              beat,
              staff:
                sign.getAttribute("number") ??
                (sign.localName === "clef" ? "1" : null),
            });
          }
        }
        signCache.set(bar.source, signs);
      }
      for (const { beat, staff } of signs) {
        if (staff && staff !== lane.staff) continue;
        const cuts = boundaries.get(bar.index) ?? new Set<number>();
        boundaries.set(bar.index, cuts.add(beat));
        const key = staffBarId(lane.partId, lane.staff, bar.index);
        if (!marked.has(key)) marked.set(key, lane);
      }
    }
  }
  const map: EngravedBar[] = [];
  if (!boundaries.size) return { root, map, marked };
  // These notations refer to a count of real measures, potentially anywhere
  // before or after the change. Inserting display bars would change the count.
  const canSplit =
    source.localName === "score-partwise" &&
    !["multi-measure-rest", "multiple-rest", "measure-repeat"].some(
      (tag) => source.getElementsByTagNameNS("*", tag).length,
    );
  const partRows = direct(root, "part").map((part) => ({
    bars: direct(part, "measure"),
    lane: parts.get(part.getAttribute("id") ?? ""),
  }));
  const length = Math.max(
    ...Array.from(parts.values(), (lane) => lane.bars.length),
  );
  for (let index = 0; index < length; index++) {
    const cuts = Array.from(boundaries.get(index) ?? []).sort((a, b) => a - b);
    const groups =
      cuts.length && cuts.length <= 128 && canSplit
        ? partRows.map(({ bars, lane }) => {
            const bar = lane?.bars[index];
            return bar && bars[index] ? partition(bar, cuts) : null;
          })
        : [];
    if (!groups.length || groups.some((group) => !group)) {
      map.push({ original: index, beat: 0, continues: false });
      continue;
    }
    for (const [partIndex, { bars, lane }] of partRows.entries()) {
      const old = bars[index];
      const siblings = groups[partIndex]!.map((group, i) => {
        const piece = old.cloneNode(false) as Element;
        if (i) {
          piece.setAttribute("implicit", "yes");
          piece.removeAttribute("id");
        }
        for (const el of group) piece.appendChild(el.cloneNode(true));
        return piece;
      });
      old.replaceWith(...siblings);
      // All staves in the part were partitioned at the same positions.
      for (const staff of new Set(
        score.lanes
          .filter((l) => l.partId === lane!.partId)
          .map((l) => l.staff),
      ))
        marked.delete(staffBarId(lane!.partId, staff, index));
    }
    [0, ...cuts].forEach((beat, i) =>
      map.push({ original: index, beat, continues: i < cuts.length }),
    );
  }
  return { root, map, marked };
}
