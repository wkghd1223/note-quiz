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
  const { name, octave, accidental } = note;

  // 이미 임시표가 있는 음표는 조표를 적용하지 않음
  if (accidental !== null && accidental !== "natural") {
    return note;
  }

  let newAccidental: Accidental | null = null;

  // 샾이 적용되는 음표인지 확인
  if (keySignature.sharps.includes(name)) {
    newAccidental = "sharp";
  }
  // 플랫이 적용되는 음표인지 확인
  else if (keySignature.flats.includes(name)) {
    newAccidental = "flat";
  }

  return {
    name,
    accidental: newAccidental,
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
  // 오선지 기본 위치 정의
  // 오선지 5줄: 0, 2, 4, 6, 8 (짝수는 선, 홀수는 간격)
  const staffMinPosition = 0; // 가장 아래 선
  const staffMaxPosition = 8; // 가장 위 선

  // 가능한 모든 위치 계산
  const allPositions = [];

  // 아래쪽 보조선 영역
  if ((staffRange?.ledgerLinesBelow || 0) > 0) {
    const belowMinPosition =
      staffMinPosition - (staffRange?.ledgerLinesBelow || 0) * 2;
    for (let pos = belowMinPosition; pos < staffMinPosition; pos += 1) {
      allPositions.push(pos);
    }
  }

  // 오선지 내부 (항상 포함)
  for (let pos = staffMinPosition; pos <= staffMaxPosition; pos += 1) {
    allPositions.push(pos);
  }

  // 위쪽 보조선 영역
  if ((staffRange?.ledgerLinesAbove || 0) > 0) {
    const aboveMaxPosition =
      staffMaxPosition + (staffRange?.ledgerLinesAbove || 0) * 2;
    for (let pos = staffMaxPosition + 1; pos <= aboveMaxPosition; pos += 1) {
      allPositions.push(pos);
    }
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
    accidental: null,
    octave: Math.max(0, Math.min(8, octave)) as Octave,
  };
}

/**
 * 임시표 추가 함수
 */
function addAccidental(
  note: Note,
  settings: GameSettings,
  keySignature: KeySignature
): Note {
  // 임시표가 비활성화되어 있으면 아무것도 하지 않음
  if (!settings.enableAccidentals) {
    return note;
  }

  // 임시표가 나올 확률 체크
  if (Math.random() > settings.accidentalProbability) {
    return note;
  }

  // 가능한 임시표들 (natural, sharp, flat)
  const possibleAccidentals: Accidental[] = ["natural", "sharp", "flat"];

  // E와 B는 샵이 없고, F와 C는 플랫이 없음 (반음 관계)
  let availableAccidentals = [...possibleAccidentals];

  if (note.name === "E" || note.name === "B") {
    availableAccidentals = availableAccidentals.filter(
      (acc) => acc !== "sharp"
    );
  }

  if (note.name === "F" || note.name === "C") {
    availableAccidentals = availableAccidentals.filter((acc) => acc !== "flat");
  }

  // 조표와 겹치는 경우 처리
  const isSharpInKeySignature = keySignature.sharps.includes(note.name);
  const isFlatInKeySignature = keySignature.flats.includes(note.name);

  if (isSharpInKeySignature || isFlatInKeySignature) {
    // 조표가 적용된 음표는 natural만 가능 (조표를 취소하는 역할)
    // 하지만 확률적으로만 적용 - 항상 natural이 나오지 않도록
    availableAccidentals = ["natural"];
  } else {
    // 조표가 적용되지 않은 음표는 natural 제외 (natural은 표시하지 않음)
    availableAccidentals = availableAccidentals.filter(
      (acc) => acc !== "natural"
    );
  }

  // 사용 가능한 임시표가 없으면 원래 음표 반환
  if (availableAccidentals.length === 0) {
    return note;
  }

  // 랜덤 임시표 선택
  const randomAccidental =
    availableAccidentals[
      Math.floor(Math.random() * availableAccidentals.length)
    ];

  return {
    ...note,
    accidental: randomAccidental,
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
  let baseNote = generateNoteInStaffRange(clef, settings.staffRange);

  // 임시표 추가 (조표와 별개)
  baseNote = addAccidental(baseNote, settings, keySignature);

  // 조표 적용 (임시표가 있으면 조표는 무시됨)
  // applyKeySignature 함수 내에서 임시표 여부를 확인하므로 항상 호출 가능
  const displayNote = applyKeySignature(baseNote, keySignature);

  console.log(baseNote, displayNote);

  return {
    id: `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    note: baseNote,
    clef,
    keySignature,
    displayNote,
  };
}

/**
 * 이명동음 매핑 테이블
 */
const ENHARMONIC_EQUIVALENTS: Record<string, string[]> = {
  C: ["C", "B#", "Dbb"],
  "C#": ["C#", "Db", "B##"],
  D: ["D", "C##", "Ebb"],
  "D#": ["D#", "Eb", "Fbb"],
  E: ["E", "D##", "Fb"],
  F: ["F", "E#", "Gbb"],
  "F#": ["F#", "Gb", "E##"],
  G: ["G", "F##", "Abb"],
  "G#": ["G#", "Ab"],
  A: ["A", "G##", "Bbb"],
  "A#": ["A#", "Bb", "Cbb"],
  B: ["B", "A##", "Cb"],
};

/**
 * 음표를 이명동음 표기로 변환 (조표와 임시표 고려)
 */
function getNoteWithAccidental(
  note: Note,
  keySignature?: KeySignature
): string {
  // 임시표가 있는 경우
  if (note.accidental === "sharp") {
    return `${note.name}#`;
  }
  if (note.accidental === "flat") {
    return `${note.name}b`;
  }
  if (note.accidental === "natural") {
    // natural 임시표는 조표를 취소하므로 기본 음표 반환
    return note.name;
  }

  // 임시표가 없는 경우 (null), 조표 확인
  if (keySignature) {
    // 조표에 샵이 있는 음표인지 확인
    if (keySignature.sharps.includes(note.name)) {
      return `${note.name}#`;
    }
    // 조표에 플랫이 있는 음표인지 확인
    if (keySignature.flats.includes(note.name)) {
      return `${note.name}b`;
    }
  }

  // 조표도 없고 임시표도 없으면 기본 음표
  return note.name;
}

/**
 * 두 음표가 이명동음인지 확인
 */
function areEnharmonicEquivalents(note1: string, note2: string): boolean {
  // 각 음표가 속한 이명동음 그룹을 찾기
  for (const equivalents of Object.values(ENHARMONIC_EQUIVALENTS)) {
    if (equivalents.includes(note1) && equivalents.includes(note2)) {
      return true;
    }
  }
  return false;
}

/**
 * 답안 검증 (옥타브 무관, 이명동음 처리)
 */
export function validateAnswer(question: Question, userAnswer: Note): boolean {
  // 문제의 음표 (조표와 임시표가 적용된 최종 음표)
  const questionNoteStr = getNoteWithAccidental(
    question.note,
    question.keySignature
  );

  // 사용자 답안 음표 (조표 정보 없이 - 사용자가 입력한 그대로)
  const userAnswerStr = getNoteWithAccidental(userAnswer);

  // 이명동음 확인
  return areEnharmonicEquivalents(questionNoteStr, userAnswerStr);
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
