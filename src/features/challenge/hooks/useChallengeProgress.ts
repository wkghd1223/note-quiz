"use client";
import { useEffect, useSyncExternalStore } from "react";
import { createProgressSession } from "../store/progressSession";
const session = createProgressSession();
export function useChallengeProgress() {
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  useEffect(() => {
    session.hydrate();
  }, []);
  return {
    ...snapshot,
    update: session.update,
    record: session.record,
    reset: session.reset,
  };
}
