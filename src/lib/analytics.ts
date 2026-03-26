/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    gtag: (
      command: "config" | "event" | "js",
      targetId: string | Date,
      config?: Record<string, any>
    ) => void;
  }
}

function canTrackAnalytics() {
  return (
    typeof window !== "undefined" &&
    process.env.NODE_ENV === "production" &&
    typeof window.gtag === "function"
  );
}

function emitAnalyticsEvent(
  eventName: string,
  payload: Record<string, string | number | boolean | null | undefined>
) {
  if (!canTrackAnalytics()) {
    return;
  }

  window.gtag("event", eventName, payload);
}

export const trackGameStart = (settings: {
  clef: string;
  keySignature: string;
  answerMode: string;
}) => {
  emitAnalyticsEvent("note_quiz_session_started", {
    training_mode: "note_quiz",
    clef: settings.clef,
    key_signature: settings.keySignature,
    answer_mode: settings.answerMode,
  });
};

export const trackGameComplete = (result: {
  score: number;
  accuracy: number;
  totalQuestions: number;
  timeSpent: number;
}) => {
  emitAnalyticsEvent("note_quiz_session_completed", {
    training_mode: "note_quiz",
    score: result.score,
    accuracy: result.accuracy,
    total_questions: result.totalQuestions,
    time_spent_ms: result.timeSpent,
  });
};

export const trackAnswer = (payload: {
  isCorrect: boolean;
  timeSpent: number;
  answerMode: string;
  questionNumber: number;
}) => {
  emitAnalyticsEvent("note_quiz_answer_submitted", {
    training_mode: "note_quiz",
    is_correct: payload.isCorrect,
    time_spent_ms: payload.timeSpent,
    answer_mode: payload.answerMode,
    question_number: payload.questionNumber,
  });
};

export const trackSettingsChange = (payload: {
  setting: string;
  value: string;
  surface?: string;
}) => {
  emitAnalyticsEvent("note_quiz_settings_changed", {
    training_mode: "note_quiz",
    setting_name: payload.setting,
    setting_value: payload.value,
    surface: payload.surface ?? null,
  });
};

export const trackPageView = (pageName: string) => {
  emitAnalyticsEvent("page_view_custom", {
    page_name: pageName,
  });
};

export const trackEarTrainingStart = (settings: {
  inputMode: string;
  noteSet: string;
  timeLimit: number | null;
  sessionType: string;
}) => {
  emitAnalyticsEvent("ear_training_session_started", {
    training_mode: "ear_training",
    input_mode: settings.inputMode,
    note_set: settings.noteSet,
    time_limit: settings.timeLimit,
    session_type: settings.sessionType,
  });
};

export const trackEarTrainingAnswer = (payload: {
  inputMode: string;
  expectedNote: string;
  userNote: string;
  isCorrect: boolean;
  timeSpent: number;
}) => {
  emitAnalyticsEvent("ear_training_answer_submitted", {
    training_mode: "ear_training",
    input_mode: payload.inputMode,
    expected_note: payload.expectedNote,
    user_note: payload.userNote,
    is_correct: payload.isCorrect,
    time_spent_ms: payload.timeSpent,
  });
};

export const trackEarTrainingComplete = (payload: {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  averageTime: number;
  replayCount: number;
}) => {
  emitAnalyticsEvent("ear_training_session_completed", {
    training_mode: "ear_training",
    total_questions: payload.totalQuestions,
    correct_answers: payload.correctAnswers,
    accuracy: payload.accuracy,
    average_time_ms: payload.averageTime,
    replay_count: payload.replayCount,
  });
};

export const trackEarTrainingReplay = () => {
  emitAnalyticsEvent("ear_training_note_replayed", {
    training_mode: "ear_training",
    source: "replay",
  });
};

export const trackEarTrainingSettingsChange = (
  setting: string,
  value: string
) => {
  emitAnalyticsEvent("ear_training_settings_changed", {
    training_mode: "ear_training",
    setting_name: setting,
    setting_value: value,
  });
};
