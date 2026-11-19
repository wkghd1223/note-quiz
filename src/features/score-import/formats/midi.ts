import { dottedLength, glyphValues, writtenLength } from "../score-xml";
import {
  readMidi,
  type MidiFile,
  type MidiKey,
  type MidiMark,
  type MidiNote,
  type MidiPart,
} from "./midi-file";
import { createScoreWriter } from "./writer";

type Writer = ReturnType<typeof createScoreWriter>;
const MAX_MEASURES = 16_384;

function measures(file: MidiFile) {
  const bars = [];
  let start = 0,
    meterIndex = 0,
    keyIndex = 0,
    tempoIndex = 0;
  while (start < file.end) {
    if (
      bars.length >= MAX_MEASURES ||
      (bars.length + 1) * file.parts.length > MAX_MEASURES * 2
    )
      throw new Error("fileTooLarge");
    if (file.meters[meterIndex + 1]?.tick === start) meterIndex++;
    const meter = file.meters[meterIndex];
    const length = (4 * file.ppq * meter.value.beats) / meter.value.beatType;
    const end = Math.min(
      start + length,
      file.meters[meterIndex + 1]?.tick ?? Infinity,
      file.end,
    );
    const keys: MidiMark<MidiKey>[] = [];
    const tempos: MidiMark<number>[] = [];
    while (file.keys[keyIndex]?.tick < end) keys.push(file.keys[keyIndex++]);
    while (file.tempos[tempoIndex]?.tick < end)
      tempos.push(file.tempos[tempoIndex++]);
    bars.push({
      start,
      end,
      partial: end < start + length,
      meter: meter.tick === start ? meter.value : undefined,
      keys,
      tempos,
    });
    start = end;
  }
  return bars;
}

const steps = ["C", "D", "E", "F", "G", "A", "B"];
const naturalPitches = [0, 2, 4, 5, 7, 9, 11];
const sharps = "FCGDAEB",
  flats = "BEADGCF";

// MIDI only stores key numbers. Prefer the diatonic spelling in the current key
// (e.g. E-sharp in F-sharp major); use conventional sharps/flats for chromatic tones.
function spell(pitch: number, fifths: number) {
  const sign = fifths < 0 ? -1 : 1;
  const altered = (sign < 0 ? flats : sharps).slice(0, Math.abs(fifths));
  let best = { step: "C", alter: 0, octave: 0, cost: Infinity };
  for (const [i, step] of steps.entries()) {
    const relative = pitch - naturalPitches[i];
    const octave = Math.round(relative / 12) - 1;
    const alter = relative - (octave + 1) * 12;
    if (Math.abs(alter) > 1) continue;
    const signature = altered.includes(step) ? sign : 0;
    const cost =
      Math.abs(alter - signature) * 4 +
      Math.abs(alter) +
      (alter === -sign ? 1 : 0);
    if (cost < best.cost) best = { step, alter, octave, cost };
  }
  return best;
}

function rhythm(quarters: number) {
  const exact = writtenLength(quarters);
  if (exact) return { ...exact, triplet: false };
  const triplet = writtenLength(quarters * 1.5);
  if (triplet && !triplet.dots) return { ...triplet, triplet: true };
  // A live player's timing rarely falls on exact engraving values. Approximate
  // only the printed glyph; <duration> always carries the original timing.
  let best = { type: "quarter", dots: 0, distance: Infinity };
  for (const [type, base] of glyphValues) {
    for (let dots = 0; dots <= 1; dots++) {
      const distance = Math.abs(Math.log2(quarters / dottedLength(base, dots)));
      if (distance < best.distance) best = { type, dots, distance };
    }
  }
  return { ...best, triplet: false };
}

function writeNote(
  writer: Writer,
  measure: Element,
  start: number,
  end: number,
  ppq: number,
  fifths: number,
  head?: MidiNote,
  chord = false,
) {
  const { add } = writer;
  const note = add(measure, "note");
  if (chord) add(note, "chord");
  if (head) {
    const pitch = add(note, "pitch");
    const { step, alter, octave } = spell(head.pitch, fifths);
    add(pitch, "step", step);
    if (alter) add(pitch, "alter", alter);
    add(pitch, "octave", octave);
  } else add(note, "rest");
  const duration = Math.min(head?.end ?? end, end) - start;
  add(note, "duration", duration);
  const ties = [];
  if (head && head.start < start) ties.push("stop");
  if (head && head.end > end) ties.push("start");
  for (const type of ties) add(note, "tie", undefined, { type });
  add(note, "voice", 1);
  const { type, dots, triplet } = rhythm(duration / ppq);
  add(note, "type", type);
  for (let i = 0; i < dots; i++) add(note, "dot");
  if (triplet) {
    const modification = add(note, "time-modification");
    add(modification, "actual-notes", 3);
    add(modification, "normal-notes", 2);
  }
  if (ties.length) {
    const notations = add(note, "notations");
    for (const type of ties) add(notations, "tied", undefined, { type });
  }
  return note;
}

