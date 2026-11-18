import type {
  ImportedBar,
  ImportedLane,
  ImportedScore,
  ScoreMeter,
} from "./types";
import {
  attributesAtStart,
  childrenNamed,
  direct,
  element,
  fail,
  first,
  glyphValues,
  insertOrdered,
  near,
  remove,
  set,
  value,
  writtenLength,
  writeRhythm,
} from "./score-xml";

type Copy = (node: Element) => Element;
type Part = { bars: Element[]; lane?: ImportedLane };
type Head = { note: Element; length: number };
type Item =
  | { at: number; heads: Head[] }
  | { at: number; node: Element; beforeBoundary: boolean };
type Output = {
  start: number;
  end: number;
  items: { at: number; advance: number; nodes: Element[] }[];
};

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}
function exact(n: number) {
  if (!Number.isSafeInteger(Math.round(n)) || !near(n, Math.round(n)))
    return fail();
  return Math.round(n);
}

function lcm(a: number, b: number) {
  return exact((a / gcd(a, b)) * b);
}

/** MusicXML divisions and values measured in divisions are both decimals. */
function decimalFraction(raw: number): [number, number] {
  const n = Math.abs(raw);
  if (Number.isSafeInteger(n)) return [n, 1];
  if (!Number.isFinite(n)) return fail();
  const [mantissa, exponent = "0"] = String(n).split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const places = fraction.length - Number(exponent);
  let numerator = exact(Number(whole + fraction) * 10 ** Math.max(-places, 0));
  let twos = Math.max(0, places),
    fives = twos;
  while (twos && numerator % 2 === 0) {
    numerator /= 2;
    twos--;
  }
  while (fives && numerator % 5 === 0) {
    numerator /= 5;
    fives--;
  }
  return [numerator, exact(2 ** twos * 5 ** fives)];
}

const relativeTimeAttributes = ["attack", "release", "make-time"];

function scoreParts(score: ImportedScore): Part[] {
  const root = score.document.documentElement;
  const lanes = new Map(score.lanes.map((lane) => [lane.partId, lane]));
  if (root.localName === "score-partwise") {
    return direct(root, "part").map((part) => ({
      bars: direct(part, "measure"),
      lane: lanes.get(part.getAttribute("id")!),
    }));
  }
  const byId = new Map<string, Element[]>();
  for (const m of direct(root, "measure"))
    for (const part of direct(m, "part")) {
      const id = part.getAttribute("id")!;
      const bars = byId.get(id) ?? [];
      bars.push(part);
      byId.set(id, bars);
    }
  return Array.from(byId, ([id, bars]) => ({ bars, lane: lanes.get(id) }));
}

function setMeter(measure: Element, meter: ScoreMeter) {
  const attrs = attributesAtStart(measure);
  const opening: Element[] = [];
  for (const node of Array.from(measure.children)) {
    if (["note", "forward", "backup"].includes(node.localName)) break;
    if (node.localName === "attributes") opening.push(...direct(node, "time"));
  }
  const old = opening;
  const times = old.some((t) => !t.hasAttribute("number"))
    ? old
    : [insertOrdered(attrs, element(attrs, "time")), ...old];
  for (const time of times) {
    time.removeAttribute("symbol");
    remove(time, "beats", "beat-type", "senza-misura", "interchangeable");
    set(time, "beats", meter.beats);
    set(time, "beat-type", meter.beatType);
  }
}

function commonGrid(
  parts: Part[],
  start: number,
  end: number,
  lane: ImportedLane,
  meter: ScoreMeter,
) {
  let grid = meter.beatType;
  for (const b of lane.bars.slice(start, end))
    grid = lcm(grid, b.meter.beatType);
  for (const part of parts) {
    let divisions = decimalFraction(part.lane?.bars[start]?.divisions ?? 1)[0];
    let subTicks = 1;
    function includeTime(n: number) {
      if (!Number.isInteger(n)) subTicks = lcm(subTicks, decimalFraction(n)[1]);
    }
    for (const b of part.bars.slice(start, end)) {
      for (const el of Array.from(
        b.getElementsByTagNameNS(b.namespaceURI, "*"),
      )) {
        if (el.localName === "divisions") {
          const n = Number(el.textContent);
          if (!(n > 0)) fail();
          divisions = lcm(divisions, decimalFraction(n)[0]);
        } else if (el.localName === "duration" || el.localName === "offset") {
          includeTime(Number(el.textContent));
        }
        for (const attr of relativeTimeAttributes)
          if (el.hasAttribute(attr)) includeTime(Number(el.getAttribute(attr)));
      }
    }
    // One source tick and every subdivision of it must fit the new integer grid.
    grid = lcm(grid, exact(divisions * subTicks));
  }
  return grid;
}

