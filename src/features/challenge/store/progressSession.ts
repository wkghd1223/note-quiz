import {
  emptyProgress,
  readProgress,
  saveProgress,
  recordAttempt,
  type ChallengeProgressV1,
  type StorageLike,
  type StorageWarning,
} from "./progress";
/** Browser-memory progress survives route changes even if durable storage is blocked.
 * Creation is side-effect free: hydrate is called only after client mount. */
export function createProgressSession(storage?: StorageLike) {
  const initial = {
    progress: emptyProgress(),
    warning: null as StorageWarning | null,
    hydrated: false,
  };
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const publish = (next: typeof initial) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const hydrate = () => {
    if (!snapshot.hydrated) {
      const read = readProgress(storage);
      publish({ ...read, hydrated: true });
    }
  };
  const update = (
    change: (previous: ChallengeProgressV1) => ChallengeProgressV1,
  ) => {
    hydrate();
    const progress = change(snapshot.progress);
    publish({
      progress,
      warning: saveProgress(progress, storage),
      hydrated: true,
    });
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hydrate,
    update,
    record: (attempt: Parameters<typeof recordAttempt>[1]) =>
      update((previous) => recordAttempt(previous, attempt)),
    reset: () => {
      const progress = emptyProgress();
      publish({
        progress,
        warning: saveProgress(progress, storage, true),
        hydrated: true,
      });
    },
  };
}
