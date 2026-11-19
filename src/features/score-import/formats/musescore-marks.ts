import { direct, first, insertOrdered, value } from "../score-xml";
import {
  integer,
  quarters,
  unsupported,
  type Writer,
} from "./musescore-rhythm";

const articulationSymbols: Record<string, string> = {
  Accent: "accent",
  Marcato: "strong-accent",
  Staccato: "staccato",
  Staccatissimo: "staccatissimo",
  Tenuto: "tenuto",
  TenutoStaccato: "detached-legato",
};

const checkedLegacyTies = new WeakSet<Element>();

// MuseScore 2 uses a shared spanner ID namespace. Validate each pair once,
// since an endSpanner on a note can also end a glissando.
function checkLegacyTies(note: Element) {
  const staff = note.closest("Staff");
  if (!staff) unsupported();
  if (checkedLegacyTies.has(staff)) return;
  const starts = new Map<string, Element>();
  for (const mark of staff.querySelectorAll("Note > Tie")) {
    const id = mark.getAttribute("id");
    if (!id || starts.has(id)) unsupported();
    starts.set(id, mark.parentElement!);
  }
  for (const mark of staff.querySelectorAll("Note > endSpanner")) {
    const id = mark.getAttribute("id") ?? "";
    const start = starts.get(id);
    if (!start || value(start, "pitch") !== value(mark.parentElement!, "pitch"))
      unsupported();
    starts.delete(id);
  }
  if (starts.size) unsupported();
  checkedLegacyTies.add(staff);
}

function endpoints(spanner: Element) {
  const types: ("stop" | "start")[] = [];
  if (first(spanner, "prev")) types.push("stop");
  if (first(spanner, "next")) types.push("start");
  if (!types.length) unsupported();
  return types;
}

function attach(w: Writer, note: Element, name: string) {
  return first(note, name) ?? insertOrdered(note, w.add(note, name));
}

export function writeNoteMarks(
  w: Writer,
  sourceChord: Element,
  sourceNote: Element | null,
  note: Element,
  firstHead: boolean,
) {
  if (sourceNote) {
    if (
      sourceNote.querySelector(
        "Bend, GuitarBend, Glissando, Events, PartialTie, LaissezVib, Spanner:not([type='Tie'])",
      ) ||
      value(sourceNote, "play") === "0" ||
      Number(value(sourceNote, "tuning") ?? 0) !== 0
    )
      unsupported();
    const ties = new Set<"stop" | "start">();
    for (const spanner of direct(sourceNote, "Spanner")) {
      for (const loc of spanner.querySelectorAll("location")) {
        if (
          ["voices", "staves"].some(
            (field) => Number(value(loc, field) ?? 0) !== 0,
          )
        )
          unsupported();
      }
      endpoints(spanner).forEach((type) => ties.add(type));
    }
    const legacyStart = first(sourceNote, "Tie");
    const legacyEnd = first(sourceNote, "endSpanner");
    if (legacyStart || legacyEnd) {
      checkLegacyTies(sourceNote);
      if (legacyStart) ties.add("start");
      if (legacyEnd) ties.add("stop");
    }
    for (const type of ["stop", "start"] as const) {
      if (!ties.has(type)) continue;
      insertOrdered(note, w.add(note, "tie", undefined, { type }));
      w.add(attach(w, note, "notations"), "tied", undefined, { type });
    }
  }
  if (!firstHead) return;
  if (
    sourceChord.querySelector(
      ":scope > Tremolo, :scope > TremoloSingleChord, :scope > TremoloTwoChord, :scope > Ornament, :scope > ChordLine",
    )
  )
    unsupported();
  const notations = () => attach(w, note, "notations");
  if (first(sourceChord, "Arpeggio")) w.add(notations(), "arpeggiate");
  for (const spanner of direct(sourceChord, "Spanner")) {
    if (spanner.getAttribute("type") !== "Slur") unsupported();
    for (const type of endpoints(spanner))
      w.add(notations(), "slur", undefined, { type });
  }
  for (const slur of direct(sourceChord, "Slur")) {
    const type = slur.getAttribute("type");
    if (type !== "start" && type !== "stop") unsupported();
    w.add(notations(), "slur", undefined, { type });
  }
  for (const mark of direct(sourceChord, "Articulation")) {
    const symbol = value(mark, "subtype") ?? "";
    const match = /^artic(.+?)(Above|Below)$/.exec(symbol);
    if (!match || !Object.hasOwn(articulationSymbols, match[1])) unsupported();
    const group =
      first(notations(), "articulations") ??
      w.add(notations(), "articulations");
    w.add(group, articulationSymbols[match[1]], undefined, {
      placement: match[2].toLowerCase(),
    });
  }
  for (const lyric of direct(sourceChord, "Lyrics")) {
    const text = value(lyric, "text");
    if (!text) continue;
    const verse = Number(value(lyric, "no") ?? 0) + 1;
    if (!Number.isSafeInteger(verse) || verse < 1) unsupported();
    const output = w.add(note, "lyric", undefined, { number: verse });
    const syllabic = value(lyric, "syllabic");
    if (syllabic && ["begin", "end", "single", "middle"].includes(syllabic))
      w.add(output, "syllabic", syllabic);
    w.add(output, "text", text);
    if (
      Number(value(lyric, "ticks") ?? 0) > 0 ||
      quarters(value(lyric, "ticks_f") ?? "0/1") > 0
    )
      w.add(output, "extend");
  }
}