function scaleTime(node: Element, factor: number, grid: number) {
  if (factor === 1) return;
  for (const el of [
    node,
    ...Array.from(node.getElementsByTagNameNS(node.namespaceURI, "*")),
  ]) {
    if (el.localName === "divisions") el.textContent = String(grid);
    else if (["duration", "offset"].includes(el.localName))
      el.textContent = String(exact(Number(el.textContent) * factor));
    for (const name of relativeTimeAttributes)
      if (el.hasAttribute(name))
        el.setAttribute(
          name,
          String(exact(Number(el.getAttribute(name)) * factor)),
        );
  }
}

const measureOf = (node: Element) =>
  node.localName === "measure" ? node : node.parentElement!;
function isJump(el: Element) {
  const sound = el.localName === "sound" ? el : first(el, "sound");
  return (
    ["dacapo", "dalsegno", "segno", "tocoda", "coda", "fine"].some((k) =>
      sound?.hasAttribute(k),
    ) ||
    childrenNamed(el, "segno").length > 0 ||
    childrenNamed(el, "coda").length > 0 ||
    childrenNamed(el, "words").some((w) =>
      /^(d\.?\s*[cs]\.?\b|da capo|dal segno|fine\b|(?:to|al) coda)/i.test(
        w.textContent?.trim() ?? "",
      ),
    )
  );
}

/** Keep each original XML item's absolute beat, independently of voice order and backup/forward. */
function readPart(
  part: Part,
  copy: Copy,
  start: number,
  starts: number[],
  grid: number,
  anchors: Set<number>,
) {
  const items: Item[] = [];
  let inherited = part.lane?.bars[start]?.divisions ?? 1;
  for (let i = 0; i < starts.length - 1; i++) {
    const source = part.bars[start + i],
      begin = starts[i],
      end = starts[i + 1],
      measure = measureOf(source);
    if (
      measure.getAttribute("implicit") === "yes" ||
      measure.getAttribute("number") === "0"
    ) {
      // A trailing partial bar can merge back into its predecessor when the
      // user enlarges the meter. Preserve a pickup at the beginning.
      if (i === 0 || i < starts.length - 2) anchors.add(begin);
      anchors.add(end);
    }
    if (
      Array.from(measure.attributes).some(
        (a) => !["number", "implicit", "width"].includes(a.localName),
      )
    )
      anchors.add(begin);
    const divisions = [{ at: begin, n: inherited }];
    let cursor = begin;
    let previous: Head[] | undefined;
    for (const original of Array.from(source.children)) {
      const div = divisions.reduce(
        (a, b) => (b.at <= cursor && b.at >= a.at ? b : a),
        divisions[0],
      ).n;
      const factor = grid / div;
      const kind = original.localName;
      if (kind === "backup" || kind === "forward") {
        const amount = exact(Number(value(original, "duration")) * factor);
        cursor += kind === "forward" ? amount : -amount;
        if (amount <= 0 || cursor < begin || cursor > end) fail();
        previous = undefined;
        continue;
      }
      const node = copy(original);
      scaleTime(node, factor, grid);
      if (kind === "note" && !first(node, "grace")) {
        const length = exact(Number(value(node, "duration")));
        if (length <= 0) fail();
        const head = { note: node, length };
        if (first(node, "chord") && previous) previous.push(head);
        else {
          previous = [head];
          items.push({ at: cursor, heads: previous });
          cursor += length;
        }
        continue;
      }
      let at = cursor,
        beforeBoundary = false;
      if (kind === "attributes") {
        const d = first(original, "divisions");
        if (d) {
          divisions.push({ at: cursor, n: Number(d.textContent) });
          remove(node, "divisions");
        }
        if (!node.children.length) continue;
        // A new clef/key at an old barline remains visible even in renderers
        // which cannot engrave per-staff mid-measure signature changes.
        if (
          cursor === begin &&
          (first(node, "key") || first(node, "clef") || first(node, "time"))
        )
          anchors.add(begin);
      } else if (kind === "barline") {
        const location = node.getAttribute("location") ?? "right";
        at = location === "left" ? begin : location === "right" ? end : cursor;
        beforeBoundary = location !== "left";
        if (
          !node.children.length ||
          (node.children.length === 1 && value(node, "bar-style") === "regular")
        )
          continue;
        anchors.add(at);
        if (location === "middle") node.setAttribute("location", "right");
      } else if (kind === "print") {
        anchors.add(at);
      } else if (
        kind === "direction" ||
        kind === "sound" ||
        kind === "harmony"
      ) {
        const offset = first(node, "offset");
        const visualAt = cursor + Number(offset?.textContent ?? 0);
        if (kind === "direction") {
          const sound = first(node, "sound");
          const own = sound && first(sound, "offset");
          const directionAt =
            offset?.getAttribute("sound") === "yes" ? visualAt : cursor;
          at = own ? cursor + Number(own.textContent) : directionAt;
          // Keep the sound inside its direction: an explicit tempo overrides
          // its printed metronome, even if they were at different positions.
          own?.remove();
          if (
            isJump(node) ||
            sound ||
            childrenNamed(node, "metronome").length
          ) {
            const delta = visualAt - at;
            if (delta || offset) {
              const visual = offset ?? element(node, "offset");
              if (!offset)
                node.insertBefore(
                  visual,
                  Array.from(node.children).find(
                    (n) => n.localName !== "direction-type",
                  ) ?? null,
                );
              visual.textContent = String(delta);
              visual.setAttribute("sound", "no");
            }
          } else {
            at = visualAt;
            offset?.remove();
          }
        } else {
          at = visualAt;
          offset?.remove();
        }
        if (isJump(node)) anchors.add(at);
        beforeBoundary = at === end;
      } else beforeBoundary = at === end;
      items.push({ at, node, beforeBoundary });
    }
    inherited = divisions.reduce((a, b) => (b.at >= a.at ? b : a)).n;
  }
  return items;
}

