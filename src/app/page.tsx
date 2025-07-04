"use client";

import Link from "next/link";
import { FaMusic, FaPlay } from "react-icons/fa";
import { useTranslation } from "@/hooks/useTranslation";
import LanguageSelector from "@/components/ui/LanguageSelector";
import { useLanguageStore } from "@/store/languageStore";

export default function HomePage() {
  const { t } = useTranslation();
  const { isInitialized } = useLanguageStore();

  // 언어 초기화가 완료될 때까지 로딩
  if (!isInitialized) {
    return (
      <main className="min-h-[calc(100vh)] bg-gradient-to-br from-blue-50 to-indigo-100"></main>
    );
  }

  return (
    <main className=" p-4 sm:p-8 text-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="flex justify-end w-full mb-4">
        <LanguageSelector />
      </header>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
        <section className="max-w-4xl mx-auto w-full">
          <div className="mb-6 sm:mb-8">
            <FaMusic className="text-4xl sm:text-6xl text-blue-600 mx-auto mb-4" />
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-800 mb-4">
              {t.gameTitle}
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8 px-2">
              {t.ui.description}
            </p>
          </div>

          <div className="space-y-4 px-2">
            <Link
              href="/game"
              className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <FaPlay className="mr-2" />
              {t.startGame}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
