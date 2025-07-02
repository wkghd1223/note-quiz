"use client";

import { useMemo } from "react";
import { useLanguageStore } from "@/store/languageStore";
import { getTranslation } from "@/lib/i18n/translations";

export function useTranslation() {
  const { language } = useLanguageStore();

  const t = useMemo(() => {
    return getTranslation(language);
  }, [language]);

  return { t, language };
}
