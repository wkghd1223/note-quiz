import type { StateStorage } from "zustand/middleware";

/** Read the current value rather than caching it across tabs or storage clears. */
export const safeLocalStorage = {
  getItem(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      if (localStorage.getItem(key) === value) return;
    } catch {
      // A failed read does not mean writes are unavailable.
    }
    try {
      localStorage.setItem(key, value);
    } catch {
      // Practice remains usable without storage; the next call can retry.
    }
  },
  removeItem(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage can be blocked.
    }
  },
} satisfies StateStorage;
