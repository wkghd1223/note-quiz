import { create } from "zustand";
import { persist } from "zustand/middleware";

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

  // 지원하는 언어 목록
  const supportedLanguages: Language[] = ["en", "ko", "ja", "es"];

  if (supportedLanguages.includes(langCode as Language)) {
    return langCode as Language;
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
      partialize: (state) => ({
        language: state.language,
        isInitialized: state.isInitialized,
      }),
    }
  )
);
