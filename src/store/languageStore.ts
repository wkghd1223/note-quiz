import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { isLanguage } from "@/lib/i18n/locale";

interface LanguageStore {
  language: Language;
  setLanguage: (language: Language) => void;
  isInitialized: boolean;
  initializeLanguage: () => void;
}

// 브라우저 언어 감지 함수
function detectBrowserLanguage(): Language {
  if (typeof window === "undefined") return "en";

  const browserLang = navigator.language || navigator.languages?.[0] || "en";
  const langCode = browserLang.split("-")[0].toLowerCase();

  if (isLanguage(langCode)) {
    return langCode;
  }

  return "en"; // 기본값
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set, get) => ({
      language: "en" as Language,
      isInitialized: false,
      setLanguage: (language) => set({ language }),
      initializeLanguage: () => {
        const { isInitialized } = get();
        if (!isInitialized) {
          const detectedLanguage = detectBrowserLanguage();
          set({ language: detectedLanguage, isInitialized: true });
        }
      },
    }),
    {
      name: "language-storage",
      storage: createJSONStorage(() => ({
        getItem: (key: string) => {
          try {
            const raw = window.localStorage.getItem(key);
            if (raw) JSON.parse(raw);
            return raw;
          } catch {
            return null;
          }
        },
        setItem: (key: string, value: string) => {
          try {
            window.localStorage.setItem(key, value);
          } catch {
            /* Practice works without persistence. */
          }
        },
        removeItem: (key: string) => {
          try {
            window.localStorage.removeItem(key);
          } catch {
            /* No stored state to remove. */
          }
        },
      })),
      merge: (persisted, current) => {
        const value = persisted as Partial<LanguageStore> | undefined;
        return {
          ...current,
          ...(isLanguage(value?.language)
            ? { language: value.language, isInitialized: true }
            : {}),
        };
      },
      partialize: (state) => ({
        language: state.language,
        isInitialized: state.isInitialized,
      }),
    },
  ),
);
