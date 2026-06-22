"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaPlay, FaRedoAlt, FaWaveSquare } from "react-icons/fa";
import { NOTE_NAMES } from "@/lib/music/constants";
import { useLanguageStore } from "@/store/languageStore";
import { useTranslation } from "@/hooks/useTranslation";
import RhythmStaff, {
  RhythmAnswerState,
  RhythmNoteValue,
  RhythmSequenceItem,
} from "@/components/rhythm/RhythmStaff";

type RhythmRoundState = "idle" | "playing" | "finished";

const BPM = 72;
const ROUND_NOTE_COUNT = 3;
const BEAT_MS = Math.round(60000 / BPM);
const STAFF_NOTES: Note[] = [
  { name: "E", accidental: "natural", octave: 4 },
  { name: "F", accidental: "natural", octave: 4 },
  { name: "G", accidental: "natural", octave: 4 },
  { name: "A", accidental: "natural", octave: 4 },
  { name: "B", accidental: "natural", octave: 4 },
  { name: "C", accidental: "natural", octave: 5 },
  { name: "D", accidental: "natural", octave: 5 },
  { name: "E", accidental: "natural", octave: 5 },
  { name: "F", accidental: "natural", octave: 5 },
];
const RHYTHM_PATTERNS: RhythmNoteValue[][] = [
  ["quarter", "quarter", "quarter"],
  ["quarter", "eighth", "eighth"],
  ["eighth", "eighth", "quarter"],
  ["eighth", "quarter", "eighth"],
  ["sixteenth", "sixteenth", "eighth"],
  ["eighth", "sixteenth", "sixteenth"],
  ["triplet", "triplet", "triplet"],
];

function createRoundAnswers(): RhythmAnswerState[] {
  return Array.from({ length: ROUND_NOTE_COUNT }, () => ({
    submitted: null,
    status: "pending",
  }));
}

function getDurationBeats(duration: RhythmNoteValue) {
  switch (duration) {
    case "quarter":
      return 1;
    case "eighth":
      return 0.5;
    case "sixteenth":
      return 0.25;
    case "triplet":
      return 1 / 3;
    default:
      return 1;
  }
}

function getDurationLabel(duration: RhythmNoteValue) {
  switch (duration) {
    case "quarter":
      return "1/4";
    case "eighth":
      return "1/8";
    case "sixteenth":
      return "1/16";
    case "triplet":
      return "3";
    default:
      return duration;
  }
}

function generateSequence(): RhythmSequenceItem[] {
  const pattern =
    RHYTHM_PATTERNS[Math.floor(Math.random() * RHYTHM_PATTERNS.length)];

  return pattern.map((duration) => ({
    note: { ...STAFF_NOTES[Math.floor(Math.random() * STAFF_NOTES.length)] },
    duration,
  }));
}

function getTotalBeats(items: RhythmSequenceItem[]) {
  return items.reduce((sum, item) => sum + getDurationBeats(item.duration), 0);
}

function getActiveNoteIndex(items: RhythmSequenceItem[], elapsedBeats: number) {
  let accumulated = 0;

  for (let index = 0; index < items.length; index += 1) {
    const next = accumulated + getDurationBeats(items[index].duration);
    if (elapsedBeats < next) {
      return index;
    }
    accumulated = next;
  }

  return -1;
}

function getProgressInActiveNote(
  items: RhythmSequenceItem[],
  elapsedBeats: number,
  activeIndex: number
) {
  const beatsBefore = items
    .slice(0, activeIndex)
    .reduce((sum, item) => sum + getDurationBeats(item.duration), 0);
  const currentDuration = getDurationBeats(items[activeIndex].duration);

  return Math.min(Math.max((elapsedBeats - beatsBefore) / currentDuration, 0), 1);
}

