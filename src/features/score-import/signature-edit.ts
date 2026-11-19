import type { ScoreChange } from "./edit-history";
import {
  fromPosition,
  keyAlter,
  midiOf,
  staffPosition,
  steps,
  type Spelling,
} from "./editor-pitch";
import { scoreBeatOf } from "./model";
import { attributesAtBeat, signatureAttributes } from "./signature-position";
import { clearTie, notePitch, ordinaryTieEnds, ties } from "./score-edits";
import {
  childrenNamed,
  direct,
  element,
  epsilon,
  fail,
  first,
  insertOrdered,
  remove,
  set,
  value,
} from "./score-xml";
import type {
  ImportedBar,
  ImportedEvent,
  ImportedLane,
  ImportedScore,
  ScoreStep,
} from "./types";

export interface WrittenKey {
  fifths: number;
  mode: "major" | "minor";
}

const modes = [
  "ionian",
  "dorian",
  "phrygian",
  "lydian",
  "mixolydian",
  "aeolian",
  "locrian",
];
const mod = (n: number, d: number) => ((n % d) + d) % d;

function tonic(fifths: number, mode?: string): Spelling {
  const degree = mode === "minor" ? 5 : Math.max(0, modes.indexOf(mode ?? ""));
  const pitch = fromPosition(28 + mod(4 * fifths + degree, 7));
  pitch.alter = keyAlter(pitch.step, fifths);
  return pitch;
}

function keyInterval(
  bar: Pick<ImportedBar, "fifths" | "keyMode">,
  choice: WrittenKey,
) {
  const from = tonic(bar.fifths, bar.keyMode),
    to = tonic(choice.fifths, choice.mode);
  const delta = midiOf(to) - midiOf(from);
  // Choose the closest tonic, preferring up for a tritone. Use both intervals
  // so enharmonic keys (F# and Gb) keep their distinct written spellings.
  const semitones = mod(delta + 5, 12) - 5;
  const letters =
    staffPosition(to) - staffPosition(from) + 7 * ((semitones - delta) / 12);
  return { letters, semitones };
}

function applies(key: Element, staff: string) {
  return !key.hasAttribute("number") || key.getAttribute("number") === staff;
}

/** Install the new signature after any simultaneous general declaration, while
 * keeping that general key available to the other staves in the part. */
function writeKey(
  copy: Parameters<ScoreChange>[0],
  score: ImportedScore,
  lane: ImportedLane,
  bar: ImportedBar,
  choice: WrittenKey,
  event?: ImportedEvent,
) {
  const opening = attributesAtBeat(bar, event)
    .flatMap((a) => direct(a, "key"))
    .filter((k) => applies(k, lane.staff))
    .at(-1);
  const multipleStaves =
    opening &&
    !opening.hasAttribute("number") &&
    (score.lanes.some(
      (other) => other.partId === lane.partId && other.staff !== lane.staff,
    ) ||
      lane.bars.some((b) =>
        direct(b.source, "attributes").some(
          (a) => Number(value(a, "staves")) > 1,
        ),
      ));
  let key: Element;
  if (opening && !multipleStaves) {
    key = copy(opening);
  } else {
    const attr = opening
      ? copy(opening.parentElement!)
      : signatureAttributes(copy, bar, event);
    key = insertOrdered(attr, element(attr, "key"));
    key.setAttribute("number", lane.staff);
  }
  // A nontraditional key and its per-accidental octave/previous cancellation
  // are a different MusicXML representation from a fifths-based signature.
  remove(
    key,
    "cancel",
    "key-step",
    "key-alter",
    "key-accidental",
    "key-octave",
  );
  set(key, "fifths", choice.fifths);
  set(key, "mode", choice.mode);
}

type Interval = ReturnType<typeof keyInterval>;
function spell(pitch: Spelling, interval: Interval) {
  if (
    !steps.includes(pitch.step) ||
    !Number.isInteger(pitch.alter) ||
    !Number.isInteger(pitch.octave)
  )
    return fail();
  const next = fromPosition(staffPosition(pitch) + interval.letters);
  next.alter = midiOf(pitch) + interval.semitones - midiOf(next);
  if (Math.abs(next.alter) > 2) return fail();
  return next;
}

function writeSpelling(
  node: Element,
  stepTag: string,
  alterTag: string,
  next: Spelling,
) {
  const step = first(node, stepTag);
  if (!step) return fail();
  step.textContent = next.step;
  const old = first(node, alterTag);
  if (next.alter === 0) old?.remove();
  else {
    const alter = old ?? element(node, alterTag);
    if (!old) step.after(alter);
    alter.textContent = String(next.alter);
  }
}

