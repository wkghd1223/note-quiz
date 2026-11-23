import { readScoreDocument } from "./formats/read-document";
import { readXml, MAX_SCORE_ELEMENTS } from "./formats/xml";
import type {
  ImportedBar,
  ImportedEvent,
  ImportedHead,
  ImportedLane,
  ImportedScore,
  ImportedUnpitchedHead,
  ScoreClef,
  ScoreIssue,
  ScoreMeter,
  ScoreStep,
} from "./types";

export const MAX_SCORE_REPEAT_PASSES = 32;
export const elements = (parent: Element, name: string) =>
  Array.from(parent.children).filter((el) => el.localName === name);
export const child = (parent: Element, name: string) =>
  Array.from(parent.children).find((el) => el.localName === name);
const content = (parent: Element, name: string) =>
  child(parent, name)?.textContent?.trim();
function number(value: string | null | undefined, fallback = NaN) {
  return value == null || value.trim() === "" ? fallback : Number(value);
}
const pitchSteps: Record<ScoreStep, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const noteUnits: Record<string, number> = {
  maxima: 32,
  long: 16,
  breve: 8,
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  "16th": 0.25,
  "32nd": 0.125,
  "64th": 0.0625,
  "128th": 0.03125,
  "256th": 1 / 64,
  "512th": 1 / 128,
  "1024th": 1 / 256,
};
const EPS = 1e-8;

interface Context {
  divisions: number;
  meter: ScoreMeter;
  clef: ScoreClef;
  fifths: number;
  keyMode?: string;
  transpose: number;
}
const initialContext: Context = {
  divisions: 1,
  meter: { beats: 4, beatType: 4 },
  clef: { sign: "G", line: 2 },
  fifths: 0,
  transpose: 0,
};
type Change = { at: number; staff?: string; value: Partial<Context> };
type SourceBar = { source: Element; measure: Element };
type Part = { id: string; name: string; bars: SourceBar[] };
type Issue = (
  code: string,
  blocking?: boolean,
  staff?: string,
  voice?: string,
) => void;

export type TempoMark = { at: number; bpm: number; explicit: boolean };
export interface BarPerformance {
  tempos: TempoMark[];
  repeatStart: boolean;
  repeatCount: number;
  endingStart: number[];
  endingStop: boolean;
  segno?: string;
  coda?: string;
  dalSegno?: string;
  daCapo?: boolean;
  fine?: boolean;
  toCoda?: string;
}
const newPerformance = (): BarPerformance => ({
  tempos: [],
  repeatStart: false,
  repeatCount: 0,
  endingStart: [],
  endingStop: false,
});
const navigationMarks = [
  "segno",
  "coda",
  "dalSegno",
  "toCoda",
  "daCapo",
  "fine",
] as const;
const metadata = new WeakMap<XMLDocument, BarPerformance[]>();
// Editors use score time rather than XML order: a backup can put an attribute
// written after voice one back at the opening of the very same measure.
const positions = new WeakMap<Element, number>();
export function scoreBeatOf(node: Element) {
  const beat = positions.get(node);
  if (beat === undefined) throw new Error("staleSelection");
  return beat;
}
export function playbackBars(score: ImportedScore): readonly BarPerformance[] {
  const cached = metadata.get(score.document);
  if (!cached) throw new Error("invalidFile");
  return cached;
}

export async function readScoreFile(
  file: File,
  signal?: AbortSignal,
): Promise<ImportedScore> {
  const { document, format } = await readScoreDocument(file, signal);
  return { ...parseScoreDocument(document), file, sourceFormat: format };
}

export function parseScoreXml(text: string): ImportedScore {
  return parseScoreDocument(readXml(text));
}

function sourceParts(root: Element): Part[] {
  const names = new Map<string, string>();
  const list = child(root, "part-list");
  for (const part of list ? elements(list, "score-part") : []) {
    names.set(part.getAttribute("id") ?? "", content(part, "part-name") ?? "");
  }
  if (root.localName === "score-partwise") {
    return elements(root, "part").map((part) => {
      const id = part.getAttribute("id") ?? "";
      return {
        id,
        name: names.get(id) || id,
        bars: elements(part, "measure").map((measure) => ({
          source: measure,
          measure,
        })),
      };
    });
  }
  if (root.localName === "score-timewise") {
    const barsByPart = new Map<string, SourceBar[]>();
    const measures = elements(root, "measure");
    for (const [index, measure] of measures.entries()) {
      for (const part of elements(measure, "part")) {
        const id = part.getAttribute("id") ?? "";
        const bars = barsByPart.get(id) ?? [];
        if (bars.length !== index) throw new Error("unsupportedNotation");
        bars.push({ source: part, measure });
        barsByPart.set(id, bars);
      }
    }
    if (
      [...barsByPart.values()].some((bars) => bars.length !== measures.length)
    )
      throw new Error("unsupportedNotation");
    return [...barsByPart].map(([id, bars]) => ({
      id,
      name: names.get(id) || id,
      bars,
    }));
  }
  throw new Error("unsupportedFile");
}

