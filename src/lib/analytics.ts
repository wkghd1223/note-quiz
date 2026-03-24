/* eslint-disable @typescript-eslint/no-explicit-any */
// Google Analytics 이벤트 추적 함수들

declare global {
  interface Window {
    gtag: (
      command: "config" | "event" | "js",
      targetId: string | Date,
      config?: Record<string, any>
    ) => void;
  }
}

// 게임 시작 이벤트
export const trackGameStart = (settings: {
  clef: string;
  keySignature: string;
  answerMode: string;
}) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "game_start", {
      event_category: "Game",
      event_label: "Game Started",
      clef: settings.clef,
      key_signature: settings.keySignature,
      answer_mode: settings.answerMode,
    });
  }
};

// 게임 완료 이벤트
export const trackGameComplete = (result: {
  score: number;
  accuracy: number;
  totalQuestions: number;
  timeSpent: number;
}) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "game_complete", {
      event_category: "Game",
      event_label: "Game Completed",
      score: result.score,
      accuracy: result.accuracy,
      total_questions: result.totalQuestions,
      time_spent: result.timeSpent,
    });
  }
};

// 정답/오답 이벤트
export const trackAnswer = (isCorrect: boolean, timeSpent: number) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", isCorrect ? "correct_answer" : "wrong_answer", {
      event_category: "Game",
      event_label: isCorrect ? "Correct Answer" : "Wrong Answer",
      time_spent: timeSpent,
    });
  }
};

// 설정 변경 이벤트
export const trackSettingsChange = (setting: string, value: string) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "settings_change", {
      event_category: "Settings",
      event_label: `${setting} changed to ${value}`,
      setting_name: setting,
      setting_value: value,
    });
  }
};

// 페이지 뷰 이벤트 (자동으로 추적되지만 커스텀 이벤트용)
export const trackPageView = (pageName: string) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "page_view", {
      event_category: "Navigation",
      event_label: `Page View: ${pageName}`,
      page_name: pageName,
    });
  }
};

export const trackEarTrainingStart = (settings: {
  inputMode: string;
  noteSet: string;
  timeLimit: number | null;
  sessionType: string;
}) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "ear_training_started", {
      event_category: "EarTraining",
      input_mode: settings.inputMode,
      note_set: settings.noteSet,
      time_limit: settings.timeLimit,
      session_type: settings.sessionType,
    });
  }
};

export const trackEarTrainingAnswer = (payload: {
  inputMode: string;
  expectedNote: string;
  userNote: string;
  isCorrect: boolean;
  timeSpent: number;
}) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "ear_training_answer_submitted", {
      event_category: "EarTraining",
      input_mode: payload.inputMode,
      expected_note: payload.expectedNote,
      user_note: payload.userNote,
      is_correct: payload.isCorrect,
      time_spent_ms: payload.timeSpent,
    });
  }
};

export const trackEarTrainingComplete = (payload: {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  averageTime: number;
  replayCount: number;
}) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "ear_training_completed", {
      event_category: "EarTraining",
      total_questions: payload.totalQuestions,
      correct_answers: payload.correctAnswers,
      accuracy: payload.accuracy,
      average_time_ms: payload.averageTime,
      replay_count: payload.replayCount,
    });
  }
};

export const trackEarTrainingReplay = () => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "ear_training_note_played", {
      event_category: "EarTraining",
      source: "replay",
    });
  }
};

export const trackEarTrainingSettingsChange = (
  setting: string,
  value: string
) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "ear_training_settings_changed", {
      event_category: "EarTraining",
      setting_name: setting,
      setting_value: value,
    });
  }
};