function moveNote(note: Element, interval: Interval) {
  const pitch = notePitch(note);
  if (!pitch) return;
  // Fixing the pitch while retaining a literal fret/string or harp tuning
  // would leave the physical fingering in disagreement with the note.
  if (
    childrenNamed(note, "fret").length ||
    childrenNamed(note, "string").length
  )
    return fail();
  const next = spell(pitch, interval);
  if (next.octave < 0 || next.octave > 9) return fail();
  const xmlPitch = first(note, "pitch")!;
  writeSpelling(xmlPitch, "step", "alter", next);
  set(xmlPitch, "octave", next.octave);
  const accidental = first(note, "accidental");
  if (accidental)
    accidental.textContent = [
      "flat-flat",
      "flat",
      "natural",
      "sharp",
      "double-sharp",
    ][next.alter + 2];
}

function moveHarmony(harmony: Element, interval: Interval) {
  if (first(harmony, "frame") && interval.semitones) return fail();
  for (const tag of ["root", "bass"]) {
    for (const node of direct(harmony, tag)) {
      const stepTag = tag + "-step",
        alterTag = tag + "-alter";
      const step = value(node, stepTag) as ScoreStep;
      const next = spell(
        { step, octave: 4, alter: Number(value(node, alterTag) ?? 0) },
        interval,
      );
      writeSpelling(node, stepTag, alterTag, next);
      // A custom printed root/bass name can contain the old spelling.
      first(node, stepTag)?.removeAttribute("text");
    }
  }
}

/** An ordinary tie crossing the edited boundary becomes a new attack.
 * Internal ties (including all intermediate stop/start links) stay intact. */
function splitBoundaryTies(
  copy: Parameters<ScoreChange>[0],
  lane: ImportedLane,
  moved: Set<Element>,
  semitones: number,
) {
  // Enharmonic respelling alone does not create a new sounding attack.
  if (semitones === 0) return;
  const active = new Map<number, Element>();
  for (const bar of lane.bars)
    for (const event of bar.events)
      for (const head of event.heads) {
        const source = head.source,
          changed = moved.has(source);
        if (
          changed &&
          (head.midi + semitones < 0 || head.midi + semitones > 127)
        )
          return fail();
        const previous = active.get(head.midi);
        if (ties(source, "stop").length) {
          if (!previous && changed) return fail();
          if (previous && changed !== moved.has(previous)) {
            if (!ordinaryTieEnds(source) || !ordinaryTieEnds(previous))
              return fail();
            clearTie(copy(previous), "start");
            clearTie(copy(source), "stop");
          }
        } else if (previous && moved.has(previous)) return fail();
        if (ties(source, "start").length) active.set(head.midi, source);
        else active.delete(head.midi);
      }
  if ([...active.values()].some((node) => moved.has(node))) fail();
}

export function keyEdit(
  score: ImportedScore,
  lane: ImportedLane,
  bar: ImportedBar,
  choice: WrittenKey,
  transposeNotes: boolean,
  event?: ImportedEvent,
): ScoreChange {
  return (copy) => {
    if (
      !Number.isInteger(choice.fifths) ||
      Math.abs(choice.fifths) > 7 ||
      !["major", "minor"].includes(choice.mode)
    )
      return fail();
    writeKey(copy, score, lane, bar, choice, event);
    const interval = keyInterval(event ?? bar, choice);
    if (!transposeNotes || (!interval.letters && !interval.semitones)) return;
    const moved = new Set<Element>();
    for (const measure of lane.bars.slice(bar.index)) {
      const start = measure.index === bar.index ? (event?.start ?? 0) : 0;
      let end = Infinity;
      for (const attr of direct(measure.source, "attributes")) {
        const at = scoreBeatOf(attr);
        if (measure.index === bar.index && at < start + epsilon) continue;
        if (direct(attr, "key").some((k) => applies(k, lane.staff)))
          end = Math.min(end, at);
      }
      for (const node of Array.from(measure.source.children)) {
        if (node.localName !== "note" && node.localName !== "harmony") continue;
        if (
          (value(node, "staff") || "1") !== lane.staff ||
          scoreBeatOf(node) < start - epsilon ||
          scoreBeatOf(node) >= end - epsilon
        )
          continue;
        if (node.localName === "harmony") moveHarmony(copy(node), interval);
        else if (first(node, "pitch")) {
          moveNote(copy(node), interval);
          moved.add(node);
        }
      }
      if (Number.isFinite(end)) break;
    }
    for (const voice of score.lanes)
      if (voice.partId === lane.partId && voice.staff === lane.staff)
        splitBoundaryTies(copy, voice, moved, interval.semitones);
  };
}
