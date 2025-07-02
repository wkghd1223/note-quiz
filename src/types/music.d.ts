// 음표 이름 (영어)
type NoteName = "C" | "D" | "E" | "F" | "G" | "A" | "B";

// 음표 이름 (한국어 - 도레미)
type SolfegeNote = "도" | "레" | "미" | "파" | "솔" | "라" | "시";

// 조표 (Accidental)
type Accidental = "natural" | "sharp" | "flat";

// 음자리표 (Clef)
type ClefType = "treble" | "bass" | "alto" | "tenor";

// 옥타브 (일반적으로 0-8)
type Octave = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// 완전한 음표 정보
interface Note {
  name: NoteName;
  accidental: Accidental | null;
  octave: Octave;
}

// 음자리표 정보
interface Clef {
  type: ClefType;
  name: string;
  nameKo: string;
}

// 조표 정보 (Key Signature)
interface KeySignature {
  key: string;
  sharps: NoteName[];
  flats: NoteName[];
  accidentalType: "sharp" | "flat" | "natural";
}

// 답안 입력 방식
type AnswerMode = "piano" | "solfege";

// 언어 설정
type Language = "en" | "ko";

// 게임 설정
interface GameSettings {
  clef: ClefType | "random";
  keySignature: string | "random";
  staffRange: {
    ledgerLinesAbove: number; // 오선지 위쪽 보조선 개수
    ledgerLinesBelow: number; // 오선지 아래쪽 보조선 개수
  };
  answerMode: AnswerMode;
  enableSound: boolean;
  timeLimit?: number; // seconds, undefined for no limit
  enableAccidentals: boolean; // 임시표 사용 여부
  accidentalProbability: number; // 임시표가 나올 확률 (0-1)
}

// 게임 상태
type GameState = "idle" | "playing" | "paused" | "finished";

// 문제 정보
interface Question {
  id: string;
  note: Note;
  clef: ClefType;
  keySignature: KeySignature;
  displayNote: Note; // 조표가 적용된 실제 표시될 음표
}

// 답안 정보
interface Answer {
  note: Note;
  timestamp: number;
  isCorrect: boolean;
  timeSpent: number; // 해당 문제에 걸린 시간 (밀리초)
}

// 게임 결과
interface GameResult {
  totalQuestions: number;
  correctAnswers: number;
  totalTime: number;
  averageTime: number;
  accuracy: number;
  answers: Answer[];
}

// 게임 통계
interface GameStats {
  gamesPlayed: number;
  totalCorrect: number;
  totalQuestions: number;
  bestTime: number;
  averageAccuracy: number;
}

interface Feedback {
  message: string;
  type: "success" | "error";
}
