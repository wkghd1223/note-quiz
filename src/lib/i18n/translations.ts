import { Language } from '@/types/music';

export interface Translations {
  // 게임 제목 및 기본
  gameTitle: string;
  startGame: string;
  pauseGame: string;
  resumeGame: string;
  endGame: string;
  resetGame: string;
  settings: string;
  
  // 게임 상태
  gameStates: {
    idle: string;
    playing: string;
    paused: string;
    finished: string;
  };
  
  // 음자리표
  clefs: {
    treble: string;
    bass: string;
    alto: string;
    tenor: string;
    random: string;
  };
  
  // 조표
  keySignatures: {
    random: string;
  };
  
  // 게임 모드
  gameModes: {
    visual: string;
    audio: string;
    both: string;
  };
  
  // 답안 입력 방식
  answerModes: {
    piano: string;
    solfege: string;
  };
  
  // 난이도
  difficulties: {
    easy: string;
    medium: string;
    hard: string;
    expert: string;
  };
  
  // 설정 관련
  settingsLabels: {
    clef: string;
    keySignature: string;
    octaveRange: string;
    octaveMin: string;
    octaveMax: string;
    difficulty: string;
    gameMode: string;
    answerMode: string;
    language: string;
    enableSound: string;
    timeLimit: string;
    timeLimitEnable: string;
    resetToDefault: string;
    cancel: string;
    apply: string;
  };
  
  // 점수판
  scoreboard: {
    title: string;
    correct: string;
    total: string;
    accuracy: string;
    gameResult: string;
    finalScore: string;
    finalAccuracy: string;
    totalTime: string;
    averageTime: string;
    overallStats: string;
    gamesPlayed: string;
    overallAccuracy: string;
    bestAccuracy: string;
    bestTime: string;
    recentAnswers: string;
    achievements: string;
  };
  
  // 타이머
  timer: {
    elapsed: string;
    remaining: string;
    timeLimit: string;
  };
  
  // 성취 배지
  achievements: {
    perfect: string;
    excellent: string;
    good: string;
    endurance: string;
    fast: string;
  };
  
  // 피아노 키보드
  piano: {
    instruction: string;
    selectedNote: string;
  };
  
  // 일반 메시지
  messages: {
    correct: string;
    incorrect: string;
    timeUp: string;
    gameComplete: string;
    newRecord: string;
  };
  
  // 단위
  units: {
    seconds: string;
    games: string;
    questions: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    gameTitle: 'Note Quiz Game',
    startGame: 'Start Game',
    pauseGame: 'Pause',
    resumeGame: 'Resume',
    endGame: 'End Game',
    resetGame: 'Reset',
    settings: 'Settings',
    
    gameStates: {
      idle: 'Ready',
      playing: 'Playing',
      paused: 'Paused',
      finished: 'Finished'
    },
    
    clefs: {
      treble: 'Treble Clef',
      bass: 'Bass Clef',
      alto: 'Alto Clef',
      tenor: 'Tenor Clef',
      random: 'Random'
    },
    
    keySignatures: {
      random: 'Random'
    },
    
    gameModes: {
      visual: 'Visual',
      audio: 'Audio',
      both: 'Both'
    },
    
    answerModes: {
      piano: 'Piano Keys',
      solfege: 'Solfege'
    },
    
    difficulties: {
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
      expert: 'Expert'
    },
    
    settingsLabels: {
      clef: 'Clef',
      keySignature: 'Key Signature',
      octaveRange: 'Octave Range',
      octaveMin: 'Min',
      octaveMax: 'Max',
      difficulty: 'Difficulty',
      gameMode: 'Game Mode',
      answerMode: 'Answer Mode',
      language: 'Language',
      enableSound: 'Enable Sound',
      timeLimit: 'Time Limit (seconds)',
      timeLimitEnable: 'Enable Time Limit',
      resetToDefault: 'Reset to Default',
      cancel: 'Cancel',
      apply: 'Apply'
    },
    
    scoreboard: {
      title: 'Scoreboard',
      correct: 'Correct',
      total: 'Total',
      accuracy: 'Accuracy',
      gameResult: 'Game Result',
      finalScore: 'Final Score',
      finalAccuracy: 'Final Accuracy',
      totalTime: 'Total Time',
      averageTime: 'Average Time',
      overallStats: 'Overall Stats',
      gamesPlayed: 'Games Played',
      overallAccuracy: 'Overall Accuracy',
      bestAccuracy: 'Best Accuracy',
      bestTime: 'Best Time',
      recentAnswers: 'Recent Answers',
      achievements: 'Achievements'
    },
    
    timer: {
      elapsed: 'Elapsed Time',
      remaining: 'Time Remaining',
      timeLimit: 'time limit'
    },
    
    achievements: {
      perfect: '🏆 Perfect!',
      excellent: '⭐ Excellent',
      good: '👍 Good',
      endurance: '💪 Endurance',
      fast: '⚡ Fast'
    },
    
    piano: {
      instruction: 'Click to select a note',
      selectedNote: 'Selected Note'
    },
    
    messages: {
      correct: 'Correct!',
      incorrect: 'Incorrect',
      timeUp: 'Time\'s up!',
      gameComplete: 'Game Complete!',
      newRecord: 'New Record!'
    },
    
    units: {
      seconds: 'sec',
      games: 'games',
      questions: 'questions'
    }
  },
  
