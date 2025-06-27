import {
  Note,
  NoteName,
  SolfegeNote,
  ClefType,
  Octave,
  KeySignature,
  Question,
  GameSettings,
  Accidental
} from '@/types/music';
import {
  NOTE_NAMES,
  NOTE_NAME_MAPPING,
  SOLFEGE_TO_NOTE_MAPPING,
  KEY_SIGNATURES,
  DEFAULT_OCTAVE_RANGES,
  NOTE_FREQUENCIES
} from './constants';

/**
 * 랜덤 음표 생성
 */
export function generateRandomNote(
  octaveMin: Octave = 4,
  octaveMax: Octave = 6,
  allowedNotes?: NoteName[]
): Note {
  const notes = allowedNotes || NOTE_NAMES;
  const randomNote = notes[Math.floor(Math.random() * notes.length)];
  const randomOctave = Math.floor(Math.random() * (octaveMax - octaveMin + 1)) + octaveMin;
  
  return {
    name: randomNote,
    accidental: 'natural',
    octave: randomOctave as Octave
  };
}

/**
 * 조표를 적용한 음표 생성
 */
export function applyKeySignature(note: Note, keySignature: KeySignature): Note {
  const { name, octave } = note;
  let accidental: Accidental = 'natural';

  // 샾이 적용되는 음표인지 확인
  if (keySignature.sharps.includes(name)) {
    accidental = 'sharp';
  }
  // 플랫이 적용되는 음표인지 확인
  else if (keySignature.flats.includes(name)) {
    accidental = 'flat';
  }

  return {
    name,
    accidental,
    octave
  };
}

/**
 * 음표를 문자열로 변환
 */
export function noteToString(note: Note): string {
  const accidentalSymbol = note.accidental === 'sharp' ? '#' : 
                          note.accidental === 'flat' ? 'b' : '';
  return `${note.name}${accidentalSymbol}${note.octave}`;
}

/**
 * 문자열을 음표로 변환
 */
export function stringToNote(noteString: string): Note | null {
  const match = noteString.match(/^([A-G])([#b]?)([0-8])$/);
  if (!match) return null;

  const [, noteName, accidentalSymbol, octaveStr] = match;
  const accidental: Accidental = accidentalSymbol === '#' ? 'sharp' :
                                accidentalSymbol === 'b' ? 'flat' : 'natural';

  return {
    name: noteName as NoteName,
    accidental,
    octave: parseInt(octaveStr) as Octave
  };
}

/**
 * 영어 음표명을 한국어(도레미)로 변환
 */
export function noteToSolfege(noteName: NoteName): SolfegeNote {
  return NOTE_NAME_MAPPING[noteName];
}

/**
 * 한국어(도레미)를 영어 음표명으로 변환
 */
export function solfegeToNote(solfege: SolfegeNote): NoteName {
  return SOLFEGE_TO_NOTE_MAPPING[solfege];
}

/**
 * 음표의 주파수 계산
 */
export function getNoteFrequency(note: Note): number {
  const noteString = noteToString(note);
  return NOTE_FREQUENCIES[noteString] || 440; // 기본값은 A4
}

/**
 * 두 음표가 같은지 비교
 */
export function notesEqual(note1: Note, note2: Note): boolean {
  return note1.name === note2.name &&
         note1.accidental === note2.accidental &&
         note1.octave === note2.octave;
}

/**
 * 음표가 조표에 의해 변경되는지 확인
 */
export function isNoteAffectedByKeySignature(note: Note, keySignature: KeySignature): boolean {
  return keySignature.sharps.includes(note.name) || keySignature.flats.includes(note.name);
}

/**
 * 랜덤 조표 선택
 */
export function getRandomKeySignature(): KeySignature {
  const keys = Object.keys(KEY_SIGNATURES);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return KEY_SIGNATURES[randomKey];
}

/**
 * 음자리표에 따른 기본 옥타브 범위 가져오기
 */
export function getDefaultOctaveRange(clef: ClefType): { min: Octave; max: Octave } {
  return DEFAULT_OCTAVE_RANGES[clef];
}

/**
 * 게임 설정에 따른 문제 생성
 */
export function generateQuestion(settings: GameSettings): Question {
  // 음자리표 결정
  const clef = settings.clef === 'random' 
    ? (['treble', 'bass', 'alto', 'tenor'] as ClefType[])[Math.floor(Math.random() * 4)]
    : settings.clef;

  // 조표 결정
  const keySignature = settings.keySignature === 'random'
    ? getRandomKeySignature()
    : KEY_SIGNATURES[settings.keySignature] || KEY_SIGNATURES['C'];

  // 옥타브 범위 결정
  const { min: octaveMin, max: octaveMax } = settings.octaveRange;

  // 기본 음표 생성
  const baseNote = generateRandomNote(octaveMin, octaveMax);

  // 조표 적용
  const displayNote = applyKeySignature(baseNote, keySignature);

  return {
    id: `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    note: baseNote,
    clef,
    keySignature,
    displayNote
  };
}

/**
 * 답안 검증
 */
export function validateAnswer(question: Question, userAnswer: Note): boolean {
  // 기본 음표 이름이 같은지 확인 (조표는 무시)
  return question.note.name === userAnswer.name && 
         question.note.octave === userAnswer.octave;
}

/**
 * 음자리표별 오선지 위치 계산 (SVG 좌표)
 */
export function getNotePositionOnStaff(note: Note, clef: ClefType): number {
  // 기준선에서의 상대적 위치 (반음계 단위)
  const notePositions: Record<NoteName, number> = {
    'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6
  };

  const basePosition = notePositions[note.name];
  const octaveOffset = (note.octave - 4) * 7; // 옥타브당 7개 위치

  // 음자리표별 기준점 조정
  let clefOffset = 0;
  switch (clef) {
    case 'treble':
      clefOffset = 0; // G4가 두 번째 줄
      break;
    case 'bass':
      clefOffset = -12; // F2가 네 번째 줄
      break;
    case 'alto':
      clefOffset = -7; // C4가 가운데 줄
      break;
    case 'tenor':
      clefOffset = -5; // C4가 네 번째 줄
      break;
  }

  return basePosition + octaveOffset + clefOffset;
}

/**
 * 음표가 오선지 위에 있는지 아래에 있는지 판단
 */
export function isNoteAboveStaff(position: number): boolean {
  return position > 8; // 오선지 위쪽
}

export function isNoteBelowStaff(position: number): boolean {
  return position < 0; // 오선지 아래쪽
}

/**
 * 보조선이 필요한지 판단
 */
export function needsLedgerLines(position: number): boolean {
  return position < 0 || position > 8;
}

/**
 * 필요한 보조선 위치들 계산
 */
export function getLedgerLinePositions(position: number): number[] {
  const lines: number[] = [];
  
  if (position < 0) {
    // 아래쪽 보조선
    for (let i = -2; i >= position; i -= 2) {
      lines.push(i);
    }
  } else if (position > 8) {
    // 위쪽 보조선
    for (let i = 10; i <= position; i += 2) {
      lines.push(i);
    }
  }
  
  return lines;
}
