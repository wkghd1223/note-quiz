"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaPlay,
  FaStop,
  FaVolumeUp,
  FaClock,
  FaCheck,
  FaBullseye,
} from "react-icons/fa";
import EarTrainingSettings from "@/components/ear-training/EarTrainingSettings";
import PianoKeyboard from "@/components/game/PianoKeyboard";
import SolfegeKeyboard from "@/components/game/SolfegeKeyboard";
import { trackEarTrainingReplay } from "@/lib/analytics";
import {
  initializeAudio,
  playPianoNote,
  stopAllNotes,
} from "@/lib/music/audio";
import { noteToString } from "@/lib/music/utils";
import { trebleStaffRange } from "@/lib/notation/basic-staff";
import { useShallow } from "zustand/react/shallow";
import PracticeFeedback from "./PracticeFeedback";
import MusicNotation from "./MusicNotation";
import { useEarTrainingStore } from "@/store/earTrainingStore";
import { useTranslation } from "@/hooks/useTranslation";
import PracticeShell from "./PracticeShell";
import PracticeController from "./PracticeController";
import PracticeMetrics from "./PracticeMetrics";
import ModeSwitcher, { PracticeMode } from "./ModeSwitcher";
import LearningResult from "./LearningResult";

interface EarPracticeModeProps {
  mode: PracticeMode;
  onModeChange: (mode: PracticeMode) => void;
  settingsOpen: boolean;
  settingsIntro?: React.ReactNode;
  headerActions?: React.ReactNode;
  onSettingsOpen: () => void;
  onSettingsClose: () => void;
  onLeaderboardOpen: () => void;
  runOptions?: EarSessionOptions;
  onComplete?: (result: EarTrainingResult, kind: PracticeSessionKind) => void;
  onChangePractice?: () => void;
}

