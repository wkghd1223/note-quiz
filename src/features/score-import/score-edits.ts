import { reflowScore } from "./rebar";
import {
  fail,
  epsilon,
  near,
  direct,
  first,
  value,
  element,
  insertOrdered,
  set,
  remove,
  childrenNamed,
  attributesAtStart,
  glyphValues,
  typeLength,
  dottedLength,
  writtenLength,
  writeRhythm,
} from "./score-xml";
export { direct, typeLength, dottedLength, writtenLength } from "./score-xml";
import { MAX_SCORE_REPEAT_PASSES } from "./model";
import { attributesAtBeat, signatureAttributes } from "./signature-position";
import type {
  ImportedBar,
  ImportedEvent,
  ImportedHead,
  ImportedLane,
  ImportedScore,
  ScoreClef,
  ScoreMeter,
  WrittenHead,
} from "./types";
import {
  fromPosition,
  keyAlter,
  midiOf,
  staffPosition,
  type Spelling,
} from "./editor-pitch";

/** The owner applies a change to a detached clone and commits it atomically. */
export type Edit = (copy: (original: Element) => Element) => void;
/** In timewise scores the note's container is a part within one measure. */
function partBars(note: Element): Element[] {
  const container = note.parentElement!;
  if (container.localName === "measure")
    return direct(container.parentElement!, "measure");
  const id = container.getAttribute("id");
  return direct(note.ownerDocument.documentElement, "measure").flatMap((m) =>
    direct(m, "part").filter((p) => p.getAttribute("id") === id),
  );
}

export function writtenRhythm(event: ImportedEvent, head?: WrittenHead) {
  const note = head?.source ?? event.source;
  const type = value(note, "type");
  if (type) return { type, dots: direct(note, "dot").length };
  if (first(note, "rest")?.getAttribute("measure") === "yes")
    return { type: "whole", dots: 0 };
  const ratio = event.tuplet ? event.tuplet.actual / event.tuplet.normal : 1;
  return (
    writtenLength((head?.duration ?? event.duration) * ratio) ?? {
      type: "",
      dots: 0,
    }
  );
}

/** Change just this printed head, even when other heads share its stem. */
export function noteheadEdit(source: Element, shape: "default" | "x"): Edit {
  return (copy) => {
    const note = copy(source);
    if (!first(note, "pitch") && !first(note, "unpitched")) fail();
    if (shape === "default") remove(note, "notehead");
    else {
      const head = set(note, "notehead", shape);
      // A glyph override for the old shape no longer applies to an X.
      head.removeAttribute("smufl");
    }
  };
}

export function cloneTiming(source: Element) {
  const note = element(source, "note");
  for (const kind of [
    "duration",
    "voice",
    "type",
    "dot",
    "time-modification",
    "staff",
  ])
    for (const child of direct(source, kind))
      insertOrdered(note, child.cloneNode(true) as Element);
  return note;
}

function insertAfter(reference: Element, next: Element) {
  reference.parentNode!.insertBefore(next, reference.nextSibling);
}

function notesFor(event: ImportedEvent, copy: (source: Element) => Element) {
  if (!canEditEvent(event)) fail();
  return event.heads.length
    ? event.heads.map((head) => copy(head.source))
    : [copy(event.source)];
}

export function canEditEvent(event: ImportedEvent) {
  if (event.unpitchedHeads?.length) return false;
  if (
    event.heads.length
      ? event.heads[0].source !== event.source
      : !first(event.source, "rest")
  )
    return false;
  let next = event.source.nextElementSibling;
  for (const head of event.heads.slice(1)) {
    if (head.source !== next) return false;
    next = next.nextElementSibling;
  }
  return !next || next.localName !== "note" || !first(next, "chord");
}

export function notePitch(note: Element): Spelling | null {
  const pitch = first(note, "pitch");
  if (!pitch) return null;
  const step = value(pitch, "step") as Spelling["step"];
  return {
    step,
    octave: Number(value(pitch, "octave")),
    alter: Number(value(pitch, "alter") || 0),
  };
}

