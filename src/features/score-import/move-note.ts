import { canEditEvent, cloneTiming } from "./score-edits";
import {
  direct,
  dottedLength,
  element,
  epsilon,
  fail,
  first,
  glyphValues,
  insertOrdered,
  near,
  set,
  typeLength,
  value,
  writtenLength,
} from "./score-xml";
import type { ScoreChange } from "./edit-history";
import type { ImportedEvent, ImportedLane } from "./types";

const members = (e: ImportedEvent) =>
  e.heads.length ? e.heads.map((head) => head.source) : [e.source];
const staff = (n: Element) => value(n, "staff") ?? "1";
const voice = (n: Element) => value(n, "voice") ?? "1";
const linked =
  "tie,tied,slur,glissando,slide,wavy-line,hammer-on,pull-off,tremolo[type=start],tremolo[type=stop]";

function movable(event: ImportedEvent) {
  return (
    canEditEvent(event) &&
    members(event).every(
      (note, index) =>
        !note.querySelector(linked + ",grace,cue") &&
        !note.hasAttribute("attack") &&
        !note.hasAttribute("release") &&
        (!index || !note.querySelector("tuplet")),
    )
  );
}

// Slots of unequal length can trade places inside one uninterrupted voice.
// Crossing a direction, a second voice or a barline must keep its musical time.
function canShiftBetween(a: ImportedEvent, b: ImportedEvent) {
  if (a.source.parentElement !== b.source.parentElement) return false;
  const [left, right] = a.start < b.start ? [a, b] : [b, a];
  let node = members(left).at(-1)?.nextElementSibling;
  while (node && node !== right.source) {
    if (
      node.localName !== "note" ||
      voice(node) !== voice(a.source) ||
      staff(node) !== staff(a.source) ||
      node.querySelector(linked + ",grace,time-modification")
    )
      return false;
    node = node.nextElementSibling;
  }
  return node === right.source;
}

function restSpace(after: ImportedEvent, need: number) {
  let next = members(after).at(-1)?.nextElementSibling;
  const used: Element[] = [];
  while (next && need > epsilon) {
    if (
      next.localName !== "note" ||
      !first(next, "rest") ||
      voice(next) !== voice(after.source) ||
      staff(next) !== staff(after.source) ||
      next.querySelector("notations,time-modification,lyric,beam")
    )
      return;
    used.push(next);
    const duration = Number(value(next, "duration")) / after.divisions;
    if (!(duration > 0) || !Number.isFinite(duration)) return;
    need -= duration;
    next = next.nextElementSibling;
  }
  if (need <= epsilon) return { used, remainder: Math.max(0, -need) };
}

function planDrop(source: ImportedEvent, target: ImportedEvent) {
  if (
    !source.heads.length ||
    source === target ||
    source.source.ownerDocument !== target.source.ownerDocument ||
    staff(source.source) !== staff(target.source) ||
    voice(source.source) !== voice(target.source) ||
    (source.transpose ?? 0) !== (target.transpose ?? 0) ||
    !movable(source) ||
    !movable(target)
  )
    return;
  const difference = Math.abs(source.duration - target.duration);
  if (
    source.tuplet?.actual !== target.tuplet?.actual ||
    source.tuplet?.normal !== target.tuplet?.normal
  )
    return;
  if (near(difference, 0)) return { kind: "exchange" } as const;
  if (source.tuplet) return;
  if (
    !target.heads.length &&
    target.duration > source.duration &&
    !target.source.querySelector("notations,lyric")
  )
    return { kind: "rest", difference } as const;
  const shorter = source.duration < target.duration ? source : target;
  const longer = shorter === source ? target : source;
  const space = restSpace(shorter, difference);
  if (space && !space.used.includes(longer.source))
    return { kind: "balance", shorter, longer, difference, space } as const;
  if (canShiftBetween(source, target)) return { kind: "exchange" } as const;
}

export function canDropNote(source: ImportedEvent, target: ImportedEvent) {
  return Boolean(planDrop(source, target));
}

function writeTicks(note: Element, ticks: number) {
  if (!Number.isSafeInteger(Math.round(ticks)) || ticks <= 0) fail();
  const decimal = ticks.toFixed(10).replace(/\.?0+$/, "");
  if (!(Number(decimal) > 0)) fail();
  set(note, "duration", decimal);
}

