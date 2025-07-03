"use client";
import Header from "@/components/layouts/header";
import GameControl from "@/components/game/GameControl";
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

      {/* 게임 컨트롤 - 모바일에서만 */}
      <div className="md:hidden mt-4">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <GameControl />
        </div>
      </div>
    </>
  );
}
