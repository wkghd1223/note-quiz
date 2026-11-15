import { beatsPerMeasure } from "./stage";
import type {
  BarNavigation,
  PlaybackDirection,
  ExerciseDefinition,
} from "./stage";
import type { PlaybackJumpKind } from "./performance";

/** Authoring subset: nonnested repeats (2–8 total passes), one D.C./D.S.
 * instruction, no alternate endings. Return instructions execute once; ordinary
 * repeats are ignored afterwards. Expansion beyond 256 performed bars rejects
 * rather than truncating a score or allowing an unbounded loop.
 */
export const MAX_PLAYBACK_BARS = 256;
export const MAX_REPEAT_PASSES = 8;
export interface PlaybackBarVisit {
  sourceBarIndex: number;
  /** One-based visit to this written bar. */
  visit: number;
  occurrenceIndex: number;
  /** Performed beats, including unscored rewind gaps. */
  startBeat: number;
  endBeat: number;
}
export interface PlaybackBeatTransition {
  startBeat: number;
  endBeat: number;
  fromBar: number;
  toBar: number;
  kind: PlaybackJumpKind;
}
export interface PlaybackPlan {
  visits: PlaybackBarVisit[];
  transitions: PlaybackBeatTransition[];
  durationBeats: number;
}
const directions = new Set<PlaybackDirection>([
  "segno",
  "coda",
  "fine",
  "toCoda",
  "daCapo",
  "daCapoAlFine",
  "daCapoAlCoda",
  "dalSegno",
  "dalSegnoAlFine",
  "dalSegnoAlCoda",
]);
const isReturn = (direction: PlaybackDirection) =>
  direction.startsWith("daCapo") || direction.startsWith("dalSegno");
