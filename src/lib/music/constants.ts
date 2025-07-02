// 음표 이름 배열
export const NOTE_NAMES: NoteName[] = ["C", "D", "E", "F", "G", "A", "B"];

// 도레미 음표 이름
export const SOLFEGE_NOTES: SolfegeNote[] = [
  "도",
  "레",
  "미",
  "파",
  "솔",
  "라",
  "시",
];

// 영어-한국어 음표 매핑
export const NOTE_NAME_MAPPING: Record<NoteName, SolfegeNote> = {
  C: "도",
  D: "레",
  E: "미",
  F: "파",
  G: "솔",
  A: "라",
  B: "시",
};

// 한국어-영어 음표 매핑
export const SOLFEGE_TO_NOTE_MAPPING: Record<SolfegeNote, NoteName> = {
  도: "C",
  레: "D",
  미: "E",
  파: "F",
  솔: "G",
  라: "A",
  시: "B",
};

// 음자리표 정보
export const CLEFS: Record<ClefType, Clef> = {
  treble: {
    type: "treble",
    name: "Treble Clef",
    nameKo: "높은음자리표",
  },
  bass: {
    type: "bass",
    name: "Bass Clef",
    nameKo: "낮은음자리표",
  },
  alto: {
    type: "alto",
    name: "Alto Clef",
    nameKo: "알토음자리표",
  },
  tenor: {
    type: "tenor",
    name: "Tenor Clef",
    nameKo: "테너음자리표",
  },
};

// 주요 조표들
export const KEY_SIGNATURES: Record<string, KeySignature> = {
  C: {
    key: "C Major",
    sharps: [],
    flats: [],
    accidentalType: "natural",
  },
  G: {
    key: "G Major",
    sharps: ["F"],
    flats: [],
    accidentalType: "sharp",
  },
  D: {
    key: "D Major",
    sharps: ["F", "C"],
    flats: [],
    accidentalType: "sharp",
  },
  A: {
    key: "A Major",
    sharps: ["F", "C", "G"],
    flats: [],
    accidentalType: "sharp",
  },
  E: {
    key: "E Major",
    sharps: ["F", "C", "G", "D"],
    flats: [],
    accidentalType: "sharp",
  },
  B: {
    key: "B Major",
    sharps: ["F", "C", "G", "D", "A"],
    flats: [],
    accidentalType: "sharp",
  },
  "F#": {
    key: "F# Major",
    sharps: ["F", "C", "G", "D", "A", "E"],
    flats: [],
    accidentalType: "sharp",
  },
  "C#": {
    key: "C# Major",
    sharps: ["F", "C", "G", "D", "A", "E", "B"],
    flats: [],
    accidentalType: "sharp",
  },
  F: {
    key: "F Major",
    sharps: [],
    flats: ["B"],
    accidentalType: "flat",
  },
  Bb: {
    key: "Bb Major",
    sharps: [],
    flats: ["B", "E"],
    accidentalType: "flat",
  },
  Eb: {
    key: "Eb Major",
    sharps: [],
    flats: ["B", "E", "A"],
    accidentalType: "flat",
  },
  Ab: {
    key: "Ab Major",
    sharps: [],
    flats: ["B", "E", "A", "D"],
    accidentalType: "flat",
  },
  Db: {
    key: "Db Major",
    sharps: [],
    flats: ["B", "E", "A", "D", "G"],
    accidentalType: "flat",
  },
  Gb: {
    key: "Gb Major",
    sharps: [],
    flats: ["B", "E", "A", "D", "G", "C"],
    accidentalType: "flat",
  },
  Cb: {
    key: "Cb Major",
    sharps: [],
    flats: ["B", "E", "A", "D", "G", "C", "F"],
    accidentalType: "flat",
  },
};

