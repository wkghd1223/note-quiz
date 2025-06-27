// 음표 이름 (영어)
export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

// 음표 이름 (한국어 - 도레미)
export type SolfegeNote = '도' | '레' | '미' | '파' | '솔' | '라' | '시';

// 조표 (Accidental)
export type Accidental = 'natural' | 'sharp' | 'flat';

// 음자리표 (Clef)
export type ClefType = 'treble' | 'bass' | 'alto' | 'tenor';

// 옥타브 (일반적으로 0-8)
export type Octave = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// 완전한 음표 정보
export interface Note {
  name: NoteName;
  accidental: Accidental;
  octave: Octave;
}

// 음자리표 정보
export interface Clef {
  type: ClefType;
  name: string;
  nameKo: string;
}

// 조표 정보 (Key Signature)
export interface KeySignature {
  key: string;
  sharps: NoteName[];
  flats: NoteName[];
  accidentalType: 'sharp' | 'flat' | 'natural';
}

// 게임 난이도
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

// 게임 모드
export type GameMode = 'visual' | 'audio' | 'both';

// 답안 입력 방식
export type AnswerMode = 'piano' | 'solfege';

// 언어 설정
export type Language = 'en' | 'ko';

// 게임 설정
export interface GameSettings {
  clef: ClefType | 'random';
  keySignature: string | 'random';
  octaveRange: {
    min: Octave;
    max: Octave;
  };
  difficulty: Difficulty;
  gameMode: GameMode;
  answerMode: AnswerMode;
  language: Language;
  enableSound: boolean;
  timeLimit?: number; // seconds, undefined for no limit
}

// 게임 상태
export type GameState = 'idle' | 'playing' | 'paused' | 'finished';

// 문제 정보
export interface Question {
  id: string;
  note: Note;
  clef: ClefType;
  keySignature: KeySignature;
  displayNote: Note; // 조표가 적용된 실제 표시될 음표
}

// 답안 정보
export interface Answer {
  note: Note;
  timestamp: number;
  isCorrect: boolean;
}

// 게임 결과
export interface GameResult {
  totalQuestions: number;
  correctAnswers: number;
  totalTime: number;
  averageTime: number;
  accuracy: number;
  answers: Answer[];
}

// 게임 통계
export interface GameStats {
  gamesPlayed: number;
  totalCorrect: number;
  totalQuestions: number;
  bestAccuracy: number;
  bestTime: number;
  averageAccuracy: number;
}
