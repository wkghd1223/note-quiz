"use client";

import React from "react";
import LeaderboardTicker from "./LeaderboardTicker";

interface AppShellProps {
  leaderboardOpen: boolean;
  onLeaderboardOpen: () => void;
  onLeaderboardClose: () => void;
  children: React.ReactNode;
}

export default function AppShell({
  leaderboardOpen,
  onLeaderboardOpen,
  onLeaderboardClose,
  children,
}: AppShellProps) {
  return (
    <>
      <LeaderboardTicker
        isOpen={leaderboardOpen}
        onOpen={onLeaderboardOpen}
        onClose={onLeaderboardClose}
      />

      <main className="mx-auto w-full max-w-[480px] px-3 py-3 sm:max-w-6xl sm:px-4 sm:py-4">
        {children}
      </main>
    </>
  );
}
