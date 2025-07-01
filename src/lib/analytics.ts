// Google Analytics 이벤트 추적 함수들

declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js',
      targetId: string | Date,
      config?: Record<string, any>
    ) => void;
  }
}

// 게임 시작 이벤트
export const trackGameStart = (settings: {
  clef: string;
  keySignature: string;
  difficulty: string;
  gameMode: string;
  answerMode: string;
}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'game_start', {
      event_category: 'Game',
      event_label: 'Game Started',
      clef: settings.clef,
      key_signature: settings.keySignature,
      difficulty: settings.difficulty,
      game_mode: settings.gameMode,
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
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'game_complete', {
      event_category: 'Game',
      event_label: 'Game Completed',
      score: result.score,
      accuracy: result.accuracy,
      total_questions: result.totalQuestions,
      time_spent: result.timeSpent,
    });
  }
};

// 정답/오답 이벤트
export const trackAnswer = (isCorrect: boolean, timeSpent: number) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', isCorrect ? 'correct_answer' : 'wrong_answer', {
      event_category: 'Game',
      event_label: isCorrect ? 'Correct Answer' : 'Wrong Answer',
      time_spent: timeSpent,
    });
  }
};

// 설정 변경 이벤트
export const trackSettingsChange = (setting: string, value: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'settings_change', {
      event_category: 'Settings',
      event_label: `${setting} changed to ${value}`,
      setting_name: setting,
      setting_value: value,
    });
  }
};

// 페이지 뷰 이벤트 (자동으로 추적되지만 커스텀 이벤트용)
export const trackPageView = (pageName: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', {
      event_category: 'Navigation',
      event_label: `Page View: ${pageName}`,
      page_name: pageName,
    });
  }
};