export default function EarPracticeMode({
  mode,
  onModeChange,
  settingsOpen,
  settingsIntro,
  headerActions,
  onSettingsOpen,
  onSettingsClose,
  runOptions,
  onComplete,
}: EarPracticeModeProps) {
  const { t } = useTranslation();
  const store = useEarTrainingStore(
    useShallow((state) => ({
      settings: state.settings,
      sessionSettings: state.sessionSettings,
      sessionState: state.sessionState,
      sessionKind: state.sessionKind,
      currentQuestion: state.currentQuestion,
      isAdvancingQuestion: state.isAdvancingQuestion,
      answers: state.answers,
      result: state.result,
      questionLimit: state.questionLimit,
      resetSession: state.resetSession,
      endSession: state.endSession,
      updateSettings: state.updateSettings,
    })),
  );
  const {
    settings,
    sessionSettings,
    sessionState,
    sessionKind,
    currentQuestion,
    isAdvancingQuestion,
    answers,
    result,
    questionLimit,
  } = store;
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [starting, setStarting] = useState(false);
  const audioAttempt = useRef(0);
  const startingRef = useRef(false);
  const mounted = useRef(true);
  const completedSessionId = useRef<string | undefined>(undefined);
  const completionCallback = useRef(onComplete);
  completionCallback.current = onComplete;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopAllNotes();
      useEarTrainingStore.getState().resetSession();
    };
  }, []);
  useEffect(() => {
    if (sessionState !== "playing") return;
    const interval = setInterval(() => {
      useEarTrainingStore.getState().updateTimer(Date.now());
    }, 50);
    return () => clearInterval(interval);
  }, [sessionState]);
  useEffect(() => {
    if (
      sessionState !== "playing" ||
      !currentQuestion ||
      !sessionSettings.enableSound ||
      !audioReady
    )
      return;
    let active = true;
    playPianoNote(currentQuestion.targetNote, 700).catch(() => {
      if (active) setAudioError(true);
    });
    return () => {
      active = false;
      stopAllNotes();
    };
  }, [sessionState, currentQuestion, sessionSettings.enableSound, audioReady]);
  useEffect(() => {
    if (
      sessionState !== "finished" ||
      !result ||
      completedSessionId.current === result.sessionId
    )
      return;
    completedSessionId.current = result.sessionId;
    completionCallback.current?.(result, sessionKind);
  }, [sessionState, result, sessionKind]);

  const start = async (options: EarSessionOptions | undefined = runOptions) => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    const attempt = ++audioAttempt.current;
    const originalSettings = useEarTrainingStore.getState().settings;
    stopAllNotes();
    setAudioError(false);
    try {
      await initializeAudio();
      if (
        mounted.current &&
        attempt === audioAttempt.current &&
        originalSettings === useEarTrainingStore.getState().settings
      ) {
        setAudioReady(true);
        useEarTrainingStore.getState().startSession(options);
      }
    } catch {
      if (
        mounted.current &&
        attempt === audioAttempt.current &&
        originalSettings === useEarTrainingStore.getState().settings
      )
        setAudioError(true);
    } finally {
      if (mounted.current && attempt === audioAttempt.current) {
        startingRef.current = false;
        setStarting(false);
      }
    }
  };
  const replay = async (note: Note, count = false) => {
    const attempt = ++audioAttempt.current;
    const original = useEarTrainingStore.getState();
    const isCurrent = () => {
      const latest = useEarTrainingStore.getState();
      return (
        mounted.current &&
        attempt === audioAttempt.current &&
        latest.sessionId === original.sessionId &&
        latest.currentQuestion === original.currentQuestion &&
        latest.sessionState === original.sessionState &&
        latest.settings === original.settings
      );
    };
    stopAllNotes();
    try {
      // Start immediately so stopAllNotes also cancels a pending audio resume.
      const playback = playPianoNote(note, 700);
      if (count) {
        useEarTrainingStore.getState().replayCurrentQuestion();
        trackEarTrainingReplay();
      }
      await playback;
      if (isCurrent()) {
        setAudioReady(true);
        setAudioError(false);
      }
    } catch {
      if (isCurrent()) setAudioError(true);
    }
  };
  const lastAnswer = answers[answers.length - 1];
  const isFinished = sessionState === "finished";
  const feedback =
    sessionState === "playing" && isAdvancingQuestion && lastAnswer
      ? lastAnswer
      : null;
  const notationNotes = useMemo(
    () =>
      feedback
        ? [feedback.correctNote]
        : isFinished && lastAnswer
          ? [lastAnswer.correctNote]
          : [],
    [feedback, isFinished, lastAnswer],
  );
  const mistakes =
    result?.answers.filter((entry) => !entry.isCorrect && entry.question) ?? [];
  const activeSettings = sessionState === "idle" ? settings : sessionSettings;
  // Reserve the configured pitch pool even before an audio answer is revealed.
  const notationRange = useMemo(
    () => trebleStaffRange(activeSettings.octaveRange),
    [activeSettings.octaveRange],
  );
  const summary = [
    settings.questionLimit
      ? t.learning.ten
      : settings.sessionType === "timed"
        ? `${settings.timeLimit} ${t.units.seconds}`
        : t.learning.free,
    t.earTraining.noteSet[settings.noteSet],
    t.earTraining.inputMode[settings.inputMode],
  ].join(" / ");

  const resultContent =
    result && isFinished ? (
      <LearningResult
        preserveScroll
        focusOnMount={false}
        result={result}
        hasMistakes={mistakes.length > 0}
        onReview={() =>
          void start({
            kind: "review",
            questions: mistakes.map((entry) => entry.question!),
          })
        }
      >
        <p className="text-sm text-slate-600">
          {t.earTraining.result.replayCount}: {result.replayCount}
        </p>
        {sessionKind === "review" && (
          <p className="text-sm text-slate-600">{t.learning.reviewNotice}</p>
        )}
        {mistakes.length > 0 && (
          <details>
            <summary className="min-h-11 cursor-pointer text-sm font-bold text-[#5b21b6]">
              {t.learning.review}
            </summary>
            <ul className="space-y-2">
              {mistakes.map((entry, index) => (
                <li
                  key={`${entry.question!.id}-${index}`}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <p className="text-sm">
                    {t.messages.correctAnswer}:{" "}
                    {noteToString(entry.correctNote)} / {t.messages.yourAnswer}:{" "}
                    {noteToString(entry.note)}
                  </p>
                  <button
                    type="button"
                    onClick={() => void replay(entry.correctNote)}
                    aria-label={t.earTraining.replay}
                    title={t.earTraining.replay}
                    className="mt-2 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200"
                  >
                    <FaVolumeUp aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </LearningResult>
    ) : null;
  const stage = (
    <div
      data-practice-stage
      data-practice-phase={
        sessionState === "idle" ? "idle" : isFinished ? "finished" : "active"
      }
      className="relative rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <div className="mb-2 flex min-h-24 items-start justify-between gap-3 sm:min-h-20">
        <div
          className="grid min-h-24 min-w-0 flex-1 items-center sm:min-h-20"
          data-practice-prompt-band
        >
          <h2
            data-practice-prompt
            tabIndex={-1}
            className={`col-start-1 row-start-1 max-h-10 min-w-0 overflow-auto text-sm font-bold leading-5 text-slate-600 ${feedback ? "opacity-0" : ""}`}
          >
            {t.earTraining.listenPrompt}
          </h2>
          <PracticeFeedback
            message={
              feedback
                ? feedback.isCorrect
                  ? t.messages.correct
                  : t.messages.incorrect
                : undefined
            }
            correct={feedback?.isCorrect}
            details={
              feedback ? (
                <>
                  <p>
                    {t.messages.yourAnswer}: {noteToString(feedback.note)}
                  </p>
                  <p>
                    {t.messages.correctAnswer}:{" "}
                    {noteToString(feedback.correctNote)}
                  </p>
                </>
              ) : undefined
            }
            announcementKey={answers.length}
          />
        </div>
        <button
          type="button"
          onClick={() =>
            currentQuestion && void replay(currentQuestion.targetNote, true)
          }
          disabled={sessionState !== "playing" || !currentQuestion}
          aria-label={t.earTraining.replay}
          title={t.earTraining.replay}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#5b21b6] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed] focus-visible:ring-offset-2 disabled:opacity-50"
        >
          <FaVolumeUp aria-hidden="true" className="shrink-0" />
        </button>
        <p className="shrink-0 text-sm font-bold tabular-nums text-slate-600">
          {answers.length}
          {questionLimit ? `/${questionLimit}` : ""}
        </p>
      </div>
      <MusicNotation
        notes={notationNotes}
        staffRange={notationRange}
        label={t.messages.correctAnswer}
        revealed={!!feedback || (isFinished && !!lastAnswer)}
      />
    </div>
  );
  const input =
    sessionState === "playing" || isFinished ? (
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-3 text-xs font-bold text-slate-500">
          {t.earTraining.currentTarget}:{" "}
          {t.earTraining.noteSet[activeSettings.noteSet]}
        </p>
        {activeSettings.inputMode === "piano" ? (
          <PianoKeyboard
            onNoteClick={(note) =>
              useEarTrainingStore.getState().submitAnswer(note)
            }
            onAudioError={() => setAudioError(true)}
            disabled={isFinished || isAdvancingQuestion}
            showAccidentals={activeSettings.noteSet === "chromatic"}
            className="flex max-w-full flex-col items-center overflow-x-auto"
          />
        ) : (
          <SolfegeKeyboard
            onNoteClick={(note) =>
              useEarTrainingStore.getState().submitAnswer(note)
            }
            onAudioError={() => setAudioError(true)}
            disabled={isFinished || isAdvancingQuestion}
            showAccidentals={activeSettings.noteSet === "chromatic"}
          />
        )}
      </div>
    ) : null;
  const actions = (
    <PracticeController
      state={sessionState}
      states={{
        playing: [
          {
            id: "end",
            label: t.earTraining.stop,
            onClick: () => store.endSession(),
            tone: "danger",
            icon: <FaStop />,
          },
        ],
        idle: [
          {
            id: "start",
            label: t.startGame,
            onClick: () => void start(),
            disabled: starting,
            tone: "primary",
            icon: <FaPlay />,
          },
        ],
      }}
    />
  );
  return (
    <PracticeShell
      description={t.earTraining.description}
      modeSwitcher={<ModeSwitcher mode={mode} onChange={onModeChange} />}
      title={t.earTraining.title}
      kicker={t.earTraining.subtitle}
      status={<EarStatus />}
      stage={
        <>
          {audioError && (
            <div
              role="alert"
              className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
            >
              <p>{t.learning.audioError}</p>
              <button
                type="button"
                onClick={() =>
                  currentQuestion
                    ? void replay(currentQuestion.targetNote)
                    : void start()
                }
                className="mt-2 min-h-11 rounded-lg border border-amber-300 px-3 font-bold"
              >
                {t.learning.retryAudio}
              </button>
            </div>
          )}
          {stage}
        </>
      }
      input={input}
      actions={actions}
      headerActions={headerActions}
      settingsIntro={settingsIntro}
      settings={
        <EarTrainingSettings
          embedded
          settings={settings}
          onChange={store.updateSettings}
        />
      }
      settingsSummary={summary}
      isIdle={sessionState === "idle"}
      isFinished={isFinished}
      onRestart={() => void start()}
      restartDisabled={starting}
      result={resultContent}
      resultKey={result?.sessionId ?? null}
      settingsOpen={settingsOpen}
      onSettingsOpen={onSettingsOpen}
      onSettingsClose={onSettingsClose}
    />
  );
}
function EarStatus() {
  const { t } = useTranslation();
  const elapsed = useEarTrainingStore((state) => state.elapsedTime);
  const questionAt = useEarTrainingStore((state) => state.questionStartTime);
  const phase = useEarTrainingStore((state) => state.sessionState);
  const answers = useEarTrainingStore((state) => state.answers);
  const correct = answers.filter((answer) => answer.isCorrect).length;
  return (
    <PracticeMetrics
      items={[
        {
          label: t.timer.elapsed,
          value: formatTime(elapsed),
          icon: <FaClock />,
        },
        {
          label: t.scoreboard.correct,
          value: String(correct),
          icon: <FaCheck />,
        },
        {
          label: t.scoreboard.accuracy,
          value: `${(answers.length ? (correct / answers.length) * 100 : 0).toFixed(0)}%`,
          icon: <FaBullseye />,
        },
      ]}
      detail={`${t.ui.currentQuestionTime}: ${formatTime(phase === "playing" && questionAt !== null ? Math.max(0, Date.now() - questionAt) : 0)}`}
    />
  );
}

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(
      2,
      "0",
    )}:${(seconds % 60).toString().padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
}
