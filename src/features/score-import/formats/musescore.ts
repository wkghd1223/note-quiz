import { direct, first, value } from "../score-xml";
import { createScoreWriter } from "./writer";
import {
  writeDirection,
  writeMeasureMarks,
  writeNoteMarks,
} from "./musescore-marks";
import {
  readInstrument,
  writeClef,
  writeHarmony,
  writeKey,
  writePitch,
  type Instrument,
} from "./musescore-pitch";
import {
  integer,
  MeasureClock,
  quarters,
  readRhythm,
  Tuplets,
  unsupported,
  type Writer,
} from "./musescore-rhythm";

interface Staff {
  definition: Element;
  bars: Element[];
  percussion: boolean;
}
interface Part {
  name: string;
  staves: Staff[];
  instrument: Instrument;
}

function partsOf(score: Element): Part[] {
  const staves = new Map<string, Element>();
  for (const s of direct(score, "Staff")) {
    const id = s.getAttribute("id");
    if (!id || staves.has(id)) throw new Error("invalidFile");
    staves.set(id, s);
  }
  const style = first(score, "Style");
  const concertView = !!style && value(style, "concertPitch") === "1";
  const parts = direct(score, "Part").map((part, index) => {
    const instrument = readInstrument(part, concertView);
    const inst = first(part, "Instrument") ?? part;
    const name =
      value(part, "trackName") ||
      value(inst, "longName") ||
      value(inst, "trackName") ||
      `P${index + 1}`;
    const members = direct(part, "Staff").map((definition) => {
      const id = definition.getAttribute("id") || "";
      const source = staves.get(id);
      if (!source) throw new Error("invalidFile");
      staves.delete(id);
      const type = first(definition, "StaffType")?.getAttribute("group");
      const bars = direct(source, "Measure").filter(
        (b) => !first(b, "multiMeasureRest"),
      );
      return {
        definition,
        bars,
        percussion: type === "percussion" || value(inst, "useDrumset") === "1",
      };
    });
    if (!members.length) throw new Error("invalidFile");
    return { name, instrument, staves: members };
  });
  if (!parts.length || staves.size) throw new Error("invalidFile");
  return parts;
}

function writeMetadata(w: Writer, score: Element) {
  const tags = new Map(
    direct(score, "metaTag").map((el) => [
      el.getAttribute("name"),
      el.textContent?.trim(),
    ]),
  );
  const firstStaff = first(score, "Staff");
  const frame = firstStaff && first(firstStaff, "VBox");
  const title =
    tags.get("workTitle") ||
    (frame &&
      direct(frame, "Text")
        .find((el) => value(el, "style")?.toLowerCase() === "title")
        ?.querySelector("text")
        ?.textContent?.trim());
  if (title) w.add(w.add(w.root, "work"), "work-title", title);
  if (tags.get("movementTitle"))
    w.add(w.root, "movement-title", tags.get("movementTitle"));
  const creators = ["composer", "lyricist", "arranger"].filter((role) =>
    tags.get(role),
  );
  if (creators.length || tags.get("copyright")) {
    const info = w.add(w.root, "identification");
    for (const role of creators)
      w.add(info, "creator", tags.get(role), { type: role });
    if (tags.get("copyright")) w.add(info, "rights", tags.get("copyright"));
  }
}

interface Meter {
  beats: number;
  unit: number;
  symbol?: string;
}
function readMeter(node: Element) {
  if (value(node, "stretchN") !== value(node, "stretchD")) return unsupported();
  const beats = integer(value(node, "sigN")),
    unit = integer(value(node, "sigD"));
  if (beats < 1 || unit < 1) return unsupported();
  const type = value(node, "subtype");
  return {
    beats,
    unit,
    symbol:
      type === "fourfour" || type === "1"
        ? "common"
        : type === "allabreve" || type === "2"
          ? "cut"
          : undefined,
  };
}

function voicesOf(bar: Element): Element[] {
  const voices = direct(bar, "voice");
  return voices.length ? voices : [bar];
}

function metersOf(staves: Staff[]): Meter[] {
  const count = staves[0].bars.length;
  if (!count || staves.some((staff) => staff.bars.length !== count))
    throw new Error("invalidFile");
  let current: Meter = { beats: 4, unit: 4 };
  return Array.from({ length: count }, (_, index) => {
    let change: Meter | undefined;
    for (const staff of staves) {
      for (const voice of voicesOf(staff.bars[index])) {
        for (const node of direct(voice, "TimeSig")) {
          const meter = readMeter(node);
          if (
            change &&
            (change.beats !== meter.beats || change.unit !== meter.unit)
          )
            return unsupported();
          change = meter;
        }
      }
    }
    return (current = change ?? current);
  });
}

