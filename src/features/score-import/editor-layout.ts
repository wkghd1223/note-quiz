import type {
  ImportedBar,
  ImportedEvent,
  ImportedHead,
  ImportedLane,
  ScoreClef,
} from "./types";
import {
  bottomStaffPosition,
  displayedPitch,
  keyAlter,
  soundingShift,
  staffPosition,
  steps,
  shiftedKey,
  type Spelling,
} from "./editor-pitch";
import { direct, tupletSpan, writtenRhythm } from "./score-edits";
import { meterGlyphs } from "@/lib/notation/meter-glyphs";

export const space = 12,
  bottom = 118;
export const noteY = (p: Spelling, c: ScoreClef) =>
  bottom - ((staffPosition(p) - bottomStaffPosition(c)) * space) / 2;
export const clefGlyph = (c: ScoreClef) =>
  ({
    G: "\uE050",
    F: "\uE062",
    C: "\uE05C",
    percussion: "\uE069",
    TAB: "\uE06D",
    none: "",
  })[c.sign] ?? c.sign;
export const accidentalGlyph = (alter: number) =>
  ({
    "-2": "\uE264",
    "-1": "\uE260",
    "0": "\uE261",
    "1": "\uE262",
    "2": "\uE263",
    "-0.5": "\uE280",
    "0.5": "\uE282",
  })[String(alter)] ?? String(alter);
export const lengthChoices = [
  ["whole", "1"],
  ["half", "1/2"],
  ["quarter", "1/4"],
  ["eighth", "1/8"],
  ["16th", "1/16"],
  ["32nd", "1/32"],
  ["64th", "1/64"],
  ["128th", "1/128"],
  ["256th", "1/256"],
  ["512th", "1/512"],
  ["1024th", "1/1024"],
  ["breve", "2"],
  ["long", "4"],
  ["maxima", "8"],
] as const;
export const noteRank = [
  "maxima",
  "long",
  "breve",
  "whole",
  "half",
  "quarter",
  "eighth",
  "16th",
  "32nd",
  "64th",
  "128th",
  "256th",
  "512th",
  "1024th",
];
export const restGlyph = (type: string) =>
  String.fromCodePoint(0xe4e0 + Math.max(0, noteRank.indexOf(type)));
/** Inline signatures can precede the first sounding note after written silence. */
function inlineSignature(
  previous: ImportedBar | ImportedEvent,
  event: ImportedEvent,
  semitones: number,
) {
  const clefChanged = !sameClef(previous.clef, event.clef);
  const oldKey = shiftedKey(
    previous.fifths,
    (previous.transpose ?? 0) + semitones,
  );
  const key = shiftedKey(event.fifths, (event.transpose ?? 0) + semitones);
  if (!clefChanged && oldKey === key) return null;
  const cancelled = !key && oldKey !== key;
  const signs = oldKey === key ? 0 : key || oldKey;
  const width = (clefChanged ? 30 : 0) + Math.min(7, Math.abs(signs)) * 10 + 8;
  return { clefChanged, signs, cancelled, width };
}

export interface LayoutHead {
  head: ImportedHead;
  index: number;
  eventIndex: number;
  shown: Spelling;
  x: number;
  y: number;
  accidental: boolean;
  type: string;
  dots: number;
  shift: number;
}
export interface LineBar {
  left: number;
  width: number;
  firstNoteX: number;
  /** Onsets in engraving coordinates, in the same order as bar.events. */
  anchors: number[];
  key: number;
  startingShift: number;
  clefX?: number;
  keyX?: number;
  meterX?: number;
  cancelledKey: number;
}

const sameClef = (a: ScoreClef, b: ScoreClef) =>
  a.sign === b.sign && a.line === b.line && a.octaveChange === b.octaveChange;

/** Measure boundaries are indexed once. Detailed glyphs are laid out only
 * for the stretch visible in the horizontally scrollable viewport. */
