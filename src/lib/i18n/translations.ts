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
    answerMode: string;
    language: string;
    enableSound: string;
    timeLimit: string;
    timeLimitEnable: string;
    resetToDefault: string;
    cancel: string;
    apply: string;
    random: string;
    staffRange: string;
    ledgerLinesAbove: string;
    ledgerLinesBelow: string;
    ledgerLinesInstruction: string;
    accidentals: string;
    accidentalProbability: string;
    resetAllStats: string;
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

  // 도레미 키보드
  solfege: {
    title: string;
    instruction: string;
    selectedNote: string;
    notes: {
      C: string;
      "C#": string;
      D: string;
      "D#": string;
      E: string;
      F: string;
      "F#": string;
      G: string;
      "G#": string;
      A: string;
      "A#": string;
      B: string;
    };
  };

  // 일반 메시지
  messages: {
    correct: string;
    incorrect: string;
    timeUp: string;
    gameComplete: string;
    newRecord: string;
    correctAnswer: string;
    yourAnswer: string;
    playSound: string;
    startGameInstruction: string;
    gameCompleteInstruction: string;
  };

  // 단위
  units: {
    seconds: string;
    games: string;
    questions: string;
  };

  // 추가 UI 텍스트
  ui: {
    welcome: string;
    description: string;
    features: {
      customSettings: string;
      realTimeFeedback: string;
    };
    currentQuestionTime: string;
    accidentalDescription: string;
    ledgerLinesDescription: string;
  };

  // 홈페이지 콘텐츠
  home: {
    hero: {
      title: string;
      description: string;
      cta: string;
    };
    features: {
      title: string;
      soundPlayback: {
        title: string;
        description: string;
      };
      variousClefs: {
        title: string;
        description: string;
      };
      instantFeedback: {
        title: string;
        description: string;
      };
      multiLanguage: {
        title: string;
        description: string;
      };
    };
    howToUse: {
      title: string;
      step1: {
        title: string;
        description: string;
      };
      step2: {
        title: string;
        description: string;
      };
      step3: {
        title: string;
        description: string;
      };
      step4: {
        title: string;
        description: string;
      };
    };
    faq: {
      title: string;
      q1: {
        question: string;
        answer: string;
      };
      q2: {
        question: string;
        answer: string;
      };
      q3: {
        question: string;
        answer: string;
      };
      q4: {
        question: string;
        answer: string;
      };
      q5: {
        question: string;
        answer: string;
      };
      q6: {
        question: string;
        answer: string;
      };
    };
    about: {
      title: string;
      description1: string;
      description2: string;
      description3: string;
      description4: string;
    };
    cta: {
      title: string;
      description: string;
      button: string;
    };
    footer: {
      copyright: string;
      tagline: string;
    };
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    gameTitle: "Note Quiz",
    startGame: "Start Game",
    pauseGame: "Pause",
    resumeGame: "Resume",
    endGame: "End Game",
    resetGame: "Reset",
    settings: "Settings",

    gameStates: {
      idle: "Ready",
      playing: "Playing",
      paused: "Paused",
      finished: "Finished",
    },

    clefs: {
      treble: "Treble Clef",
      bass: "Bass Clef",
      alto: "Alto Clef",
      tenor: "Tenor Clef",
      random: "Random",
    },

    keySignatures: {
      random: "Random",
    },

    answerModes: {
      piano: "Piano Keys",
      solfege: "Solfege",
    },

    difficulties: {
      easy: "Easy",
      medium: "Medium",
      hard: "Hard",
      expert: "Expert",
    },

    settingsLabels: {
      clef: "Clef",
      keySignature: "Key Signature",
      octaveRange: "Octave Range",
      octaveMin: "Min",
      octaveMax: "Max",
      answerMode: "Answer Mode",
      language: "Language",
      enableSound: "Enable Sound",
      timeLimit: "Time Limit (seconds)",
      timeLimitEnable: "Enable Time Limit",
      resetToDefault: "Reset to Default",
      cancel: "Cancel",
      apply: "Apply",
      random: "Random",
      staffRange: "Staff Range",
      ledgerLinesAbove: "Ledger Lines Above",
      ledgerLinesBelow: "Ledger Lines Below",
      ledgerLinesInstruction:
        "The more ledger lines, the wider range of notes will be generated.",
      accidentals: "Accidentals",
      accidentalProbability: "Accidental Probability",
      resetAllStats: "Reset All Stats",
    },

    scoreboard: {
      title: "Scoreboard",
      correct: "Correct",
      total: "Total",
      accuracy: "Accuracy",
      gameResult: "Game Result",
      finalScore: "Final Score",
      finalAccuracy: "Final Accuracy",
      totalTime: "Total Time",
      averageTime: "Average Time",
      overallStats: "Overall Stats",
      gamesPlayed: "Games Played",
      overallAccuracy: "Overall Accuracy",
      bestAccuracy: "Best Accuracy",
      bestTime: "Best Time",
      recentAnswers: "Recent Answers",
      achievements: "Achievements",
    },

    timer: {
      elapsed: "Elapsed Time",
      remaining: "Time Remaining",
      timeLimit: "time limit",
    },

    achievements: {
      perfect: "🏆 Perfect!",
      excellent: "⭐ Excellent",
      good: "👍 Good",
      endurance: "💪 Endurance",
      fast: "⚡ Fast",
    },

    piano: {
      instruction: "Click to select a note",
      selectedNote: "Selected Note",
    },

    solfege: {
      title: "Solfege Input",
      instruction: "Click solfege to select a note",
      selectedNote: "Selected Note",
      notes: {
        C: "Do",
        "C#": "Do♯",
        D: "Re",
        "D#": "Re♯",
        E: "Mi",
        F: "Fa",
        "F#": "Fa♯",
        G: "Sol",
        "G#": "Sol♯",
        A: "La",
        "A#": "La♯",
        B: "Ti",
      },
    },

    messages: {
      correct: "Correct!",
      incorrect: "Incorrect",
      timeUp: "Time's up!",
      gameComplete: "Game Complete!",
      newRecord: "New Record!",
      correctAnswer: "Correct Answer",
      yourAnswer: "Your Answer",
      playSound: "🔊 Play Sound",
      startGameInstruction: 'Adjust settings and click "Start Game" button.',
      gameCompleteInstruction:
        "Game complete! Check your results on the scoreboard.",
    },

    units: {
      seconds: "sec",
      games: "games",
      questions: "questions",
    },

    ui: {
      welcome: "Welcome to Note Quiz!",
      description: "Learn to read musical notes by sight and sound!",
      features: {
        customSettings: "Customizable Settings",
        realTimeFeedback: "Real-time Feedback",
      },
      currentQuestionTime: "Current Question Time",
      accidentalDescription:
        "When accidentals are enabled, individual notes can have ♯, ♭, ♮ added separately from key signatures.",
      ledgerLinesDescription:
        "The more ledger lines, the wider range of notes will be generated.",
    },

    home: {
      hero: {
        title: "Note Quiz",
        description: "Learn to read musical notes by sight and sound!",
        cta: "Start Game",
      },
      features: {
        title: "Key Features",
        soundPlayback: {
          title: "Sound Playback",
          description:
            "Listen to the accurate sound of each note while learning",
        },
        variousClefs: {
          title: "Various Clefs",
          description: "Support for Treble, Bass, Alto, and Tenor clefs",
        },
        instantFeedback: {
          title: "Instant Feedback",
          description: "Check your answers immediately and learn",
        },
        multiLanguage: {
          title: "Multi-Language Support",
          description: "Support for 6 languages worldwide",
        },
      },
      howToUse: {
        title: "How to Use",
        step1: {
          title: "Start Game",
          description: "Click the 'Start Game' button to begin learning notes",
        },
        step2: {
          title: "Check Note",
          description: "View the note on the staff and listen to the sound",
        },
        step3: {
          title: "Enter Answer",
          description:
            "Input your answer using the piano keyboard or solfege buttons",
        },
        step4: {
          title: "Continue Learning",
          description:
            "Keep solving problems to improve your note reading skills",
        },
      },
      faq: {
        title: "Frequently Asked Questions",
        q1: {
          question: "What is Note Quiz?",
          answer:
            "Note Quiz is an interactive learning game designed to improve your ability to read musical notes from sheet music. It provides visual notation and sound together to quickly improve note recognition skills.",
        },
        q2: {
          question: "What clefs are supported?",
          answer:
            "We support Treble Clef, Bass Clef, Alto Clef, and Tenor Clef. You can learn each clef separately.",
        },
        q3: {
          question: "Can I learn key signatures?",
          answer:
            "Yes, you can solve problems with various key signatures. You can select a specific key signature in the game settings or set it to random.",
        },
        q4: {
          question: "What languages are supported?",
          answer:
            "We support 6 languages: English, Korean, Japanese, Spanish, German, and French. The language is automatically selected based on your browser settings.",
        },
        q5: {
          question: "Is there a cost?",
          answer:
            "No, Note Quiz is completely free. You can use it anytime without registration or payment.",
        },
        q6: {
          question: "Can I use it on mobile?",
          answer:
            "Yes, Note Quiz is a responsive web application that works perfectly on all devices (desktop, tablet, mobile).",
        },
      },
      about: {
        title: "About Note Quiz",
        description1:
          "Note Quiz is an interactive learning platform designed for music learners to develop the ability to quickly recognize notes from sheet music.",
        description2:
          "Especially for people learning instruments like harmonica, piano, and vocals who struggle with note reading, this game allows you to learn in a fun way.",
        description3:
          "It provides an effective learning experience through visual notation display, accurate sound playback, and instant feedback. It also supports various clefs, key signatures, and accidentals, making it suitable for music learners of all levels.",
        description4:
          "Improve your note reading skills with Note Quiz and experience the joy of music learning!",
      },
      cta: {
        title: "Start Now!",
        description:
          "Improve your note reading skills and make music learning more enjoyable.",
        button: "Start Game",
      },
      footer: {
        copyright: "© 2024 Note Quiz. All rights reserved.",
        tagline: "Interactive note recognition game for music learning",
      },
    },
  },

  ko: {
    gameTitle: "계이름 맞추기 게임",
    startGame: "게임 시작",
    pauseGame: "일시정지",
    resumeGame: "계속하기",
    endGame: "게임 종료",
    resetGame: "다시 시작",
    settings: "설정",

    gameStates: {
      idle: "대기",
      playing: "진행 중",
      paused: "일시정지",
      finished: "완료",
    },

    clefs: {
      treble: "높은음자리표",
      bass: "낮은음자리표",
      alto: "알토음자리표",
      tenor: "테너음자리표",
      random: "랜덤",
    },

    keySignatures: {
      random: "랜덤",
    },

    answerModes: {
      piano: "피아노 건반",
      solfege: "도레미",
    },

    difficulties: {
      easy: "쉬움",
      medium: "보통",
      hard: "어려움",
      expert: "전문가",
    },

    settingsLabels: {
      clef: "음자리표",
      keySignature: "조표",
      octaveRange: "옥타브 범위",
      octaveMin: "최소",
      octaveMax: "최대",
      answerMode: "답안 입력 방식",
      language: "언어",
      enableSound: "소리 재생",
      timeLimit: "시간 제한 (초)",
      timeLimitEnable: "시간 제한 사용",
      resetToDefault: "기본값으로 재설정",
      cancel: "취소",
      apply: "적용",
      random: "랜덤",
      staffRange: "오선지 범위",
      ledgerLinesAbove: "위쪽 보조선",
      ledgerLinesBelow: "아래쪽 보조선",
      ledgerLinesInstruction:
        "보조선이 많을수록 더 넓은 음역대의 문제가 출제됩니다.",
      accidentals: "임시표 사용",
      accidentalProbability: "임시표 출현 확률",
      resetAllStats: "모든 통계 초기화",
    },

    scoreboard: {
      title: "점수판",
      correct: "정답",
      total: "총 문제",
      accuracy: "정확도",
      gameResult: "게임 결과",
      finalScore: "최종 점수",
      finalAccuracy: "최종 정확도",
      totalTime: "총 시간",
      averageTime: "평균 시간",
      overallStats: "전체 통계",
      gamesPlayed: "플레이한 게임",
      overallAccuracy: "전체 정확도",
      bestAccuracy: "최고 정확도",
      bestTime: "최고 기록",
      recentAnswers: "최근 답안",
      achievements: "성취",
    },

    timer: {
      elapsed: "경과 시간",
      remaining: "남은 시간",
      timeLimit: "초 제한",
    },

    achievements: {
      perfect: "🏆 완벽!",
      excellent: "⭐ 우수",
      good: "👍 양호",
      endurance: "💪 지구력",
      fast: "⚡ 빠름",
    },

    piano: {
      instruction: "클릭하여 음표를 선택하세요",
      selectedNote: "선택된 음표",
    },

    solfege: {
      title: "도레미 입력",
      instruction: "도레미를 클릭하여 음표를 선택하세요",
      selectedNote: "선택된 음표",
      notes: {
        C: "도",
        "C#": "도♯",
        D: "레",
        "D#": "레♯",
        E: "미",
        F: "파",
        "F#": "파♯",
        G: "솔",
        "G#": "솔♯",
        A: "라",
        "A#": "라♯",
        B: "시",
      },
    },

    messages: {
      correct: "정답!",
      incorrect: "틀렸습니다",
      timeUp: "시간 종료!",
      gameComplete: "게임 완료!",
      newRecord: "신기록!",
      correctAnswer: "정답",
      yourAnswer: "당신의 답안",
      playSound: "🔊 소리 듣기",
      startGameInstruction: '설정을 조정한 후 "게임 시작" 버튼을 클릭하세요.',
      gameCompleteInstruction:
        "게임이 완료되었습니다. 점수판에서 결과를 확인하세요.",
    },

    units: {
      seconds: "초",
      games: "게임",
      questions: "문제",
    },

    ui: {
      welcome: "계이름 맞추기 게임에 오신 것을 환영합니다!",
      description: "시각적 학습과 청각적 훈련을 통해 음악 실력을 향상시키세요.",
      features: {
        customSettings: "맞춤형 설정",
        realTimeFeedback: "실시간 피드백",
      },
      currentQuestionTime: "현재 문제 시간",
      accidentalDescription:
        "임시표가 활성화되면 조표와 별개로 개별 음표에 ♯, ♭, ♮이 추가될 수 있습니다.",
      ledgerLinesDescription:
        "보조선이 많을수록 더 넓은 음역대의 문제가 출제됩니다.",
    },

    home: {
      hero: {
        title: "계이름 맞추기 게임",
        description:
          "시각적 학습과 청각적 훈련을 통해 음악 실력을 향상시키세요.",
        cta: "게임 시작",
      },
      features: {
        title: "주요 기능",
        soundPlayback: {
          title: "음성 재생",
          description: "각 음표의 정확한 음성을 들으며 학습하세요",
        },
        variousClefs: {
          title: "다양한 악보",
          description: "트레블, 베이스, 알토, 테너 음자리표 지원",
        },
        instantFeedback: {
          title: "즉시 피드백",
          description: "정답 여부를 즉시 확인하고 학습하세요",
        },
        multiLanguage: {
          title: "다국어 지원",
          description: "6개 언어로 전 세계 사용자 지원",
        },
      },
      howToUse: {
        title: "이용 방법",
        step1: {
          title: "게임 시작",
          description: '"게임 시작" 버튼을 클릭하여 음표 학습을 시작하세요',
        },
        step2: {
          title: "음표 확인",
          description: "악보에 표시된 음표를 확인하고 음성을 들으세요",
        },
        step3: {
          title: "답변 입력",
          description: "피아노 건반이나 도레미 버튼으로 정답을 입력하세요",
        },
        step4: {
          title: "학습 진행",
          description: "계속 문제를 풀며 음표 읽기 능력을 향상시키세요",
        },
      },
      faq: {
        title: "자주 묻는 질문 (FAQ)",
        q1: {
          question: "Note Quiz는 무엇인가요?",
          answer:
            "Note Quiz는 음악 악보에서 음표를 읽는 능력을 향상시키기 위한 대화형 학습 게임입니다. 시각적 악보와 음성을 함께 제공하여 음표 인식 능력을 빠르게 개선할 수 있습니다.",
        },
        q2: {
          question: "어떤 악보를 지원하나요?",
          answer:
            "트레블 음자리표(Treble Clef), 베이스 음자리표(Bass Clef), 알토 음자리표(Alto Clef), 테너 음자리표(Tenor Clef)를 모두 지원합니다. 각 음자리표별로 학습할 수 있습니다.",
        },
        q3: {
          question: "조표(Key Signature)를 학습할 수 있나요?",
          answer:
            "네, 다양한 조표를 포함한 문제를 풀 수 있습니다. 게임 설정에서 특정 조표를 선택하거나 랜덤으로 설정하여 조표 학습을 진행할 수 있습니다.",
        },
        q4: {
          question: "어떤 언어를 지원하나요?",
          answer:
            "영어, 한국어, 일본어, 스페인어, 독일어, 프랑스어 총 6개 언어를 지원합니다. 브라우저 언어 설정에 따라 자동으로 언어가 선택됩니다.",
        },
        q5: {
          question: "비용이 드나요?",
          answer:
            "아니요, Note Quiz는 완전히 무료입니다. 회원가입이나 결제 없이 누구나 언제든지 이용할 수 있습니다.",
        },
        q6: {
          question: "모바일에서도 사용할 수 있나요?",
          answer:
            "네, Note Quiz는 반응형 웹 애플리케이션으로 모든 기기(데스크톱, 태블릿, 모바일)에서 완벽하게 작동합니다.",
        },
      },
      about: {
        title: "Note Quiz에 대해",
        description1:
          "Note Quiz는 음악 학습자들이 악보에서 음표를 빠르게 인식하는 능력을 개발하기 위해 설계된 대화형 학습 플랫폼입니다.",
        description2:
          "특히 하모니카, 피아노, 성악 등 악기를 배우는 사람들이 음표 읽기에 어려움을 겪을 때, 이 게임을 통해 재미있게 학습할 수 있습니다.",
        description3:
          "시각적 악보 표시, 정확한 음성 재생, 즉시 피드백을 통해 효과적인 학습 경험을 제공합니다. 또한 다양한 음자리표, 조표, 임시표를 지원하여 모든 수준의 음악 학습자에게 적합합니다.",
        description4:
          "Note Quiz와 함께 음표 읽기 능력을 향상시키고, 음악 학습의 즐거움을 경험해보세요!",
      },
      cta: {
        title: "지금 바로 시작하세요!",
        description:
          "음표 읽기 능력을 향상시키고 음악 학습을 더욱 즐겁게 만들어보세요.",
        button: "게임 시작하기",
      },
      footer: {
        copyright: "© 2024 Note Quiz. All rights reserved.",
        tagline: "음악 학습을 위한 대화형 음표 인식 게임",
      },
    },
  },

  ja: {
    gameTitle: "音符クイズ",
    startGame: "ゲーム開始",
    pauseGame: "一時停止",
    resumeGame: "再開",
    endGame: "ゲーム終了",
    resetGame: "リセット",
    settings: "設定",

    gameStates: {
      idle: "待機中",
      playing: "プレイ中",
      paused: "一時停止",
      finished: "完了",
    },

    clefs: {
      treble: "ト音記号",
      bass: "ヘ音記号",
      alto: "アルト記号",
      tenor: "テナー記号",
      random: "ランダム",
    },

    answerModes: {
      piano: "ピアノ鍵盤",
      solfege: "ドレミ",
    },

    difficulties: {
      easy: "簡単",
      medium: "普通",
      hard: "難しい",
      expert: "エキスパート",
    },

    keySignatures: {
      random: "ランダム",
    },

    settingsLabels: {
      clef: "音部記号",
      keySignature: "調号",
      octaveRange: "オクターブ範囲",
      octaveMin: "最小",
      octaveMax: "最大",
      answerMode: "回答方式",
      language: "言語",
      enableSound: "音を有効にする",
      timeLimit: "制限時間（秒）",
      timeLimitEnable: "制限時間を有効にする",
      resetToDefault: "デフォルトにリセット",
      cancel: "キャンセル",
      apply: "適用",
      random: "ランダム",
      staffRange: "譜表範囲",
      ledgerLinesAbove: "上の加線",
      ledgerLinesBelow: "下の加線",
      ledgerLinesInstruction:
        "加線が多いほど、より広い音域の音符が生成されます。",
      accidentals: "臨時記号",
      accidentalProbability: "臨時記号の確率",
      resetAllStats: "全統計をリセット",
    },

    piano: {
      instruction: "クリックして音符を選択してください",
      selectedNote: "選択された音符",
    },

    solfege: {
      title: "ドレミ入力",
      instruction: "ドレミをクリックして音符を選択してください",
      selectedNote: "選択された音符",
      notes: {
        C: "ド",
        "C#": "ド♯",
        D: "レ",
        "D#": "レ♯",
        E: "ミ",
        F: "ファ",
        "F#": "ファ♯",
        G: "ソ",
        "G#": "ソ♯",
        A: "ラ",
        "A#": "ラ♯",
        B: "シ",
      },
    },

    messages: {
      correct: "正解！",
      incorrect: "不正解",
      timeUp: "時間切れ！",
      gameComplete: "ゲーム完了！",
      newRecord: "新記録！",
      correctAnswer: "正解",
      yourAnswer: "あなたの回答",
      playSound: "音を再生",
      startGameInstruction: "ゲームを開始するには設定を確認してください。",
      gameCompleteInstruction:
        "ゲームが完了しました。スコアボードで結果を確認してください。",
    },

    scoreboard: {
      title: "スコアボード",
      correct: "正解",
      total: "合計",
      accuracy: "正解率",
      gameResult: "ゲーム結果",
      finalScore: "最終スコア",
      finalAccuracy: "最終正解率",
      totalTime: "総時間",
      averageTime: "平均時間",
      overallStats: "全体統計",
      gamesPlayed: "プレイ回数",
      bestAccuracy: "最高正解率",
      bestTime: "最短時間",
      overallAccuracy: "全体正解率",
      recentAnswers: "最近の回答",
      achievements: "実績",
    },

    timer: {
      elapsed: "経過時間",
      remaining: "残り時間",
      timeLimit: "秒制限",
    },

    achievements: {
      perfect: "🏆 完璧！",
      excellent: "⭐ 優秀",
      good: "👍 良好",
      endurance: "💪 持久力",
      fast: "⚡ 高速",
    },

    units: {
      seconds: "秒",
      games: "ゲーム",
      questions: "問題",
    },

    ui: {
      welcome: "音符クイズへようこそ！",
      description: "視覚と聴覚で音符を学ぼう！",
      features: {
        customSettings: "カスタム設定",
        realTimeFeedback: "リアルタイムフィードバック",
      },
      currentQuestionTime: "現在の問題時間",
      accidentalDescription:
        "臨時記号が有効になると、調号とは別に個別の音符に♯、♭、♮が追加される場合があります。",
      ledgerLinesDescription:
        "加線が多いほど、より広い音域の問題が出題されます。",
    },

    home: {
      hero: {
        title: "音符クイズ",
        description: "視覚と聴覚で音符を学ぼう！",
        cta: "ゲーム開始",
      },
      features: {
        title: "主な機能",
        soundPlayback: {
          title: "音声再生",
          description: "各音符の正確な音を聞きながら学習できます",
        },
        variousClefs: {
          title: "様々な音部記号",
          description: "ト音記号、ヘ音記号、アルト記号、テノール記号に対応",
        },
        instantFeedback: {
          title: "即座フィードバック",
          description: "正解・不正解をすぐに確認して学習できます",
        },
        multiLanguage: {
          title: "多言語対応",
          description: "6言語で世界中のユーザーをサポート",
        },
      },
      howToUse: {
        title: "使い方",
        step1: {
          title: "ゲーム開始",
          description: '"ゲーム開始"ボタンをクリックして音符学習を始めましょう',
        },
        step2: {
          title: "音符確認",
          description: "楽譜に表示された音符を確認して音を聞きましょう",
        },
        step3: {
          title: "答え入力",
          description:
            "ピアノキーボードまたはドレミボタンで答えを入力してください",
        },
        step4: {
          title: "学習継続",
          description: "問題を解き続けて音符読み能力を向上させましょう",
        },
      },
      faq: {
        title: "よくある質問（FAQ）",
        q1: {
          question: "Note Quizとは何ですか？",
          answer:
            "Note Quizは、楽譜から音符を読む能力を向上させるための対話型学習ゲームです。視覚的な楽譜表示と音声を組み合わせて、音符認識能力を素早く向上させることができます。",
        },
        q2: {
          question: "どの音部記号に対応していますか？",
          answer:
            "ト音記号（Treble Clef）、ヘ音記号（Bass Clef）、アルト記号（Alto Clef）、テノール記号（Tenor Clef）に対応しています。各音部記号ごとに学習できます。",
        },
        q3: {
          question: "調号を学習できますか？",
          answer:
            "はい、様々な調号を含む問題を解くことができます。ゲーム設定で特定の調号を選択するか、ランダムに設定して調号学習を進めることができます。",
        },
        q4: {
          question: "どの言語に対応していますか？",
          answer:
            "英語、日本語、韓国語、スペイン語、ドイツ語、フランス語の6言語に対応しています。ブラウザの言語設定に基づいて自動的に言語が選択されます。",
        },
        q5: {
          question: "費用はかかりますか？",
          answer:
            "いいえ、Note Quizは完全に無料です。登録や支払いなしに、誰でもいつでも利用できます。",
        },
        q6: {
          question: "モバイルでも使用できますか？",
          answer:
            "はい、Note Quizはレスポンシブウェブアプリケーションで、すべてのデバイス（デスクトップ、タブレット、モバイル）で完璧に動作します。",
        },
      },
      about: {
        title: "Note Quizについて",
        description1:
          "Note Quizは、音楽学習者が楽譜から音符を素早く認識する能力を開発するために設計された対話型学習プラットフォームです。",
        description2:
          "特にハーモニカ、ピアノ、ボーカルなどの楽器を学んでいる人が音符読みに困っているときに、このゲームを通じて楽しく学習できます。",
        description3:
          "視覚的な楽譜表示、正確な音声再生、即座フィードバックを通じて効果的な学習体験を提供します。また、様々な音部記号、調号、臨時記号に対応しており、すべてのレベルの音楽学習者に適しています。",
        description4:
          "Note Quizで音符読み能力を向上させ、音楽学習の喜びを体験してください！",
      },
      cta: {
        title: "今すぐ始めましょう！",
        description: "音符読み能力を向上させ、音楽学習をより楽しくしましょう。",
        button: "ゲーム開始",
      },
      footer: {
        copyright: "© 2024 Note Quiz. All rights reserved.",
        tagline: "音楽学習のための対話型音符認識ゲーム",
      },
    },
  },

  es: {
    gameTitle: "Quiz de Notas",
    startGame: "Iniciar Juego",
    pauseGame: "Pausar",
    resumeGame: "Reanudar",
    endGame: "Terminar Juego",
    resetGame: "Reiniciar",
    settings: "Configuración",

    gameStates: {
      idle: "En espera",
      playing: "Jugando",
      paused: "Pausado",
      finished: "Terminado",
    },

    clefs: {
      treble: "Clave de Sol",
      bass: "Clave de Fa",
      alto: "Clave de Do en 3ª",
      tenor: "Clave de Do en 4ª",
      random: "Aleatorio",
    },

    answerModes: {
      piano: "Teclas de Piano",
      solfege: "Solfeo",
    },

    difficulties: {
      easy: "Fácil",
      medium: "Medio",
      hard: "Difícil",
      expert: "Experto",
    },

    keySignatures: {
      random: "Aleatorio",
    },

    settingsLabels: {
      clef: "Clave",
      keySignature: "Armadura",
      octaveRange: "Rango de Octavas",
      octaveMin: "Mín",
      octaveMax: "Máx",
      answerMode: "Modo de Respuesta",
      language: "Idioma",
      enableSound: "Habilitar Sonido",
      timeLimit: "Límite de Tiempo (segundos)",
      timeLimitEnable: "Habilitar Límite de Tiempo",
      resetToDefault: "Restablecer por Defecto",
      cancel: "Cancelar",
      apply: "Aplicar",
      random: "Aleatorio",
      staffRange: "Rango del Pentagrama",
      ledgerLinesAbove: "Líneas Adicionales Arriba",
      ledgerLinesBelow: "Líneas Adicionales Abajo",
      ledgerLinesInstruction:
        "Más líneas adicionales permiten un rango más amplio de notas.",
      accidentals: "Alteraciones",
      accidentalProbability: "Probabilidad de Alteraciones",
      resetAllStats: "Restablecer Todas las Estadísticas",
    },

    piano: {
      instruction: "Haz clic para seleccionar una nota",
      selectedNote: "Nota Seleccionada",
    },

    solfege: {
      title: "Entrada de Solfeo",
      instruction: "Haz clic en el solfeo para seleccionar una nota",
      selectedNote: "Nota Seleccionada",
      notes: {
        C: "Do",
        "C#": "Do♯",
        D: "Re",
        "D#": "Re♯",
        E: "Mi",
        F: "Fa",
        "F#": "Fa♯",
        G: "Sol",
        "G#": "Sol♯",
        A: "La",
        "A#": "La♯",
        B: "Si",
      },
    },

    messages: {
      correct: "¡Correcto!",
      incorrect: "Incorrecto",
      timeUp: "¡Tiempo agotado!",
      gameComplete: "¡Juego completado!",
      newRecord: "¡Nuevo récord!",
      correctAnswer: "Respuesta correcta",
      yourAnswer: "Tu respuesta",
      playSound: "Reproducir sonido",
      startGameInstruction: "Revisa la configuración para comenzar el juego.",
      gameCompleteInstruction:
        "Juego completado. Revisa tus resultados en el marcador.",
    },

    scoreboard: {
      title: "Marcador",
      correct: "Correcto",
      total: "Total",
      accuracy: "Precisión",
      gameResult: "Resultado del Juego",
      finalScore: "Puntuación Final",
      finalAccuracy: "Precisión Final",
      totalTime: "Tiempo Total",
      averageTime: "Tiempo Promedio",
      overallStats: "Estadísticas Generales",
      gamesPlayed: "Juegos Jugados",
      bestAccuracy: "Mejor Precisión",
      bestTime: "Mejor Tiempo",
      overallAccuracy: "Precisión General",
      recentAnswers: "Respuestas Recientes",
      achievements: "Logros",
    },

    timer: {
      elapsed: "Tiempo Transcurrido",
      remaining: "Tiempo Restante",
      timeLimit: "límite de tiempo",
    },

    achievements: {
      perfect: "🏆 ¡Perfecto!",
      excellent: "⭐ Excelente",
      good: "👍 Bien",
      endurance: "💪 Resistencia",
      fast: "⚡ Rápido",
    },

    units: {
      seconds: "seg",
      games: "juegos",
      questions: "preguntas",
    },

    ui: {
      welcome: "¡Bienvenido al Quiz de Notas!",
      description: "¡Aprende a leer notas musicales por vista y sonido!",
      features: {
        customSettings: "Configuración Personalizada",
        realTimeFeedback: "Retroalimentación en Tiempo Real",
      },
      currentQuestionTime: "Tiempo de Pregunta Actual",
      accidentalDescription:
        "Cuando las alteraciones están habilitadas, se pueden agregar ♯, ♭, ♮ a notas individuales además de la armadura.",
      ledgerLinesDescription:
        "Más líneas adicionales permiten un rango más amplio de preguntas.",
    },

    home: {
      hero: {
        title: "Quiz de Notas",
        description: "¡Aprende a leer notas musicales por vista y sonido!",
        cta: "Iniciar Juego",
      },
      features: {
        title: "Características Principales",
        soundPlayback: {
          title: "Reproducción de Sonido",
          description:
            "Escucha el sonido preciso de cada nota mientras aprendes",
        },
        variousClefs: {
          title: "Varios Claves",
          description: "Soporte para claves de Sol, Fa, Do (Alto) y Do (Tenor)",
        },
        instantFeedback: {
          title: "Retroalimentación Instantánea",
          description: "Verifica tus respuestas inmediatamente y aprende",
        },
        multiLanguage: {
          title: "Soporte Multilingüe",
          description: "Soporte para 6 idiomas en todo el mundo",
        },
      },
      howToUse: {
        title: "Cómo Usar",
        step1: {
          title: "Iniciar Juego",
          description:
            'Haz clic en el botón "Iniciar Juego" para comenzar a aprender notas',
        },
        step2: {
          title: "Verificar Nota",
          description: "Visualiza la nota en el pentagrama y escucha el sonido",
        },
        step3: {
          title: "Ingresar Respuesta",
          description:
            "Ingresa tu respuesta usando el teclado de piano o botones de solfeo",
        },
        step4: {
          title: "Continuar Aprendiendo",
          description:
            "Sigue resolviendo problemas para mejorar tu habilidad de lectura de notas",
        },
      },
      faq: {
        title: "Preguntas Frecuentes (FAQ)",
        q1: {
          question: "¿Qué es Note Quiz?",
          answer:
            "Note Quiz es un juego de aprendizaje interactivo diseñado para mejorar tu capacidad de leer notas musicales en partituras. Proporciona notación visual y sonido juntos para mejorar rápidamente la capacidad de reconocimiento de notas.",
        },
        q2: {
          question: "¿Qué claves se admiten?",
          answer:
            "Admitimos Clave de Sol, Clave de Fa, Clave de Do (Alto) y Clave de Do (Tenor). Puedes aprender cada clave por separado.",
        },
        q3: {
          question: "¿Puedo aprender armaduras?",
          answer:
            "Sí, puedes resolver problemas con varias armaduras. Puedes seleccionar una armadura específica en la configuración del juego o establecerla en aleatorio.",
        },
        q4: {
          question: "¿Qué idiomas se admiten?",
          answer:
            "Admitimos 6 idiomas: inglés, coreano, japonés, español, alemán y francés. El idioma se selecciona automáticamente según la configuración de tu navegador.",
        },
        q5: {
          question: "¿Hay algún costo?",
          answer:
            "No, Note Quiz es completamente gratuito. Puedes usarlo en cualquier momento sin registro ni pago.",
        },
        q6: {
          question: "¿Puedo usarlo en dispositivos móviles?",
          answer:
            "Sí, Note Quiz es una aplicación web receptiva que funciona perfectamente en todos los dispositivos (escritorio, tableta, móvil).",
        },
      },
      about: {
        title: "Acerca de Note Quiz",
        description1:
          "Note Quiz es una plataforma de aprendizaje interactiva diseñada para que los músicos desarrollen la capacidad de reconocer rápidamente notas de partituras.",
        description2:
          "Especialmente para personas que aprenden instrumentos como armónica, piano y canto que tienen dificultades con la lectura de notas, este juego permite aprender de manera divertida.",
        description3:
          "Proporciona una experiencia de aprendizaje efectiva a través de la visualización de partituras, reproducción de sonido preciso y retroalimentación instantánea. También admite varios claves, armaduras y alteraciones, lo que lo hace adecuado para músicos de todos los niveles.",
        description4:
          "¡Mejora tu habilidad de lectura de notas con Note Quiz y experimenta la alegría del aprendizaje musical!",
      },
      cta: {
        title: "¡Comienza Ahora!",
        description:
          "Mejora tu habilidad de lectura de notas y haz que el aprendizaje musical sea más agradable.",
        button: "Iniciar Juego",
      },
      footer: {
        copyright: "© 2024 Note Quiz. All rights reserved.",
        tagline:
          "Juego interactivo de reconocimiento de notas para aprendizaje musical",
      },
    },
  },

  de: {
    gameTitle: "Noten-Quiz",
    startGame: "Spiel starten",
    pauseGame: "Pausieren",
    resumeGame: "Fortsetzen",
    endGame: "Spiel beenden",
    resetGame: "Zurücksetzen",
    settings: "Einstellungen",

    gameStates: {
      idle: "Bereit",
      playing: "Spielend",
      paused: "Pausiert",
      finished: "Beendet",
    },

    clefs: {
      treble: "Violinschlüssel",
      bass: "Bassschlüssel",
      alto: "Altschlüssel",
      tenor: "Tenorschlüssel",
      random: "Zufällig",
    },

    answerModes: {
      piano: "Klaviertasten",
      solfege: "Solmisation",
    },

    difficulties: {
      easy: "Einfach",
      medium: "Mittel",
      hard: "Schwer",
      expert: "Experte",
    },

    keySignatures: {
      random: "Zufällig",
    },

    settingsLabels: {
      clef: "Notenschlüssel",
      keySignature: "Vorzeichen",
      octaveRange: "Oktavbereich",
      octaveMin: "Min",
      octaveMax: "Max",
      answerMode: "Antwortmodus",
      language: "Sprache",
      enableSound: "Ton aktivieren",
      timeLimit: "Zeitlimit (Sekunden)",
      timeLimitEnable: "Zeitlimit aktivieren",
      resetToDefault: "Auf Standard zurücksetzen",
      cancel: "Abbrechen",
      apply: "Anwenden",
      random: "Zufällig",
      staffRange: "Notenlinienbereich",
      ledgerLinesAbove: "Hilfslinien oben",
      ledgerLinesBelow: "Hilfslinien unten",
      ledgerLinesInstruction:
        "Mehr Hilfslinien ermöglichen einen größeren Notenbereich.",
      accidentals: "Vorzeichen",
      accidentalProbability: "Vorzeichen-Wahrscheinlichkeit",
      resetAllStats: "Alle Statistiken zurücksetzen",
    },

    piano: {
      instruction: "Klicken Sie, um eine Note auszuwählen",
      selectedNote: "Ausgewählte Note",
    },

    solfege: {
      title: "Solmisation-Eingabe",
      instruction: "Klicken Sie auf Solmisation, um eine Note auszuwählen",
      selectedNote: "Ausgewählte Note",
      notes: {
        C: "Do",
        "C#": "Do♯",
        D: "Re",
        "D#": "Re♯",
        E: "Mi",
        F: "Fa",
        "F#": "Fa♯",
        G: "Sol",
        "G#": "Sol♯",
        A: "La",
        "A#": "La♯",
        B: "Si",
      },
    },

    messages: {
      correct: "Richtig!",
      incorrect: "Falsch",
      timeUp: "Zeit abgelaufen!",
      gameComplete: "Spiel beendet!",
      newRecord: "Neuer Rekord!",
      correctAnswer: "Richtige Antwort",
      yourAnswer: "Ihre Antwort",
      playSound: "Ton abspielen",
      startGameInstruction:
        "Überprüfen Sie die Einstellungen, um das Spiel zu starten.",
      gameCompleteInstruction:
        "Spiel beendet. Überprüfen Sie Ihre Ergebnisse auf der Anzeigetafel.",
    },

    scoreboard: {
      title: "Anzeigetafel",
      correct: "Richtig",
      total: "Gesamt",
      accuracy: "Genauigkeit",
      gameResult: "Spielergebnis",
      finalScore: "Endpunktzahl",
      finalAccuracy: "Endgenauigkeit",
      totalTime: "Gesamtzeit",
      averageTime: "Durchschnittszeit",
      overallStats: "Gesamtstatistiken",
      gamesPlayed: "Gespielte Spiele",
      bestAccuracy: "Beste Genauigkeit",
      bestTime: "Beste Zeit",
      overallAccuracy: "Gesamtgenauigkeit",
      recentAnswers: "Letzte Antworten",
      achievements: "Erfolge",
    },

    timer: {
      elapsed: "Verstrichene Zeit",
      remaining: "Verbleibende Zeit",
      timeLimit: "Zeitlimit",
    },

    achievements: {
      perfect: "🏆 Perfekt!",
      excellent: "⭐ Ausgezeichnet",
      good: "👍 Gut",
      endurance: "💪 Ausdauer",
      fast: "⚡ Schnell",
    },

    units: {
      seconds: "Sek",
      games: "Spiele",
      questions: "Fragen",
    },

    ui: {
      welcome: "Willkommen beim Noten-Quiz!",
      description: "Lernen Sie, Musiknoten durch Sehen und Hören zu lesen!",
      features: {
        customSettings: "Benutzerdefinierte Einstellungen",
        realTimeFeedback: "Echtzeit-Feedback",
      },
      currentQuestionTime: "Aktuelle Fragenzeit",
      accidentalDescription:
        "Wenn Vorzeichen aktiviert sind, können ♯, ♭, ♮ zu einzelnen Noten zusätzlich zur Tonart hinzugefügt werden.",
      ledgerLinesDescription:
        "Mehr Hilfslinien ermöglichen einen größeren Bereich von Fragen.",
    },

    home: {
      hero: {
        title: "Noten-Quiz",
        description: "Lernen Sie, Musiknoten durch Sehen und Hören zu lesen!",
        cta: "Spiel starten",
      },
      features: {
        title: "Hauptmerkmale",
        soundPlayback: {
          title: "Soundwiedergabe",
          description: "Hören Sie den genauen Klang jeder Note beim Lernen",
        },
        variousClefs: {
          title: "Verschiedene Notenschlüssel",
          description:
            "Unterstützung für Violinschlüssel, Bassschlüssel, Alt- und Tenorschlüssel",
        },
        instantFeedback: {
          title: "Sofortiges Feedback",
          description: "Überprüfen Sie Ihre Antworten sofort und lernen Sie",
        },
        multiLanguage: {
          title: "Mehrsprachige Unterstützung",
          description: "Unterstützung für 6 Sprachen weltweit",
        },
      },
      howToUse: {
        title: "Anleitung",
        step1: {
          title: "Spiel starten",
          description:
            'Klicken Sie auf die Schaltfläche "Spiel starten", um mit dem Notenlernen zu beginnen',
        },
        step2: {
          title: "Note überprüfen",
          description:
            "Sehen Sie sich die Note auf dem Notensystem an und hören Sie den Klang",
        },
        step3: {
          title: "Antwort eingeben",
          description:
            "Geben Sie Ihre Antwort mit der Klaviertastatur oder Solmisations-Schaltflächen ein",
        },
        step4: {
          title: "Lernen fortsetzen",
          description:
            "Lösen Sie weiterhin Aufgaben, um Ihre Notenlese-Fähigkeiten zu verbessern",
        },
      },
      faq: {
        title: "Häufig gestellte Fragen (FAQ)",
        q1: {
          question: "Was ist Note Quiz?",
          answer:
            "Note Quiz ist ein interaktives Lernspiel, das entwickelt wurde, um Ihre Fähigkeit zu verbessern, Musiknoten aus Noten zu lesen. Es bietet visuelle Notation und Klang zusammen, um die Notenerkennung schnell zu verbessern.",
        },
        q2: {
          question: "Welche Notenschlüssel werden unterstützt?",
          answer:
            "Wir unterstützen Violinschlüssel, Bassschlüssel, Altschlüssel und Tenorschlüssel. Sie können jeden Notenschlüssel separat erlernen.",
        },
        q3: {
          question: "Kann ich Tonarten lernen?",
          answer:
            "Ja, Sie können Aufgaben mit verschiedenen Tonarten lösen. Sie können eine bestimmte Tonart in den Spieleinstellungen auswählen oder auf Zufallsmodus einstellen.",
        },
        q4: {
          question: "Welche Sprachen werden unterstützt?",
          answer:
            "Wir unterstützen 6 Sprachen: Englisch, Koreanisch, Japanisch, Spanisch, Deutsch und Französisch. Die Sprache wird automatisch basierend auf Ihren Browsereinstellungen ausgewählt.",
        },
        q5: {
          question: "Kostet es etwas?",
          answer:
            "Nein, Note Quiz ist völlig kostenlos. Sie können es jederzeit ohne Registrierung oder Zahlung nutzen.",
        },
        q6: {
          question: "Kann ich es auf Mobilgeräten verwenden?",
          answer:
            "Ja, Note Quiz ist eine responsive Webanwendung, die auf allen Geräten (Desktop, Tablet, Mobilgerät) perfekt funktioniert.",
        },
      },
      about: {
        title: "Über Note Quiz",
        description1:
          "Note Quiz ist eine interaktive Lernplattform, die entwickelt wurde, damit Musikschüler die Fähigkeit entwickeln, Noten aus Noten schnell zu erkennen.",
        description2:
          "Besonders für Menschen, die Instrumente wie Mundharmonika, Klavier und Gesang lernen und Schwierigkeiten beim Notenlesen haben, ermöglicht dieses Spiel unterhaltsames Lernen.",
        description3:
          "Es bietet ein effektives Lernerlebnis durch visuelle Notenanzeigte, genaue Soundwiedergabe und sofortiges Feedback. Es unterstützt auch verschiedene Notenschlüssel, Tonarten und Vorzeichen und ist daher für Musikschüler aller Niveaus geeignet.",
        description4:
          "Verbessern Sie Ihre Notenlese-Fähigkeiten mit Note Quiz und erleben Sie die Freude des Musiklernens!",
      },
      cta: {
        title: "Jetzt beginnen!",
        description:
          "Verbessern Sie Ihre Notenlese-Fähigkeiten und machen Sie das Musiklernen angenehmer.",
        button: "Spiel starten",
      },
      footer: {
        copyright: "© 2024 Note Quiz. All rights reserved.",
        tagline: "Interaktives Notenerkennung-Spiel zum Musiklernen",
      },
    },
  },

  fr: {
    gameTitle: "Quiz des Notes",
    startGame: "Commencer le Jeu",
    pauseGame: "Pause",
    resumeGame: "Reprendre",
    endGame: "Terminer le Jeu",
    resetGame: "Réinitialiser",
    settings: "Paramètres",

    gameStates: {
      idle: "En attente",
      playing: "En cours",
      paused: "En pause",
      finished: "Terminé",
    },

    clefs: {
      treble: "Clé de Sol",
      bass: "Clé de Fa",
      alto: "Clé d'Ut 3ème",
      tenor: "Clé d'Ut 4ème",
      random: "Aléatoire",
    },

    answerModes: {
      piano: "Touches de Piano",
      solfege: "Solfège",
    },

    difficulties: {
      easy: "Facile",
      medium: "Moyen",
      hard: "Difficile",
      expert: "Expert",
    },

    keySignatures: {
      random: "Aléatoire",
    },

    settingsLabels: {
      clef: "Clé",
      keySignature: "Armure",
      octaveRange: "Gamme d'Octaves",
      octaveMin: "Min",
      octaveMax: "Max",
      answerMode: "Mode de Réponse",
      language: "Langue",
      enableSound: "Activer le Son",
      timeLimit: "Limite de Temps (secondes)",
      timeLimitEnable: "Activer la Limite de Temps",
      resetToDefault: "Rétablir par Défaut",
      cancel: "Annuler",
      apply: "Appliquer",
      random: "Aléatoire",
      staffRange: "Gamme de Portée",
      ledgerLinesAbove: "Lignes Supplémentaires Au-dessus",
      ledgerLinesBelow: "Lignes Supplémentaires En-dessous",
      ledgerLinesInstruction:
        "Plus de lignes supplémentaires permettent une gamme plus large de notes.",
      accidentals: "Altérations",
      accidentalProbability: "Probabilité d'Altérations",
      resetAllStats: "Réinitialiser Toutes les Statistiques",
    },

    piano: {
      instruction: "Cliquez pour sélectionner une note",
      selectedNote: "Note Sélectionnée",
    },

    solfege: {
      title: "Entrée Solfège",
      instruction: "Cliquez sur le solfège pour sélectionner une note",
      selectedNote: "Note Sélectionnée",
      notes: {
        C: "Do",
        "C#": "Do♯",
        D: "Ré",
        "D#": "Ré♯",
        E: "Mi",
        F: "Fa",
        "F#": "Fa♯",
        G: "Sol",
        "G#": "Sol♯",
        A: "La",
        "A#": "La♯",
        B: "Si",
      },
    },

    messages: {
      correct: "Correct !",
      incorrect: "Incorrect",
      timeUp: "Temps écoulé !",
      gameComplete: "Jeu terminé !",
      newRecord: "Nouveau record !",
      correctAnswer: "Bonne réponse",
      yourAnswer: "Votre réponse",
      playSound: "Jouer le son",
      startGameInstruction: "Vérifiez les paramètres pour commencer le jeu.",
      gameCompleteInstruction:
        "Jeu terminé. Vérifiez vos résultats sur le tableau de bord.",
    },

    scoreboard: {
      title: "Tableau de Bord",
      correct: "Correct",
      total: "Total",
      accuracy: "Précision",
      gameResult: "Résultat du Jeu",
      finalScore: "Score Final",
      finalAccuracy: "Précision Finale",
      totalTime: "Temps Total",
      averageTime: "Temps Moyen",
      overallStats: "Statistiques Générales",
      gamesPlayed: "Jeux Joués",
      bestAccuracy: "Meilleure Précision",
      bestTime: "Meilleur Temps",
      overallAccuracy: "Précision Générale",
      recentAnswers: "Réponses Récentes",
      achievements: "Réussites",
    },

    timer: {
      elapsed: "Temps Écoulé",
      remaining: "Temps Restant",
      timeLimit: "limite de temps",
    },

    achievements: {
      perfect: "🏆 Parfait !",
      excellent: "⭐ Excellent",
      good: "👍 Bien",
      endurance: "💪 Endurance",
      fast: "⚡ Rapide",
    },

    units: {
      seconds: "sec",
      games: "jeux",
      questions: "questions",
    },

    ui: {
      welcome: "Bienvenue au Quiz des Notes !",
      description:
        "Apprenez à lire les notes de musique par la vue et l'ouïe !",
      features: {
        customSettings: "Paramètres Personnalisés",
        realTimeFeedback: "Retour en Temps Réel",
      },
      currentQuestionTime: "Temps de Question Actuel",
      accidentalDescription:
        "Lorsque les altérations sont activées, ♯, ♭, ♮ peuvent être ajoutés aux notes individuelles en plus de l'armure.",
      ledgerLinesDescription:
        "Plus de lignes supplémentaires permettent une gamme plus large de questions.",
    },

    home: {
      hero: {
        title: "Quiz des Notes",
        description:
          "Apprenez à lire les notes de musique par la vue et l'ouïe !",
        cta: "Commencer le Jeu",
      },
      features: {
        title: "Caractéristiques Principales",
        soundPlayback: {
          title: "Lecture Audio",
          description: "Écoutez le son précis de chaque note en apprenant",
        },
        variousClefs: {
          title: "Diverses Clés",
          description:
            "Support pour les clés de Sol, Fa, Do (Alto) et Do (Ténor)",
        },
        instantFeedback: {
          title: "Retour Instantané",
          description: "Vérifiez vos réponses immédiatement et apprenez",
        },
        multiLanguage: {
          title: "Support Multilingue",
          description: "Support pour 6 langues dans le monde",
        },
      },
      howToUse: {
        title: "Comment Utiliser",
        step1: {
          title: "Commencer le Jeu",
          description:
            'Cliquez sur le bouton "Commencer le Jeu" pour commencer à apprendre les notes',
        },
        step2: {
          title: "Vérifier la Note",
          description: "Visualisez la note sur la portée et écoutez le son",
        },
        step3: {
          title: "Entrer la Réponse",
          description:
            "Entrez votre réponse en utilisant le clavier de piano ou les boutons de solfège",
        },
        step4: {
          title: "Continuer l'Apprentissage",
          description:
            "Continuez à résoudre des problèmes pour améliorer vos compétences en lecture de notes",
        },
      },
      faq: {
        title: "Questions Fréquemment Posées (FAQ)",
        q1: {
          question: "Qu'est-ce que Note Quiz ?",
          answer:
            "Note Quiz est un jeu d'apprentissage interactif conçu pour améliorer votre capacité à lire les notes de musique à partir de partitions. Il fournit la notation visuelle et le son ensemble pour améliorer rapidement la capacité de reconnaissance des notes.",
        },
        q2: {
          question: "Quelles clés sont supportées ?",
          answer:
            "Nous supportons la clé de Sol, la clé de Fa, la clé de Do (Alto) et la clé de Do (Ténor). Vous pouvez apprendre chaque clé séparément.",
        },
        q3: {
          question: "Puis-je apprendre les armures ?",
          answer:
            "Oui, vous pouvez résoudre des problèmes avec diverses armures. Vous pouvez sélectionner une armure spécifique dans les paramètres du jeu ou la définir sur aléatoire.",
        },
        q4: {
          question: "Quelles langues sont supportées ?",
          answer:
            "Nous supportons 6 langues : anglais, coréen, japonais, espagnol, allemand et français. La langue est automatiquement sélectionnée en fonction des paramètres de votre navigateur.",
        },
        q5: {
          question: "Y a-t-il un coût ?",
          answer:
            "Non, Note Quiz est complètement gratuit. Vous pouvez l'utiliser à tout moment sans inscription ni paiement.",
        },
        q6: {
          question: "Puis-je l'utiliser sur mobile ?",
          answer:
            "Oui, Note Quiz est une application web réactive qui fonctionne parfaitement sur tous les appareils (ordinateur de bureau, tablette, mobile).",
        },
      },
      about: {
        title: "À Propos de Note Quiz",
        description1:
          "Note Quiz est une plateforme d'apprentissage interactive conçue pour que les musiciens développent la capacité à reconnaître rapidement les notes à partir de partitions.",
        description2:
          "Particulièrement pour les personnes qui apprennent des instruments comme l'harmonica, le piano et le chant qui ont du mal à lire les notes, ce jeu permet d'apprendre de manière amusante.",
        description3:
          "Il offre une expérience d'apprentissage efficace grâce à l'affichage visuel des partitions, la lecture audio précise et le retour instantané. Il supporte également diverses clés, armures et altérations, ce qui le rend adapté aux musiciens de tous les niveaux.",
        description4:
          "Améliorez vos compétences en lecture de notes avec Note Quiz et découvrez la joie de l'apprentissage musical !",
      },
      cta: {
        title: "Commencez Maintenant !",
        description:
          "Améliorez vos compétences en lecture de notes et rendez l'apprentissage musical plus agréable.",
        button: "Commencer le Jeu",
      },
      footer: {
        copyright: "© 2024 Note Quiz. All rights reserved.",
        tagline:
          "Jeu interactif de reconnaissance des notes pour l'apprentissage musical",
      },
    },
  },
};

export function getTranslation(language: Language): Translations {
  return translations[language] || translations.en;
}
