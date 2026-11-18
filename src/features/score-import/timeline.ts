import { MAX_PLAYBACK_BARS } from "../challenge/domain/playback-order";
import {
  elements,
  MAX_SCORE_REPEAT_PASSES,
  playbackBars,
  type BarPerformance,
  type TempoMark,
} from "./model";
import type {
  ImportedBar,
  ImportedHead,
  ImportedScore,
  ImportedTarget,
  ImportedTimeline,
  ScoreOptions,
} from "./types";

const EPS = 1e-8;
// A count-in is a cue before the score, including when the file encodes
// an unusually long measure. Bound the number of scheduled audio nodes.
const MAX_COUNT_IN_PULSES = 32;
interface Repeat {
  start: number;
  end: number;
  count: number;
}
interface Ending {
  start: number;
  end: number;
  passes: number[];
  repeat?: Repeat;
}

/** Resolve repeat pairs and volta brackets against the whole written score, before cropping. */
function readNavigation(bars: readonly BarPerformance[]) {
  const opened: number[] = [];
  const repeats: Repeat[] = [];
  const endings: Ending[] = [];
  let ending: Ending | undefined;
  for (const [index, bar] of bars.entries()) {
    if (bar.repeatStart) opened.push(index);
    if (bar.endingStart.length) {
      ending = { start: index, end: index, passes: bar.endingStart };
      endings.push(ending);
    }
    if (ending) ending.end = index;
    if (bar.repeatCount) {
      const start = opened.pop() ?? 0;
      repeats.push({ start, end: index, count: bar.repeatCount });
    }
    if (bar.endingStop) ending = undefined;
  }
  // The final ending usually begins *after* the backward repeat barline.
  for (const repeat of repeats) {
    let previousEnd = -2;
    for (const bracket of endings) {
      if (
        (bracket.start >= repeat.start &&
          bracket.start <= repeat.end &&
          bracket.end <= repeat.end) ||
        bracket.start === previousEnd + 1
      ) {
        if (!bracket.repeat) bracket.repeat = repeat;
        previousEnd = bracket.end;
      }
    }
  }
  return { repeats, endings };
}

function targetMarker(
  bars: readonly BarPerformance[],
  marker: "segno" | "coda",
  label: string,
  from: number,
) {
  const matches = bars
    .map((bar, index) => ({ value: bar[marker], index }))
    .filter(
      ({ value, index }) =>
        value !== undefined &&
        (marker === "segno" ? index <= from : index > from),
    );
  const exact = matches.filter(({ value }) => label !== "" && value === label);
  const candidates = exact.length
    ? exact
    : matches.filter(({ value }) => !label || !value);
  if (candidates.length !== 1) throw new Error("unsupportedNotation");
  return candidates[0].index;
}

function visitOrder(bars: readonly BarPerformance[], options: ScoreOptions) {
  const { fromBar, toBar } = options;
  if (!options.repeats)
    return Array.from({ length: toBar - fromBar + 1 }, (_, i) => fromBar + i);
  const nav = readNavigation(bars);
  const complete = nav.repeats.filter(
    (rep) => rep.start >= fromBar && rep.end <= toBar,
  );
  const ends = new Map(complete.map((rep) => [rep.end, rep]));
  const atEnding = new Map(
    nav.endings
      .filter((e) => e.repeat && complete.includes(e.repeat))
      .map((e) => [e.start, e]),
  );
  const passes = new Map<Repeat, number>();
  const played: number[] = [];
  let index = fromBar,
    returned = false,
    jumpedCoda = false;
  const maxVisits = Math.max(
    MAX_PLAYBACK_BARS,
    (toBar - fromBar + 1) * MAX_SCORE_REPEAT_PASSES,
  );
  while (index <= toBar) {
    if (played.length >= maxVisits) throw new Error("tooLong");
    const bracket = atEnding.get(index);
    if (bracket?.repeat) {
      const pass = returned
        ? bracket.repeat.count
        : (passes.get(bracket.repeat) ?? 1);
      if (!bracket.passes.includes(pass)) {
        index = bracket.end + 1;
        continue;
      }
    }
    played.push(index);
    const bar = bars[index];
    if (returned && bar.fine) break;
    if (returned && !jumpedCoda && bar.toCoda !== undefined) {
      const to = targetMarker(bars, "coda", bar.toCoda, index);
      if (to <= toBar) {
        jumpedCoda = true;
        index = to;
        continue;
      }
    }
    const repeat = ends.get(index);
    if (repeat && !returned) {
      const pass = passes.get(repeat) ?? 1;
      if (pass < repeat.count) {
        passes.set(repeat, pass + 1);
        for (const inner of complete)
          if (
            inner !== repeat &&
            inner.start >= repeat.start &&
            inner.end < repeat.end
          )
            passes.delete(inner);
        index = repeat.start;
        continue;
      }
    }
    if (!returned && (bar.daCapo || bar.dalSegno !== undefined)) {
      const to = bar.daCapo
        ? 0
        : targetMarker(bars, "segno", bar.dalSegno!, index);
      if (to >= fromBar && to <= toBar) {
        returned = true;
        index = to;
        continue;
      }
    }
    index++;
  }
  return played;
}