export function layoutScoreLine(
  lane: ImportedLane,
  semitones: number,
  minWidth: number,
) {
  let width = 0,
    top = 0,
    end = 163;
  let lastKey: number | undefined;
  let lastClef: ScoreClef | undefined;
  const bars = lane.bars.map((bar, index): LineBar => {
    const previous = lane.bars[index - 1];
    const startingShift = semitones + (bar.transpose ?? 0);
    const key = shiftedKey(bar.fifths, startingShift);
    let x = index ? 12 : 20;
    let clefX, keyX, meterX;
    if (!lastClef || !sameClef(lastClef, bar.clef)) {
      clefX = x;
      x += 35;
    }
    // Show naturals when a key change cancels the preceding signature.
    const cancelledKey = !key && lastKey ? lastKey : 0;
    if (key !== lastKey && (key || cancelledKey)) {
      keyX = x;
      x += 10 * Math.min(7, Math.abs(key || cancelledKey)) + 4;
    }
    if (
      !previous ||
      previous.meter.beats !== bar.meter.beats ||
      previous.meter.beatType !== bar.meter.beatType ||
      previous.meter.symbol !== bar.meter.symbol ||
      previous.meter.displayBeats !== bar.meter.displayBeats
    ) {
      meterX = x + 4;
      x = meterX + meterGlyphs(bar.meter, space).width + 4;
    }
    const firstNoteX = x + 23;
    x = firstNoteX;
    const anchors = bar.events.map((event, i) => {
      const before = bar.events[i - 1];
      if (before) {
        x += Math.max(42, Math.min(105, (event.start - before.start) * 58));
      } else if (event.start > 0) x += Math.min(105, event.start * 58);
      x += inlineSignature(before ?? bar, event, semitones)?.width ?? 0;
      for (const head of event.heads) {
        const shown = displayedPitch(
          head,
          event.fifths,
          soundingShift(head, semitones),
        );
        const y = noteY(shown, event.clef);
        top = Math.min(top, y - 64);
        end = Math.max(end, y + 53);
      }
      return x;
    });
    const left = width;
    const last = bar.events.at(-1);
    const tail = Math.max(
      41,
      Math.min(105, (bar.duration - (last?.start ?? 0)) * 58),
    );
    const barWidth = Math.max(
      96,
      x + tail,
      lane.bars.length === 1 ? minWidth : 0,
    );
    if (anchors.length > 1 && barWidth > x + tail) {
      const extra = (barWidth - x - tail) / (anchors.length - 1);
      anchors.forEach((_, i) => {
        anchors[i] += i * extra;
      });
    }
    width += barWidth;
    lastClef = last?.clef ?? bar.clef;
    lastKey = last
      ? shiftedKey(
          last.fifths,
          last.heads[0]
            ? soundingShift(last.heads[0], semitones)
            : startingShift,
        )
      : key;
    return {
      left,
      width: barWidth,
      firstNoteX,
      anchors,
      clefX,
      keyX,
      meterX,
      key,
      startingShift,
      cancelledKey,
    };
  });
  return { bars, width, top, height: end - top };
}

export function lineBarAt(bars: LineBar[], x: number) {
  let lo = 0,
    hi = bars.length;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1;
    if (bars[mid].left <= x) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Interpolate between the same noteheads used for drawing and hit testing. */
export function lineCursorX(
  bar: ImportedBar,
  layout: LineBar,
  beat: number,
  nextBar?: LineBar,
) {
  let lo = -1,
    hi = bar.events.length;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1;
    if (bar.events[mid].start <= beat) lo = mid;
    else hi = mid;
  }
  const start = bar.events[lo]?.start ?? 0,
    stop = bar.events[hi]?.start ?? bar.duration;
  const x = layout.anchors[lo] ?? layout.firstNoteX,
    nextX = layout.anchors[hi] ?? layout.width + (nextBar?.firstNoteX ?? 0);
  const fraction =
    stop > start
      ? Math.min(1, Math.max(0, (beat - start) / (stop - start)))
      : 0;
  return layout.left + x + fraction * (nextX - x);
}

