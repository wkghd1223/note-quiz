import { describe, expect, it } from "vitest";
import { generateMelody } from "@/features/melody/domain/generator";
import { defaultMelodySettings } from "@/features/melody/domain/settings";
import { getInstrumentProfile, getScoringProfile } from "./instrument-profile";
import { LiveAttemptScorer } from "./live-scoring";
import type { PerformanceEvent, TargetEvent } from "./performance";
import { buildPlaybackTimeline } from "./score-timeline";
import { scoreAttempt } from "./scoring";

const melody = generateMelody(defaultMelodySettings, 1);
const profile = getScoringProfile(melody, "voice");
const targets: TargetEvent[] = [0, 1, 2].map((index) => ({
  stageEventId: `n${index}`,
  targetConcertMidi: 60,
  startAudioSec: index,
  endAudioSec: index + 1,
  kind: "note",
  requiresDistinctAttack: false,
}));
const event = (
  overrides: Partial<PerformanceEvent> = {},
): PerformanceEvent => ({
  eventId: "input",
  inputMethod: "microphone",
  onsetAudioSec: 0,
  offsetAudioSec: 1,
  observedMidi: 60,
  medianCents: 0,
  validPitchRatio: 1,
  confidence: 1,
  attackConfidence: 1,
  ...overrides,
});

