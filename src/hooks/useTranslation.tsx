"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useLanguageStore } from "@/store/languageStore";
import { getTranslation } from "@/lib/i18n/translations";
import { resolveLanguage } from "@/lib/i18n/locale";

export function useTranslation() {
  const stored = useLanguageStore();
  const pathname = usePathname();
  // URL language is request-local during SSR; never mutate the shared store here.
  const { language, locale, isInitialized } = resolveLanguage(
    pathname,
    stored.language,
    stored.isInitialized,
  );

  const t = useMemo(() => {
    return getTranslation(language);
  }, [language]);

  return { t, language, locale, isInitialized };
}