  ko: {
    gameTitle: '계이름 맞추기 게임',
    startGame: '게임 시작',
    pauseGame: '일시정지',
    resumeGame: '계속하기',
    endGame: '게임 종료',
    resetGame: '다시 시작',
    settings: '설정',
    
    gameStates: {
      idle: '대기',
      playing: '진행 중',
      paused: '일시정지',
      finished: '완료'
    },
    
    clefs: {
      treble: '높은음자리표',
      bass: '낮은음자리표',
      alto: '알토음자리표',
      tenor: '테너음자리표',
      random: '랜덤'
    },
    
    keySignatures: {
      random: '랜덤'
    },
    
    gameModes: {
      visual: '시각적',
      audio: '청각적',
      both: '시청각'
    },
    
    answerModes: {
      piano: '피아노 건반',
      solfege: '도레미'
    },
    
    difficulties: {
      easy: '쉬움',
      medium: '보통',
      hard: '어려움',
      expert: '전문가'
    },
    
    settingsLabels: {
      clef: '음자리표',
      keySignature: '조표',
      octaveRange: '옥타브 범위',
      octaveMin: '최소',
      octaveMax: '최대',
      difficulty: '난이도',
      gameMode: '게임 모드',
      answerMode: '답안 입력 방식',
      language: '언어',
      enableSound: '소리 재생',
      timeLimit: '시간 제한 (초)',
      timeLimitEnable: '시간 제한 사용',
      resetToDefault: '기본값으로 재설정',
      cancel: '취소',
      apply: '적용'
    },
    
    scoreboard: {
      title: '점수판',
      correct: '정답',
      total: '총 문제',
      accuracy: '정확도',
      gameResult: '게임 결과',
      finalScore: '최종 점수',
      finalAccuracy: '최종 정확도',
      totalTime: '총 시간',
      averageTime: '평균 시간',
      overallStats: '전체 통계',
      gamesPlayed: '플레이한 게임',
      overallAccuracy: '전체 정확도',
      bestAccuracy: '최고 정확도',
      bestTime: '최고 기록',
      recentAnswers: '최근 답안',
      achievements: '성취'
    },
    
    timer: {
      elapsed: '경과 시간',
      remaining: '남은 시간',
      timeLimit: '초 제한'
    },
    
    achievements: {
      perfect: '🏆 완벽!',
      excellent: '⭐ 우수',
      good: '👍 양호',
      endurance: '💪 지구력',
      fast: '⚡ 빠름'
    },
    
    piano: {
      instruction: '클릭하여 음표를 선택하세요',
      selectedNote: '선택된 음표'
    },
    
    messages: {
      correct: '정답!',
      incorrect: '틀렸습니다',
      timeUp: '시간 종료!',
      gameComplete: '게임 완료!',
      newRecord: '신기록!'
    },
    
    units: {
      seconds: '초',
      games: '게임',
      questions: '문제'
    }
  }
};

export function getTranslation(language: Language): Translations {
  return translations[language] || translations.en;
}