// 옥타브 범위
export const OCTAVE_RANGE: Octave[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

// 각 음자리표별 기본 옥타브 범위
export const DEFAULT_OCTAVE_RANGES: Record<
  ClefType,
  { min: Octave; max: Octave }
> = {
  treble: { min: 4, max: 6 },
  bass: { min: 2, max: 4 },
  alto: { min: 3, max: 5 },
  tenor: { min: 3, max: 5 },
};

// 피아노 건반 레이아웃 (흰 건반과 검은 건반)
export const PIANO_KEYS = {
  WHITE_KEYS: ["C", "D", "E", "F", "G", "A", "B"] as NoteName[],
  BLACK_KEYS: ["C#", "D#", "F#", "G#", "A#"] as string[],
  KEY_PATTERN: [
    { note: "C", type: "white" },
    { note: "C#", type: "black" },
    { note: "D", type: "white" },
    { note: "D#", type: "black" },
    { note: "E", type: "white" },
    { note: "F", type: "white" },
    { note: "F#", type: "black" },
    { note: "G", type: "white" },
    { note: "G#", type: "black" },
    { note: "A", type: "white" },
    { note: "A#", type: "black" },
    { note: "B", type: "white" },
  ],
};

// 음표 주파수 (A4 = 440Hz 기준)
export const NOTE_FREQUENCIES: Record<string, number> = {
  C0: 16.35,
  "C#0": 17.32,
  D0: 18.35,
  "D#0": 19.45,
  E0: 20.6,
  F0: 21.83,
  "F#0": 23.12,
  G0: 24.5,
  "G#0": 25.96,
  A0: 27.5,
  "A#0": 29.14,
  B0: 30.87,
  C1: 32.7,
  "C#1": 34.65,
  D1: 36.71,
  "D#1": 38.89,
  E1: 41.2,
  F1: 43.65,
  "F#1": 46.25,
  G1: 49.0,
  "G#1": 51.91,
  A1: 55.0,
  "A#1": 58.27,
  B1: 61.74,
  C2: 65.41,
  "C#2": 69.3,
  D2: 73.42,
  "D#2": 77.78,
  E2: 82.41,
  F2: 87.31,
  "F#2": 92.5,
  G2: 98.0,
  "G#2": 103.83,
  A2: 110.0,
  "A#2": 116.54,
  B2: 123.47,
  C3: 130.81,
  "C#3": 138.59,
  D3: 146.83,
  "D#3": 155.56,
  E3: 164.81,
  F3: 174.61,
  "F#3": 185.0,
  G3: 196.0,
  "G#3": 207.65,
  A3: 220.0,
  "A#3": 233.08,
  B3: 246.94,
  C4: 261.63,
  "C#4": 277.18,
  D4: 293.66,
  "D#4": 311.13,
  E4: 329.63,
  F4: 349.23,
  "F#4": 369.99,
  G4: 392.0,
  "G#4": 415.3,
  A4: 440.0,
  "A#4": 466.16,
  B4: 493.88,
  C5: 523.25,
  "C#5": 554.37,
  D5: 587.33,
  "D#5": 622.25,
  E5: 659.25,
  F5: 698.46,
  "F#5": 739.99,
  G5: 783.99,
  "G#5": 830.61,
  A5: 880.0,
  "A#5": 932.33,
  B5: 987.77,
  C6: 1046.5,
  "C#6": 1108.73,
  D6: 1174.66,
  "D#6": 1244.51,
  E6: 1318.51,
  F6: 1396.91,
  "F#6": 1479.98,
  G6: 1567.98,
  "G#6": 1661.22,
  A6: 1760.0,
  "A#6": 1864.66,
  B6: 1975.53,
  C7: 2093.0,
  "C#7": 2217.46,
  D7: 2349.32,
  "D#7": 2489.02,
  E7: 2637.02,
  F7: 2793.83,
  "F#7": 2959.96,
  G7: 3135.96,
  "G#7": 3322.44,
  A7: 3520.0,
  "A#7": 3729.31,
  B7: 3951.07,
  C8: 4186.01,
  "C#8": 4434.92,
  D8: 4698.63,
  "D#8": 4978.03,
  E8: 5274.04,
  F8: 5587.65,
  "F#8": 5919.91,
  G8: 6271.93,
  "G#8": 6644.88,
  A8: 7040.0,
  "A#8": 7458.62,
  B8: 7902.13,
};

// 게임 기본 설정
export const DEFAULT_GAME_SETTINGS = {
  clef: "treble" as ClefType,
  keySignature: "C",
  staffRange: {
    ledgerLinesAbove: 2, // 오선지 위쪽 보조선 2개까지
    ledgerLinesBelow: 2, // 오선지 아래쪽 보조선 2개까지
  },
  answerMode: "piano" as const,
  enableSound: true,
  timeLimit: undefined,
  enableAccidentals: false, // 기본적으로 임시표 비활성화
  accidentalProbability: 0.3, // 30% 확률로 임시표 생성
};