function direction(w: Writer, measure: Element, staff?: number) {
  const node = w.add(measure, "direction");
  const type = w.add(node, "direction-type");
  if (staff !== undefined) w.add(node, "staff", staff);
  return { node, type };
}

const dynamicMarks = new Set([
  "p",
  "pp",
  "ppp",
  "pppp",
  "ppppp",
  "pppppp",
  "f",
  "ff",
  "fff",
  "ffff",
  "fffff",
  "ffffff",
  "mp",
  "mf",
  "sf",
  "sfp",
  "sfpp",
  "fp",
  "rf",
  "rfz",
  "sfz",
  "sffz",
  "fz",
  "n",
  "pf",
  "sfzp",
]);

// Called in document order, while the MusicXML cursor is at the mark's beat.
export function writeDirection(
  w: Writer,
  source: Element,
  measure: Element,
  staff: number,
) {
  switch (source.localName) {
    case "Tempo": {
      const bpm = Number(value(source, "tempo")) * 60;
      if (!Number.isFinite(bpm) || bpm <= 0 || value(source, "type"))
        unsupported();
      const { node, type } = direction(w, measure, staff);
      const metronome = w.add(type, "metronome");
      w.add(metronome, "beat-unit", "quarter");
      w.add(metronome, "per-minute", Number(bpm.toFixed(6)));
      w.add(node, "sound", undefined, { tempo: Number(bpm.toFixed(6)) });
      return true;
    }
    case "Dynamic": {
      const mark = value(source, "subtype") || value(source, "text");
      if (!mark) return true;
      const { type } = direction(w, measure, staff);
      const dynamics = w.add(type, "dynamics");
      if (dynamicMarks.has(mark)) w.add(dynamics, mark);
      else w.add(dynamics, "other-dynamics", mark);
      return true;
    }
    case "StaffText":
    case "SystemText":
    case "RehearsalMark": {
      if (
        source.querySelector(
          "swing, MidiAction, channelSwitch, aeolus, playTech, capo",
        )
      )
        unsupported();
      const text = value(source, "text");
      if (text) {
        const { type } = direction(w, measure, staff);
        // Only a native Jump/Marker has navigational meaning. The common
        // MusicXML reader also recognizes D.C. or Fine written as words.
        const words = text.trim().toLowerCase().replaceAll(".", "");
        const looksLikeJump =
          /^(dc|da capo|ds|dal segno)\b|^(?:to coda|al coda|fine)$/.test(words);
        if (source.localName === "RehearsalMark")
          w.add(type, "rehearsal", text);
        else if (looksLikeJump)
          w.add(type, "rehearsal", text, { enclosure: "none" });
        else w.add(type, "words", text);
      }
      return true;
    }
    case "Spanner": {
      const kind = source.getAttribute("type");
      if (kind === "Volta") return true; // Collected by measure below.
      if (kind !== "HairPin" && kind !== "Pedal") unsupported();
      for (const endpoint of endpoints(source)) {
        const { type } = direction(w, measure, staff);
        if (kind === "Pedal") {
          w.add(type, "pedal", undefined, { type: endpoint });
        } else {
          const hairpin = first(source, "HairPin");
          const subtype = hairpin ? (value(hairpin, "subtype") ?? "0") : "0";
          if (!["0", "1", "2", "3"].includes(subtype)) unsupported();
          const shape = ["0", "2"].includes(subtype)
            ? "crescendo"
            : "diminuendo";
          w.add(type, "wedge", undefined, {
            type: endpoint === "stop" ? "stop" : shape,
          });
        }
      }
      return true;
    }
    case "BarLine": {
      const kind = value(source, "subtype") ?? "normal";
      if (source.querySelector("Fermata, Articulation")) unsupported();
      const styles: Record<string, string> = {
        normal: "regular",
        end: "light-heavy",
        double: "light-light",
        dashed: "dashed",
        dotted: "dotted",
        heavy: "heavy",
        "reverse-end": "heavy-light",
        "double-heavy": "heavy-heavy",
        "start-repeat": "heavy-light",
        "end-repeat": "light-heavy",
        "end-start-repeat": "light-heavy",
      };
      if (!Object.hasOwn(styles, kind)) unsupported();
      const isEvent = (el: Element) =>
        el.localName === "Chord" || el.localName === "Rest";
      const siblings = Array.from(source.parentElement!.children);
      const index = siblings.indexOf(source);
      const later = siblings.slice(index + 1).some(isEvent);
      const location = later
        ? siblings.slice(0, index).some(isEvent)
          ? "middle"
          : "left"
        : "right";
      if (location === "middle" && kind.includes("repeat")) unsupported();
      const line =
        location === "middle"
          ? w.add(measure, "barline", undefined, { location })
          : atBoundary(w, measure, location);
      if (!first(line, "bar-style"))
        line.prepend(w.add(line, "bar-style", styles[kind]));
      // Native startRepeat/endRepeat flags, not the printed barline style,
      // determine playback. MuseScore may write this engraving to each staff.
      return true;
    }
    case "Jump":
    case "Marker":
      return true; // Bound to the measure, handled below.
    case "MeasureRepeat":
    case "RepeatMeasure":
    case "Fermata":
    case "Breath":
    case "GradualTempoChange":
    case "InstrumentChange":
    case "Ottava":
    case "TremoloBar":
    case "Caesura":
      return unsupported();
    default:
      return false;
  }
}