function meterOf(time: Element): ScoreMeter | null {
  const beats = elements(time, "beats");
  const units = elements(time, "beat-type");
  if (!beats.length || beats.length !== units.length) return null;
  // A single denominator can represent additive meters such as 3+2/8.
  const base = number(units[0].textContent);
  if (
    !Number.isSafeInteger(base) ||
    base <= 0 ||
    units.some((el) => number(el.textContent) !== base)
  )
    return null;
  const groups = beats.flatMap((el) =>
    (el.textContent ?? "").split("+").map((n) => number(n)),
  );
  if (groups.some((n) => !Number.isSafeInteger(n) || n < 1)) return null;
  const count = groups.reduce((a, b) => a + b, 0);
  const symbol = time.getAttribute("symbol");
  return {
    beats: count,
    beatType: base,
    ...(groups.length > 1 && { displayBeats: groups.join("+") }),
    ...((symbol === "common" && count === 4 && base === 4) ||
    (symbol === "cut" && count === 2 && base === 2)
      ? { symbol }
      : {}),
  };
}

function readAttribute(el: Element, issue: Issue): Partial<Context> | null {
  switch (el.localName) {
    case "divisions": {
      const divisions = number(el.textContent);
      if (!(divisions > 0 && Number.isFinite(divisions))) {
        issue("divisions");
        return null;
      }
      return { divisions };
    }
    case "clef": {
      const sign = content(el, "sign") ?? "G";
      return {
        clef: {
          sign,
          line: number(
            content(el, "line"),
            sign === "F" ? 4 : sign === "C" ? 3 : 2,
          ),
          octaveChange: number(content(el, "clef-octave-change"), 0),
        },
      };
    }
    case "key": {
      const fifths = number(content(el, "fifths"));
      if (!Number.isSafeInteger(fifths) || Math.abs(fifths) > 7) {
        issue("key", false);
        return null;
      }
      return { fifths, keyMode: content(el, "mode") };
    }
    case "time": {
      const meter = meterOf(el);
      if (!meter) {
        issue("time");
        return null;
      }
      return { meter };
    }
    case "transpose": {
      const transpose =
        number(content(el, "chromatic"), 0) +
        12 * number(content(el, "octave-change"), 0);
      if (!Number.isInteger(transpose) || child(el, "double"))
        issue("transpose");
      return { transpose: Number.isFinite(transpose) ? transpose : 0 };
    }
    case "measure-style": {
      for (const style of Array.from(el.children)) {
        if (
          ["measure-repeat", "beat-repeat", "slash", "multiple-rest"].includes(
            style.localName,
          )
        )
          issue(style.localName, style.localName !== "multiple-rest");
      }
      return null;
    }
    default:
      return null;
  }
}

function endings(value: string, issue: Issue): number[] {
  const numbers = value.split(/[,\s]+/).flatMap((piece) => {
    const match = /^(\d+)(?:[-–](\d+))?$/.exec(piece);
    if (!match) return [];
    const start = Number(match[1]),
      end = Number(match[2] ?? start);
    if (start < 1 || end < start || end > MAX_SCORE_REPEAT_PASSES) return [];
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });
  if (!numbers.length) issue("ending");
  return numbers;
}

function barline(
  el: Element,
  before: BarPerformance | undefined,
  after: BarPerformance | undefined,
  issue: Issue,
) {
  const rep = child(el, "repeat");
  if (rep) {
    if (el.getAttribute("location") === "middle") issue("repeat");
    if (rep.getAttribute("direction") === "forward" && after)
      after.repeatStart = true;
    if (rep.getAttribute("direction") === "backward" && before) {
      before.repeatCount = number(rep.getAttribute("times"), 2);
      if (
        !Number.isSafeInteger(before.repeatCount) ||
        before.repeatCount < 1 ||
        before.repeatCount > MAX_SCORE_REPEAT_PASSES
      )
        issue("repeat");
    }
  }
  const ending = child(el, "ending");
  if (ending?.getAttribute("type") === "start") {
    if (after)
      after.endingStart = endings(ending.getAttribute("number") ?? "", issue);
  } else if (ending && before) before.endingStop = true;
}

