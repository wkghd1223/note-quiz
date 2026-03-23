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

      <div className="mx-auto max-w-5xl">
        {/* 도레미 키보드 */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">
          {SOLFEGE_LAYOUT.map((keyData) => {
            const solfegeText = getSolfegeText(keyData);
            const isPressed = pressedKeys.has(solfegeText);
            const isSelected = isKeySelected(keyData);
            const isBlackKey = keyData.color === "black";

            return (
              <button
                key={solfegeText}
                className={`
                    solfege-key rounded-[1.4rem] border-2 p-4 text-sm font-bold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#c4b5fd] sm:p-5 sm:text-base
                    ${
                      isPressed
                        ? "scale-95 shadow-inner"
                        : "hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(76,29,149,0.12)]"
                    }
                    ${isSelected ? "ring-2 ring-[#c4b5fd]" : ""}
                    ${
                      disabled
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer"
                    }
                    ${
                      isBlackKey
                        ? isPressed
                          ? "border-[#4c1d95] bg-[#4c1d95] text-white"
                          : isSelected
                            ? "border-[#4c1d95] bg-gradient-to-br from-[#6d28d9] to-[#4c1d95] text-white"
                            : "border-[#0f172a] bg-[#0f172a] text-white hover:bg-[#1e293b]"
                        : isPressed
                          ? "border-[#7c3aed] bg-[#ede9fe] text-[#5b21b6]"
                          : isSelected
                            ? "border-[#7c3aed] bg-[#ede9fe] text-[#5b21b6]"
                            : "border-[#d7deea] bg-white text-slate-700 hover:border-[#c4b5fd] hover:bg-[#faf9fe]"
                    }
                  `}
                onClick={() => handleKeyClick(keyData)}
                disabled={disabled}
                aria-label={solfegeText}
              >
                <div className="min-w-0 text-center">
                  <div className="break-words text-base leading-tight sm:text-lg xl:text-xl">
                    {solfegeText}
                  </div>
                  <div className="mt-1 break-words text-[10px] uppercase tracking-[0.12em] text-current opacity-75 sm:text-xs sm:tracking-[0.14em]">
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
