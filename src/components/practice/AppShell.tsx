"use client";

import React from "react";
import Header from "@/components/layouts/header";
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
    <div className="min-h-screen overflow-x-hidden bg-[#f6f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-[480px] px-3 py-3 sm:max-w-7xl sm:px-4">
          <Header variant="compact" />
        </div>
      </header>

      <LeaderboardTicker
        isMobileOpen={leaderboardOpen}
        onMobileOpen={onLeaderboardOpen}
        onMobileClose={onLeaderboardClose}
      />

      <main className="mx-auto w-full max-w-[480px] px-3 py-3 sm:max-w-7xl sm:px-4 sm:py-4">
        {children}
      </main>
    </div>
  );
}
