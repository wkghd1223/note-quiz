import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as analytics from "./analytics";
import { initializeAnalytics } from "./analytics-runtime";
const gtag = vi.fn();
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubGlobal("window", {
    gtag,
    location: new URL("https://note-quiz.com/practice/note"),
  });
  vi.stubGlobal("document", { title: "Practice", referrer: "" });
  initializeAnalytics();
  gtag.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("anonymous session analytics", () => {
  it.each([
    "entered",
    "started",
    "completed",
    "review_started",
    "result_restarted",
  ] as const)("emits only aggregate allow-listed fields for %s", (event) => {
    const details = {
      mode: "interval",
      difficulty: "basic",
      presentation: "audio",
      sessionType: "ten",
      kind: "practice",
      completed: true,
      total: 10,
      correct: 7,
      entryStart: true,
      hasMistakes: true,
      sessionId: "private-session",
      userId: "private-person",
      expectedNote: "C4",
      userNote: "D4",
      answers: ["C4"],
      audio: "raw-audio",
    };
    analytics.trackLearningEvent(event, details);
    expect(gtag).toHaveBeenCalledTimes(1);
    const [command, name, payload] = gtag.mock.calls[0];
    expect(command).toBe("event");
    expect(name).toBe(`practice_${event}`);
    expect(payload).toMatchObject({
      training_mode: "interval",
      difficulty: "basic",
      presentation: "audio",
      session_type: "ten",
      session_kind: "practice",
      completed: true,
      total_questions: 10,
      correct_answers: 7,
      entry_start: true,
      had_mistakes: true,
    });
    expect(Object.keys(payload).sort()).toEqual(
      [
        "training_mode",
        "difficulty",
        "presentation",
        "session_type",
        "session_kind",
        "completed",
        "total_questions",
        "correct_answers",
        "entry_start",
        "had_mistakes",
      ].sort(),
    );
    expect(JSON.stringify(payload)).not.toMatch(
      /private|C4|D4|raw-audio|sessionId|userId|expectedNote|userNote/,
    );
  });
  it("retains existing note and ear start/completion events using aggregate values", () => {
    analytics.trackGameStart({
      clef: "treble",
      keySignature: "C",
      answerMode: "piano",
    });
    analytics.trackGameComplete({
      score: 7,
      accuracy: 70,
      totalQuestions: 10,
      timeSpent: 12000,
      sessionPoints: 7,
      eligibleForLeaderboard: true,
    });
    analytics.trackEarTrainingStart({
      inputMode: "piano",
      noteSet: "natural",
      timeLimit: null,
      sessionType: "practice",
    });
    analytics.trackEarTrainingComplete({
      totalQuestions: 10,
      correctAnswers: 7,
      accuracy: 70,
      averageTime: 1200,
      replayCount: 2,
    });
    expect(gtag.mock.calls.map((call) => call[1])).toEqual([
      "note_quiz_session_started",
      "note_quiz_session_completed",
      "ear_training_session_started",
      "ear_training_session_completed",
    ]);
    expect(gtag.mock.calls.map((call) => call[2])).toEqual([
      {
        training_mode: "note_quiz",
        clef: "treble",
        key_signature: "C",
        answer_mode: "piano",
      },
      {
        training_mode: "note_quiz",
        score: 7,
        accuracy: 70,
        total_questions: 10,
        time_spent_ms: 12000,
        session_points: 7,
        eligible_for_leaderboard: true,
      },
      {
        training_mode: "ear_training",
        input_mode: "piano",
        note_set: "natural",
        time_limit: null,
        session_type: "practice",
      },
      {
        training_mode: "ear_training",
        total_questions: 10,
        correct_answers: 7,
        accuracy: 70,
        average_time_ms: 1200,
        replay_count: 2,
      },
    ]);
    for (const call of gtag.mock.calls)
      expect(
        Object.keys(call[2]).some((key) =>
          /^(expected_note|user_note|session_id|user_id|answer|answers)$/.test(
            key,
          ),
        ),
      ).toBe(false);
  });
  it("has no answer-level tracking API remaining", () => {
    expect("trackAnswer" in analytics).toBe(false);
    expect("trackEarTrainingAnswer" in analytics).toBe(false);
  });
  it.each(["note", "ear", "interval", "chord"])(
    "does not create a second event family from a basic %s funnel call",
    (mode) => {
      analytics.trackLearningEvent("started", {
        mode,
        difficulty: "basic",
        presentation: mode === "note" ? "visual" : "audio",
        sessionType: "ten",
        kind: "practice",
        entryStart: true,
      });
      expect(gtag).toHaveBeenCalledTimes(1);
      expect(gtag.mock.calls[0].slice(0, 2)).toEqual([
        "event",
        "practice_started",
      ]);
      expect(gtag.mock.calls[0][2]).not.toHaveProperty("elapsed_time_ms");
    },
  );
  it("allow-lists the remaining compatibility and surface helpers", () => {
    const extra = {
      userId: "private-person",
      sessionId: "private-session",
      seed: 999,
      notes: ["C4"],
      audio: "raw-audio",
    };
    analytics.trackLeaderboardSubmission({
      status: "accepted",
      sessionPoints: 3,
      totalQuestions: 10,
      ...extra,
    });
    analytics.trackSettingsChange({
      setting: "clef",
      value: "treble",
      surface: "settings",
      ...extra,
    });
    analytics.trackEarTrainingReplay();
    analytics.trackEarTrainingSettingsChange("note_set", "natural");
    analytics.trackPracticeModeChanged("ear");
    analytics.trackPracticeSettingsOpened("note");
    analytics.trackPracticeSettingsClosed("note");
    analytics.trackLeaderboardTickerOpened("practice");
    analytics.trackPageView("practice"); // legacy helper; not the route page_view
    expect(gtag.mock.calls.map((call) => call[1])).toEqual([
      "leaderboard_session_submitted",
      "note_quiz_settings_changed",
      "ear_training_note_replayed",
      "ear_training_settings_changed",
      "practice_mode_changed",
      "practice_settings_opened",
      "practice_settings_closed",
      "leaderboard_ticker_opened",
      "page_view_custom",
    ]);
    expect(JSON.stringify(gtag.mock.calls)).not.toMatch(
      /private|userId|sessionId|seed|notes|C4|raw-audio/,
    );
  });
  it("does not track development or server rendering", () => {
    vi.stubEnv("NODE_ENV", "development");
    analytics.trackLearningEvent("entered", {
      mode: "note",
      difficulty: "beginner",
    });
    expect(gtag).not.toHaveBeenCalled();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("window", undefined);
    expect(() =>
      analytics.trackLearningEvent("entered", {
        mode: "note",
        difficulty: "beginner",
      }),
    ).not.toThrow();
    expect(gtag).not.toHaveBeenCalled();
  });
  it("keeps melody preview separate from actual practice and excludes extra fields", () => {
    analytics.trackMelodyPreviewStarted();
    analytics.trackLearningEvent("completed", {
      mode: "melody",
      difficulty: "custom",
      completed: false,
      elapsedMs: 1200,
      ...{ attemptToken: 4, seed: 999, frequency: 440, notes: ["C4"] },
    });
    expect(gtag.mock.calls.map((call) => call[1])).toEqual([
      "practice_preview_started",
      "practice_completed",
    ]);
    expect(gtag.mock.calls[0][2]).toEqual({
      training_mode: "melody",
      difficulty: "custom",
      presentation: "visual",
      session_type: "exercise",
    });
    expect(gtag.mock.calls[1][2].elapsed_time_ms).toBe(1200);
    expect(JSON.stringify(gtag.mock.calls)).not.toMatch(
      /attemptToken|seed|frequency|notes|C4|999|440/,
    );
  });
});
