"use client";

import React, { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import CompactStatusBar from "@/components/ui/CompactStatusBar";
import Panel from "@/components/ui/Panel";
import GameControl from "./GameControl";
import GameSettingsTrigger from "./GameSettingsTrigger";

interface TimerProps {
  className?: string;
}

const Timer: React.FC<TimerProps> = ({ className = "" }) => {
  const { t } = useTranslation();
  const {
    gameState,
    elapsedTime,
    updateTimer,
    settings,
    endGame,
    getQuestionElapsedTime,
  } = useGameStore();

  const [displayTime, setDisplayTime] = useState(0);
  const [questionTime, setQuestionTime] = useState(0);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (gameState === "playing") {
      intervalId = setInterval(() => {
        const now = Date.now();
        updateTimer(now);
        setDisplayTime(elapsedTime);
        setQuestionTime(getQuestionElapsedTime());

        if (settings.timeLimit && elapsedTime >= settings.timeLimit * 1000) {
          endGame();
        }
      }, 100);
    } else {
      setDisplayTime(elapsedTime);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    gameState,
    elapsedTime,
    updateTimer,
    settings.timeLimit,
    endGame,
    getQuestionElapsedTime,
  ]);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((milliseconds % 1000) / 100);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${tenths}`;
  };

  const remainingTime = settings.timeLimit
    ? Math.max(0, settings.timeLimit * 1000 - displayTime)
    : 0;
  const isTimeRunningOut = settings.timeLimit && remainingTime < 10000;
  const mainTime = settings.timeLimit ? remainingTime : elapsedTime;
  const progressPercent = settings.timeLimit
    ? Math.max(
        0,
        Math.min(100, (remainingTime / (settings.timeLimit * 1000)) * 100),
      )
    : 0;

  const stateTone =
    gameState === "playing"
      ? "success"
      : gameState === "paused"
        ? "warning"
        : gameState === "finished"
          ? "danger"
          : "accent";

  return (
    <Panel className={className} padding="compact">
      <div className="space-y-3 lg:space-y-4">
        <GameControl />

        <CompactStatusBar
          items={[
            {
              label: settings.timeLimit ? t.timer.remaining : t.timer.elapsed,
              value: formatTime(mainTime),
              tone: isTimeRunningOut
                ? "danger"
                : gameState === "playing"
                  ? "accent"
                  : "default",
            },
            ...(gameState === "playing"
              ? [
                  {
                    label: t.ui.currentQuestionTime,
                    value: formatTime(questionTime),
                    tone: "default" as const,
                  },
                ]
              : []),
            {
              label: t.settingsLabels.timeLimit,
              value: settings.timeLimit
                ? `${settings.timeLimit}${t.units.seconds}`
                : "∞",
              tone: "default",
            },
            {
              label: t.settingsLabels.answerMode,
              value:
                settings.answerMode === "piano"
                  ? t.answerModes.piano
                  : settings.answerMode === "solfege"
                    ? t.answerModes.solfege
                    : t.answerModes.microphone,
              tone: stateTone,
            },
          ]}
        />

        {settings.timeLimit && (
          <div>
            <div className="h-1.5 w-full rounded-full bg-[#ede9fe]">
              <div
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  isTimeRunningOut
                    ? "bg-red-500"
                    : "bg-gradient-to-r from-[#4c1d95] to-[#7c3aed]"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        <div className="lg:hidden">
          <GameSettingsTrigger variant="mobile-card" />
        </div>
      </div>
    </Panel>
  );
};

export default Timer;
