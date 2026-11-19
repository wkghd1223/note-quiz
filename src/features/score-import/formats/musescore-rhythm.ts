import { direct, dottedLength, first, typeLength, value } from "../score-xml";
import type { createScoreWriter } from "./writer";

export type Writer = ReturnType<typeof createScoreWriter>;

export function unsupported(): never {
  throw new Error("unsupportedNotation");
}

export function integer(
  raw: string | undefined | null,
  fallback?: number,
): number {
  if (raw == null && fallback !== undefined) return fallback;
  if (!raw || !/^-?\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))
    return unsupported();
  return Number(raw);
}

/** MSCX fractions are measured in whole notes; our clocks use quarters. */
export function quarters(fraction: string) {
  const match = /^(-?\d+)\/(\d+)$/.exec(fraction);
  if (!match || Number(match[2]) === 0) return unsupported();
  return (4 * integer(match[1])) / integer(match[2]);
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** Use whole ticks for nested tuplets and MuseScore's fractional voice offsets.
 * Compute a common divisions value for each measure, even for e.g. septuplets. */
export class MeasureClock {
  private scale = 480;
  private durations: [Element, number][] = [];

  constructor(
    private w: Writer,
    private divisions: Element,
  ) {}

  duration(parent: Element, beats: number) {
    if (!(beats > 0 && Number.isFinite(beats))) return unsupported();
    const ticks = beats * this.scale;
    if (Math.abs(ticks - Math.round(ticks)) > 1e-7) {
      // Continued fractions recover the exact denominator from the native ratio.
      let remaining = beats,
        last = 0,
        denominator = 1;
      let numerator = Math.floor(remaining);
      let previousNumerator = 1;
      while (Math.abs(beats * denominator - numerator) > 1e-8) {
        remaining = 1 / (remaining - Math.floor(remaining));
        const term = Math.floor(remaining);
        [last, denominator] = [denominator, term * denominator + last];
        [previousNumerator, numerator] = [
          numerator,
          term * numerator + previousNumerator,
        ];
        if (!Number.isSafeInteger(denominator) || denominator > 1e7)
          return unsupported();
      }
      this.scale = (this.scale / gcd(this.scale, denominator)) * denominator;
      if (this.scale > 1e8) return unsupported();
    }
    this.durations.push([this.w.add(parent, "duration"), beats]);
  }

  move(measure: Element, delta: number) {
    if (Math.abs(delta) < 1e-9) return;
    this.duration(
      this.w.add(measure, delta < 0 ? "backup" : "forward"),
      Math.abs(delta),
    );
  }

  finish() {
    this.divisions.textContent = String(this.scale);
    for (const [el, beats] of this.durations) {
      const ticks = Math.round(beats * this.scale);
      if (!Number.isSafeInteger(ticks) || ticks < 1) return unsupported();
      el.textContent = String(ticks);
    }
  }
}

interface Tuplet {
  actual: number;
  normal: number;
  first?: Element;
  last?: Element;
  id: string | null;
}

function marker(
  w: Writer,
  note: Element,
  side: "start" | "stop",
  depth: number,
) {
  const marks = first(note, "notations") ?? w.add(note, "notations");
  w.add(marks, "tuplet", undefined, { type: side, number: depth });
}

export class Tuplets {
  private groups: Tuplet[] = [];
  constructor(private w: Writer) {}

  open(node: Element) {
    const actual = integer(value(node, "actualNotes"));
    const normal = integer(value(node, "normalNotes"));
    if (actual <= 0 || normal <= 0 || this.groups.length >= 8)
      return unsupported();
    this.groups.push({ actual, normal, id: node.getAttribute("id") });
  }

  close() {
    const depth = this.groups.length;
    const group = this.groups.pop();
    if (!group?.last) return unsupported();
    marker(this.w, group.last, "stop", depth);
  }

  /** MSCX 2 stores membership on each chord/rest; MSCX 3+ closes it with endTuplet. */
  legacyMember(node: Element) {
    const ids = direct(node, "Tuplet").map((el) => el.textContent?.trim());
    while (this.groups.length) {
      const top = this.groups[this.groups.length - 1];
      if (!top.id || ids.includes(top.id)) break;
      this.close();
    }
    if (ids.some((id) => !this.groups.some((group) => group.id === id)))
      return unsupported();
  }

  endVoice() {
    while (this.groups.length && this.groups[this.groups.length - 1].id)
      this.close();
    if (this.groups.length) return unsupported();
  }

  ratio() {
    return this.groups.reduce(
      (ratio, group) => (ratio * group.normal) / group.actual,
      1,
    );
  }

  writeRatio(note: Element) {
    if (!this.groups.length) return;
    const actual = this.groups.reduce((n, g) => n * g.actual, 1);
    const normal = this.groups.reduce((n, g) => n * g.normal, 1);
    if (!Number.isSafeInteger(actual) || !Number.isSafeInteger(normal))
      return unsupported();
    const time = this.w.add(note, "time-modification");
    this.w.add(time, "actual-notes", actual);
    this.w.add(time, "normal-notes", normal);
  }

  markLeader(note: Element) {
    this.groups.forEach((group, index) => {
      if (!group.first) marker(this.w, note, "start", index + 1);
      group.first ??= note;
      group.last = note;
    });
  }
}

export function readRhythm(
  node: Element,
  measureBeats: number,
  tuplets: Tuplets,
) {
  const type =
    value(node, "durationType") ?? (node.localName === "Rest" ? "measure" : "");
  const dots = integer(value(node, "dots"), 0);
  if (dots < 0 || dots > 4) return unsupported();
  const base = type === "measure" ? measureBeats : typeLength(type);
  if (!base) return unsupported();
  const explicit = value(node, "duration");
  const beats =
    (explicit ? quarters(explicit) : dottedLength(base, dots)) *
    tuplets.ratio();
  return { type, dots, beats };
}