function atBoundary(w: Writer, measure: Element, location: "left" | "right") {
  const existing = direct(measure, "barline").find(
    (el) => el.getAttribute("location") === location,
  );
  if (existing) return existing;
  const line = w.add(measure, "barline", undefined, { location });
  if (location === "left") measure.prepend(line);
  return line;
}

function ending(
  w: Writer,
  measure: Element,
  number: string,
  type: "start" | "stop" | "discontinue",
  text?: string,
) {
  const line = atBoundary(w, measure, type === "start" ? "left" : "right");
  const old = first(line, "ending");
  if (old) {
    if (
      old.getAttribute("number") !== number ||
      old.getAttribute("type") !== type
    )
      unsupported();
    return;
  }
  const mark = w.add(line, "ending", text, { number, type });
  line.insertBefore(mark, first(line, "repeat") ?? null);
}

function repeat(
  w: Writer,
  line: Element,
  direction: "forward" | "backward",
  count?: string,
) {
  const old = first(line, "repeat");
  if (!old)
    w.add(line, "repeat", undefined, {
      direction,
      ...(count ? { times: count } : {}),
    });
}

function writeVoltas(
  w: Writer,
  bar: Element,
  measures: Element[],
  index: number,
) {
  for (const spanner of bar.querySelectorAll("Spanner[type='Volta']")) {
    const volta = first(spanner, "Volta");
    if (!volta) {
      if (!first(spanner, "prev")) unsupported();
      continue;
    }
    const next = first(spanner, "next");
    const loc = next && first(next, "location");
    if (!loc) unsupported();
    const destination = index + integer(value(loc, "measures"), 0);
    const fraction = value(loc, "fractions");
    let lastIndex = destination - 1;
    if (fraction && quarters(fraction) !== 0) {
      // At EOF there is no next measure for an end anchor. MuseScore
      // writes the final measure and its full duration instead.
      const target = measures[destination];
      if (!target) unsupported();
      const ticks = Array.from(target.children).reduce((sum, el) => {
        if (el.localName === "backup")
          return sum - Number(value(el, "duration"));
        if (
          el.localName === "forward" ||
          (el.localName === "note" &&
            !first(el, "chord") &&
            !first(el, "grace"))
        )
          return sum + Number(value(el, "duration"));
        return sum;
      }, 0);
      const divisions = Number(
        target.querySelector("attributes > divisions")?.textContent,
      );
      if (!divisions || Math.abs(quarters(fraction) - ticks / divisions) > 1e-7)
        unsupported();
      lastIndex = destination;
    }
    if (lastIndex < index || !measures[lastIndex]) unsupported();
    const raw = value(volta, "endings") ?? "";
    if (!/^\d+(?:\s*,\s*\d+)*$/.test(raw)) unsupported();
    const numbers = raw.replaceAll(/\s/g, "");
    ending(w, measures[index], numbers, "start", value(volta, "beginText"));
    const hook = value(volta, "endHookType");
    ending(
      w,
      measures[lastIndex],
      numbers,
      hook && hook !== "0" ? "stop" : "discontinue",
    );
  }
}

