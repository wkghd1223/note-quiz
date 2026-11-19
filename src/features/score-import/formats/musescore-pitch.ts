import { first, value } from "../score-xml";
import { integer, unsupported, type Writer } from "./musescore-rhythm";

const circle = ["F", "C", "G", "D", "A", "E", "B"] as const;
const pitchClass = [5, 0, 7, 2, 9, 4, 11];
const defaultTpc = [14, 21, 16, 11, 18, 13, 20, 15, 10, 17, 12, 19];
const mod = (n: number, d: number) => ((n % d) + d) % d;

export interface Instrument {
  chromatic: number;
  diatonic: number;
  concertView: boolean;
}

export function readInstrument(
  part: Element,
  concertView: boolean,
): Instrument {
  const inst = first(part, "Instrument") ?? part;
  return {
    chromatic: integer(value(inst, "transposeChromatic"), 0),
    diatonic: integer(value(inst, "transposeDiatonic"), 0),
    concertView,
  };
}

// Moving one semitone and one diatonic step has a unique displacement on the
// circle of fifths. This preserves E-flat/F, C-flat and double accidentals.
const fifthsInterval = (i: Instrument) => 7 * i.chromatic - 12 * i.diatonic;

function spellTpc(tpc: number) {
  const index = mod(tpc - 13, 7);
  const alter = (tpc - 13 - index) / 7;
  if (Math.abs(alter) > 3) return unsupported();
  return { index, step: circle[index], alter };
}

export function writeHarmony(
  w: Writer,
  measure: Element,
  node: Element,
  staff: number,
) {
  const harmony = w.add(measure, "harmony");
  const root = value(node, "root");
  const name = value(node, "name") || "";
  if (!root) {
    if (!name) return unsupported();
    w.add(harmony, "function", name);
  } else {
    const spelling = spellTpc(integer(root));
    const r = w.add(harmony, "root");
    w.add(r, "root-step", spelling.step);
    if (spelling.alter) w.add(r, "root-alter", spelling.alter);
  }
  const kinds: Record<string, string> = {
    "": "major",
    m: "minor",
    "=": "minor",
    "7": "dominant",
    m7: "minor-seventh",
    maj7: "major-seventh",
    dim: "diminished",
    aug: "augmented",
    sus4: "suspended-fourth",
    sus2: "suspended-second",
    "6": "major-sixth",
    m6: "minor-sixth",
    "9": "dominant-ninth",
  };
  w.add(
    harmony,
    "kind",
    kinds[name] ?? "other",
    name ? { text: name } : undefined,
  );
  const bass = value(node, "base");
  if (bass) {
    const spelling = spellTpc(integer(bass));
    const b = w.add(harmony, "bass");
    w.add(b, "bass-step", spelling.step);
    if (spelling.alter) w.add(b, "bass-alter", spelling.alter);
  }
  w.add(harmony, "staff", staff);
}

export function writePitch(
  w: Writer,
  note: Element,
  head: Element,
  i: Instrument,
) {
  const midi = integer(value(head, "pitch"));
  if (midi < 0 || midi > 127) return unsupported();
  const writtenMidi = i.concertView ? midi : midi - i.chromatic;
  const concertTpc = integer(value(head, "tpc"), defaultTpc[midi % 12]);
  const writtenTpc = i.concertView
    ? concertTpc
    : integer(value(head, "tpc2"), concertTpc - fifthsInterval(i));
  const { index, alter, step } = spellTpc(writtenTpc);
  const octave = (writtenMidi - pitchClass[index] - alter) / 12 - 1;
  if (!Number.isInteger(octave)) return unsupported();
  const pitch = w.add(note, "pitch");
  w.add(pitch, "step", step);
  if (alter) w.add(pitch, "alter", alter);
  w.add(pitch, "octave", octave);
}

export function writeKey(
  w: Writer,
  attr: Element,
  node: Element,
  staff: number,
  i: Instrument,
) {
  if (value(node, "custom") === "1" || first(node, "KeySym"))
    return unsupported();
  const old = value(node, "accidental"),
    actual = value(node, "actualKey");
  const concert = value(node, "concertKey");
  let fifths: number;
  if (i.concertView && concert !== undefined) fifths = integer(concert);
  else if (actual !== undefined) fifths = integer(actual);
  else if (concert !== undefined) fifths = integer(concert) - fifthsInterval(i);
  else fifths = integer(old, 0);
  const key = w.add(attr, "key", undefined, { number: staff });
  w.add(key, "fifths", fifths);
  const mode = value(node, "mode");
  if (mode) w.add(key, "mode", mode);
}

export function writeClef(
  w: Writer,
  attr: Element,
  name: string,
  staff: number,
) {
  const raw = name.toUpperCase();
  const parts = /^([GFC])([1-5])?(?:(8|15)\s*(V[AB]|M[AB]))?$/.exec(raw);
  const percussion = raw.startsWith("PERC");
  const tab = raw.startsWith("TAB");
  if (!parts && !percussion && !tab) return unsupported();
  const sign = percussion ? "percussion" : tab ? "TAB" : parts![1];
  const clef = w.add(attr, "clef", undefined, { number: staff });
  w.add(clef, "sign", sign);
  w.add(clef, "line", parts?.[2] ?? (sign === "F" ? 4 : sign === "C" ? 3 : 2));
  if (parts?.[3]) {
    const octaves = parts[3] === "15" ? 2 : 1;
    w.add(
      clef,
      "clef-octave-change",
      parts[4].endsWith("B") ? -octaves : octaves,
    );
  }
}