const graceNames =
  /^(?:acciaccatura|appoggiatura|grace(?:4|8|16|32)(?:after)?)$/i;
const accidentals: Record<string, string> = {
  accidentalNatural: "natural",
  accidentalSharp: "sharp",
  accidentalFlat: "flat",
  accidentalDoubleSharp: "double-sharp",
  accidentalDoubleFlat: "flat-flat",
  natural: "natural",
  sharp: "sharp",
  flat: "flat",
  "double sharp": "double-sharp",
  "double flat": "flat-flat",
  "sharp-sharp": "double-sharp",
  "flat-flat": "flat-flat",
  "double-sharp": "double-sharp",
  "double-flat": "flat-flat",
};
interface VoiceContext {
  w: Writer;
  measure: Element;
  clock: MeasureClock;
  length: number;
  start: number;
  division: number;
  instrument: Instrument;
  staff: number;
  voice: number;
  percussion: boolean;
  legacy: boolean;
}

function writeEvent(
  node: Element,
  ctx: VoiceContext,
  tuplets: Tuplets,
): number {
  const { w, measure, clock, instrument, staff, voice } = ctx;
  const rest = node.localName === "Rest";
  const heads = rest ? [null] : direct(node, "Note");
  if (!heads.length || integer(value(node, "staffMove"), 0) !== 0)
    return unsupported();
  if (
    ctx.legacy &&
    (integer(value(node, "track"), 0) % 4 !== 0 ||
      integer(value(node, "voice"), 0) !== 0)
  )
    return unsupported();
  const grace = Array.from(node.children).some((el) =>
    graceNames.test(el.localName),
  );
  const { type, dots, beats } = readRhythm(node, ctx.length, tuplets);
  heads.forEach((head, index) => {
    const out = w.add(measure, "note");
    if (grace) w.add(out, "grace");
    if (index) w.add(out, "chord");
    if (!head)
      w.add(
        out,
        "rest",
        undefined,
        type === "measure" ? { measure: "yes" } : undefined,
      );
    else if (ctx.percussion) w.add(out, "unpitched");
    else writePitch(w, out, head, instrument);
    if (!grace) clock.duration(out, beats);
    w.add(out, "voice", voice);
    if (type !== "measure") w.add(out, "type", type);
    for (let dot = 0; dot < dots; dot++) w.add(out, "dot");
    const accidental = head && first(head, "Accidental");
    if (accidental) {
      const kind = value(accidental, "subtype") || "";
      if (!accidentals[kind] && kind !== "none") return unsupported();
      if (accidentals[kind]) w.add(out, "accidental", accidentals[kind]);
    }
    tuplets.writeRatio(out);
    w.add(out, "staff", staff);
    if (!index) tuplets.markLeader(out);
    writeNoteMarks(w, node, head, out, !index);
  });
  return grace ? 0 : beats;
}

const visualOnly = new Set([
  "eid",
  "Beam",
  "Segment",
  "LayoutBreak",
  "Spacer",
  "Image",
  "LayoutMode",
  "irregular",
  "startRepeat",
  "endRepeat",
  "noOffset",
  "vspacer",
  "vspacerUp",
  "visible",
  "slashStyle",
  "breakMultiMeasureRest",
  "stemless",
  "Marker",
  "Jump",
  "BarLine",
  "measureNumberMode",
  "userStretch",
]);

function writeVoice(source: Element, ctx: VoiceContext) {
  const { w, measure, clock, instrument, staff } = ctx;
  const tuplets = new Tuplets(w);
  let at = 0;
  for (const el of Array.from(source.children)) {
    switch (el.localName) {
      case "Tuplet":
        if (ctx.legacy) tuplets.legacyMember(el);
        tuplets.open(el);
        break;
      case "endTuplet":
        tuplets.close();
        break;
      case "Chord":
      case "Rest":
        if (ctx.legacy) tuplets.legacyMember(el);
        at += writeEvent(el, ctx, tuplets);
        break;
      case "TimeSig":
        if (Math.abs(at) > 1e-8) return unsupported();
        break;
      case "Harmony":
        writeHarmony(w, measure, el, staff);
        break;
      case "KeySig":
        writeKey(w, w.add(measure, "attributes"), el, staff, instrument);
        break;
      case "Clef":
        writeClef(
          w,
          w.add(measure, "attributes"),
          value(
            el,
            instrument.concertView ? "concertClefType" : "transposingClefType",
          ) ||
            value(el, "concertClefType") ||
            value(el, "subtype") ||
            "G",
          staff,
        );
        break;
      case "tick":
      case "location": {
        const offset =
          el.localName === "tick"
            ? integer(el.textContent?.trim()) / ctx.division - ctx.start - at
            : quarters(value(el, "fractions") ?? "0/1");
        if (
          el.localName === "location" &&
          Array.from(el.children).some((c) => c.localName !== "fractions")
        )
          return unsupported();
        if (at + offset < -1e-8) return unsupported();
        clock.move(measure, offset);
        at += offset;
        break;
      }
      default:
        if (
          !writeDirection(w, el, measure, staff) &&
          !visualOnly.has(el.localName)
        )
          return unsupported();
    }
  }
  tuplets.endVoice();
  return at;
}

