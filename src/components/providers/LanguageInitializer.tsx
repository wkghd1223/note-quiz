"use client";

import { useEffect } from "react";
import { useLanguageStore } from "@/store/languageStore";
import { useTranslation } from "@/hooks/useTranslation";
import { htmlLanguage } from "@/lib/i18n/locale";

export default function LanguageInitializer() {
  const { initializeLanguage } = useLanguageStore();
  const { language, locale } = useTranslation();

  useEffect(() => {
    // 클라이언트 사이드에서만 실행
    if (!locale) initializeLanguage();
  }, [initializeLanguage, locale]);

  useEffect(() => {
    document.documentElement.lang = htmlLanguage(language);
  }, [language]);

  return null; // UI를 렌더링하지 않음
}
