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
    // TODO(aboutsblank@2025-12-16T21:13:27+01): test support for multiple clefs
    clefs: string;
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
      clefs: "Clefs",
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
      // TODO(aboutsblank@2025-12-16T21:14:34+01): translation needed
      clefs: "MISSING TRANSLATION [CLEFS]",
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
      // TODO(aboutsblank@2025-12-16T21:14:34+01): translation needed
      clefs: "MISSING TRANSLATION [CLEFS]",
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
      // TODO(aboutsblank@2025-12-16T21:14:34+01): translation needed
      clefs: "MISSING TRANSLATION [CLEFS]",
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
      // TODO(aboutsblank@2025-12-16T21:14:34+01): translation needed
      clefs: "MISSING TRANSLATION [CLEFS]",
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
      // TODO(aboutsblank@2025-12-16T21:14:34+01): translation needed
      clefs: "MISSING TRANSLATION [CLEFS]",
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
  },
};

export function getTranslation(language: Language): Translations {
  return translations[language] || translations.en;
}