function barClock(
  bar: ImportedBar,
  marks: readonly TempoMark[],
  initialBpm: number,
  speed: number,
) {
  const points = [{ beat: 0, seconds: 0, bpm: initialBpm }];
  // Sound tempo has precedence over a visual metronome mark at the same position.
  const ordered = [...marks].sort(
    (a, b) => a.at - b.at || Number(a.explicit) - Number(b.explicit),
  );
  for (const mark of ordered) {
    if (
      !Number.isFinite(mark.at) ||
      mark.at < -EPS ||
      mark.at > bar.duration + EPS
    )
      throw new Error("unsupportedNotation");
    const last = points.at(-1)!;
    const at = Math.min(bar.duration, Math.max(0, mark.at));
    if (Math.abs(at - last.beat) < EPS) last.bpm = mark.bpm;
    else
      points.push({
        beat: at,
        seconds: last.seconds + ((at - last.beat) * 60) / (last.bpm * speed),
        bpm: mark.bpm,
      });
  }
  const seconds = (beat: number) => {
    let left = 0,
      right = points.length;
    while (left + 1 < right) {
      const middle = Math.floor((left + right) / 2);
      if (points[middle].beat <= beat + EPS) left = middle;
      else right = middle;
    }
    const point = points[left];
    return point.seconds + ((beat - point.beat) * 60) / (point.bpm * speed);
  };
  return { points, seconds, begin: points[0].bpm, end: points.at(-1)!.bpm };
}

function pulseLength(meter: ImportedBar["meter"]) {
  const compound =
    meter.beats > 3 && meter.beats % 3 === 0 && meter.beatType >= 8;
  return (4 / meter.beatType) * (compound ? 3 : 1);
}

function tieTypes(head: ImportedHead) {
  const sound = elements(head.source, "tie");
  const marks = sound.length
    ? sound
    : elements(head.source, "notations").flatMap((n) => elements(n, "tied"));
  return new Set(marks.map((mark) => mark.getAttribute("type")));
}