// MusicXML also accepts a duration without a type. Keep an exceptionally
// long gap as one rest instead of creating a node per maxima.
function insertRests(before: ChildNode, beats: number, slot: ImportedEvent) {
  let remaining = beats;
  const longest = dottedLength(glyphValues[0][1], 3);
  while (remaining > epsilon) {
    const rhythm = writtenLength(remaining);
    const type =
      rhythm?.type ??
      (remaining <= longest
        ? glyphValues.find(([, v]) => v <= remaining + epsilon)?.[0]
        : undefined);
    const dots = rhythm?.dots ?? 0;
    const length = type ? dottedLength(typeLength(type)!, dots) : remaining;
    const rest = element(before.parentElement!, "note");
    set(rest, "rest");
    writeTicks(rest, length * slot.divisions);
    for (const tag of ["voice", "staff"]) {
      const original = first(slot.source, tag);
      if (original) insertOrdered(rest, original.cloneNode(true) as Element);
    }
    if (type) set(rest, "type", type);
    for (let i = 0; i < dots; i++) insertOrdered(rest, element(rest, "dot"));
    before.before(rest);
    remaining -= length;
  }
}

function retainSlotMarks(left: Element, right: Element) {
  for (const tag of ["beam", "tuplet"]) {
    const marks = (n: Element) =>
      tag === "beam"
        ? direct(n, tag)
        : direct(n, "notations").flatMap((group) => direct(group, tag));
    const a = marks(left),
      b = marks(right);
    for (const [note, incoming] of [
      [left, b],
      [right, a],
    ] as const)
      for (const mark of incoming)
        if (tag === "beam") insertOrdered(note, mark);
        else set(note, "notations").appendChild(mark);
    for (const n of [left, right])
      direct(n, "notations")
        .filter((group) => !group.childElementCount)
        .forEach((group) => group.remove());
  }
}

function unbeam(
  lane: ImportedLane,
  e: ImportedEvent,
  copy: (el: Element) => Element,
) {
  if (!members(e).some((n) => first(n, "beam"))) return;
  const events = lane.bars.flatMap((bar) => bar.events);
  const index = events.indexOf(e);
  const beamAt = (i: number, level: string) =>
    events[i] &&
    members(events[i])
      .flatMap((n) => direct(n, "beam"))
      .filter((b) => (b.getAttribute("number") ?? "1") === level);
  for (const beam of members(e).flatMap((n) => direct(n, "beam"))) {
    const level = beam.getAttribute("number") ?? "1";
    for (const direction of [-1, 1]) {
      let i = index;
      let mark = beam.textContent?.trim();
      while (
        mark === "continue" ||
        mark === (direction < 0 ? "end" : "begin")
      ) {
        i += direction;
        const neighbors = beamAt(i, level);
        mark = neighbors?.[0]?.textContent?.trim();
        if (mark !== "continue" && mark !== (direction < 0 ? "begin" : "end"))
          break;
        neighbors?.forEach((b) => copy(b).remove());
      }
    }
    copy(beam).remove();
  }
}

export function moveNoteEdit(
  lane: ImportedLane,
  source: ImportedEvent,
  target: ImportedEvent,
): ScoreChange {
  return (copy) => {
    const plan = planDrop(source, target);
    if (
      !plan ||
      ![source, target].every((e) =>
        lane.bars.some((b) => b.events.includes(e)),
      )
    )
      return fail();
    const place = (slot: ImportedEvent) => {
      const note = copy(slot.source);
      const marker = note.ownerDocument.createComment("");
      note.before(marker);
      return marker;
    };
    const from = place(source),
      to = place(target);
    const transfer = (
      e: ImportedEvent,
      slot: ImportedEvent,
      marker: Comment,
    ) => {
      for (const n of members(e)) {
        const note = copy(n);
        if (e.divisions !== slot.divisions)
          writeTicks(
            note,
            (Number(value(n, "duration")) * slot.divisions) / e.divisions,
          );
        note.removeAttribute("default-x");
        first(note, "rest")?.removeAttribute("measure");
        marker.before(note);
      }
    };
    if (near(source.duration, target.duration))
      retainSlotMarks(copy(source.source), copy(target.source));
    else {
      unbeam(lane, source, copy);
      unbeam(lane, target, copy);
    }
    transfer(source, target, to);
    if (plan.kind === "rest") {
      copy(target.source).remove();
      const empty = cloneTiming(source.source);
      set(empty, "rest");
      from.before(empty);
      insertRests(to, plan.difference, target);
    } else {
      transfer(target, source, from);
      if (plan.kind === "balance") {
        for (const n of plan.space.used) copy(n).remove();
        insertRests(
          plan.shorter === source ? from : to,
          plan.space.remainder,
          plan.shorter,
        );
        insertRests(
          plan.longer === source ? from : to,
          plan.difference,
          plan.longer,
        );
      }
    }
    from.remove();
    to.remove();
  };
}