function barAt(starts: number[], position: number, preceding = false) {
  let lo = 0,
    hi = starts.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >>> 1;
    if (preceding ? starts[m] < position : starts[m] <= position) lo = m;
    else hi = m - 1;
  }
  return Math.min(lo, starts.length - 2);
}

function ratio(note: Element) {
  const timing = first(note, "time-modification");
  return timing
    ? Number(value(timing, "actual-notes")) /
        Number(value(timing, "normal-notes"))
    : 1;
}
function pieceLength(note: Element, length: number, grid: number) {
  const r = ratio(note);
  if (writtenLength((length * r) / grid)) return length;
  for (const [, quarters] of glyphValues) {
    const ticks = (quarters * grid) / r;
    if (ticks < length && near(ticks, Math.round(ticks)) && ticks >= 1)
      return Math.round(ticks);
  }
  return length;
}

function tie(note: Element, side: "start" | "stop") {
  const visual = set(note, "notations");
  for (const [parent, tag] of [
    [note, "tie"],
    [visual, "tied"],
  ] as const) {
    const mark = element(parent, tag);
    mark.setAttribute("type", side);
    const outgoing =
      side === "stop" &&
      direct(parent, tag).find((x) => x.getAttribute("type") === "start");
    if (outgoing) parent.insertBefore(mark, outgoing);
    else if (parent === note) insertOrdered(parent, mark);
    else parent.appendChild(mark);
  }
}
function splitHead(h: Head, offset: number, length: number, grid: number) {
  const n = h.note.cloneNode(true) as Element;
  const firstPiece = offset === 0,
    lastPiece = offset + length === h.length;
  const r = ratio(n),
    rhythm = writtenLength((length * r) / grid);
  if (rhythm) writeRhythm(n, rhythm.type, rhythm.dots, length);
  else {
    // A quantized source duration may not have an ordinary dotted spelling.
    // Express the exact remaining ticks as a written quarter with a time ratio.
    writeRhythm(n, "quarter", 0, length);
    const tm = set(n, "time-modification"),
      divisor = gcd(grid, length);
    set(tm, "actual-notes", grid / divisor);
    set(tm, "normal-notes", length / divisor);
    remove(tm, "normal-type", "normal-dot");
  }
  first(n, "rest")?.removeAttribute("measure");
  if (!firstPiece) {
    for (const el of [n, ...Array.from(n.getElementsByTagName("*"))]) {
      el.removeAttribute("id");
      el.removeAttributeNS("http://www.w3.org/XML/1998/namespace", "id");
    }
    remove(
      n,
      "accidental",
      "lyric",
      "play",
      "listen",
      "footnote",
      "level",
      "beam",
    );
    n.removeAttribute("attack");
  }
  if (!lastPiece) n.removeAttribute("release");
  // Some exporters only encode the engraved tie. Adding an internal sound tie
  // must not override the original outgoing/incoming connection.
  if (!direct(n, "tie").length) {
    for (const mark of childrenNamed(n, "tied")) {
      const side = mark.getAttribute("type");
      if (side !== "start" && side !== "stop" && side !== "continue") continue;
      for (const type of side === "continue" ? ["stop", "start"] : [side]) {
        const sound = element(n, "tie");
        sound.setAttribute("type", type);
        if (mark.hasAttribute("time-only"))
          sound.setAttribute("time-only", mark.getAttribute("time-only")!);
        insertOrdered(n, sound);
      }
    }
  }
  for (const tag of ["tie", "tied"]) {
    for (const mark of childrenNamed(n, tag)) {
      const side = mark.getAttribute("type");
      if (side === "continue" && firstPiece !== lastPiece)
        mark.setAttribute("type", firstPiece ? "stop" : "start");
      else if (
        (side === "stop" && !firstPiece) ||
        (side === "start" && !lastPiece) ||
        (side === "continue" && !firstPiece && !lastPiece)
      )
        mark.remove();
    }
  }
  for (const ns of direct(n, "notations")) {
    for (const mark of Array.from(ns.children)) {
      if (mark.localName === "tied") continue;
      const endMark =
        (mark.localName === "tuplet" && mark.getAttribute("type") === "stop") ||
        mark.localName === "fermata";
      if (endMark ? !lastPiece : !firstPiece) mark.remove();
    }
    if (!ns.children.length) ns.remove();
  }
  if (!first(n, "rest")) {
    if (!firstPiece) tie(n, "stop");
    if (!lastPiece) tie(n, "start");
  }
  return n;
}

