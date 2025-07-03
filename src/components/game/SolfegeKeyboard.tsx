"use client";

import React, { useState, useCallback } from "react";
import { playPianoNote } from "@/lib/music/audio";
import { useTranslation } from "@/hooks/useTranslation";

interface SolfegeKeyboardProps {
  onNoteClick?: (note: Note) => void;
  selectedNote?: Note | null;
  disabled?: boolean;
  className?: string;
}

// 도레미 키보드 레이아웃 (반음 포함)
type SolfegeKey = {
  note: string;
  accidental: "natural" | "sharp";
  color: "white" | "black";
};

const SOLFEGE_LAYOUT: SolfegeKey[] = [
  { note: "C", accidental: "natural", color: "white" },
  { note: "C", accidental: "sharp", color: "black" },
  { note: "D", accidental: "natural", color: "white" },
  { note: "D", accidental: "sharp", color: "black" },
  { note: "E", accidental: "natural", color: "white" },
  { note: "F", accidental: "natural", color: "white" },
  { note: "F", accidental: "sharp", color: "black" },
  { note: "G", accidental: "natural", color: "white" },
  { note: "G", accidental: "sharp", color: "black" },
  { note: "A", accidental: "natural", color: "white" },
  { note: "A", accidental: "sharp", color: "black" },
  { note: "B", accidental: "natural", color: "white" },
];

const SolfegeKeyboard: React.FC<SolfegeKeyboardProps> = ({
  onNoteClick,
  selectedNote,
  disabled = false,
  className = "",
}) => {
  const { t } = useTranslation();
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  // 도레미 텍스트 가져오기 함수
  const getSolfegeText = useCallback(
    (keyData: SolfegeKey): string => {
      const noteKey =
        keyData.accidental === "sharp" ? `${keyData.note}#` : keyData.note;
      return t.solfege.notes[noteKey as keyof typeof t.solfege.notes];
    },
    [t]
  );

  // 키 클릭 핸들러
  const handleKeyClick = useCallback(
    async (keyData: SolfegeKey) => {
      if (disabled) return;

      const note: Note = {
        name: keyData.note as NoteName,
        accidental: keyData.accidental,
        octave: 4, // 기본 옥타브 (옥타브 무관하므로 고정값)
      };

      const keyId = getSolfegeText(keyData);

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
    [disabled, onNoteClick, getSolfegeText]
  );

  // 선택된 키인지 확인
  const isKeySelected = useCallback(
    (keyData: SolfegeKey): boolean => {
      if (!selectedNote) return false;

      return (
        selectedNote.name === keyData.note &&
        selectedNote.accidental === keyData.accidental
      );
    },
    [selectedNote]
  );

  return (
    <div className={`solfege-keyboard ${className}`}>
      {/* 선택된 음표 정보 */}
      {/* <div className="mt-4 mb-2 text-center text-sm text-gray-600">
          <p>{t.solfege.instruction}</p>
          <p className="mt-1 font-medium text-blue-600">
            {t.solfege.selectedNote}:
            {selectedNote && (
              <>
                {" "}
                {SOLFEGE_LAYOUT.find(
                  (key) =>
                    key.note === selectedNote.name &&
                    key.accidental === selectedNote.accidental
                )?.solfege || selectedNote.name}
                {selectedNote.accidental === "sharp" && "♯"}
                {selectedNote.accidental === "flat" && "♭"}
              </>
            )}
          </p>
        </div> */}

      <div className="max-w-4xl mx-auto">
        {/* 도레미 키보드 */}
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
          {SOLFEGE_LAYOUT.map((keyData) => {
            const solfegeText = getSolfegeText(keyData);
            const isPressed = pressedKeys.has(solfegeText);
            const isSelected = isKeySelected(keyData);
            const isBlackKey = keyData.color === "black";

            return (
              <button
                key={solfegeText}
                className={`
                    solfege-key p-3 sm:p-4 rounded-lg border-2 font-bold text-sm sm:text-base
                    transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500
                    ${
                      isPressed
                        ? "shadow-inner transform scale-95"
                        : "hover:shadow-md"
                    }
                    ${isSelected ? "ring-2 ring-blue-300" : ""}
                    ${
                      disabled
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer"
                    }
                    ${
                      isBlackKey
                        ? isPressed
                          ? "bg-gray-600 border-gray-700 text-white"
                          : isSelected
                            ? "bg-gray-700 border-gray-800 text-white"
                            : "bg-gray-800 border-gray-900 text-white hover:bg-gray-700"
                        : isPressed
                          ? "bg-blue-200 border-blue-400 text-blue-800"
                          : isSelected
                            ? "bg-blue-100 border-blue-400 text-blue-700"
                            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                    }
                  `}
                onClick={() => handleKeyClick(keyData)}
                disabled={disabled}
                aria-label={solfegeText}
              >
                <div className="text-center">
                  <div className="text-lg sm:text-xl">{solfegeText}</div>
                  <div className="text-xs text-current opacity-75 mt-1">
                    {keyData.note}
                    {keyData.accidental === "sharp" && "♯"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SolfegeKeyboard;