function allTies(note: Element) {
  return [
    ...direct(note, "tie"),
    ...direct(note, "notations").flatMap((n) => direct(n, "tied")),
  ];
}

export function ties(note: Element, direction: "start" | "stop") {
  return allTies(note).filter(
    (t) =>
      t.getAttribute("type") === direction ||
      t.getAttribute("type") === "continue",
  );
}

export function clearTie(note: Element, direction: "start" | "stop") {
  for (const t of ties(note, direction)) {
    if (t.getAttribute("type") === "continue")
      t.setAttribute("type", direction === "start" ? "stop" : "start");
    else t.remove();
  }
  direct(note, "notations")
    .filter((n) => !n.children.length)
    .forEach((n) => n.remove());
}

type TieEnd = "start" | "stop";

/** Unison layers, alternate-pass ties, and conflicting sound/print marks
 * cannot be identified by a single selected head and time boundary. */
export function ordinaryTieEnds(note: Element) {
  const marks = allTies(note);
  if (
    marks.some(
      (mark) =>
        mark.hasAttribute("time-only") ||
        !["start", "stop", "continue"].includes(
          mark.getAttribute("type") ?? "",
        ) ||
        Number(mark.getAttribute("number") || 1) !== 1,
    )
  )
    return false;
  const hasSound = marks.some((mark) => mark.localName === "tie");
  const hasPrint = marks.some((mark) => mark.localName === "tied");
  return (["start", "stop"] as const).every((side) => {
    const ends = ties(note, side);
    const sounds = ends.filter((mark) => mark.localName === "tie").length;
    const visuals = ends.length - sounds;
    return (
      sounds <= 1 &&
      visuals <= 1 &&
      (!hasSound || !hasPrint || sounds === visuals)
    );
  });
}

function addTieMark(note: Element, tag: "tie" | "tied", side: TieEnd) {
  const owner = tag === "tie" ? note : set(note, "notations");
  const mark = element(owner, tag);
  mark.setAttribute("type", side);
  const outgoing =
    side === "stop" &&
    direct(owner, tag).find((m) => m.getAttribute("type") === "start");
  if (outgoing) owner.insertBefore(mark, outgoing);
  else if (tag === "tie") insertOrdered(note, mark);
  else owner.appendChild(mark);
}

function addTieEnd(note: Element, side: TieEnd) {
  const other = side === "start" ? "stop" : "start";
  const preserved = ties(note, other);
  for (const tag of ["tie", "tied"] as const) {
    // Introducing the first sound <tie> must not hide an existing, print-only
    // continuation from importers which then prefer the explicit sound data.
    if (preserved.length && !preserved.some((m) => m.localName === tag))
      addTieMark(note, tag, other);
    addTieMark(note, tag, side);
  }
}

export function tieAction(
  lane: ImportedLane,
  barIndex: number,
  eventIndex: number,
  headIndex: number,
): { linked: boolean; change: Edit } | undefined {
  const bar = lane.bars[barIndex];
  const event = bar?.events[eventIndex],
    head = event?.heads[headIndex];
  if (!head || !canEditEvent(event) || !near(head.duration, event.duration))
    return;
  const inside = bar.events[eventIndex + 1];
  const next = inside ?? lane.bars[barIndex + 1]?.events[0];
  if (
    !next ||
    !canEditEvent(next) ||
    !near(event.start + head.duration, next.start + (inside ? 0 : bar.duration))
  )
    return;
  if (
    [event, next].some(
      (e) =>
        first(e.source, "cue") ||
        first(e.source, "grace") ||
        e.heads.filter((h) => h.midi === head.midi).length !== 1,
    )
  )
    return;
  const target = next.heads.find(
    (h) =>
      h.midi === head.midi &&
      h.step === head.step &&
      h.octave === head.octave &&
      h.alter === head.alter,
  );
  if (
    !target ||
    !ordinaryTieEnds(head.source) ||
    !ordinaryTieEnds(target.source)
  )
    return;
  const linked = !!ties(head.source, "start").length;
  if (linked !== !!ties(target.source, "stop").length) return;
  return {
    linked,
    change: (copy) => {
      const update = linked ? clearTie : addTieEnd;
      update(copy(head.source), "start");
      update(copy(target.source), "stop");
    },
  };
}