export function layoutBar(
  bar: ImportedBar,
  semitones: number,
  layout: LineBar,
) {
  const { key, startingShift, width } = layout;
  let measureKey = key,
    accidentals = new Map<number, number>();
  const events = bar.events.map((event, eventIndex) => {
    const eventShift = event.heads.length
      ? soundingShift(event.heads[0], semitones)
      : startingShift;
    const fifths = shiftedKey(event.fifths, eventShift);
    const contextChange = inlineSignature(
      bar.events[eventIndex - 1] ?? bar,
      event,
      semitones,
    );
    if (fifths !== measureKey) {
      measureKey = fifths;
      accidentals = new Map();
    }
    const center = layout.anchors[eventIndex];
    const heads = event.heads.map((head, index) => {
      const shown = displayedPitch(
        head,
        event.fifths,
        soundingShift(head, semitones),
      );
      const pos = staffPosition(shown);
      const accidental =
        (accidentals.get(pos) ?? keyAlter(shown.step, fifths)) !==
          shown.alter || Boolean(direct(head.source, "accidental").length);
      accidentals.set(pos, shown.alter);
      return {
        head,
        index,
        eventIndex,
        shown,
        x: center,
        y: noteY(shown, event.clef),
        accidental,
        ...writtenRhythm(event, head),
        shift: soundingShift(head, semitones),
      };
    });
    const ascending = [...heads].sort((a, b) => a.y - b.y);
    for (let j = 1; j < ascending.length; j++) {
      if (
        ascending[j].y - ascending[j - 1].y <= space / 2 + 0.01 &&
        ascending[j - 1].x === center
      )
        ascending[j].x += 10;
    }
    return {
      event,
      eventIndex,
      x: center,
      heads,
      contextChange,
      fifths,
      eventShift,
    };
  });
  const ties: { from: number; to: number; y: number }[] = [];
  const open = new Map<number, LayoutHead>();
  for (const event of events)
    for (const head of event.heads) {
      const marks = [
        ...direct(head.head.source, "tie"),
        ...direct(head.head.source, "notations").flatMap((n) =>
          direct(n, "tied"),
        ),
      ].map((t) => t.getAttribute("type"));
      if (marks.includes("stop") || marks.includes("continue")) {
        ties.push({
          from: (open.get(head.head.midi)?.x ?? 18) + 5,
          to: head.x - 5,
          y: head.y + 7,
        });
        open.delete(head.head.midi);
      }
      if (marks.includes("start") || marks.includes("continue"))
        open.set(head.head.midi, head);
    }
  for (const head of open.values())
    ties.push({ from: head.x + 5, to: width - 15, y: head.y + 7 });
  const groups: { from: number; to: number; label: string }[] = [];
  for (let i = 0; i < bar.events.length; ) {
    const group = tupletSpan(bar.events, i);
    if (!group.length) {
      i++;
      continue;
    }
    const last = bar.events.indexOf(group[group.length - 1]);
    const ratio = bar.events[i].tuplet!;
    groups.push({
      from: i,
      to: last,
      label:
        ratio.normal === 2 && ratio.actual === 3
          ? "3"
          : `${ratio.actual}:${ratio.normal}`,
    });
    i = last + 1;
  }
  const ys = events.flatMap((e) => e.heads.map((h) => h.y));
  const top = Math.min(0, ...ys.map((y) => y - 64)),
    end = Math.max(163, ...ys.map((y) => y + 53));
  return { events, groups, ties, key, width, top, height: end - top };
}

export function keyPositions(fifths: number, clef: ScoreClef) {
  const sharp = fifths > 0,
    pattern = sharp
      ? ["F", "C", "G", "D", "A", "E", "B"]
      : ["B", "E", "A", "D", "G", "C", "F"];
  return pattern.slice(0, Math.min(7, Math.abs(fifths))).map((name, index) => {
    const approximate =
      bottomStaffPosition(clef) +
      (sharp ? [8, 5, 9, 6, 3, 7, 4] : [4, 7, 3, 6, 2, 5, 1])[index];
    const stepIndex = steps.findIndex((s) => s === name);
    const position = Math.round((approximate - stepIndex) / 7) * 7 + stepIndex;
    return bottom - ((position - bottomStaffPosition(clef)) * space) / 2;
  });
}
