"use client";
import Header from "@/components/layouts/header";
import { useLanguageStore } from "@/store/languageStore";

export default function GameHeader() {
  const { isInitialized } = useLanguageStore();

  // 언어 초기화가 완료될 때까지 로딩
  if (!isInitialized) {
    return null;
  }

  return (
    <>
      {/* 헤더 */}
      <Header />
    </>
  );
}