function connectedTie(note: Element, direction: "start" | "stop") {
  if (!ties(note, direction).length) return undefined;
  const pitch = notePitch(note);
  if (!pitch || !note.parentElement) return undefined;
  const sequence = partBars(note)
    .flatMap((m) => direct(m, "note"))
    .filter((n) => {
      const p = notePitch(n);
      return (
        p?.step === pitch.step &&
        p.octave === pitch.octave &&
        p.alter === pitch.alter &&
        (value(n, "voice") ?? "1") === (value(note, "voice") ?? "1") &&
        (value(n, "staff") ?? "1") === (value(note, "staff") ?? "1")
      );
    });
  const other =
    sequence[sequence.indexOf(note) + (direction === "start" ? 1 : -1)];
  return other && ties(other, direction === "start" ? "stop" : "start").length
    ? other
    : undefined;
}

function detachTies(note: Element) {
  const left = connectedTie(note, "stop"),
    right = connectedTie(note, "start");
  if (left) clearTie(left, "start");
  if (right) clearTie(right, "stop");
  clearTie(note, "start");
  clearTie(note, "stop");
}

function writePitch(note: Element, pitch: Spelling, showAccidental = false) {
  if (
    pitch.octave < 0 ||
    pitch.octave > 9 ||
    !Number.isFinite(pitch.alter) ||
    Math.abs(pitch.alter) > 2 ||
    first(note, "unpitched")
  )
    fail();
  remove(note, "rest", "accidental");
  const p = set(note, "pitch");
  remove(p, "step", "alter", "octave");
  const fields: [string, string | number][] = [["step", pitch.step]];
  if (pitch.alter) fields.push(["alter", pitch.alter]);
  fields.push(["octave", pitch.octave]);
  for (const [name, text] of fields) {
    const child = element(p, name);
    child.textContent = String(text);
    p.appendChild(child);
  }
  const sign = ["flat-flat", "flat", "natural", "sharp", "double-sharp"][
    pitch.alter + 2
  ];
  if (showAccidental && sign) set(note, "accidental", sign);
}

export function pitchEdit(
  event: ImportedEvent,
  head: ImportedHead | undefined,
  pitch: Spelling,
  showAccidental = false,
): Edit {
  return (copy) => {
    if (!canEditEvent(event)) fail();
    if (!head && !first(event.source, "rest")) fail();
    if (
      event.heads.some(
        (h) => h.id !== head?.id && near(midiOf(h), midiOf(pitch)),
      )
    )
      fail();
    const original = head?.source ?? event.source;
    const chain = [original];
    for (const direction of ["stop", "start"] as const) {
      let other = connectedTie(original, direction);
      while (other && !chain.includes(other)) {
        chain.push(other);
        other = connectedTie(other, direction);
      }
    }
    for (const source of chain) {
      let anchor = source;
      while (
        first(anchor, "chord") &&
        anchor.previousElementSibling?.localName === "note"
      )
        anchor = anchor.previousElementSibling;
      for (
        let other: Element | null = anchor;
        other;
        other = other.nextElementSibling
      ) {
        if (
          other !== anchor &&
          (other.localName !== "note" || !first(other, "chord"))
        )
          break;
        const p = notePitch(other);
        if (other !== source && p && near(midiOf(p), midiOf(pitch))) fail();
      }
    }
    for (const source of chain)
      writePitch(copy(source), pitch, showAccidental && source === original);
  };
}

export function nextChordPitch(event: ImportedEvent, base: ImportedHead) {
  const occupied = new Set(event.heads.map(midiOf));
  for (let delta = 2; delta <= 28; delta += 2) {
    const p = fromPosition(staffPosition(base) + delta);
    p.alter = keyAlter(p.step, event.fifths);
    if (p.octave <= 9 && !occupied.has(midiOf(p))) return p;
  }
  return fail();
}