function writeNavigation(w: Writer, bars: Element[], measures: Element[]) {
  const jumps = bars.flatMap((bar) => direct(bar, "Jump"));
  if (jumps.length > 1) unsupported(); // Playback currently resolves one D.C./D.S.
  const jump = jumps[0];
  const jumpTo = jump && value(jump, "jumpTo");
  const until = jump && value(jump, "playUntil");
  const continuation = jump && value(jump, "continueAt");
  if (
    jump &&
    (!jumpTo ||
      !until ||
      value(jump, "playRepeats") === "1" ||
      (until === "end" && continuation))
  )
    unsupported();
  for (const [i, bar] of bars.entries()) {
    const measure = measures[i];
    for (const el of direct(bar, "Marker")) {
      const label = value(el, "label");
      if (!label) unsupported();
      const departure = until === label;
      const target = jumpTo === label || continuation === label;
      if (target && departure) unsupported();
      const segno = jumpTo === label || ["segno", "varsegno"].includes(label);
      const coda =
        continuation === label ||
        ["codab", "codetta", "varcoda"].includes(label);
      const { node, type } = direction(w, measure);
      if (departure) {
        w.add(type, "words", value(el, "text") || label);
        w.add(
          node,
          "sound",
          undefined,
          continuation ? { tocoda: continuation } : { fine: "yes" },
        );
      } else if (segno || coda) {
        const name = segno ? "segno" : "coda";
        w.add(type, name);
        w.add(node, "sound", undefined, { [name]: label });
        measure.prepend(node);
      } else {
        // An otherwise unused "Fine" printed on a plain D.C. must not stop playback.
        w.add(type, "rehearsal", value(el, "text") || label, {
          enclosure: "none",
        });
      }
    }
    if (jump && jump.parentElement === bar && jumpTo) {
      const { node, type } = direction(w, measure);
      w.add(
        type,
        "words",
        value(jump, "text") || (jumpTo === "start" ? "D.C." : "D.S."),
      );
      w.add(
        node,
        "sound",
        undefined,
        jumpTo === "start" ? { dacapo: "yes" } : { dalsegno: jumpTo },
      );
    }
  }
}

export function writeMeasureMarks(
  w: Writer,
  bars: Element[],
  measures: Element[],
) {
  writeNavigation(w, bars, measures);
  for (const [index, bar] of bars.entries()) {
    const measure = measures[index];
    if (first(bar, "measureRepeatCount") || first(bar, "Volta")) unsupported();
    if (first(bar, "startRepeat"))
      repeat(w, atBoundary(w, measure, "left"), "forward");
    if (first(bar, "endRepeat"))
      repeat(
        w,
        atBoundary(w, measure, "right"),
        "backward",
        value(bar, "endRepeat") || "2",
      );
    writeVoltas(w, bar, measures, index);
    // The first of several voices may have already supplied a visible barline.
    const right = direct(measure, "barline").find(
      (line) => line.getAttribute("location") === "right",
    );
    if (right) measure.append(right);
  }
}