export default function RhythmTrainingPage() {
  const { t } = useTranslation();
  const { isInitialized } = useLanguageStore();
  const [roundState, setRoundState] = useState<RhythmRoundState>("idle");
  const [sequence, setSequence] = useState<RhythmSequenceItem[]>(() =>
    generateSequence()
  );
  const [answers, setAnswers] = useState<RhythmAnswerState[]>(() =>
    createRoundAnswers()
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [progressRatio, setProgressRatio] = useState(0);
  const [noteProgress, setNoteProgress] = useState(0);
  const roundStartRef = useRef<number | null>(null);
  const previousIndexRef = useRef(-1);

  const totalBeats = useMemo(() => getTotalBeats(sequence), [sequence]);

  const finishRound = useCallback(() => {
    setAnswers((previous) =>
      previous.map((answer, index) =>
        index === previousIndexRef.current && answer.status === "pending"
          ? { ...answer, status: "missed" }
          : answer
      )
    );
    setRoundState("finished");
    setActiveIndex(null);
    setProgressRatio(1);
    setNoteProgress(0);
  }, []);

  useEffect(() => {
    if (roundState !== "playing") {
      return;
    }

    roundStartRef.current = Date.now();
    previousIndexRef.current = -1;

    const intervalId = window.setInterval(() => {
      if (roundStartRef.current === null) {
        return;
      }

      const elapsedMs = Date.now() - roundStartRef.current;
      const elapsedBeats = elapsedMs / BEAT_MS;
      const currentIndex = getActiveNoteIndex(sequence, elapsedBeats);

      if (elapsedBeats >= totalBeats || currentIndex === -1) {
        window.clearInterval(intervalId);
        finishRound();
        return;
      }

      if (currentIndex !== previousIndexRef.current) {
        const previousIndex = previousIndexRef.current;

        if (previousIndex >= 0) {
          setAnswers((current) =>
            current.map((answer, index) =>
              index === previousIndex && answer.status === "pending"
                ? { ...answer, status: "missed" }
                : answer
            )
          );
        }

        previousIndexRef.current = currentIndex;
        setActiveIndex(currentIndex);
      }

      setProgressRatio(Math.min(elapsedBeats / totalBeats, 1));
      setNoteProgress(getProgressInActiveNote(sequence, elapsedBeats, currentIndex));
    }, 40);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [finishRound, roundState, sequence, totalBeats]);

  const score = useMemo(
    () => answers.filter((answer) => answer.status === "correct").length,
    [answers]
  );

  const activeItem =
    activeIndex !== null && activeIndex >= 0 ? sequence[activeIndex] : null;

  const handleStart = () => {
    const nextSequence = generateSequence();
    setSequence(nextSequence);
    setAnswers(createRoundAnswers());
    setActiveIndex(0);
    setProgressRatio(0);
    setNoteProgress(0);
    previousIndexRef.current = -1;
    setRoundState("playing");
  };

  const handleRestart = () => {
    setRoundState("idle");
    setSequence(generateSequence());
    setAnswers(createRoundAnswers());
    setActiveIndex(null);
    setProgressRatio(0);
    setNoteProgress(0);
    previousIndexRef.current = -1;
    roundStartRef.current = null;
  };

  const handleNoteInput = (noteName: NoteName) => {
    if (roundState !== "playing" || activeIndex === null) {
      return;
    }

    setAnswers((current) => {
      if (current[activeIndex]?.status !== "pending") {
        return current;
      }

      const isCorrect = sequence[activeIndex]?.note.name === noteName;
      return current.map((answer, index) =>
        index === activeIndex
          ? {
              submitted: noteName,
              status: isCorrect ? "correct" : "wrong",
            }
          : answer
      );
    });
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <main className="app-shell">
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-6">
        <aside className="order-2 space-y-4 xl:order-1">
          <div className="rounded-[1.75rem] border border-[#ded6f7] bg-white p-5 shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#6d28d9]">
              {t.rhythmTraining.subtitle}
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">
              {t.rhythmTraining.title}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {t.rhythmTraining.description}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              {t.rhythmTraining.intro}
            </p>

            <div className="mt-6 grid gap-3">
              {roundState === "playing" ? (
                <button
                  onClick={handleRestart}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[1.3rem] bg-slate-900 px-5 py-3 text-sm font-bold text-white"
                >
                  <FaRedoAlt />
                  {t.rhythmTraining.restart}
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[1.3rem] bg-gradient-to-r from-[#5b21b6] to-[#7c3aed] px-5 py-3 text-sm font-bold text-white shadow-[0_14px_30px_rgba(91,33,182,0.24)]"
                >
                  <FaPlay />
                  {t.rhythmTraining.start}
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[1.5rem] border border-[#ded6f7] bg-white p-4 shadow-[0_12px_28px_rgba(76,29,149,0.06)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {t.rhythmTraining.bpm}
              </p>
              <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950">
                {BPM}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[#ded6f7] bg-white p-4 shadow-[0_12px_28px_rgba(76,29,149,0.06)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {t.rhythmTraining.activeBeat}
              </p>
              <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#5b21b6]">
                {activeIndex === null ? "-" : `${activeIndex + 1}/${ROUND_NOTE_COUNT}`}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[#ded6f7] bg-white p-4 shadow-[0_12px_28px_rgba(76,29,149,0.06)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {t.rhythmTraining.score}
              </p>
              <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#10b981]">
                {score}/{ROUND_NOTE_COUNT}
              </p>
            </div>
          </div>
        </aside>

        <section className="order-1 min-w-0 space-y-4 xl:order-2">
          <div className="overflow-hidden rounded-[2rem] border border-[#ded6f7] bg-white shadow-[0_18px_50px_rgba(76,29,149,0.08)]">
            <div className="h-1.5 bg-gradient-to-r from-[#5b21b6] via-[#7c3aed] to-[#ede9fe]" />
            <div className="space-y-5 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.08),transparent_40%),linear-gradient(180deg,_#ffffff_0%,_#faf9fe_100%)] p-4 sm:p-6 lg:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6d28d9]">
                    {t.rhythmTraining.title}
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-slate-950 sm:text-3xl">
                    {t.rhythmTraining.subtitle}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                    {t.rhythmTraining.hitPrompt}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {activeItem && (
                    <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                      {getDurationLabel(activeItem.duration)}
                    </span>
                  )}
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#ede9fe] px-4 py-2 text-sm font-bold text-[#5b21b6]">
                    <FaWaveSquare />
                    {t.rhythmTraining.beat}{" "}
                    {activeIndex === null ? "-" : `${activeIndex + 1}/${ROUND_NOTE_COUNT}`}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="h-2 overflow-hidden rounded-full bg-[#ede9fe]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#5b21b6] to-[#7c3aed] transition-[width] duration-75"
                    style={{
                      width:
                        roundState === "finished"
                          ? "100%"
                          : `${Math.max(progressRatio * 100, roundState === "playing" ? 3 : 0)}%`,
                    }}
                  />
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#f3f0fb]">
                  <div
                    className="h-full rounded-full bg-[#a78bfa] transition-[width] duration-75"
                    style={{
                      width:
                        roundState === "playing" ? `${Math.max(noteProgress * 100, 4)}%` : "0%",
                    }}
                  />
                </div>
              </div>

              <RhythmStaff
                items={sequence}
                activeIndex={roundState === "playing" ? activeIndex : null}
                answers={answers}
              />

              <div className="rounded-[1.5rem] border border-[#ece7fb] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    {t.rhythmTraining.noteInput}
                  </p>
                  {roundState === "finished" && (
                    <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#166534]">
                      {t.rhythmTraining.resultTitle}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                  {NOTE_NAMES.map((noteName) => (
                    <button
                      key={noteName}
                      onClick={() => handleNoteInput(noteName)}
                      disabled={roundState !== "playing"}
                      className={`rounded-[1.2rem] border px-3 py-4 text-center transition-all ${
                        roundState === "playing"
                          ? "border-[#d7deea] bg-[#faf9fe] text-slate-900 hover:-translate-y-0.5 hover:border-[#c4b5fd] hover:bg-white"
                          : "cursor-not-allowed border-[#e5e7eb] bg-slate-50 text-slate-400"
                      }`}
                    >
                      <div className="text-2xl font-black tracking-[-0.05em]">
                        {noteName}
                      </div>
                      <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        {t.solfege.notes[noteName]}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {answers.map((answer, index) => (
                    <div
                      key={index}
                      className={`rounded-[1.2rem] border px-4 py-3 ${
                        answer.status === "correct"
                          ? "border-[#bbf7d0] bg-[#ecfdf5]"
                          : answer.status === "wrong"
                            ? "border-[#fecaca] bg-[#fef2f2]"
                            : answer.status === "missed"
                              ? "border-[#fde68a] bg-[#fffbeb]"
                              : "border-[#e5e7eb] bg-[#faf9fe]"
                      }`}
                    >
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        {t.rhythmTraining.beat} {index + 1}
                      </p>
                      <p className="mt-2 text-lg font-black text-slate-950">
                        {answer.submitted ?? "—"}
                      </p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        {getDurationLabel(sequence[index].duration)}
                      </p>
                    </div>
                  ))}
                </div>

                {roundState === "finished" && (
                  <div className="mt-5 rounded-[1.2rem] border border-[#ded6f7] bg-[#faf9fe] px-4 py-4">
                    <p className="text-lg font-black tracking-[-0.03em] text-slate-950">
                      {t.rhythmTraining.resultTitle}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {t.rhythmTraining.resultDescription}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