export function addHeadEdit(event: ImportedEvent, base: ImportedHead): Edit {
  return (copy) => {
    if (!canEditEvent(event)) fail();
    const p = nextChordPitch(event, base);
    const note = cloneTiming(copy(base.source));
    set(note, "chord");
    writePitch(note, p);
    insertAfter(copy(event.heads[event.heads.length - 1].source), note);
  };
}

function turnIntoRest(note: Element) {
  detachTies(note);
  remove(
    note,
    "chord",
    "pitch",
    "unpitched",
    "accidental",
    "notehead",
    "notehead-text",
    "instrument",
  );
  set(note, "rest");
}

export function restEdit(event: ImportedEvent, onlyHead?: ImportedHead): Edit {
  return (copy) => {
    const heads = notesFor(event, copy);
    if (onlyHead && event.heads.length > 1) {
      const removed = copy(onlyHead.source);
      detachTies(removed);
      if (removed === heads[0]) {
        const survivors = event.heads.filter((h) => h.id !== onlyHead.id);
        const anchorHead = survivors.reduce((a, b) =>
          a.duration >= b.duration ? a : b,
        );
        const anchor = copy(anchorHead.source);
        remove(anchor, "chord");
        for (const marker of childrenNamed(removed, "tuplet"))
          set(anchor, "notations").appendChild(marker);
        if (!direct(anchor, "beam").length) {
          for (const beam of direct(removed, "beam"))
            insertOrdered(anchor, beam);
        }
        removed.parentNode!.insertBefore(anchor, removed);
        const tail = survivors.filter((h) => h !== anchorHead).at(-1);
        const gap = event.duration - anchorHead.duration;
        if (gap > epsilon) {
          if (event.tuplet) fail();
          fillRestAfter(
            tail ? copy(tail.source) : anchor,
            gap,
            event.divisions,
          );
        }
      }
      removed.remove();
    } else {
      for (const note of heads.slice(1)) {
        detachTies(note);
        note.remove();
      }
      turnIntoRest(heads[0]);
    }
  };
}

function fillRestAfter(anchor: Element, length: number, divisions: number) {
  let remaining = length;
  let after = anchor;
  while (remaining > epsilon) {
    const exact = writtenLength(remaining);
    const best = glyphValues.find(([, v]) => v < remaining + epsilon);
    if (!best) fail();
    const rhythm = exact ?? { type: best![0], dots: 0 };
    const portion = dottedLength(typeLength(rhythm.type)!, rhythm.dots);
    const rest = cloneTiming(anchor);
    remove(rest, "time-modification");
    set(rest, "rest");
    writeRhythm(rest, rhythm.type, rhythm.dots, portion * divisions);
    insertAfter(after, rest);
    after = rest;
    remaining -= portion;
  }
}

function denominator(value: number) {
  if (!Number.isFinite(value)) return fail();
  for (let i = 1; i <= 16384; i++)
    if (near(value * i, Math.round(value * i))) return i;
  return fail();
}
function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** MusicXML divisions apply to backup/forward, direction offsets and note attacks as well. */
function prepareGrid(
  copy: (e: Element) => Element,
  event: ImportedEvent,
  lengths: number[],
) {
  let factor = 1;
  for (const length of lengths) {
    const divisor = denominator(length * event.divisions);
    factor *= divisor / gcd(factor, divisor);
    if (!Number.isSafeInteger(factor) || factor > 1000000) fail();
  }
  if (factor === 1) return event.divisions;
  const measures = partBars(copy(event.source));
  for (const el of measures.flatMap((m) =>
    Array.from(m.getElementsByTagNameNS(m.namespaceURI, "*")),
  )) {
    if (["duration", "divisions", "offset"].includes(el.localName)) {
      const n = Number(el.textContent) * factor;
      if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER) fail();
      el.textContent = String(n);
    }
    for (const attr of ["attack", "release", "make-time", "divisions"]) {
      if (el.hasAttribute(attr))
        el.setAttribute(attr, String(Number(el.getAttribute(attr)) * factor));
    }
  }
  const initial = measures[0];
  if (initial) {
    const attrs = attributesAtStart(initial);
    if (!first(attrs, "divisions")) set(attrs, "divisions", factor);
  }
  return event.divisions * factor;
}

