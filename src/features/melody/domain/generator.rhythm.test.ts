import { describe, expect, it } from "vitest";
import {
  beatsPerMeasure,
  type StageEvent,
} from "@/features/challenge/domain/stage";
import { generateMelody, MELODY_TICKS_PER_BEAT } from "./generator";
import {
  defaultMelodySettings,
  melodyTimeSignatures,
  validateMelodySettings,
} from "./settings";

const palettes = Array.from({ length: 31 }, (_, mask) =>
  [0.25, 0.5, 1, 2, 4].filter((_, index) => (mask + 1) & (1 << index)),
);
const ticks = (value: number) => {
  expect(value * MELODY_TICKS_PER_BEAT).toBeCloseTo(
    Math.round(value * MELODY_TICKS_PER_BEAT),
    8,
  );
  return Math.round(value * MELODY_TICKS_PER_BEAT);
};
describe("meter-aware generated rhythms", () => {
  it.each(melodyTimeSignatures)(
    "covers eight complete %i/%i bars for every palette and rhythm option",
    (n, d) => {
      for (const durations of palettes)
        for (const dotted of [false, true])
          for (const triplets of [false, true])
            for (const seed of [0, 7, -123]) {
              const settings = {
                ...defaultMelodySettings,
                durations,
                dotted,
                triplets,
                bpm: 40,
                timeSignature: [n, d] as [number, number],
              };
              const valid = validateMelodySettings(settings);
              if (!valid.valid) {
                if (durations.every((duration) => duration === 4)) {
                  expect(n / d).toBeLessThan(1);
                  expect(triplets).toBe(false);
                  expect(valid.errors).toEqual(["noFittingNotes"]);
                } else
                  throw new Error(
                    `Unexpected invalid settings: ${valid.errors.join(",")}`,
                  );
                continue;
              }
              const exercise = generateMelody(settings, seed);
              const perBar = beatsPerMeasure(exercise) * MELODY_TICKS_PER_BEAT;
              const totals = Array(8).fill(0);
              const groups = new Map<string, StageEvent[]>();
              let cursor = 0;
              for (const [index, event] of exercise.events.entries()) {
                const start = ticks(event.startBeat),
                  length = ticks(event.durationBeats);
                expect(start).toBe(cursor);
                expect((start % perBar) + length).toBeLessThanOrEqual(perBar);
                totals[Math.floor(start / perBar)] += length;
                cursor += length;
                const base = 4 / event.noteValue!;
                const ratio = event.tuplet ? 2 / 3 : 1;
                expect(event.durationBeats).toBeCloseTo(
                  base * (event.dots ? 1.5 : 1) * ratio,
                  12,
                );
                if (event.kind === "note") {
                  expect(event.writtenMidi).toBeGreaterThanOrEqual(
                    settings.minMidi,
                  );
                  expect(event.writtenMidi).toBeLessThanOrEqual(
                    settings.maxMidi,
                  );
                  if (event.tuplet) {
                    expect(triplets).toBe(true);
                    expect(event.noteValue).toBe(8);
                    expect(event.dots).toBe(0);
                    const group = groups.get(event.tuplet.groupId) ?? [];
                    group.push(event);
                    groups.set(event.tuplet.groupId, group);
                  } else {
                    expect(durations).toContain(base);
                    if (event.dots) expect(dotted).toBe(true);
                  }
                } else {
                  expect(event.tuplet).toBeUndefined();
                  for (const neighbor of [
                    exercise.events[index - 1],
                    exercise.events[index + 1],
                  ]) {
                    expect(neighbor).toBeDefined();
                    if (neighbor.kind === "rest")
                      expect(
                        Math.floor(ticks(neighbor.startBeat) / perBar),
                      ).not.toBe(Math.floor(start / perBar));
                  }
                }
              }
              for (const group of groups.values()) {
                expect(group).toHaveLength(3);
                expect(ticks(group[0].startBeat) % 24).toBe(0);
                expect(
                  group.map((event) => ticks(event.durationBeats)),
                ).toEqual([8, 8, 8]);
                expect(
                  ticks(group[2].startBeat + group[2].durationBeats) -
                    ticks(group[0].startBeat),
                ).toBe(24);
                expect(
                  new Set(
                    group.map((event) =>
                      Math.floor(ticks(event.startBeat) / perBar),
                    ),
                  ).size,
                ).toBe(1);
              }
              expect(totals).toEqual(Array(8).fill(perBar));
              expect(cursor).toBe(perBar * 8);
              expect(exercise.bpm).toBe(40);
              expect(exercise.events[0]).toMatchObject({
                kind: "note",
                startBeat: 0,
              });
              expect(exercise.events.at(-1)?.kind).toBe("note");
              expect(
                exercise.events.some((event) => event.kind === "rest"),
              ).toBe(true);
              expect(exercise.barNavigation).toBeUndefined();
            }
    },
    20000,
  );
  it("changes deterministic identity for tempo, meter, dotted notes and triplets", () => {
    const baseline = generateMelody(defaultMelodySettings, 9);
    for (const patch of [
      { bpm: 80 },
      { timeSignature: [3, 4] as [number, number] },
      { dotted: true },
      { triplets: true },
    ]) {
      const settings = {
        ...defaultMelodySettings,
        ...patch,
        bpm: patch.triplets ? 40 : (patch.bpm ?? 72),
      };
      expect(generateMelody(settings, 9).id).not.toBe(baseline.id);
      expect(generateMelody(settings, 9)).toEqual(generateMelody(settings, 9));
    }
  });
  it("actually generates selected dotted eighths and complete eighth triplets", () => {
    const notes = Array.from(
      { length: 8 },
      (_, seed) =>
        generateMelody(
          {
            ...defaultMelodySettings,
            durations: [0.5],
            dotted: true,
            triplets: true,
            bpm: 40,
          },
          seed,
        ).events,
    )
      .flat()
      .filter((event) => event.kind === "note");
    expect(
      notes.some((event) => event.noteValue === 8 && event.dots === 1),
    ).toBe(true);
    expect(
      notes.some(
        (event) => event.noteValue === 8 && event.tuplet?.numerator === 3,
      ),
    ).toBe(true);
  });
  it("keeps half-only 3/4 musically valid and allows adjacent written rests across bars", () => {
    const exercise = generateMelody(
      { ...defaultMelodySettings, timeSignature: [3, 4], durations: [2] },
      1,
    );
    expect(
      exercise.events
        .filter((event) => event.kind === "note")
        .every((event) => event.noteValue === 2 && event.durationBeats === 2),
    ).toBe(true);
    expect(
      exercise.events
        .filter((event) => event.kind === "rest")
        .every((event) => event.durationBeats === 1),
    ).toBe(true);
    expect(exercise.events[0]).toMatchObject({ kind: "note", startBeat: 0 });
    expect(exercise.events.at(-1)?.kind).toBe("note");
    expect(
      exercise.events.some(
        (event, index) =>
          event.kind === "rest" && exercise.events[index + 1]?.kind === "rest",
      ),
    ).toBe(true);
  });
});