function writeKey(writer: Writer, attributes: Element, key: MidiKey) {
  const element = writer.add(attributes, "key");
  writer.add(element, "fifths", key.fifths);
  writer.add(element, "mode", key.minor ? "minor" : "major");
}

function writeTempo(
  writer: Writer,
  measure: Element,
  mark: MidiMark<number>,
  barStart: number,
) {
  const { add } = writer;
  const direction = add(measure, "direction");
  const metronome = add(add(direction, "direction-type"), "metronome");
  add(metronome, "beat-unit", "quarter");
  add(metronome, "per-minute", Number(mark.value.toFixed(3)));
  if (mark.tick > barStart)
    add(direction, "offset", mark.tick - barStart, { sound: "yes" });
  add(direction, "sound", undefined, { tempo: mark.value });
}

function writePart(
  writer: Writer,
  part: MidiPart,
  parent: Element,
  bars: ReturnType<typeof measures>,
  ppq: number,
  conductor: boolean,
  signal?: AbortSignal,
) {
  const { add } = writer;
  const bass =
    part.notes.reduce((sum, note) => sum + note.pitch, 0) / part.notes.length <
    57;
  let noteIndex = 0,
    pitchChangeIndex = 0,
    fifths = 0;
  let sounding: MidiNote[] = [];
  for (const [index, bar] of bars.entries()) {
    signal?.throwIfAborted();
    const measure = add(parent, "measure", undefined, {
      number: index + 1,
      ...(bar.partial ? { implicit: "yes" } : {}),
    });
    let keyIndex = 0;
    const initialKey =
      bar.keys[0]?.tick === bar.start ? bar.keys[keyIndex++].value : undefined;
    if (index === 0 || bar.meter || initialKey) {
      const attributes = add(measure, "attributes");
      if (index === 0) add(attributes, "divisions", ppq);
      if (initialKey) {
        writeKey(writer, attributes, initialKey);
        fifths = initialKey.fifths;
      }
      if (bar.meter) {
        const time = add(attributes, "time");
        add(time, "beats", bar.meter.beats);
        add(time, "beat-type", bar.meter.beatType);
      }
      if (index === 0) {
        const clef = add(attributes, "clef");
        add(clef, "sign", bass ? "F" : "G");
        add(clef, "line", bass ? 4 : 2);
      }
    }
    if (conductor)
      for (const tempo of bar.tempos)
        writeTempo(writer, measure, tempo, bar.start);
    for (let tick = bar.start; tick < bar.end; ) {
      const key = bar.keys[keyIndex];
      if (key?.tick === tick) {
        writeKey(writer, add(measure, "attributes"), key.value);
        fifths = key.value.fifths;
        keyIndex++;
      }
      sounding = sounding.filter((head) => head.end > tick);
      while (part.notes[noteIndex]?.start === tick)
        sounding.push(part.notes[noteIndex++]);
      const next = Math.min(
        bar.end,
        part.notes[noteIndex]?.start ?? Infinity,
        bar.keys[keyIndex]?.tick ?? Infinity,
      );
      // MusicXML advances the cursor by its chord leader, whose duration must
      // therefore cover every other head. Different note-off times are retained.
      sounding.sort(
        (a, b) =>
          Math.min(b.end, next) - Math.min(a.end, next) || a.pitch - b.pitch,
      );
      while (part.pitchChanges[pitchChangeIndex]?.end <= tick)
        pitchChangeIndex++;
      const pitchChange = part.pitchChanges[pitchChangeIndex];
      for (const [i, head] of sounding.entries()) {
        const note = writeNote(
          writer,
          measure,
          tick,
          next,
          ppq,
          fifths,
          head,
          i > 0,
        );
        if (pitchChange && pitchChange.start < Math.min(head.end, next))
          add(add(note, "play"), "other-play", "active", {
            type: "midi-pitch-change",
          });
      }
      const silence = sounding.length ? Math.min(next, sounding[0].end) : tick;
      if (silence < next)
        writeNote(writer, measure, silence, next, ppq, fifths);
      tick = next;
    }
  }
}

export function midiToMusicXml(
  bytes: Uint8Array,
  signal?: AbortSignal,
): XMLDocument {
  const file = readMidi(bytes, signal);
  const bars = measures(file);
  const writer = createScoreWriter();
  if (file.title)
    writer.add(writer.add(writer.root, "work"), "work-title", file.title);
  const nameCounts = new Map<string, number>();
  for (const part of file.parts)
    nameCounts.set(part.name, (nameCounts.get(part.name) ?? 0) + 1);
  for (const [index, part] of file.parts.entries()) {
    const suffix = [
      part.track + 1,
      ...(part.port ? [part.port] : []),
      part.channel + 1,
    ].join(".");
    const name =
      part.name && nameCounts.get(part.name) === 1
        ? part.name
        : [part.name || "MIDI", suffix].join(" · ");
    writePart(
      writer,
      part,
      writer.part("P" + (index + 1), name),
      bars,
      file.ppq,
      index === 0,
      signal,
    );
  }
  return writer.document;
}