function contiguous(events: ImportedEvent[]) {
  return events.every((e, i) => {
    if (!i) return true;
    const prev = events[i - 1];
    const last = prev.heads.at(-1)?.source ?? prev.source;
    return (
      near(prev.start + prev.duration, e.start) &&
      last.nextElementSibling === e.source
    );
  });
}

function simpleRhythm(event: ImportedEvent) {
  return (
    canEditEvent(event) &&
    !event.tuplet &&
    !event.heads.some((h) => allTies(h.source).length) &&
    !first(event.source, "grace") &&
    !first(event.source, "cue")
  );
}

/** Recover time from immediately adjacent, ordinary rests or restore it after the edit. */
function exchangeTime(
  copy: (e: Element) => Element,
  bar: ImportedBar,
  last: ImportedEvent,
  after: Element,
  difference: number,
  divisions: number,
) {
  if (near(difference, 0)) return;
  if (difference < 0) {
    fillRestAfter(after, -difference, divisions);
    return;
  }
  let need = difference,
    previous = last;
  for (const rest of bar.events.slice(bar.events.indexOf(last) + 1)) {
    if (
      !contiguous([previous, rest]) ||
      rest.heads.length ||
      !simpleRhythm(rest) ||
      rest.divisions !== last.divisions ||
      first(rest.source, "notations") ||
      first(rest.source, "lyric")
    )
      fail();
    const draft = copy(rest.source);
    if (rest.duration + epsilon >= need) {
      const spare = rest.duration - need;
      if (spare > epsilon) fillRestAfter(draft, spare, divisions);
      draft.remove();
      return;
    }
    need -= rest.duration;
    draft.remove();
    previous = rest;
  }
  // A genuinely empty tail has no rest to consume. Never lengthen a pickup.
  const end = last.start + last.duration + difference;
  if (end > bar.duration + epsilon || previous !== bar.events.at(-1)) fail();
}

export function durationEdit(
  bar: ImportedBar,
  event: ImportedEvent,
  type: string,
  dots: number,
): Edit {
  return (copy) => {
    const base = typeLength(type);
    if (
      !base ||
      !simpleRhythm(event) ||
      event.heads.some((h) => !near(h.duration, event.duration))
    )
      fail();
    const duration = dottedLength(base!, dots);
    const divisions = prepareGrid(copy, event, [duration]);
    const notes = notesFor(event, copy);
    for (const note of notes) {
      first(note, "rest")?.removeAttribute("measure");
      remove(note, "beam");
      writeRhythm(note, type, dots, duration * divisions);
    }
    exchangeTime(
      copy,
      bar,
      event,
      notes[notes.length - 1],
      duration - event.duration,
      divisions,
    );
  };
}

function markTuplet(note: Element, side: "start" | "stop") {
  const parent = set(note, "notations");
  const marker = element(parent, "tuplet");
  marker.setAttribute("type", side);
  marker.setAttribute("number", "1");
  parent.appendChild(marker);
}
function writeRatio(
  note: Element,
  actual: number,
  normal: number,
  unit: { type: string; dots: number },
) {
  remove(note, "time-modification");
  const tm = set(note, "time-modification");
  for (const [name, text] of [
    ["actual-notes", actual],
    ["normal-notes", normal],
    ["normal-type", unit.type],
  ] as const) {
    const tag = element(tm, name);
    tag.textContent = String(text);
    tm.appendChild(tag);
  }
  for (let i = 0; i < unit.dots; i++) tm.appendChild(element(tm, "normal-dot"));
}

function checkRatio(actual: number, normal: number) {
  if (
    ![actual, normal].every(
      (n) => Number.isSafeInteger(n) && n >= 1 && n <= 128,
    ) ||
    actual === normal
  )
    fail();
}