export function prepareScore(
  score: ImportedScore,
  laneId: string,
  options: ScoreOptions,
): ImportedTimeline {
  const lane = score.lanes.find((item) => item.id === laneId);
  const { fromBar, toBar, semitones, speed } = options;
  if (
    !lane ||
    !Number.isInteger(fromBar) ||
    !Number.isInteger(toBar) ||
    fromBar < 0 ||
    toBar < fromBar ||
    toBar >= lane.bars.length ||
    !Number.isInteger(semitones) ||
    !Number.isFinite(speed) ||
    speed <= 0
  )
    throw new Error("invalidRange");
  if (
    score.issues.some(
      (issue) =>
        issue.blocksPractice &&
        (!issue.partId || issue.partId === lane.partId) &&
        (!issue.staff || issue.staff === lane.staff) &&
        (!issue.voice || issue.voice === lane.voice) &&
        (issue.barIndex === undefined ||
          (issue.barIndex >= fromBar && issue.barIndex <= toBar)),
    )
  )
    throw new Error("unsupportedNotation");
  const marks = playbackBars(score).slice(0, lane.bars.length);
  const order = visitOrder(marks, options);
  let bpm = 72;
  let previousBar = -1;
  const entryTempo = new Map<number, number>();
  const clockForVisit = (index: number) => {
    // A return restores the tempo at its destination. Forward skips carry the
    // tempo the player actually heard, bypassing changes in unplayed endings.
    if (index <= previousBar) bpm = entryTempo.get(index) ?? bpm;
    entryTempo.set(index, bpm);
    const clock = barClock(lane.bars[index], marks[index].tempos, bpm, speed);
    bpm = clock.end;
    previousBar = index;
    return clock;
  };
  if (fromBar > 0) {
    const beforeRange = visitOrder(marks, {
      ...options,
      fromBar: 0,
      toBar: fromBar - 1,
    });
    for (const index of beforeRange) clockForVisit(index);
  }
  let countInTempo = bpm;
  const targets: ImportedTarget[] = [];
  const beatCues: NonNullable<ImportedTimeline["beatCues"]> = [];
  const notes: ImportedTimeline["notes"] = [];
  const ties = new Map<number, (typeof notes)[number]>();
  const visits: { barIndex: number; startSec: number; endSec: number }[] = [];
  const written: NonNullable<ImportedTimeline["cursor"]> = [];
  const tempoSpans: NonNullable<ImportedTimeline["tempoSpans"]> = [];
  let durationSec = 0;
  for (const [occurrence, index] of order.entries()) {
    const bar = lane.bars[index],
      clock = clockForVisit(index);
    if (occurrence === 0) countInTempo = clock.begin;
    if (index !== order[occurrence - 1] + 1) ties.clear();
    const at = (beat: number) => durationSec + clock.seconds(beat);
    for (const [i, point] of clock.points.entries()) {
      const endBeat = clock.points[i + 1]?.beat ?? bar.duration;
      if (endBeat > point.beat)
        tempoSpans.push({
          barIndex: index,
          startBeat: point.beat,
          startSec: durationSec + point.seconds,
          endSec: at(endBeat),
          quartersPerSecond: (point.bpm * speed) / 60,
        });
    }
    if (options.metronome || options.barBell) {
      const pulse = pulseLength(bar.meter);
      const pickup =
        index === 0 &&
        bar.duration + EPS < (bar.meter.beats * 4) / bar.meter.beatType;
      if (options.metronome) {
        const count = Math.ceil((bar.duration - EPS) / pulse);
        if (beatCues.length + count > 250000) throw new Error("tooLong");
        // The end of an upbeat meets the downbeat of the first full bar.
        const remainder = pickup ? bar.duration % pulse : 0;
        const first =
          remainder < EPS || pulse - remainder < EPS ? 0 : remainder;
        for (let i = 0; i < count; i++) {
          const beat = first + i * pulse;
          if (beat >= bar.duration - EPS) break;
          beatCues.push({
            timeSec: at(beat),
            kind: i === 0 && options.barBell && !pickup ? "bar" : "beat",
          });
        }
      } else if (!pickup) beatCues.push({ timeSec: at(0), kind: "bar" });
    }
    const append = (
      eventId: string,
      start: number,
      end: number,
      midis: number[],
      tieContinuation = false,
    ) => {
      if (end <= start + EPS) return;
      const sorted = [...new Set(midis)].sort((a, b) => a - b);
      const last = targets.at(-1);
      if (
        tieContinuation &&
        last &&
        Math.abs(last.endSec - at(start)) < EPS &&
        last.midis.length === sorted.length &&
        last.midis.every((midi, i) => midi === sorted[i])
      ) {
        last.endSec = at(end);
        return;
      }
      targets.push({
        id: `${occurrence}/${eventId}/${targets.length}`,
        eventId,
        barIndex: index,
        startSec: at(start),
        endSec: at(end),
        midis: sorted,
      });
    };
    let cursor = 0;
    for (const event of bar.events) {
      if (event.start > cursor + EPS) {
        append("rest", cursor, event.start, []);
        ties.clear();
      }
      const onset = at(event.start);
      written.push({
        barIndex: index,
        eventId: event.id,
        startSec: onset,
        endSec: at(event.start + event.duration),
      });
      let allTied = event.heads.length > 0;
      for (const head of event.heads) {
        const midi = head.midi + semitones;
        if (!Number.isInteger(midi) || midi < 0 || midi > 127)
          throw new Error("invalidRange");
        const types = tieTypes(head);
        const from = ties.get(midi);
        const endSec = at(event.start + head.duration);
        const continued =
          !!from &&
          Math.abs(from.endSec - onset) < EPS &&
          (types.has("stop") || types.has("continue"));
        const sound = continued ? from : { midi, startSec: onset, endSec };
        sound.endSec = endSec;
        if (!continued) notes.push(sound);
        allTied &&= continued;
        if (types.has("start") || types.has("continue")) ties.set(midi, sound);
        else ties.delete(midi);
      }
      const offsets = [
        ...new Set([0, event.duration, ...event.heads.map((h) => h.duration)]),
      ].sort((a, b) => a - b);
      for (let i = 0; i < offsets.length - 1; i++) {
        const sounding = event.heads
          .filter((head) => head.duration > offsets[i] + EPS)
          .map((head) => head.midi + semitones);
        append(
          event.id,
          event.start + offsets[i],
          event.start + offsets[i + 1],
          sounding,
          i === 0 && allTied,
        );
      }
      cursor = event.start + event.duration;
    }
    append("rest", cursor, bar.duration, []);
    const end = at(bar.duration);
    visits.push({ barIndex: index, startSec: durationSec, endSec: end });
    durationSec = end;
  }
  if (!notes.length) throw new Error("noNotes");
  const meter = lane.bars[order[0]].meter;
  const pulse = pulseLength(meter);
  const countIn = {
    pulses: Math.min(
      MAX_COUNT_IN_PULSES,
      (meter.beats * 4) / (meter.beatType * pulse),
    ),
    pulseSec: (pulse * 60) / (countInTempo * speed),
  };
  if (!Number.isFinite(durationSec) || !Number.isFinite(countIn.pulseSec))
    throw new Error("tooLong");
  return {
    targets,
    notes,
    durationSec,
    countIn,
    visits,
    cursor: written,
    tempoSpans,
    sourceBpm: countInTempo,
    beatCues,
  };
}
