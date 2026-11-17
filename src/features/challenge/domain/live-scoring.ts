import type { ScoringProfile } from "./instrument-profile";
import { matchingWindowSec } from "./matching";
import type {
  AttemptResult,
  NoteResult,
  PerformanceEvent,
  TargetEvent,
} from "./performance";
import {
  scoreAttempt,
  summarizeAttempt,
  validPerformanceEvent,
} from "./scoring";

interface MatchingGroup {
  targets: TargetEvent[];
  left: number;
  right: number;
  end: number;
  settled: boolean;
}

/** Overlapping onset windows must close together: they can compete for input. */
function matchingGroups(targets: TargetEvent[]): MatchingGroup[] {
  const groups: MatchingGroup[] = [];
  const windows = targets
    .filter((target) => target.kind === "note")
    .map((target) => ({
      target,
      left: target.startAudioSec - matchingWindowSec(target),
      right: target.startAudioSec + matchingWindowSec(target),
    }))
    .sort((a, b) => a.left - b.left);
  for (const window of windows) {
    const previous = groups.at(-1);
    if (previous && window.left <= previous.right + 2e-9) {
      previous.targets.push(window.target);
      previous.right = Math.max(previous.right, window.right);
      previous.end = Math.max(previous.end, window.target.endAudioSec);
    } else
      groups.push({
        targets: [window.target],
        left: window.left,
        right: window.right,
        end: window.target.endAudioSec,
        settled: false,
      });
  }
  for (const group of groups)
    group.targets.sort((a, b) => a.startAudioSec - b.startAudioSec);
  return groups;
}

/**
 * Commit only closed, independent matching windows. A future event cannot
 * compete with a committed input, so the existing global alignment and scoring
 * formulas remain valid without rejudging the visible history.
 */
export class LiveAttemptScorer {
  private groups: MatchingGroup[];
  private notes = new Map<string, NoteResult>();
  private rests = new Map<string, boolean>();
  private result: AttemptResult | null = null;

  constructor(
    private targets: TargetEvent[],
    private profile: ScoringProfile,
    private offsetMs = 0,
  ) {
    this.groups = matchingGroups(targets);
  }

  advance(
    events: PerformanceEvent[],
    finalizedBeforeSec: number,
    elapsedSec: number,
  ): AttemptResult | null {
    let changed = false;
    for (const group of this.groups) {
      if (
        group.settled ||
        group.end > elapsedSec + 1e-9 ||
        group.right + 1e-9 >= finalizedBeforeSec - this.offsetMs / 1000
      )
        continue;
      // Other windows cannot consume these inputs. Retain spanning events too:
      // they supply the existing missingAttack evidence for repeated notes.
      const evaluated = scoreAttempt(
        events,
        group.targets,
        this.profile,
        this.offsetMs,
      );
      for (const note of evaluated.notes)
        this.notes.set(note.stageEventId, note);
      group.settled = true;
      changed = true;
    }
    if (this.profile.required.includes("rest"))
      for (const target of this.targets) {
        if (
          target.kind !== "rest" ||
          this.rests.has(target.stageEventId) ||
          target.endAudioSec > elapsedSec + 1e-9 ||
          target.endAudioSec + 1e-9 >= finalizedBeforeSec - this.offsetMs / 1000
        )
          continue;
        const evaluated = scoreAttempt(
          events,
          [target],
          this.profile,
          this.offsetMs,
        );
        this.rests.set(
          target.stageEventId,
          evaluated.restViolations.includes(target.stageEventId),
        );
        changed = true;
      }
    if (!changed) return this.result;
    return this.summarize(events);
  }

  /** Pause only invalidates the portion that will actually be performed again. */
  rewind(elapsedSec: number): AttemptResult | null {
    for (const group of this.groups) {
      if (group.end <= elapsedSec + 1e-9) continue;
      group.settled = false;
      for (const target of group.targets)
        this.notes.delete(target.stageEventId);
    }
    for (const target of this.targets)
      if (target.endAudioSec > elapsedSec + 1e-9)
        this.rests.delete(target.stageEventId);
    this.result = this.summarize([]);
    return this.result;
  }

  finish(events: PerformanceEvent[]): AttemptResult {
    this.advance(events, Infinity, Infinity);
    // Include malformed extra input even if the last group was already closed.
    return this.summarize(events);
  }

  private summarize(events: PerformanceEvent[]): AttemptResult {
    const result = summarizeAttempt(
      this.targets.flatMap((target) => {
        const note = this.notes.get(target.stageEventId);
        return note ? [note] : [];
      }),
      [...this.rests].filter(([, violated]) => violated).map(([id]) => id),
      this.profile.required.includes("onset"),
      !this.profile.supported ||
        events.some((event) => !validPerformanceEvent(event)),
    );
    this.result = { ...result, settledRestIds: [...this.rests.keys()] };
    return this.result;
  }
}