function readSound(
  sound: Element,
  at: number,
  data: BarPerformance,
  issue: Issue,
) {
  if (sound.hasAttribute("tempo")) {
    const bpm = number(sound.getAttribute("tempo"));
    if (bpm > 0 && Number.isFinite(bpm))
      data.tempos.push({ at, bpm, explicit: true });
    else issue("tempo");
  }
  if (sound.hasAttribute("segno")) data.segno = sound.getAttribute("segno")!;
  if (sound.hasAttribute("coda")) data.coda = sound.getAttribute("coda")!;
  if (sound.hasAttribute("dalsegno"))
    data.dalSegno = sound.getAttribute("dalsegno")!;
  if (sound.hasAttribute("tocoda")) data.toCoda = sound.getAttribute("tocoda")!;
  if (sound.getAttribute("dacapo") === "yes") data.daCapo = true;
  if (sound.hasAttribute("fine")) data.fine = true;
  if (child(sound, "swing")) issue("swing");
  if (sound.hasAttribute("dynamics")) issue("dynamics", false);
  if (
    ["damper-pedal", "soft-pedal", "sostenuto-pedal"].some((name) =>
      sound.hasAttribute(name),
    )
  )
    issue("pedal", false);
  if (sound.hasAttribute("time-only") || sound.hasAttribute("forward-repeat"))
    issue("navigation");
}

function readDirection(
  el: Element,
  at: number,
  data: BarPerformance,
  issue: Issue,
) {
  const sound = child(el, "sound");
  for (const type of elements(el, "direction-type"))
    for (const symbol of Array.from(type.children)) {
      if (["dynamics", "wedge", "pedal"].includes(symbol.localName))
        issue(symbol.localName, false);
      // In MusicXML an octave-shift is an engraving displacement from the
      // encoded pitch. The sounding pitch must not be shifted a second time.
      if (symbol.localName === "segno") data.segno ??= "";
      if (symbol.localName === "coda") data.coda ??= "";
      if (symbol.localName === "metronome" && !sound?.hasAttribute("tempo")) {
        const unit = noteUnits[content(symbol, "beat-unit") ?? ""];
        const count = number(content(symbol, "per-minute"));
        const dots = elements(symbol, "beat-unit-dot").length;
        if (count > 0 && unit && Number.isFinite(count))
          data.tempos.push({
            at,
            bpm: count * unit * (2 - 2 ** -dots),
            explicit: false,
          });
        else issue("metronome");
      }
      if (symbol.localName === "words") {
        const words = (symbol.textContent ?? "")
          .trim()
          .toLowerCase()
          .replaceAll(".", "");
        if (/^(dc|da capo)\b/.test(words)) data.daCapo = true;
        else if (/^(ds|dal segno)\b/.test(words)) data.dalSegno ??= "";
        else if (/^(to|al) coda$/.test(words)) data.toCoda ??= "";
        else if (words === "fine") data.fine = true;
        else if (
          /(ritard|rallent|accel|^rit\b|^rall\b)/.test(words) &&
          !sound?.hasAttribute("tempo")
        )
          issue("tempo-text", false);
      }
    }
}

function readHead(
  note: Element,
  id: string,
  dur: number,
  ctx: Context,
  issue: Issue,
  staff: string,
  voice: string,
): ImportedHead | ImportedUnpitchedHead | undefined {
  if (child(note, "rest")) return;
  const shape = content(note, "notehead");
  const written = { id, source: note, duration: dur, ...(shape && { shape }) };
  const unpitched = child(note, "unpitched");
  if (unpitched) {
    issue("unpitched", true, staff, voice);
    const step = content(unpitched, "display-step") as ScoreStep | undefined;
    const octave = number(content(unpitched, "display-octave"));
    if (
      step &&
      Object.hasOwn(pitchSteps, step) &&
      Number.isInteger(octave) &&
      octave >= 0 &&
      octave <= 9
    )
      return { ...written, display: { step, octave } };
    return written;
  }
  const pitch = child(note, "pitch");
  const step = pitch && (content(pitch, "step") as ScoreStep | undefined);
  const octave = pitch && number(content(pitch, "octave"));
  const alter = pitch && number(content(pitch, "alter"), 0);
  if (
    !step ||
    !Object.hasOwn(pitchSteps, step) ||
    octave == null ||
    !Number.isInteger(octave) ||
    alter == null ||
    !Number.isFinite(alter)
  ) {
    issue("pitch", true, staff, voice);
    return;
  }
  const midi = 12 * (octave + 1) + pitchSteps[step] + alter + ctx.transpose;
  if (!Number.isInteger(midi) || midi < 0 || midi > 127)
    issue("pitch", true, staff, voice);
  return { ...written, step, octave, alter, midi };
}