interface Repeat {
  start: number;
  end: number;
  passes: number;
}
interface Navigation {
  bars: Map<number, BarNavigation>;
  repeats: Map<number, Repeat>;
  returnInstruction?: {
    bar: number;
    direction: PlaybackDirection;
    target: number;
  };
  coda?: number;
}
function parseNavigation(stage: ExerciseDefinition): Navigation {
  const barBeats = beatsPerMeasure(stage);
  if (!Number.isSafeInteger(stage.measures) || stage.measures < 1)
    throw new Error("invalidNavigationMeasures");
  if (!Array.isArray(stage.barNavigation))
    throw new Error("invalidBarNavigation");
  const bars = new Map<number, BarNavigation>();
  const markers = new Map<PlaybackDirection, number[]>();
  for (const bar of stage.barNavigation) {
    if (
      !bar ||
      typeof bar !== "object" ||
      Object.keys(bar).some(
        (key) =>
          ![
            "barIndex",
            "repeatStart",
            "repeatEnd",
            "repeatCount",
            "directions",
          ].includes(key),
      )
    )
      throw new Error("unsupportedBarNavigationField");
    if (
      !Number.isSafeInteger(bar.barIndex) ||
      bar.barIndex < 0 ||
      bar.barIndex >= stage.measures ||
      bars.has(bar.barIndex)
    )
      throw new Error("invalidNavigationBar");
    if (
      (bar.repeatStart !== undefined && typeof bar.repeatStart !== "boolean") ||
      (bar.repeatEnd !== undefined && typeof bar.repeatEnd !== "boolean")
    )
      throw new Error("invalidRepeatMarker");
    if (
      bar.repeatCount !== undefined &&
      (!Number.isSafeInteger(bar.repeatCount) ||
        bar.repeatCount < 2 ||
        bar.repeatCount > MAX_REPEAT_PASSES ||
        bar.repeatEnd === false)
    )
      throw new Error("invalidRepeatCount");
    if (
      bar.directions !== undefined &&
      (!Array.isArray(bar.directions) ||
        bar.directions.some((direction) => !directions.has(direction)) ||
        new Set(bar.directions).size !== bar.directions.length)
    )
      throw new Error("invalidPlaybackDirection");
    bars.set(bar.barIndex, bar);
    for (const direction of bar.directions ?? [])
      markers.set(direction, [...(markers.get(direction) ?? []), bar.barIndex]);
  }
  for (const direction of ["segno", "coda", "fine", "toCoda"] as const)
    if ((markers.get(direction)?.length ?? 0) > 1)
      throw new Error("ambiguousNavigationTarget");
  const instructions = [...markers.entries()]
    .filter(([direction]) => isReturn(direction))
    .flatMap(([direction, positions]) =>
      positions.map((bar) => ({ bar, direction })),
    );
  if (instructions.length > 1)
    throw new Error("multipleReturnInstructionsUnsupported");
  const instruction = instructions[0];
  const segno = markers.get("segno")?.[0],
    coda = markers.get("coda")?.[0],
    fine = markers.get("fine")?.[0],
    toCoda = markers.get("toCoda")?.[0];
  const target = instruction?.direction.startsWith("dalSegno") ? segno : 0;
  if (instruction && target === undefined) throw new Error("missingSegno");
  if (instruction && target! > instruction.bar)
    throw new Error("returnTargetMustPrecedeInstruction");
  if (
    instruction?.direction.endsWith("AlFine") &&
    (fine === undefined || fine < target!)
  )
    throw new Error("missingOrUnreachableFine");
  if (toCoda !== undefined && coda === undefined)
    throw new Error("missingCoda");
  if (
    instruction?.direction.endsWith("AlCoda") &&
    (toCoda === undefined ||
      coda === undefined ||
      toCoda < target! ||
      coda <= toCoda)
  )
    throw new Error("missingOrUnreachableCoda");
  const repeats = new Map<number, Repeat>();
  let open: number | undefined,
    lastEnd = -1;
  for (const [index, bar] of [...bars.entries()].sort(([a], [b]) => a - b)) {
    if (bar.repeatStart) {
      if (open !== undefined) throw new Error("nestedRepeatsUnsupported");
      open = index;
    }
    if (bar.repeatEnd || bar.repeatCount !== undefined) {
      const start = open ?? 0;
      if (start <= lastEnd) throw new Error("overlappingRepeatsUnsupported");
      repeats.set(index, { start, end: index, passes: bar.repeatCount ?? 2 });
      open = undefined;
      lastEnd = index;
    }
  }
  if (open !== undefined) throw new Error("missingRepeatEnd");
  // Bar navigation currently supports complete bar-local events, not tied notes
  // crossing a jump boundary. Alternate endings are intentionally unsupported.
  if (
    stage.events.some(
      (event) =>
        Math.floor(event.startBeat / barBeats) !==
        Math.floor((event.startBeat + event.durationBeats - 1e-8) / barBeats),
    )
  )
    throw new Error("crossBarNavigationEventUnsupported");
  return {
    bars,
    repeats,
    returnInstruction: instruction
      ? { ...instruction, target: target! }
      : undefined,
    coda,
  };
}
function expand(
  stage: ExerciseDefinition,
  navigation: Navigation,
): PlaybackPlan {
  const barBeats = beatsPerMeasure(stage);
  const visits: PlaybackBarVisit[] = [],
    transitions: PlaybackBeatTransition[] = [];
  const visitCounts = new Map<number, number>(),
    repeatPasses = new Map<number, number>();
  let bar = 0,
    beat = 0,
    returned = false,
    codaTaken = false;
  const jump = (toBar: number, kind: PlaybackJumpKind) => {
    if (toBar <= bar) {
      transitions.push({
        startBeat: beat,
        endBeat: beat + 1,
        fromBar: bar,
        toBar,
        kind,
      });
      beat++;
    }
    bar = toBar;
  };
  while (bar < stage.measures) {
    if (visits.length >= MAX_PLAYBACK_BARS)
      throw new Error("playbackExpansionLimit");
    const visit = (visitCounts.get(bar) ?? 0) + 1;
    visitCounts.set(bar, visit);
    visits.push({
      sourceBarIndex: bar,
      visit,
      occurrenceIndex: visits.length,
      startBeat: beat,
      endBeat: beat + barBeats,
    });
    beat += barBeats;
    const marks = navigation.bars.get(bar)?.directions ?? [];
    const instruction = navigation.returnInstruction;
    if (
      returned &&
      instruction?.direction.endsWith("AlFine") &&
      marks.includes("fine")
    )
      break;
    if (
      returned &&
      !codaTaken &&
      instruction?.direction.endsWith("AlCoda") &&
      marks.includes("toCoda")
    ) {
      codaTaken = true;
      jump(navigation.coda!, "toCoda");
      continue;
    }
    // Conventional teaching policy: repeats are played on the initial traversal
    // only; after a one-shot D.C./D.S. return, ignore all ordinary repeat signs.
    const repeat = navigation.repeats.get(bar);
    if (!returned && repeat) {
      const pass = repeatPasses.get(bar) ?? 1;
      if (pass < repeat.passes) {
        repeatPasses.set(bar, pass + 1);
        jump(repeat.start, "repeat");
        continue;
      }
    }
    if (!returned && instruction?.bar === bar) {
      returned = true;
      jump(
        instruction.target,
        instruction.direction.startsWith("daCapo") ? "daCapo" : "dalSegno",
      );
      continue;
    }
    bar++;
  }
  return { visits, transitions, durationBeats: beat };
}
export function validatePlaybackNavigation(
  stage: ExerciseDefinition,
): string[] {
  try {
    beatsPerMeasure(stage);
    if (stage.barNavigation === undefined) return [];
    const navigation = parseNavigation(stage);
    expand(stage, navigation);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : "invalidBarNavigation"];
  }
}
/** Finite bar order. No navigation preserves a straight traversal. */
export function buildPlaybackPlan(stage: ExerciseDefinition): PlaybackPlan {
  const barBeats = beatsPerMeasure(stage);
  if (!stage.barNavigation?.length) {
    if (stage.barNavigation !== undefined) parseNavigation(stage);
    return {
      visits: Array.from({ length: stage.measures }, (_, bar) => ({
        sourceBarIndex: bar,
        visit: 1,
        occurrenceIndex: bar,
        startBeat: bar * barBeats,
        endBeat: (bar + 1) * barBeats,
      })),
      transitions: [],
      durationBeats: stage.measures * barBeats,
    };
  }
  return expand(stage, parseNavigation(stage));
}