function distribute(items: Item[], starts: number[], grid: number) {
  const bars: Output[] = starts
    .slice(0, -1)
    .map((start, i) => ({ start, end: starts[i + 1], items: [] }));
  for (const item of items) {
    if (item.at < 0 || item.at > starts[starts.length - 1]) fail();
    if ("node" in item) {
      bars[barAt(starts, item.at, item.beforeBoundary)].items.push({
        at: item.at,
        advance: 0,
        nodes: [item.node],
      });
      continue;
    }
    const length = item.heads[0].length;
    if (item.heads.some((h) => h.length > length)) fail();
    let offset = 0,
      i = barAt(starts, item.at);
    while (offset < length) {
      const b = bars[i],
        at = item.at + offset;
      if (!b || at >= b.end) return fail();
      let size = Math.min(b.end - at, length - offset);
      const active = item.heads.filter((h) => h.length > offset);
      let next = size;
      do {
        size = next;
        for (const h of active) {
          const d = Math.min(size, h.length - offset);
          if (!offset && d === h.length) continue;
          const portion = pieceLength(h.note, d, grid);
          if (portion < d) next = Math.min(next, portion);
        }
      } while (next < size);
      const nodes = active.map((h) => {
        const d = Math.min(size, h.length - offset);
        if (!offset && d === h.length) {
          if (first(h.note, "rest") && (at !== b.start || at + d !== b.end))
            first(h.note, "rest")!.removeAttribute("measure");
          return h.note;
        }
        return splitHead(h, offset, d, grid);
      });
      b.items.push({ at, advance: size, nodes });
      offset += size;
      if (at + size === b.end) i++;
    }
  }
  return bars;
}

function writeBar(bar: Output, dest: Element) {
  let cursor = bar.start;
  const right: Element[] = [];
  function seek(to: number) {
    if (cursor === to) return;
    const move = element(dest, to > cursor ? "forward" : "backup");
    set(move, "duration", Math.abs(to - cursor));
    dest.appendChild(move);
    cursor = to;
  }
  for (const item of bar.items) {
    const firstNode = item.nodes[0];
    if (
      firstNode.localName === "barline" &&
      firstNode.getAttribute("location") !== "left"
    ) {
      right.push(firstNode);
      continue;
    }
    seek(item.at);
    dest.append(...item.nodes);
    cursor += item.advance;
  }
  if (cursor < bar.end) seek(bar.end);
  dest.append(...right);
}

