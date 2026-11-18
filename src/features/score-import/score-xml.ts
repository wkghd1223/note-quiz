export const fail = (): never => {
  throw new Error("editConflict");
};
export const epsilon = 1e-7;
export const near = (a: number, b: number) => Math.abs(a - b) < epsilon;
export const direct = (el: Element, name: string) =>
  Array.from(el.children).filter(
    (child) =>
      child.localName === name && child.namespaceURI === el.namespaceURI,
  );
export const first = (el: Element, name: string) => direct(el, name)[0];
export const value = (el: Element, name: string) =>
  first(el, name)?.textContent?.trim();
export const element = (parent: Element, name: string) =>
  parent.ownerDocument.createElementNS(
    parent.namespaceURI,
    parent.prefix ? `${parent.prefix}:${name}` : name,
  );
const noteOrder = [
  "grace",
  "cue",
  "chord",
  "pitch",
  "unpitched",
  "rest",
  "duration",
  "tie",
  "instrument",
  "footnote",
  "level",
  "voice",
  "type",
  "dot",
  "accidental",
  "time-modification",
  "stem",
  "notehead",
  "notehead-text",
  "staff",
  "beam",
  "notations",
  "lyric",
  "play",
  "listen",
];
const attributeOrder = [
  "footnote",
  "level",
  "divisions",
  "key",
  "time",
  "staves",
  "part-symbol",
  "instruments",
  "clef",
  "staff-details",
  "transpose",
  "for-part",
  "directive",
  "measure-style",
];

export function insertOrdered(parent: Element, child: Element) {
  const order = parent.localName === "attributes" ? attributeOrder : noteOrder;
  const idx = order.indexOf(child.localName);
  const next = Array.from(parent.children).find(
    (el) => order.indexOf(el.localName) > idx,
  );
  parent.insertBefore(child, next ?? null);
  return child;
}

export function set(parent: Element, name: string, text?: string | number) {
  const child =
    first(parent, name) ?? insertOrdered(parent, element(parent, name));
  if (text !== undefined) child.textContent = String(text);
  return child;
}

export function remove(parent: Element, ...names: string[]) {
  for (const name of names) direct(parent, name).forEach((el) => el.remove());
}

export function childrenNamed(parent: Element, name: string) {
  return Array.from(parent.getElementsByTagNameNS(parent.namespaceURI, name));
}

export function attributesAtStart(measure: Element) {
  for (const child of Array.from(measure.children)) {
    if (child.localName === "attributes") return child;
    if (["note", "backup", "forward"].includes(child.localName)) break;
  }
  const attributes = element(measure, "attributes");
  measure.insertBefore(attributes, measure.firstElementChild);
  return attributes;
}

export const glyphValues = [
  ["maxima", 32],
  ["long", 16],
  ["breve", 8],
  ["whole", 4],
  ["half", 2],
  ["quarter", 1],
  ["eighth", 0.5],
  ["16th", 0.25],
  ["32nd", 0.125],
  ["64th", 0.0625],
  ["128th", 1 / 32],
  ["256th", 1 / 64],
  ["512th", 1 / 128],
  ["1024th", 1 / 256],
] as const;

export const typeLength = (type: string) =>
  glyphValues.find(([name]) => name === type)?.[1];
export const dottedLength = (base: number, dots: number) =>
  base * (2 - 2 ** -dots);
export function writtenLength(duration: number) {
  for (const [type, base] of glyphValues)
    for (let dots = 0; dots <= 3; dots++)
      if (near(dottedLength(base, dots), duration)) return { type, dots };
  return undefined;
}
export function writeRhythm(
  note: Element,
  type: string,
  dots: number,
  ticks: number,
) {
  if (
    !Number.isFinite(ticks) ||
    ticks <= 0 ||
    !Number.isSafeInteger(Math.round(ticks)) ||
    !near(ticks, Math.round(ticks))
  )
    fail();
  set(note, "duration", Math.round(ticks));
  set(note, "type", type);
  remove(note, "dot");
  for (let i = 0; i < dots; i++) insertOrdered(note, element(note, "dot"));
}
