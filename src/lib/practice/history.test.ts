import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig, serializePracticeConfig } from "./config";
import {
  HISTORY_KEY,
  HISTORY_LIMIT,
  RETENTION_MS,
  appendHistory,
  browserLearningStorage,
  emptyLearningData,
  readLearningData,
  sanitizeLearningData,
  weakestAreas,
  writeLearningData,
  type HistoryEntry,
  type LearningStorage,
} from "./history";
afterEach(() => vi.unstubAllGlobals());

const now = Date.parse("2026-10-31T12:00:00Z");
const configuration = serializePracticeConfig(
  defaultConfig("interval", "basic"),
);
function entry(change: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    at: now,
    mode: "interval",
    kind: "practice",
    difficulty: "basic",
    total: 10,
    correct: 6,
    elapsedMs: 15000,
    completed: true,
    categories: [
      { id: "M3", total: 6, correct: 2 },
      { id: "P5", total: 4, correct: 4 },
    ],
    configuration,
    ...change,
  };
}
function memory(initial?: string): LearningStorage {
  const values = new Map<string, string>(
    initial ? [[HISTORY_KEY, initial]] : [],
  );
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

describe("bounded local session history", () => {
  it("keeps the newest sixty sessions in chronological order", () => {
    const data = sanitizeLearningData(
      {
        version: 1,
        sessions: Array.from({ length: 90 }, (_, index) =>
          entry({ at: now - (90 - index) * 1000 }),
        ),
        daily: {},
      },
      now,
    );
    expect(data.sessions).toHaveLength(HISTORY_LIMIT);
    expect(data.sessions[0].at).toBe(now - 60000);
    expect(data.sessions.at(-1)?.at).toBe(now - 1000);
  });
  it("removes records older than thirty days and impossible future timestamps", () => {
    const data = sanitizeLearningData(
      {
        version: 1,
        sessions: [
          entry({ at: now - RETENTION_MS - 1 }),
          entry({ at: now - RETENTION_MS }),
          entry({ at: now + 60001 }),
          entry(),
        ],
        daily: {},
      },
      now,
    );
    expect(data.sessions.map((value) => value.at)).toEqual([
      now - RETENTION_MS,
      now,
    ]);
  });
  it("preserves summaries while stripping raw answers, audio and identifiers", () => {
    const dirty = {
      ...entry(),
      answers: [{ expected: "C4", actual: "D4" }],
      audio: "raw-audio",
      sessionId: "private",
      userId: "private",
      ip: "private",
      categories: [
        {
          id: "M3",
          total: 6,
          correct: 2,
          answers: ["C4"],
          identifier: "private",
        },
      ],
    };
    const data = sanitizeLearningData(
      { version: 1, sessions: [dirty], daily: {}, person: "private" },
      now,
    );
    expect(data.sessions).toHaveLength(1);
    expect(Object.keys(data.sessions[0]).sort()).toEqual(
      [
        "at",
        "mode",
        "kind",
        "difficulty",
        "total",
        "correct",
        "elapsedMs",
        "completed",
        "categories",
        "configuration",
      ].sort(),
    );
    expect(data.sessions[0].categories).toEqual([
      { id: "M3", total: 6, correct: 2 },
    ]);
    expect(JSON.stringify(data)).not.toMatch(
      /raw-audio|private|answers|expected|actual|identifier/,
    );
  });
  it.each([
    { total: -1 },
    { total: 151 },
    { total: 1.5 },
    { correct: 11 },
    { correct: NaN },
    { elapsedMs: Infinity },
    { completed: "yes" },
    { mode: "unknown" },
    { kind: "competition" },
    { difficulty: "expert" },
  ])("rejects malformed summary %j", (change) => {
    const data = sanitizeLearningData(
      {
        version: 1,
        sessions: [entry(change as Partial<HistoryEntry>)],
        daily: {},
      },
      now,
    );
    expect(data.sessions).toEqual([]);
  });
  it("rejects configuration/summary mismatches instead of comparing unlike levels", () => {
    const data = sanitizeLearningData(
      {
        version: 1,
        sessions: [
          entry({ mode: "chord" }),
          entry({ difficulty: "advanced" }),
          entry({ configuration: "mode=interval&level=basic&above=999" }),
        ],
        daily: {},
      },
      now,
    );
    expect(data.sessions).toEqual([]);
  });
  it("drops corrupt categories that exceed their session evidence", () => {
    const data = sanitizeLearningData(
      {
        version: 1,
        sessions: [
          entry({
            categories: [
              { id: "M3", total: 100, correct: 80 },
              { id: "P5", total: 8, correct: 7 },
              { id: "M2", total: 5, correct: 2 },
            ],
          }),
        ],
        daily: {},
      },
      now,
    );
    expect(data.sessions[0].categories).toEqual([
      { id: "M2", total: 5, correct: 2 },
    ]);
  });
  it("does not import unknown schema versions or arbitrary objects", () => {
    for (const value of [
      null,
      [],
      { version: 2, sessions: [entry()], daily: {} },
      { version: "1" },
      { version: 1, sessions: "bad", daily: [] },
    ])
      expect(sanitizeLearningData(value, now)).toEqual(emptyLearningData());
  });
});

describe("daily exercise completion", () => {
  const key = "2026-10-31:interval:basic";
  it("stores completion once and never appends a duplicate daily completion", () => {
    const first = appendHistory(
      emptyLearningData(),
      entry({ kind: "daily" }),
      key,
      now,
    );
    expect(first.daily[key]).toBe(true);
    expect(first.sessions).toHaveLength(1);
    const repeated = appendHistory(
      first,
      entry({ kind: "daily", at: now + 1000 }),
      key,
      now + 1000,
    );
    expect(repeated.sessions).toHaveLength(1);
    expect(repeated.daily[key]).toBe(true);
  });
  it("does not mark an interrupted daily exercise complete or mark review as daily", () => {
    const incomplete = appendHistory(
      emptyLearningData(),
      entry({
        kind: "daily",
        completed: false,
        total: 3,
        correct: 2,
        categories: [],
      }),
      key,
      now,
    );
    expect(incomplete.daily[key]).toBeUndefined();
    const review = appendHistory(
      incomplete,
      entry({ kind: "review" }),
      key,
      now,
    );
    expect(review.daily[key]).toBeUndefined();
    const complete = appendHistory(review, entry({ kind: "daily" }), key, now);
    expect(complete.daily[key]).toBe(true);
  });
  it("accepts only real, current, bounded UTC date keys", () => {
    const data = sanitizeLearningData(
      {
        version: 1,
        sessions: [],
        daily: {
          [key]: true,
          "2026-10-30:chord:advanced": true,
          "2026-02-31:interval:basic": true,
          "2026-11-01:interval:basic": true,
          "2026-01-01:interval:basic": true,
          "2026-10-31:interval:expert": true,
          "2026-10-31:note:basic": false,
          private: true,
        },
      },
      now,
    );
    expect(Object.keys(data.daily).sort()).toEqual(
      ["2026-10-30:chord:advanced", key].sort(),
    );
    const march = Date.parse("2026-03-05T12:00:00Z");
    expect(
      sanitizeLearningData(
        {
          version: 1,
          sessions: [],
          daily: { "2026-02-31:interval:basic": true },
        },
        march,
      ).daily,
    ).toEqual({});
  });
});

describe("storage failure and recovery", () => {
  it("reads and writes a sanitized summary document", () => {
    const storage = memory();
    const data = appendHistory(emptyLearningData(), entry(), undefined, now);
    expect(writeLearningData(data, storage, now)).toBe(true);
    expect(readLearningData(storage, now)).toEqual({ data, available: true });
  });
  it("recovers with empty data from broken JSON, oversized data or a new version", () => {
    for (const initial of [
      "{broken",
      "x".repeat(150001),
      JSON.stringify({ version: 99, sessions: [entry()] }),
    ]) {
      const storage = memory(initial);
      expect(readLearningData(storage, now).data).toEqual(emptyLearningData());
      expect(
        writeLearningData(
          appendHistory(emptyLearningData(), entry(), undefined, now),
          storage,
          now,
        ),
      ).toBe(true);
      expect(readLearningData(storage, now).data.sessions).toHaveLength(1);
    }
  });
  it("reports blocked reads, writes and missing browser storage without crashing", () => {
    const blocked: LearningStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(readLearningData(blocked, now)).toEqual({
      data: emptyLearningData(),
      available: false,
    });
    expect(writeLearningData(emptyLearningData(), blocked, now)).toBe(false);
    vi.stubGlobal(
      "window",
      Object.defineProperty({}, "localStorage", {
        get() {
          throw new Error("security");
        },
      }),
    );
    expect(browserLearningStorage()).toBeUndefined();
    expect(readLearningData(undefined, now).available).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe("evidence-bounded weak areas", () => {
  it("does not declare a weakness from fewer than five samples", () => {
    expect(
      weakestAreas([
        entry({ categories: [{ id: "M3", total: 4, correct: 0 }] }),
      ]),
    ).toEqual([]);
    expect(
      weakestAreas([
        entry({ categories: [{ id: "M3", total: 5, correct: 3 }] }),
      ]),
    ).toMatchObject([{ id: "M3", total: 5, correct: 3 }]);
  });
  it("does not mix configurations or treat review repeats as independent evidence", () => {
    const advanced = serializePracticeConfig(
      defaultConfig("interval", "advanced"),
    );
    const rows = [
      entry({ categories: [{ id: "M3", total: 3, correct: 0 }] }),
      entry({
        difficulty: "advanced",
        configuration: advanced,
        categories: [{ id: "M3", total: 3, correct: 0 }],
      }),
      entry({
        kind: "review",
        categories: [{ id: "M3", total: 10, correct: 0 }],
      }),
      entry({
        kind: "daily",
        categories: [{ id: "M3", total: 10, correct: 0 }],
      }),
    ];
    expect(weakestAreas(rows)).toEqual([]);
  });
  it("reports at most three lower-performing areas, with no improvement claim", () => {
    const results = weakestAreas([
      entry({
        total: 30,
        correct: 12,
        categories: [
          { id: "M2", total: 5, correct: 0 },
          { id: "M3", total: 5, correct: 1 },
          { id: "P4", total: 5, correct: 2 },
          { id: "P5", total: 5, correct: 3 },
          { id: "P8", total: 5, correct: 4 },
        ],
      }),
    ]);
    expect(results.map((row) => row.id)).toEqual(["M2", "M3", "P4"]);
    expect(
      results.every(
        (row) => !("improved" in row) && row.configuration === configuration,
      ),
    ).toBe(true);
  });
});

describe("retention on disk", () => {
  it("prunes expired summaries from storage on read, even without another practice", () => {
    const storage = memory(
      JSON.stringify({
        version: 1,
        sessions: [entry({ at: now - RETENTION_MS - 1 }), entry()],
        daily: {},
      }),
    );
    expect(readLearningData(storage, now).data.sessions).toHaveLength(1);
    expect(JSON.parse(storage.getItem(HISTORY_KEY)!).sessions).toHaveLength(1);
  });
});
