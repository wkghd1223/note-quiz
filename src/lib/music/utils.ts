import {
  Note,
  NoteName,
  SolfegeNote,
  ClefType,
  Octave,
  KeySignature,
  Question,
  GameSettings,
  Accidental,
} from "@/types/music";
import {
  NOTE_NAMES,
  NOTE_NAME_MAPPING,
  SOLFEGE_TO_NOTE_MAPPING,
  KEY_SIGNATURES,
  DEFAULT_OCTAVE_RANGES,
  NOTE_FREQUENCIES,
} from "./constants";

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
  const randomOctave =
    Math.floor(Math.random() * (octaveMax - octaveMin + 1)) + octaveMin;

  return {
    name: randomNote,
    accidental: "natural",
    octave: randomOctave as Octave,
  };
}

/**
 * 조표를 적용한 음표 생성
 */
export function applyKeySignature(
  note: Note,
  keySignature: KeySignature
): Note {
  const { name, octave } = note;
  let accidental: Accidental = "natural";

  // 샾이 적용되는 음표인지 확인
  if (keySignature.sharps.includes(name)) {
    accidental = "sharp";
  }
  // 플랫이 적용되는 음표인지 확인
  else if (keySignature.flats.includes(name)) {
    accidental = "flat";
  }

  return {
    name,
    accidental,
    octave,
  };
}

/**
 * 음표를 문자열로 변환
 */
export function noteToString(note: Note): string {
  const accidentalSymbol =
    note.accidental === "sharp" ? "#" : note.accidental === "flat" ? "b" : "";
  return `${note.name}${accidentalSymbol}${note.octave}`;
}

/**
 * 문자열을 음표로 변환
 */
