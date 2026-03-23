"use client";

import React, { useState, useCallback } from "react";
import { playPianoNote } from "@/lib/music/audio";
import { PIANO_KEYS } from "@/lib/music/constants";
// import { useTranslation } from "@/hooks/useTranslation";

interface PianoKeyboardProps {
  onNoteClick?: (note: Note) => void;
  selectedNote?: Note | null;
  disabled?: boolean;
  showLabels?: boolean;
  className?: string;
}

interface PianoKey {
  note: NoteName | string;
  octave: Octave;
  type: "white" | "black";
  isPressed: boolean;
}

const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
  onNoteClick,
  selectedNote,
  disabled = false,
  showLabels = true,
  className = "",
}) => {
  // const { t } = useTranslation();
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  // 키보드 키 생성
  const generateKeys = useCallback((): PianoKey[] => {
    const keys: PianoKey[] = [];
    const octave = 4; // 기본 옥타브

    PIANO_KEYS.KEY_PATTERN.forEach(({ note, type }) => {
      const keyId = `${note}${octave}`;
      keys.push({
        note: note as NoteName,
        octave: octave as Octave,
        type: type as "white" | "black",
        isPressed: pressedKeys.has(keyId),
      });
    });

    return keys;
  }, [pressedKeys]);

  // 키 클릭 핸들러
  const handleKeyClick = useCallback(
    async (key: PianoKey) => {
      if (disabled) return;

      const note: Note = {
        name: key.note.replace("#", "") as NoteName,
        accidental: key.note.includes("#") ? "sharp" : "natural",
        octave: key.octave,
      };

      const keyId = `${key.note}${key.octave}`;

      // 키 눌림 상태 업데이트
      setPressedKeys((prev) => new Set(prev).add(keyId));

      // 오디오 재생
      try {
        await playPianoNote(note, 500);
      } catch (error) {
        console.error("Failed to play note:", error);
      }

      // 키 눌림 상태 해제
      setTimeout(() => {
        setPressedKeys((prev) => {
          const newSet = new Set(prev);
          newSet.delete(keyId);
          return newSet;
        });
      }, 150);

      // 부모 컴포넌트에 알림
      onNoteClick?.(note);
    },
    [disabled, onNoteClick]
  );

  // 선택된 키인지 확인
  const isKeySelected = useCallback(
    (key: PianoKey): boolean => {
      if (!selectedNote) return false;

      const keyNote = key.note.includes("#")
        ? key.note.replace("#", "")
        : key.note;
      const keyAccidental = key.note.includes("#") ? "sharp" : "natural";

      return (
        selectedNote.name === keyNote &&
        selectedNote.accidental === keyAccidental
        // 옥타브는 비교하지 않음
      );
    },
    [selectedNote]
  );

  const keys = generateKeys();
  const whiteKeys = keys.filter((key) => key.type === "white");
  const blackKeys = keys.filter((key) => key.type === "black");

  // 키보드 너비 계산
  const keyboardWidth = whiteKeys.length * 40; // 흰 건반 너비 40px

  return (
    <div className={`piano-keyboard ${className}`}>
      {/* 키보드 정보 */}
      {/* <div className="mt-4 mb-2 text-center text-sm text-gray-600">
        <p>{t.piano.instruction}</p>
        <p className="mt-1 font-medium text-blue-600">
          {t.piano.selectedNote}:
          {selectedNote && (
            <>
              {selectedNote.name}
              {selectedNote.accidental === "sharp" && "#"}
              {selectedNote.accidental === "flat" && "♭"}
              {selectedNote.octave}
            </>
          )}
        </p>
      </div> */}

      <div
        className="relative select-none rounded-[1.75rem] border border-[#ded6f7] bg-[#faf9fe] p-4 shadow-[0_14px_40px_rgba(76,29,149,0.08)]"
        style={{ width: keyboardWidth, height: 200 }}
      >
        {/* 흰 건반 */}
        <div className="flex">
          {whiteKeys.map((key) => {
            const keyId = `${key.note}${key.octave}`;
            const isPressed = key.isPressed;
            const isSelected = isKeySelected(key);

            return (
              <button
                key={keyId}
                className={`
                  white-key relative border border-[#d7deea] bg-white md:hover:bg-[#f5f3ff]
                  transition-colors duration-75
                  ${isPressed ? "brightness-90 shadow-inner" : ""}
                  ${isSelected ? "border-[#7c3aed] bg-[#ede9fe] shadow-[inset_0_0_0_1px_rgba(124,58,237,0.18)]" : ""}
                  ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
                `}
                style={{
                  width: 40,
                  height: 200,
                  borderRadius: "0 0 16px 16px",
                }}
                onClick={() => handleKeyClick(key)}
                disabled={disabled}
                aria-label={`${key.note}${key.octave}`}
              >
                {showLabels && (
                  <span className="absolute bottom-4 left-1/2 -translate-x-1/2 transform text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    {key.note}
                    {/* <sub className="text-xs">{key.octave}</sub> */}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 검은 건반 */}
        <div className="absolute top-0 left-0">
          {blackKeys.map((key) => {
            const keyId = `${key.note}${key.octave}`;
            const isPressed = key.isPressed;
            const isSelected = isKeySelected(key);

            // 검은 건반의 위치 계산
            const whiteKeyIndex = whiteKeys.findIndex(
              (wk) =>
                wk.octave === key.octave &&
                getWhiteKeyBeforeBlack(key.note as string) === wk.note
            );
            const leftPosition = whiteKeyIndex * 40 + 28; // 흰 건반 사이에 위치

            return (
              <button
                key={keyId}
                className={`
                  black-key absolute border border-[#0f172a] bg-[#0f172a] md:hover:bg-[#1e293b]
                  text-white transition-colors duration-75
                  ${isPressed ? "opacity-70 shadow-inner" : ""}
                  ${isSelected ? "border-[#6d28d9] bg-gradient-to-b from-[#6d28d9] to-[#4c1d95]" : ""}
                  ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
                `}
                style={{
                  width: 24,
                  height: 120,
                  left: leftPosition,
                  borderRadius: "0 0 10px 10px",
                  zIndex: 10,
                  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.28)",
                }}
                onClick={() => handleKeyClick(key)}
                disabled={disabled}
                aria-label={`${key.note}${key.octave}`}
              >
                {showLabels && (
                  <span className="absolute bottom-4 left-1/2 -translate-x-1/2 transform text-xs font-bold uppercase tracking-[0.14em] text-white">
                    {key.note}
                    {/* <sub className="text-xs">{key.octave}</sub> */}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 검은 건반 앞의 흰 건반 찾기
function getWhiteKeyBeforeBlack(blackNote: string): NoteName {
  const mapping: Record<string, NoteName> = {
    "C#": "C",
    "D#": "D",
    "F#": "F",
    "G#": "G",
    "A#": "A",
  };
  return mapping[blackNote] || "C";
}

export default PianoKeyboard;
