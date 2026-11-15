import { describe, it, expect } from "vitest";
import {
  emptyProgress,
  readProgress,
  saveProgress,
  recordAttempt,
  recordKey,
  isStageUnlocked,
  PROGRESS_KEY,
  type StorageLike,
} from "./progress";
import { scoreAttempt } from "../domain/scoring";
import { getScoringProfile } from "../domain/instrument-profile";
import { getStage } from "../data/stages";
const storage = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
};
const result = () =>
  scoreAttempt(
    [
      {
        eventId: "p",
        inputMethod: "touch",
        onsetAudioSec: 0,
        offsetAudioSec: 4,
        observedMidi: 60,
        medianCents: 0,
        validPitchRatio: 1,
        confidence: 1,
        attackConfidence: 1,
      },
    ],
    [
      {
        stageEventId: "w1-s1-e1",
        kind: "note",
        targetConcertMidi: 60,
        startAudioSec: 0,
        endAudioSec: 4,
        requiresDistinctAttack: false,
      },
    ],
    getScoringProfile(getStage("w1-s1")!, "touch-keyboard"),
  );
const attempt = () => ({
  stageId: "w1-s1",
  profileId: "touch-keyboard",
  inputMethod: "touch" as const,
  mode: "challenge" as "challenge" | "rehearsal",
  result: result(),
  completedAt: "2026-11-14T00:00:00.000Z",
});
describe("versioned local-only challenge progress", () => {
  it("round trips only summary records", () => {
    const s = storage(),
      progress = recordAttempt(emptyProgress(), attempt());
    expect(saveProgress(progress, s)).toBeNull();
    expect(readProgress(s)).toEqual({ progress, warning: null });
    expect(s.data.get(PROGRESS_KEY)).not.toContain("pitchSamples");
    expect(s.data.get(PROGRESS_KEY)).not.toContain("eventId");
  });
  it("rehearsal NEVER changes official records or unlocks", () => {
    const p = emptyProgress();
    expect(recordAttempt(p, { ...attempt(), mode: "rehearsal" })).toBe(p);
    expect(isStageUnlocked("w1-s2", p)).toBe(false);
  });
  it("records are input/profile/version isolated, unlock is profile-independent", () => {
    let p = recordAttempt(emptyProgress(), attempt());
    p = recordAttempt(p, {
      ...attempt(),
      profileId: "voice",
      inputMethod: "microphone",
    });
    expect(Object.keys(p.records)).toHaveLength(2);
    expect(isStageUnlocked("w1-s2", p, "flute", "microphone")).toBe(true);
    expect(p.records[recordKey("w1-s1", "voice", "microphone")].bestStars).toBe(
      3,
    );
  });
  it("lower retry cannot reduce best score or stars", () => {
    let p = recordAttempt(emptyProgress(), attempt());
    p = recordAttempt(p, {
      ...attempt(),
      result: { ...result(), score: 40, stars: 0, cleared: false },
    });
    const r = Object.values(p.records)[0];
    expect(r).toMatchObject({ bestScore: 100, bestStars: 3, attempts: 2 });
  });
  it.each([
    "{broken",
    JSON.stringify({ version: 2 }),
    JSON.stringify({
      ...emptyProgress(),
      settings: { inputOffsetMs: Infinity },
    }),
  ])("preserves unreadable data until explicit reset %s", (raw) => {
    const s = storage();
    s.setItem(PROGRESS_KEY, raw);
    expect(readProgress(s).warning).not.toBeNull();
    expect(saveProgress(emptyProgress(), s)).not.toBeNull();
    expect(s.getItem(PROGRESS_KEY)).toBe(raw);
    expect(saveProgress(emptyProgress(), s, true)).toBeNull();
    expect(readProgress(s).warning).toBeNull();
  });
  it("blocked storage reports warning while in-memory progress still works", () => {
    const s: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const read = readProgress(s);
    expect(read.warning).toBe("unavailable");
    const next = recordAttempt(read.progress, attempt());
    expect(Object.keys(next.records)).toHaveLength(1);
    expect(saveProgress(next, s)).toBe("unavailable");
  });
  it("unscorable/unsupported observations do not unlock or create a record", () => {
    const p = emptyProgress();
    expect(
      recordAttempt(p, {
        ...attempt(),
        result: { ...result(), unscorable: true },
      }),
    ).toBe(p);
    expect(
      recordAttempt(p, {
        ...attempt(),
        profileId: "piano-mic",
        inputMethod: "microphone",
      }),
    ).toBe(p);
    expect(isStageUnlocked("missing", p)).toBe(false);
  });
  it("invalid persisted official record is not silently sanitized and overwritten", () => {
    const s = storage(),
      p = recordAttempt(emptyProgress(), attempt());
    Object.values(p.records)[0].bestScore = 999;
    s.setItem(PROGRESS_KEY, JSON.stringify(p));
    expect(readProgress(s).warning).toBe("corrupt");
    expect(saveProgress(emptyProgress(), s)).toBe("corrupt");
  });
});