export function stringToNote(noteString: string): Note | null {
  const match = noteString.match(/^([A-G])([#b]?)([0-8])$/);
  if (!match) return null;

  const [, noteName, accidentalSymbol, octaveStr] = match;
  const accidental: Accidental =
    accidentalSymbol === "#"
      ? "sharp"
      : accidentalSymbol === "b"
        ? "flat"
        : "natural";

  return {
    name: noteName as NoteName,
    accidental,
    octave: parseInt(octaveStr) as Octave,
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
  return (
    note1.name === note2.name &&
    note1.accidental === note2.accidental &&
    note1.octave === note2.octave
  );
}

/**
 * 음표가 조표에 의해 변경되는지 확인
 */
export function isNoteAffectedByKeySignature(
  note: Note,
  keySignature: KeySignature
): boolean {
  return (
    keySignature.sharps.includes(note.name) ||
    keySignature.flats.includes(note.name)
  );
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
export function getDefaultOctaveRange(clef: ClefType): {
  min: Octave;
  max: Octave;
} {
  return DEFAULT_OCTAVE_RANGES[clef];
}

/**
 * 보조선 범위에 따른 음표 생성
 */
function generateNoteInStaffRange(
  clef: ClefType,
  staffRange: { ledgerLinesAbove: number; ledgerLinesBelow: number }
): Note {
  // 오선지 기본 위치 (0-8, 0이 가장 아래 첫 번째 보조선, 8이 가장 위 첫 번째 보조선)
  // 실제 오선지는 1,2,3,4,5 (아래부터 위로)
  const staffBottom = -4; // 오선지 아래 첫 번째 간격
  const staffTop = 12; // 오선지 위 첫 번째 간격

  const minPosition = staffBottom - staffRange.ledgerLinesBelow * 2; // 아래쪽 보조선
  const maxPosition = staffTop + staffRange.ledgerLinesAbove * 2; // 위쪽 보조선

  // 가능한 모든 위치 (선과 간격 모두 포함)
  const allPositions = [];
  for (let pos = minPosition; pos <= maxPosition; pos += 1) {
    allPositions.push(pos);
  }

  // 랜덤 위치 선택
  const randomPosition =
    allPositions[Math.floor(Math.random() * allPositions.length)];

  // 위치를 음표로 변환
  return convertStaffPositionToNote(randomPosition, clef);
}

/**
 * 오선지 위치를 음표로 변환
 */
function convertStaffPositionToNote(position: number, clef: ClefType): Note {
  const noteNames: NoteName[] = ["C", "D", "E", "F", "G", "A", "B"];

  // 음자리표별 기준점 설정 (새로운 좌표계 기준)
  let baseOctave = 4;
  let baseNoteIndex = 0; // C
  let basePosition = 0; // 기본 위치

  switch (clef) {
    case "treble":
      // G4가 두 번째 줄 (position 2)
      baseOctave = 4;
      baseNoteIndex = 4; // G
      basePosition = 2;
      break;
    case "bass":
      // F3가 네 번째 줄 (position 6)
      baseOctave = 3;
      baseNoteIndex = 3; // F
      basePosition = 6;
      break;
    case "alto":
      // C4가 가운데 줄 (position 4)
      baseOctave = 4;
      baseNoteIndex = 0; // C
      basePosition = 4;
      break;
    case "tenor":
      // C4가 네 번째 줄 (position 6)
      baseOctave = 4;
      baseNoteIndex = 0; // C
      basePosition = 6;
      break;
  }

  // 위치 차이 계산 (반음계 단위가 아닌 음계 단위)
  const positionDiff = position - basePosition;

  // 음표 계산 (각 위치는 하나의 음계 단위)
  let noteIndex = baseNoteIndex + positionDiff;
  let octave = baseOctave;

  // 옥타브 조정
  while (noteIndex < 0) {
    noteIndex += 7;
    octave--;
  }
  while (noteIndex >= 7) {
    noteIndex -= 7;
    octave++;
  }

  return {
    name: noteNames[noteIndex],
    accidental: "natural",
    octave: Math.max(0, Math.min(8, octave)) as Octave,
  };
}

/**
 * 게임 설정에 따른 문제 생성
 */
export function generateQuestion(settings: GameSettings): Question {
  // 음자리표 결정
  const clef =
    settings.clef === "random"
      ? (["treble", "bass", "alto", "tenor"] as ClefType[])[
          Math.floor(Math.random() * 4)
        ]
      : settings.clef;

  // 조표 결정
  const keySignature =
    settings.keySignature === "random"
      ? getRandomKeySignature()
      : KEY_SIGNATURES[settings.keySignature] || KEY_SIGNATURES["C"];

  // 보조선 범위에 따른 음표 생성
  const baseNote = generateNoteInStaffRange(clef, settings.staffRange);

  // 조표 적용
  const displayNote = applyKeySignature(baseNote, keySignature);

  return {
    id: `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    note: baseNote,
    clef,
    keySignature,
    displayNote,
  };
}

/**
 * 답안 검증 (옥타브 무관)
 */
export function validateAnswer(question: Question, userAnswer: Note): boolean {
  // 기본 음표 이름이 같은지 확인 (조표와 옥타브는 무시)
  return question.note.name === userAnswer.name;
}

/**
 * 음자리표별 오선지 위치 계산 (SVG 좌표)
 */
export function getNotePositionOnStaff(note: Note, clef: ClefType): number {
  // 음표별 기본 위치 (C=0, D=1, E=2, ...)
  const notePositions: Record<NoteName, number> = {
    C: 0,
    D: 1,
    E: 2,
    F: 3,
    G: 4,
    A: 5,
    B: 6,
  };

  // 음자리표별 기준점 (convertStaffPositionToNote와 동일한 로직)
  let baseOctave = 4;
  let baseNoteIndex = 0;
  let basePosition = 0;

  switch (clef) {
    case "treble":
      baseOctave = 4;
      baseNoteIndex = 4; // G
      basePosition = 2;
      break;
    case "bass":
      baseOctave = 3;
      baseNoteIndex = 3; // F
      basePosition = 6;
      break;
    case "alto":
      baseOctave = 4;
      baseNoteIndex = 0; // C
      basePosition = 4;
      break;
    case "tenor":
      baseOctave = 4;
      baseNoteIndex = 0; // C
      basePosition = 6;
      break;
  }

  // 현재 음표의 절대 위치 계산
  const currentNoteIndex =
    notePositions[note.name] + (note.octave - baseOctave) * 7;
  const baseNoteAbsoluteIndex = baseNoteIndex + (baseOctave - baseOctave) * 7;

  // 상대 위치 계산
  const relativePosition = currentNoteIndex - baseNoteAbsoluteIndex;

  return basePosition + relativePosition;
}

/**
 * 음표가 오선지 위에 있는지 아래에 있는지 판단
 */
export function isNoteAboveStaff(position: number): boolean {
  return position > 8; // 오선지 위쪽 (첫 번째 보조선 위)
}

export function isNoteBelowStaff(position: number): boolean {
  return position < 0; // 오선지 아래쪽 (첫 번째 보조선 아래)
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
    // 아래쪽 보조선 (짝수 위치에만 선이 있음)
    for (let i = -2; i >= position; i -= 2) {
      lines.push(i);
    }
  } else if (position > 8) {
    // 위쪽 보조선 (짝수 위치에만 선이 있음)
    for (let i = 10; i <= position; i += 2) {
      lines.push(i);
    }
  }

  return lines;
}
