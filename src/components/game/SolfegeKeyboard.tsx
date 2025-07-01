"use client";

import React, { useState, useCallback } from "react";
import { playPianoNote } from "@/lib/music/audio";
import {
  NOTE_NAME_MAPPING,
  SOLFEGE_TO_NOTE_MAPPING,
  SOLFEGE_NOTES,
} from "@/lib/music/constants";

interface SolfegeKeyboardProps {
  startOctave?: Octave;
  endOctave?: Octave;
  onNoteClick?: (note: Note) => void;
  selectedNote?: Note | null;
  disabled?: boolean;
  className?: string;
}

const SolfegeKeyboard: React.FC<SolfegeKeyboardProps> = ({
  startOctave = 3,
  endOctave = 6,
  onNoteClick,
  selectedNote,
  disabled = false,
  className = "",
}) => {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  // 키 클릭 핸들러
  const handleKeyClick = useCallback(
    async (solfege: SolfegeNote, octave: Octave) => {
      if (disabled) return;

      const noteName = SOLFEGE_TO_NOTE_MAPPING[solfege];
      const note: Note = {
        name: noteName,
        accidental: "natural",
        octave,
      };

      const keyId = `${solfege}${octave}`;

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
    (solfege: SolfegeNote, octave: Octave): boolean => {
      if (!selectedNote) return false;

      const expectedSolfege = NOTE_NAME_MAPPING[selectedNote.name];
      return (
        expectedSolfege === solfege &&
        selectedNote.octave === octave &&
        selectedNote.accidental === "natural"
      );
    },
    [selectedNote]
  );

  // 옥타브별 도레미 키 생성
  const generateKeys = () => {
    const keys = [];
    for (let octave = startOctave; octave <= endOctave; octave++) {
      keys.push(
        <div key={`octave-${octave}`} className="mb-4">
          <div className="text-center text-sm font-medium text-gray-600 mb-2">
            {octave}옥타브
          </div>
          <div className="grid grid-cols-7 gap-2">
            {SOLFEGE_NOTES.map((solfege) => {
              const keyId = `${solfege}${octave}`;
              const isPressed = pressedKeys.has(keyId);
              const isSelected = isKeySelected(solfege, octave as Octave);

              return (
                <button
                  key={keyId}
                  className={`
                    solfege-key p-4 rounded-lg border-2 font-bold text-lg
                    transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500
                    ${
                      isPressed
                        ? "bg-blue-200 border-blue-400 shadow-inner transform scale-95"
                        : "bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                    }
                    ${
                      isSelected
                        ? "bg-blue-100 border-blue-400 ring-2 ring-blue-300"
                        : ""
                    }
                    ${
                      disabled
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer hover:shadow-md"
                    }
                  `}
                  onClick={() => handleKeyClick(solfege, octave as Octave)}
                  disabled={disabled}
                  aria-label={`${solfege} ${octave}옥타브`}
                >
                  <div className="text-center">
                    <div className="text-xl">{solfege}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {SOLFEGE_TO_NOTE_MAPPING[solfege]}
                      {octave}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    return keys;
  };

  return (
    <div className={`solfege-keyboard ${className}`}>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
            도레미 입력
          </h3>

          <div className="space-y-4">{generateKeys()}</div>

          {/* 선택된 음표 정보 */}
          <div className="mt-6 text-center text-sm text-gray-600">
            <p>도레미를 클릭하여 음표를 선택하세요</p>
            {selectedNote && (
              <p className="mt-2 font-medium text-blue-600">
                선택된 음표: {NOTE_NAME_MAPPING[selectedNote.name]} (
                {selectedNote.name}
                {selectedNote.accidental === "sharp" && "#"}
                {selectedNote.accidental === "flat" && "♭"}
                {selectedNote.octave})
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SolfegeKeyboard;