function writePart(
  w: Writer,
  source: Part,
  index: number,
  meters: Meter[],
  division: number,
  legacy: boolean,
  signal?: AbortSignal,
) {
  const dest = w.part(`P${index + 1}`, source.name);
  let start = 0;
  const bars = meters.map((meter, barIndex) => {
    signal?.throwIfAborted();
    const bar = source.staves[0].bars[barIndex];
    const length = bar.hasAttribute("len")
      ? quarters(bar.getAttribute("len")!)
      : (meter.beats * 4) / meter.unit;
    if (!(length > 0)) return unsupported();
    const partial =
      Math.abs(length - (meter.beats * 4) / meter.unit) > 1e-8 ||
      value(bar, "irregular") === "1";
    const measure = w.add(dest, "measure", undefined, {
      number: bar.getAttribute("number") || barIndex + 1,
      ...(partial ? { implicit: "yes" } : {}),
    });
    const attr = w.add(measure, "attributes");
    const clock = new MeasureClock(w, w.add(attr, "divisions"));
    if (!barIndex || meter !== meters[barIndex - 1]) {
      const time = w.add(
        attr,
        "time",
        undefined,
        meter.symbol ? { symbol: meter.symbol } : undefined,
      );
      w.add(time, "beats", meter.beats);
      w.add(time, "beat-type", meter.unit);
    }
    if (!barIndex) {
      if (source.staves.length > 1) w.add(attr, "staves", source.staves.length);
      source.staves.forEach((staff, i) => {
        const def = staff.definition;
        writeClef(
          w,
          attr,
          value(
            def,
            source.instrument.concertView
              ? "defaultConcertClef"
              : "defaultTransposingClef",
          ) ||
            value(def, "defaultClef") ||
            (staff.percussion ? "PERC" : "G"),
          i + 1,
        );
      });
      const { chromatic, diatonic } = source.instrument;
      if (!source.instrument.concertView && (chromatic || diatonic)) {
        const transpose = w.add(attr, "transpose");
        w.add(transpose, "diatonic", diatonic);
        w.add(transpose, "chromatic", chromatic);
      }
      if (index === 0) w.add(measure, "sound", undefined, { tempo: 120 });
    }
    let at = 0;
    source.staves.forEach((staff, staffIndex) => {
      const native = staff.bars[barIndex];
      // MeasureRepeat placeholders don't contain the notes they repeat.
      if (first(native, "measureRepeatCount") || first(native, "measureRepeat"))
        return unsupported();
      voicesOf(native).forEach((voice, voiceIndex) => {
        clock.move(measure, -at);
        at = writeVoice(voice, {
          w,
          measure,
          clock,
          length,
          start,
          division,
          instrument: source.instrument,
          staff: staffIndex + 1,
          voice: voiceIndex + 1,
          percussion: staff.percussion,
          legacy,
        });
      });
    });
    if (at < length) clock.move(measure, length - at);
    clock.finish();
    start += length;
    return measure;
  });
  for (const staff of source.staves) writeMeasureMarks(w, staff.bars, bars);
}

/** Translate native score data into the same DOM edited and played by MusicXML imports.
 * Only the main score owns musical time; nested excerpts are independent views. */
export function museScoreToMusicXml(
  source: XMLDocument,
  signal?: AbortSignal,
): XMLDocument {
  signal?.throwIfAborted();
  const root = source.documentElement;
  const version = root.getAttribute("version") ?? "";
  if (root.localName !== "museScore" || !/^[234](?:\.\d+)+$/.test(version))
    throw new Error("unsupportedFile");
  const score = first(root, "Score");
  if (!score) throw new Error("invalidFile");
  const style = first(score, "Style");
  if (style) {
    const unit = value(style, "swingUnit")?.toLowerCase();
    if (
      unit &&
      !["zero", "0", "none"].includes(unit) &&
      integer(value(style, "swingRatio"), 60) !== 50
    )
      return unsupported();
  }
  const w = createScoreWriter();
  writeMetadata(w, score);
  const parts = partsOf(score);
  const meters = metersOf(parts.flatMap((part) => part.staves));
  const division = integer(value(score, "Division"), 480);
  if (division < 1) throw new Error("invalidFile");
  parts.forEach((part, i) =>
    writePart(w, part, i, meters, division, version.startsWith("2."), signal),
  );
  return w.document;
}