describe("committed live judgments", () => {
  it("waits for both the target end and processed input, independent of RAF time", () => {
    const scorer = new LiveAttemptScorer(targets, profile);
    expect(scorer.advance([event()], 1.1, 0.999)).toBeNull();
    expect(scorer.advance([], -Infinity, 10)).toBeNull();
    const committed = scorer.advance([event()], 1.1, 1)!;
    expect(committed.notes).toMatchObject([
      { stageEventId: "n0", status: "passed" },
    ]);
    expect(scorer.advance([event()], 1.2, 1.1)).toBe(committed);
  });

  it("keeps a committed miss visible while later sounds are held", () => {
    const scorer = new LiveAttemptScorer(targets, profile);
    const committed = scorer.advance([], 1.5, 1.5)!;
    expect(committed.notes[0].status).toBe("missed");
    expect(scorer.advance([], 1.5, 1.8)).toBe(committed);
    const later = scorer.advance(
      [event({ eventId: "next", onsetAudioSec: 1.7, offsetAudioSec: 2.2 })],
      2.3,
      2.3,
    )!;
    expect(later.notes[0]).toBe(committed.notes[0]);
    expect(scorer.finish([]).notes[0]).toBe(committed.notes[0]);
  });

  it("leaves a delayed or long open sound pending until its measured offset is known", () => {
    const scorer = new LiveAttemptScorer(targets, profile);
    // Detector progress remains at the open sound's onset even when the UI is ahead.
    expect(scorer.advance([], 0, 2.5)).toBeNull();
    const result = scorer.advance([event({ offsetAudioSec: 2 })], 2.1, 2.5)!;
    expect(result.notes[0]).toMatchObject({
      status: "failed",
      reasons: ["tooLong"],
    });
    expect(result.notes[1].status).toBe("missed");
    expect(scorer.finish([event({ offsetAudioSec: 2 })]).notes[0]).toBe(
      result.notes[0],
    );
  });

  it("does not publish the seed-298 red result that a later input used to turn green", () => {
    const exercise = generateMelody(
      {
        ...defaultMelodySettings,
        durations: [0.5, 2],
        bpm: 60,
        minMidi: 60,
        maxMidi: 64,
      },
      298,
    );
    const timeline = buildPlaybackTimeline(
      exercise,
      getInstrumentProfile("voice")!,
      0,
    ).targets;
    expect(
      timeline
        .slice(0, 3)
        .map((t) => [t.targetConcertMidi, t.startAudioSec, t.endAudioSec]),
    ).toEqual([
      [62, 0, 0.5],
      [64, 0.5, 1],
      [60, 1, 3],
    ]);
    const inputs = [
      event({
        eventId: "e0",
        onsetAudioSec: 0.4,
        offsetAudioSec: 0.51,
        observedMidi: 64,
      }),
      event({
        eventId: "e1",
        onsetAudioSec: 0.59,
        offsetAudioSec: 1.09,
        observedMidi: 64,
      }),
      event({
        eventId: "e2",
        onsetAudioSec: 1.31,
        offsetAudioSec: 1.48,
        observedMidi: 62,
      }),
    ];
    const scoring = getScoringProfile(exercise, "voice");
    expect(
      scoreAttempt(inputs.slice(0, 2), timeline, scoring).notes[1].status,
    ).toBe("failed");
    expect(scoreAttempt(inputs, timeline, scoring).notes[1].status).toBe(
      "passed",
    );
    const scorer = new LiveAttemptScorer(timeline, scoring);
    expect(
      scorer
        .advance(inputs.slice(0, 2), 1.2, 1.2)
        ?.notes.some((n) => n.stageEventId === timeline[1].stageEventId),
    ).toBe(false);
    const committed = scorer.advance(inputs, 3.1, 3.1)!;
    expect(committed.notes[1]).toMatchObject({
      eventId: "e1",
      status: "passed",
    });
    expect(scorer.finish(inputs).notes[1]).toBe(committed.notes[1]);
  });

  it("keeps final scoring equal to the existing whole-attempt formulas", () => {
    for (let seed = 1; seed <= 24; seed++) {
      const exercise = generateMelody(
        {
          ...defaultMelodySettings,
          durations: [0.25, 0.5, 1, 2],
          bpm: 96,
          dotted: true,
          triplets: true,
        },
        seed,
      );
      const timeline = buildPlaybackTimeline(
        exercise,
        getInstrumentProfile("voice")!,
        0,
      ).targets;
      const scoring = getScoringProfile(exercise, "voice");
      const inputs = timeline
        .filter((t, index) => t.kind === "note" && index % 7 !== seed % 7)
        .map((target, index) =>
          event({
            eventId: `event-${index}`,
            onsetAudioSec: target.startAudioSec + (index % 3) * 0.04,
            offsetAudioSec: target.endAudioSec + (index % 3) * 0.04,
            observedMidi: target.targetConcertMidi! + (index % 5 === 0 ? 2 : 0),
          }),
        );
      const scorer = new LiveAttemptScorer(timeline, scoring, 30);
      for (let now = 0; now < timeline.at(-1)!.endAudioSec + 1; now += 0.1) {
        const delivered = inputs.filter(
          (input) => input.offsetAudioSec! <= now,
        );
        const open = inputs.find(
          (input) => input.onsetAudioSec <= now && input.offsetAudioSec! > now,
        );
        scorer.advance(delivered, open?.onsetAudioSec ?? now, now);
      }
      const { settledRestIds, ...result } = scorer.finish(inputs);
      expect(settledRestIds).toEqual(
        timeline.filter((t) => t.kind === "rest").map((t) => t.stageEventId),
      );
      expect(result).toEqual(scoreAttempt(inputs, timeline, scoring, 30));
    }
  });

  it("does not award two repeated notes for one continuous sound", () => {
    const scorer = new LiveAttemptScorer(targets, profile);
    const result = scorer.finish([event({ offsetAudioSec: 2 })]);
    expect(result.notes.map((n) => n.status)).toEqual([
      "failed",
      "missed",
      "missed",
    ]);
  });

  it("retains uncertainty in the pitch denominator and preserves the 75% boundary", () => {
    for (const correct of [2, 3]) {
      const scorer = new LiveAttemptScorer(targets, profile);
      const input = event({
        pitchSamples: Array.from({ length: 4 }, (_, index) => ({
          audioTimeSec: index / 4,
          midi: index < correct ? 60 : null,
          cents: index < correct ? 0 : null,
          confidence: index < correct ? 1 : 0,
        })),
      });
      expect(scorer.finish([input]).notes[0]).toMatchObject({
        pitchScore: correct * 25,
        pitchPass: correct === 3,
      });
    }
  });

  it("waits for a rest's crossing sound before publishing its immutable color", () => {
    const rest = {
      ...targets[1],
      kind: "rest" as const,
      targetConcertMidi: null,
    };
    const scorer = new LiveAttemptScorer(
      [targets[0], rest, targets[2]],
      profile,
    );
    const pending = scorer.advance([], 0.9, 2.5)!;
    expect(pending.settledRestIds).toEqual([]);
    const crossed = event({ onsetAudioSec: 0.9, offsetAudioSec: 2.1 });
    const settled = scorer.advance([crossed], 2.2, 2.5)!;
    expect(settled.settledRestIds).toEqual([rest.stageEventId]);
    expect(settled.restViolations).toEqual([rest.stageEventId]);
    expect(scorer.finish([crossed]).restViolations).toEqual(
      settled.restViolations,
    );
  });

  it("rewinds only future judgments and reuses prior committed records", () => {
    const scorer = new LiveAttemptScorer(targets, profile);
    const inputs = targets.map((target, index) =>
      event({
        eventId: `e${index}`,
        onsetAudioSec: index,
        offsetAudioSec: index + 1,
      }),
    );
    const before = scorer.advance(inputs, 3.1, 3.1)!;
    const rewound = scorer.rewind(1)!;
    expect(rewound.notes).toEqual([before.notes[0]]);
    expect(rewound.notes[0]).toBe(before.notes[0]);
    expect(
      scorer.finish(inputs.slice(0, 1)).notes.map((n) => n.status),
    ).toEqual(["passed", "missed", "missed"]);
  });
});