function replaceMeasures(
  originals: Element[],
  copy: Copy,
  oldStarts: number[],
  starts: number[],
  capacity: number,
  fill: (dest: Element, index: number) => void,
) {
  const parent = copy(originals[0]).parentElement!;
  const after = copy(originals[originals.length - 1]).nextElementSibling;
  const templates = new Map(originals.map((m, i) => [oldStarts[i], m]));
  const firstNumber = Number(originals[0].getAttribute("number"));
  let lastNumber = firstNumber;
  for (const old of originals) copy(old).remove();
  for (let i = 0; i < starts.length - 1; i++) {
    const source = templates.get(starts[i]);
    const dest = source
      ? (source.cloneNode(false) as Element)
      : element(parent, "measure");
    const label = Number.isInteger(firstNumber)
      ? String(firstNumber + i)
      : (source?.getAttribute("number") ??
        `${originals[0].getAttribute("number")}.${i + 1}`);
    dest.setAttribute("number", label);
    lastNumber = Number(label);
    if (starts[i + 1] - starts[i] !== capacity)
      dest.setAttribute("implicit", "yes");
    else dest.removeAttribute("implicit");
    parent.insertBefore(dest, after);
    fill(dest, i);
  }
  if (originals.length !== starts.length - 1)
    for (let m = after; m; m = m.nextElementSibling) {
      if (
        m.localName === "measure" &&
        Number.isInteger(lastNumber) &&
        /^\d+$/.test(m.getAttribute("number") ?? "")
      )
        m.setAttribute("number", String(++lastNumber));
    }
}

export function reflowScore(
  copy: Copy,
  score: ImportedScore,
  lane: ImportedLane,
  bar: ImportedBar,
  meter: ScoreMeter,
) {
  if (
    !Number.isInteger(meter.beats) ||
    meter.beats < 1 ||
    meter.beats > 32 ||
    ![1, 2, 4, 8, 16, 32].includes(meter.beatType)
  )
    fail();
  const start = bar.index;
  const parts = scoreParts(score).filter((part) => part.bars[start]);
  const quarters = (meter.beats * 4) / meter.beatType;
  if (near(quarters, (bar.meter.beats * 4) / bar.meter.beatType)) {
    parts.forEach((p) => setMeter(copy(p.bars[start]), meter));
    return;
  }
  let end = start + 1;
  while (
    end < lane.bars.length &&
    !parts.some(
      (p) =>
        p.bars[end] &&
        direct(p.bars[end], "attributes").some((a) => first(a, "time")),
    )
  )
    end++;
  const grid = commonGrid(parts, start, end, lane, meter),
    capacity = exact(quarters * grid);
  const oldStarts = [0];
  for (let i = start; i < end; i++) {
    const length = Math.max(
      ...parts.map((p) => p.lane?.bars[i]?.duration ?? 0),
    );
    oldStarts.push(oldStarts.at(-1)! + exact(length * grid));
  }
  const total = oldStarts.at(-1)!;
  const anchors = new Set([0, total]);
  const endings = parts.map(
    (p) => oldStarts[Math.min(end, p.bars.length) - start],
  );
  endings.forEach((t) => anchors.add(t));
  const streams = parts.map((p) =>
    readPart(
      p,
      copy,
      start,
      oldStarts.slice(0, Math.min(end, p.bars.length) - start + 1),
      grid,
      anchors,
    ),
  );
  const starts = [0];
  for (const boundary of [...anchors].sort((a, b) => a - b)) {
    if (boundary < 0 || boundary > total) fail();
    while (starts.at(-1)! < boundary) {
      if (starts.length > 350000) fail();
      starts.push(Math.min(boundary, starts.at(-1)! + capacity));
    }
  }
  const plans = streams.map((stream) => distribute(stream, starts, grid));
  const fill = (dest: Element, p: number, i: number) => {
    writeBar(plans[p][i], dest);
    if (i === 0) {
      set(attributesAtStart(dest), "divisions", grid);
      setMeter(dest, meter);
    }
  };
  if (score.document.documentElement.localName === "score-timewise") {
    replaceMeasures(
      parts[0].bars.slice(start, end).map(measureOf),
      copy,
      oldStarts,
      starts,
      capacity,
      (m, i) => {
        parts.forEach((part, p) => {
          const dest = part.bars[start].cloneNode(false) as Element;
          m.appendChild(dest);
          fill(dest, p, i);
        });
      },
    );
  } else {
    parts.forEach((part, p) =>
      replaceMeasures(
        part.bars.slice(start, end),
        copy,
        oldStarts,
        starts.filter((at) => at <= endings[p]),
        capacity,
        (m, i) => fill(m, p, i),
      ),
    );
  }
  for (const part of parts) {
    const next = part.bars[end];
    if (next) {
      const previous = part.lane?.bars[end]?.divisions;
      if (previous && previous !== grid)
        set(attributesAtStart(copy(next)), "divisions", previous);
      const nextBar = part.lane?.bars[end];
      if (nextBar && !direct(next, "attributes").some((a) => first(a, "time")))
        setMeter(copy(next), nextBar.meter);
    }
  }
}
