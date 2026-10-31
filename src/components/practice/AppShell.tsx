"use client";

import React from "react";
import Footer from "@/components/layouts/footer";
import Header from "@/components/layouts/header";
import LeaderboardTicker from "./LeaderboardTicker";
import AdLayoutObserver from "./AdLayoutObserver";

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
    <div
      data-practice-scroll
      className="practice-ad-safe bg-[#f6f7fb] text-slate-950"
    >
      <AdLayoutObserver />
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-[480px] px-3 py-3 sm:max-w-6xl sm:px-4">
          <Header variant="compact" />
        </div>
      </div>

      <LeaderboardTicker
        isOpen={leaderboardOpen}
        onOpen={onLeaderboardOpen}
        onClose={onLeaderboardClose}
      />

      <main className="mx-auto w-full max-w-[480px] px-3 py-3 sm:max-w-6xl sm:px-4 sm:py-4">
        {children}
      </main>
      <Footer />
    </div>
  );
}
