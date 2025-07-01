"use client";

import Link from "next/link";
import { FaMusic, FaPlay, FaCog, FaTrophy } from "react-icons/fa";
import { useTranslation } from "@/hooks/useTranslation";

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8 text-center bg-gradient-to-br from-blue-50 to-indigo-100">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12 px-2">
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <FaPlay className="text-2xl sm:text-3xl text-green-600 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">
              {t.ui.features.gameMode}
            </h3>
            <p className="text-gray-600 text-xs sm:text-sm">
              시각적, 청각적, 또는 두 가지 모두를 활용한 학습 모드를 선택할 수
              있습니다.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <FaCog className="text-2xl sm:text-3xl text-blue-600 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">
              {t.ui.features.customSettings}
            </h3>
            <p className="text-gray-600 text-xs sm:text-sm">
              음자리표, 조표, 옥타브 범위 등을 자유롭게 설정하여 난이도를
              조절하세요.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
            <FaTrophy className="text-2xl sm:text-3xl text-yellow-600 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">
              {t.ui.features.realTimeFeedback}
            </h3>
            <p className="text-gray-600 text-xs sm:text-sm">
              정확도와 시간을 실시간으로 추적하고 개인 기록을 관리하세요.
            </p>
          </div>
        </div>

        <div className="space-y-4 px-2">
          <Link
            href="/game"
            className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <FaPlay className="mr-2" />
            {t.startGame}
          </Link>

          <div className="text-xs sm:text-sm text-gray-500 space-y-1">
            <p>🎹 피아노 건반으로 답안 입력</p>
            <p>🎵 실제 소리로 절대음감 훈련</p>
            <p>⏱️ 시간 제한 모드 지원</p>
            <p>🌍 한국어/영어 지원</p>
          </div>
        </div>
      </section>
    </main>
  );
}
