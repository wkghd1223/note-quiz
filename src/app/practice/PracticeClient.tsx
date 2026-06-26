"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/practice/AppShell";
import EarPracticeMode from "@/components/practice/EarPracticeMode";
import NotePracticeMode from "@/components/practice/NotePracticeMode";
import { PracticeMode } from "@/components/practice/ModeSwitcher";
import {
  trackLeaderboardTickerOpened,
  trackPracticeModeChanged,
  trackPracticeSettingsClosed,
  trackPracticeSettingsOpened,
} from "@/lib/analytics";

function normalizeMode(value: string | null): PracticeMode {
  return value === "ear" ? "ear" : "note";
}

export default function PracticeClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = normalizeMode(searchParams.get("mode"));
  const [settingsOpen, setSettingsOpen] = useState(
    searchParams.get("settings") === "open"
  );
  const [leaderboardOpen, setLeaderboardOpen] = useState(
    searchParams.get("leaderboard") === "open"
  );

  useEffect(() => {
    setSettingsOpen(searchParams.get("settings") === "open");
    setLeaderboardOpen(searchParams.get("leaderboard") === "open");
  }, [searchParams]);

  const updateQuery = (next: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(next).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const handleModeChange = (nextMode: PracticeMode) => {
    trackPracticeModeChanged(nextMode);
    updateQuery({
      mode: nextMode,
      settings: null,
      leaderboard: null,
    });
  };

  const handleSettingsOpen = () => {
    setSettingsOpen(true);
    trackPracticeSettingsOpened(mode);
    updateQuery({ settings: "open" });
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
    trackPracticeSettingsClosed(mode);
    updateQuery({ settings: null });
  };

  const handleLeaderboardOpen = () => {
    setLeaderboardOpen(true);
    trackLeaderboardTickerOpened("practice");
    updateQuery({ leaderboard: "open" });
  };

  const handleLeaderboardClose = () => {
    setLeaderboardOpen(false);
    updateQuery({ leaderboard: null });
  };

  return (
    <AppShell
      leaderboardOpen={leaderboardOpen}
      onLeaderboardOpen={handleLeaderboardOpen}
      onLeaderboardClose={handleLeaderboardClose}
    >
      {mode === "ear" ? (
        <EarPracticeMode
          mode={mode}
          onModeChange={handleModeChange}
          settingsOpen={settingsOpen}
          onSettingsOpen={handleSettingsOpen}
          onSettingsClose={handleSettingsClose}
          onLeaderboardOpen={handleLeaderboardOpen}
        />
      ) : (
        <NotePracticeMode
          mode={mode}
          onModeChange={handleModeChange}
          settingsOpen={settingsOpen}
          onSettingsOpen={handleSettingsOpen}
          onSettingsClose={handleSettingsClose}
          onLeaderboardOpen={handleLeaderboardOpen}
        />
      )}
    </AppShell>
  );
}
