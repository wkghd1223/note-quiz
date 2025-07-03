"use client";

import { useEffect } from "react";
import { useLanguageStore } from "@/store/languageStore";

export default function LanguageInitializer() {
  const { initializeLanguage } = useLanguageStore();

  useEffect(() => {
    // 클라이언트 사이드에서만 실행
    initializeLanguage();
  }, [initializeLanguage]);

  return null; // UI를 렌더링하지 않음
}