interface RawNote {
  node: Element;
  id: string;
  at: number;
  duration: number;
  staff: string;
  voice: string;
  chord: boolean;
}
type ParsedBar = {
  input: SourceBar;
  duration: number;
  start: Map<string, Context>;
  notes: Map<string, ImportedEvent[]>;
};

function readMeasure(
  input: SourceBar,
  inherited: Map<string, Context>,
  partIndex: number,
  index: number,
  scoreBars: BarPerformance[],
  issue: Issue,
): ParsedBar {
  const performance = scoreBars[index];
  const changes: Change[] = [];
  const notes: RawNote[] = [];
  const directions: { at: number; data: BarPerformance }[] = [];
  const collectDirection = (at: number, data: BarPerformance) => {
    performance.tempos.push(...data.tempos);
    if (navigationMarks.some((key) => data[key] !== undefined))
      directions.push({ at, data });
  };
  let clock = 0,
    extent = 0,
    lastNote: RawNote | undefined;
  const divisions: { at: number; value: number }[] = [
    { at: 0, value: inherited.get("1")!.divisions },
  ];
  const currentDivision = () => {
    let selected = divisions[0];
    for (const entry of divisions)
      if (entry.at <= clock + EPS && entry.at >= selected.at) selected = entry;
    return selected.value;
  };
  for (const el of Array.from(input.source.children)) {
    const div = currentDivision();
    switch (el.localName) {
      case "attributes": {
        positions.set(el, clock);
        for (const attr of Array.from(el.children)) {
          const value = readAttribute(attr, issue);
          if (!value) continue;
          if (value.divisions)
            divisions.push({ at: clock, value: value.divisions });
          const staff =
            attr.getAttribute("number") ??
            (attr.localName === "clef" ? "1" : undefined);
          if (value.meter && clock > EPS) issue("midMeasureTime");
          changes.push({ at: clock, staff, value });
        }
        break;
      }
      case "backup":
      case "forward": {
        const duration = number(content(el, "duration")) / div;
        if (!Number.isFinite(duration) || duration <= 0) {
          issue("duration");
          break;
        }
        clock += duration * (el.localName === "backup" ? -1 : 1);
        if (clock < -EPS) {
          issue("backup");
          clock = 0;
        }
        clock = Math.max(0, clock);
        extent = Math.max(extent, clock);
        lastNote = undefined;
        break;
      }
      case "harmony":
        positions.set(el, clock + number(content(el, "offset"), 0) / div);
        break;
      case "direction":
      case "sound": {
        const isDirection = el.localName === "direction";
        const offset = isDirection ? child(el, "offset") : undefined;
        // A direction's offset is visual unless explicitly marked for playback.
        const directionAt =
          offset?.getAttribute("sound") === "yes"
            ? clock + number(offset.textContent) / div
            : clock;
        const sound = isDirection ? child(el, "sound") : el;
        const explicit = newPerformance();
        if (sound) {
          const own = child(sound, "offset");
          const soundAt = own
            ? clock + number(own.textContent) / div
            : directionAt;
          readSound(sound, soundAt, explicit, issue);
          collectDirection(soundAt, explicit);
        }
        if (isDirection) {
          const visual = newPerformance();
          readDirection(el, directionAt, visual, issue);
          // A printed symbol can describe the same jump as an explicit sound.
          for (const key of navigationMarks)
            if (explicit[key] !== undefined) delete visual[key];
          collectDirection(directionAt, visual);
        }
        break;
      }
      case "barline": {
        // A forward repeat on a right barline starts the following measure.
        // A backward repeat on a left barline closes the preceding measure.
        const boundary =
          el.getAttribute("location") === "left" ? index : index + 1;
        barline(el, scoreBars[boundary - 1], scoreBars[boundary], issue);
        break;
      }
      case "note": {
        positions.set(el, child(el, "chord") && lastNote ? lastNote.at : clock);
        const staff = content(el, "staff") || "1",
          voice = content(el, "voice") || "1";
        const scoped = (code: string, blocking = true) =>
          issue(code, blocking, staff, voice);
        if (child(el, "grace")) {
          scoped("grace");
          break;
        }
        const d = number(content(el, "duration")) / div;
        if (!Number.isFinite(d) || d <= 0) {
          scoped("duration");
          break;
        }
        const chord = !!child(el, "chord");
        if (chord && !lastNote) scoped("chord");
        const at = chord && lastNote ? lastNote.at : clock;
        const item = {
          node: el,
          id: `p${partIndex}b${index}n${notes.length}`,
          at,
          duration: d,
          staff,
          voice,
          chord,
        };
        notes.push(item);
        lastNote = item;
        if (!chord) clock += d;
        extent = Math.max(extent, at + d);
        if (child(el, "cue") || el.getAttribute("pizzicato") === "yes")
          scoped(child(el, "cue") ? "cue" : "pizzicato", !!child(el, "cue"));
        const play = child(el, "play");
        if (
          play &&
          elements(play, "other-play").some(
            (mark) => mark.getAttribute("type") === "midi-pitch-change",
          )
        )
          scoped("pitch");
        if (
          ["attack", "release", "time-only"].some((name) =>
            el.hasAttribute(name),
          ) ||
          elements(el, "tie").some((tie) => tie.hasAttribute("time-only"))
        )
          scoped("performance-offset");
        for (const notation of elements(el, "notations"))
          for (const sign of Array.from(notation.children)) {
            if (
              [
                "ornaments",
                "fermata",
                "glissando",
                "slide",
                "arpeggiate",
              ].includes(sign.localName)
            )
              scoped(sign.localName);
            if (
              sign.localName === "articulations" ||
              sign.localName === "dynamics"
            )
              scoped(sign.localName, false);
            if (
              sign.localName === "technical" &&
              (child(sign, "bend") || child(sign, "harmonic"))
            )
              scoped("technical");
          }
        break;
      }
    }
  }
  changes.sort((a, b) => a.at - b.at);
  const contextAt = (staff: string, at: number): Context => {
    const effective = { ...(inherited.get(staff) ?? inherited.get("1")!) };
    for (const item of changes) {
      if (item.at > at + EPS) break;
      if (!item.staff || item.staff === staff)
        Object.assign(effective, item.value);
    }
    return effective;
  };
  const start = new Map(
    [...inherited.keys()].map((staff) => [staff, contextAt(staff, 0)]),
  );
  const groups = new Map<string, ImportedEvent[]>();
  for (const { node, id, at, duration, staff, voice, chord } of notes) {
    const ctx = contextAt(staff, at);
    const lane = JSON.stringify([staff, voice]);
    const events = groups.get(lane) ?? [];
    let event = events.at(-1);
    if (chord && event && Math.abs(event.start - at) < EPS) {
      if (event.duration + EPS < duration)
        issue("chordDuration", true, staff, voice);
    } else {
      const modification = child(node, "time-modification");
      event = {
        id,
        source: node,
        start: at,
        duration,
        heads: [],
        noteType: content(node, "type") ?? "",
        dots: elements(node, "dot").length,
        ...(modification
          ? {
              tuplet: {
                actual: number(content(modification, "actual-notes")),
                normal: number(content(modification, "normal-notes")),
              },
            }
          : {}),
        divisions: ctx.divisions,
        fifths: ctx.fifths,
        keyMode: ctx.keyMode,
        transpose: ctx.transpose,
        clef: ctx.clef,
      };
      events.push(event);
    }
    const head = readHead(node, id, duration, ctx, issue, staff, voice);
    if (head) {
      if ("midi" in head) event.heads.push(head);
      else (event.unpitchedHeads ??= []).push(head);
    }
    groups.set(lane, events);
  }
  for (const [lane, events] of groups) {
    events.sort((a, b) => a.start - b.start);
    if (
      events.some(
        (event, i) =>
          i && event.start < events[i - 1].start + events[i - 1].duration - EPS,
      )
    ) {
      const [staff, voice] = JSON.parse(lane);
      issue("overlappingEvents", true, staff, voice);
    }
  }
  // Compute all final contexts against the old map before replacing it.
  const final = [...inherited.keys()].map(
    (staff) => [staff, contextAt(staff, Infinity)] as const,
  );
  for (const [staff, value] of final) inherited.set(staff, value);
  const meter = start.get("1")!.meter;
  const nominal = (meter.beats * 4) / meter.beatType;
  const partial =
    input.measure.getAttribute("implicit") === "yes" ||
    input.measure.getAttribute("number") === "0";
  const duration = partial && extent > 0 ? extent : Math.max(nominal, extent);
  for (const { at, data } of directions) {
    const atStart = Math.abs(at) < EPS;
    if (!atStart && Math.abs(at - duration) >= EPS) {
      issue("navigation");
      continue;
    }
    const boundary = atStart ? index : index + 1;
    const after = scoreBars[boundary],
      before = scoreBars[boundary - 1];
    for (const marker of ["segno", "coda"] as const) {
      if (data[marker] === undefined) continue;
      if (after) after[marker] = data[marker] || after[marker] || "";
      else issue("navigation");
    }
    if (
      data.dalSegno !== undefined ||
      data.toCoda !== undefined ||
      data.fine ||
      data.daCapo
    ) {
      if (!before) issue("navigation");
      else {
        if (data.dalSegno !== undefined)
          before.dalSegno = data.dalSegno || before.dalSegno || "";
        if (data.toCoda !== undefined)
          before.toCoda = data.toCoda || before.toCoda || "";
        if (data.daCapo) before.daCapo = true;
        if (data.fine) before.fine = true;
      }
    }
  }
  return { input, duration, start, notes: groups };
}

