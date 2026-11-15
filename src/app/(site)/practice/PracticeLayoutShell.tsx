"use client";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/practice/AppShell";
import { trackLeaderboardTickerOpened } from "@/lib/analytics";

/** This layout survives sibling mode navigation and never subscribes to game clocks. */
export default function PracticeLayoutShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname(),
    router = useRouter(),
    search = useSearchParams();
  const update = (open: boolean) => {
    const p = new URLSearchParams(search.toString());
    p.delete("settings");
    if (open) p.set("leaderboard", "open");
    else p.delete("leaderboard");
    router.replace(
      `${p.size ? `${pathname}?${p}` : pathname}${window.location.hash}`,
      { scroll: false },
    );
  };
  return (
    <AppShell
      leaderboardOpen={search.get("leaderboard") === "open"}
      onLeaderboardOpen={() => {
        trackLeaderboardTickerOpened("practice");
        update(true);
      }}
      onLeaderboardClose={() => update(false)}
    >
      {children}
    </AppShell>
  );
}