export function divideTupletEdit(
  event: ImportedEvent,
  actual: number,
  normal: number,
): Edit {
  return (copy) => {
    checkRatio(actual, normal);
    const unit = writtenLength(event.duration / normal);
    if (
      !unit ||
      !simpleRhythm(event) ||
      event.heads.some((h) => !near(h.duration, event.duration))
    )
      fail();
    const chunk = event.duration / actual;
    const divisions = prepareGrid(copy, event, [chunk]);
    const notes = notesFor(event, copy);
    for (const note of notes) {
      writeRhythm(note, unit!.type, unit!.dots, divisions * chunk);
      first(note, "rest")?.removeAttribute("measure");
      remove(note, "beam");
      writeRatio(note, actual, normal, unit!);
    }
    markTuplet(notes[0], "start");
    let last = notes[notes.length - 1];
    for (let i = 1; i < actual; i++) {
      const rest = cloneTiming(notes[0]);
      set(rest, "rest");
      insertAfter(last, rest);
      last = rest;
    }
    markTuplet(actual === 1 ? notes[0] : last, "stop");
  };
}

export function groupTupletEdit(
  bar: ImportedBar,
  selection: ImportedEvent[],
  actual: number,
  normal: number,
): Edit {
  return (copy) => {
    checkRatio(actual, normal);
    if (
      !selection.length ||
      !selection.every(simpleRhythm) ||
      !contiguous(selection) ||
      selection.some((e) => e.divisions !== selection[0].divisions)
    )
      fail();
    const sum = selection.reduce((t, e) => t + e.duration, 0);
    const unit = writtenLength(sum / actual);
    if (!unit) fail();
    const factor = normal / actual;
    const durations = selection
      .flatMap((e) => [e.duration, ...e.heads.map((h) => h.duration)])
      .map((d) => d * factor);
    const divisions = prepareGrid(copy, selection[0], durations);
    for (const e of selection) {
      const notes = notesFor(e, copy);
      notes.forEach((note, i) => {
        const dur = e.heads[i]?.duration ?? e.duration;
        const written = writtenLength(dur);
        if (!written) fail();
        remove(note, "beam");
        first(note, "rest")?.removeAttribute("measure");
        writeRhythm(
          note,
          written!.type,
          written!.dots,
          dur * factor * divisions,
        );
        writeRatio(note, actual, normal, unit!);
      });
    }
    const last = selection[selection.length - 1];
    markTuplet(copy(selection[0].source), "start");
    markTuplet(copy(last.source), "stop");
    exchangeTime(
      copy,
      bar,
      last,
      notesFor(last, copy).at(-1)!,
      sum * (factor - 1),
      divisions,
    );
  };
}

function tupletMarkers(event: ImportedEvent) {
  const notes = event.heads.length
    ? event.heads.map((head) => head.source)
    : [event.source];
  return notes.flatMap((note) => childrenNamed(note, "tuplet"));
}

export function tupletSpan(
  events: ImportedEvent[],
  index: number,
): ImportedEvent[] {
  const selected = events[index];
  if (!selected?.tuplet) return [];
  const match = (a: ImportedEvent | undefined) =>
    a?.tuplet?.actual === selected.tuplet!.actual &&
    a?.tuplet?.normal === selected.tuplet!.normal;
  const has = (i: number, side: string) =>
    tupletMarkers(events[i]).some((t) => t.getAttribute("type") === side);
  let start = index,
    end = index;
  while (
    start &&
    match(events[start - 1]) &&
    !has(start, "start") &&
    !has(start - 1, "stop")
  )
    start--;
  while (
    end + 1 < events.length &&
    match(events[end + 1]) &&
    !has(end, "stop") &&
    !has(end + 1, "start")
  )
    end++;
  // A time-modification is sufficient in MusicXML. Some exporters omit
  // printed brackets even for adjacent, independent groups of the same ratio.
  if (!has(start, "start") && !has(end, "stop")) {
    const normalType = first(selected.source, "time-modification");
    const unit =
      normalType && typeLength(value(normalType, "normal-type") ?? "");
    const normal = unit
      ? dottedLength(unit, direct(normalType, "normal-dot").length)
      : typeLength(writtenRhythm(selected).type);
    if (normal) {
      const span = normal * selected.tuplet.normal;
      let begin = start,
        sum = 0;
      for (let i = start; i <= end; i++) {
        sum += events[i].duration;
        if (sum >= span - epsilon || i === end) {
          if (index <= i) return events.slice(begin, i + 1);
          begin = i + 1;
          sum = 0;
        }
      }
    }
  }
  return events.slice(start, end + 1);
}