export function parseScoreDocument(document: XMLDocument): ImportedScore {
  if (document.getElementsByTagName("*").length > MAX_SCORE_ELEMENTS)
    throw new Error("fileTooLarge");
  const root = document.documentElement;
  const parts = sourceParts(root);
  if (
    !parts.length ||
    parts.some((p) => !p.id || !p.bars.length) ||
    new Set(parts.map((p) => p.id)).size !== parts.length
  )
    throw new Error("invalidFile");
  const lanes: ImportedLane[] = [];
  const issues: ScoreIssue[] = [];
  const seenIssues = new Set<string>();
  const longestPart = parts.reduce(
    (n, part) => Math.max(n, part.bars.length),
    0,
  );
  const performance = Array.from({ length: longestPart }, newPerformance);
  for (const [partIndex, part] of parts.entries()) {
    const staves = new Set(["1"]);
    for (const { source } of part.bars) {
      for (const note of elements(source, "note"))
        staves.add(content(note, "staff") || "1");
    }
    const states = new Map([...staves].map((staff) => [staff, initialContext]));
    const laneKeys = new Set<string>();
    const parsed = part.bars.map((bar, barIndex) => {
      const issue: Issue = (code, blocksPractice = true, staff, voice) => {
        const key = JSON.stringify([
          code,
          blocksPractice,
          partIndex,
          barIndex,
          staff,
          voice,
        ]);
        if (seenIssues.has(key)) return;
        seenIssues.add(key);
        issues.push({
          code,
          blocksPractice,
          partId: part.id,
          barIndex,
          staff,
          voice,
        });
      };
      const value = readMeasure(
        bar,
        states,
        partIndex,
        barIndex,
        performance,
        issue,
      );
      for (const key of value.notes.keys()) laneKeys.add(key);
      return value;
    });
    for (const key of laneKeys) {
      const [staff, voice] = JSON.parse(key) as [string, string];
      const bars: ImportedBar[] = parsed.map((bar, index) => {
        const ctx = bar.start.get(staff)!;
        return {
          index,
          label: bar.input.measure.getAttribute("number") || String(index + 1),
          source: bar.input.source,
          duration: bar.duration,
          divisions: ctx.divisions,
          meter: ctx.meter,
          clef: ctx.clef,
          fifths: ctx.fifths,
          keyMode: ctx.keyMode,
          transpose: ctx.transpose,
          events: bar.notes.get(key) ?? [],
        };
      });
      lanes.push({
        id: JSON.stringify([part.id, staff, voice]),
        partId: part.id,
        staff,
        voice,
        label:
          laneKeys.size > 1 ? `${part.name} · ${staff}/${voice}` : part.name,
        bars,
      });
    }
  }
  if (!lanes.length) throw new Error("noNotes");
  const work = child(root, "work");
  const title =
    (work && content(work, "work-title")) ||
    content(root, "movement-title") ||
    "";
  metadata.set(document, performance);
  return { document, lanes, title, issues };
}