function completeTupletGroup(events: ImportedEvent[], selected: ImportedEvent) {
  const group = tupletSpan(events, events.indexOf(selected));
  if (!group.length) return fail();
  // A fragment of an outer bracket can have a different time-modification
  // and no printed marker of its own. Never strip its timing in isolation.
  const open = new Set<string>();
  for (const event of events) {
    if (event === group[0]) break;
    for (const marker of tupletMarkers(event)) {
      const id = marker.getAttribute("number") || "1";
      if (marker.getAttribute("type") === "start") open.add(id);
      if (marker.getAttribute("type") === "stop") open.delete(id);
    }
  }
  if (open.size) return fail();
  const markers = group.flatMap((event) =>
    tupletMarkers(event).map((marker) => ({ event, marker })),
  );
  if (markers.length) {
    const [start, stop] = markers;
    if (
      markers.length !== 2 ||
      start.event !== group[0] ||
      stop.event !== group.at(-1) ||
      start.marker.getAttribute("type") !== "start" ||
      stop.marker.getAttribute("type") !== "stop" ||
      (start.marker.getAttribute("number") || "1") !==
        (stop.marker.getAttribute("number") || "1")
    )
      return fail();
  }
  return group;
}

function ordinaryDurations(event: ImportedEvent) {
  return notesFor(event, (n) => n).map((_note, index) => {
    const { type, dots } = writtenRhythm(event, event.heads[index]);
    const base = typeLength(type);
    return base ? dottedLength(base, dots) : fail();
  });
}

export function ungroupEdit(lane: ImportedLane, selected: ImportedEvent): Edit {
  return (copy) => {
    // Engraving clips a bracket to the current bar. Editing needs both ends,
    // even after a meter change has placed them in different bars.
    const group = completeTupletGroup(
      lane.bars.flatMap((bar) => bar.events),
      selected,
    );
    if (
      group.some(
        (e) =>
          e.divisions !== group[0].divisions ||
          e.heads.some((h) => allTies(h.source).length),
      )
    )
      fail();
    const members = new Set(group);
    const sections = lane.bars
      .map((bar) => ({
        bar,
        events: bar.events.filter((e) => members.has(e)),
      }))
      .filter((section) => section.events.length);
    for (const [index, section] of sections.entries()) {
      if (!contiguous(section.events)) fail();
      const next = sections[index + 1];
      const last = section.events.at(-1)!;
      if (
        next &&
        (section.bar.index + 1 !== next.bar.index ||
          !near(last.start + last.duration, section.bar.duration) ||
          !near(next.events[0].start, 0))
      )
        fail();
    }
    const durations = new Map(
      group.map((event) => [event, ordinaryDurations(event)]),
    );
    const divisions = prepareGrid(
      copy,
      group[0],
      [...durations.values()].flat(),
    );
    for (const section of sections) {
      let delta = 0;
      for (const e of section.events) {
        const lengths = durations.get(e)!;
        for (const [i, note] of notesFor(e, copy).entries()) {
          set(note, "duration", Math.round(lengths[i] * divisions));
          remove(note, "time-modification", "beam");
          childrenNamed(note, "tuplet").forEach((t) => t.remove());
        }
        delta += lengths[0] - e.duration;
      }
      const last = section.events.at(-1)!;
      exchangeTime(
        copy,
        section.bar,
        last,
        notesFor(last, copy).at(-1)!,
        delta,
        divisions,
      );
    }
  };
}

export function clefEdit(
  bar: ImportedBar,
  lane: ImportedLane,
  choice: ScoreClef,
  event?: ImportedEvent,
): Edit {
  return (copy) => {
    const original = attributesAtBeat(bar, event)
      .flatMap((a) => direct(a, "clef"))
      .filter((c) => (c.getAttribute("number") || "1") === lane.staff)
      .at(-1);
    const attr = signatureAttributes(copy, bar, event);
    const clef = original
      ? copy(original)
      : insertOrdered(attr, element(attr, "clef"));
    if (Number(lane.staff) > 1) clef.setAttribute("number", lane.staff);
    remove(clef, "sign", "line", "clef-octave-change");
    for (const [tag, text] of [
      ["sign", choice.sign],
      ["line", choice.line],
    ] as const) {
      const child = element(clef, tag);
      child.textContent = String(text);
      clef.appendChild(child);
    }
    if (choice.octaveChange)
      set(clef, "clef-octave-change", choice.octaveChange);
  };
}

export function meterEdit(
  score: ImportedScore,
  lane: ImportedLane,
  bar: ImportedBar,
  meter: ScoreMeter,
): Edit {
  return (copy) => reflowScore(copy, score, lane, bar, meter);
}

interface RepeatRange {
  start: number;
  end: number;
  forward: Element[];
  backward: Element[];
}

export function repeatRanges(lane: ImportedLane) {
  const bars = lane.bars.map(() => ({
    forward: [] as Element[],
    backward: [] as Element[],
  }));
  for (const bar of lane.bars) {
    for (const barline of direct(bar.source, "barline")) {
      const boundary =
        bar.index + (barline.getAttribute("location") === "left" ? 0 : 1);
      for (const mark of direct(barline, "repeat")) {
        const direction = mark.getAttribute("direction");
        if (direction === "forward") bars[boundary]?.forward.push(mark);
        if (direction === "backward") bars[boundary - 1]?.backward.push(mark);
      }
    }
  }
  const open: number[] = [],
    ranges: RepeatRange[] = [];
  for (const [index, { forward, backward }] of bars.entries()) {
    if (forward.length) open.push(index);
    if (backward.length) {
      const start = open.pop();
      ranges.push({
        start: start ?? 0,
        end: index,
        forward: start === undefined ? [] : bars[start].forward,
        backward,
      });
    }
  }
  return { bars, ranges, open };
}

function addRepeat(measure: Element, start: boolean, count: number) {
  const dir = start ? "forward" : "backward",
    loc = start ? "left" : "right";
  const owner =
    direct(measure, "barline").find(
      (b) => (b.getAttribute("location") || "right") === loc,
    ) ?? element(measure, "barline");
  if (!owner.parentElement) {
    owner.setAttribute("location", loc);
    measure.insertBefore(owner, start ? measure.firstElementChild : null);
  }
  const marker = element(owner, "repeat");
  marker.setAttribute("direction", dir);
  if (!start) marker.setAttribute("times", String(count));
  owner.appendChild(marker);
}

export function repeatEdit(
  score: ImportedScore,
  start: number,
  end: number,
  count: number,
  erase: boolean,
): Edit {
  return (copy) => {
    if (
      !Number.isSafeInteger(count) ||
      count < 1 ||
      count > MAX_SCORE_REPEAT_PASSES ||
      start > end ||
      start < 0
    )
      fail();
    const parts = new Map(score.lanes.map((lane) => [lane.partId, lane]));
    for (const lane of parts.values()) {
      const from = lane.bars[start],
        to = lane.bars[end];
      if (!from || !to) fail();
      const { ranges, open } = repeatRanges(lane);
      const existing = ranges.find(
        (pair) => pair.start === start && pair.end === end,
      );
      if (existing) {
        if (!erase) {
          for (const mark of existing.backward)
            copy(mark).setAttribute("times", String(count));
          continue;
        }
        for (const mark of [...existing.forward, ...existing.backward]) {
          const draft = copy(mark),
            barline = draft.parentElement!;
          draft.remove();
          if (!barline.children.length) barline.remove();
        }
      } else {
        if (erase) continue;
        if (
          open.some((index) => index <= end) ||
          ranges.some((pair) => pair.start <= end && pair.end >= start)
        )
          fail();
        addRepeat(copy(from.source), true, count);
        addRepeat(copy(to.source), false, count);
      }
    }
  };
}
