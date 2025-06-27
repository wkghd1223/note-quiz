'use client';

import Link from 'next/link';
import { FaMusic, FaPlay, FaCog, FaTrophy } from 'react-icons/fa';

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <section className="max-w-4xl mx-auto">
        <div className="mb-8">
          <FaMusic className="text-6xl text-blue-600 mx-auto mb-4" />
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            계이름 맞추기 게임
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            음표를 보고 정확한 계이름을 맞춰보세요!<br />
            시각적 학습과 청각적 훈련을 통해 음악 실력을 향상시키세요.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-md p-6">
            <FaPlay className="text-3xl text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              다양한 게임 모드
            </h3>
            <p className="text-gray-600 text-sm">
              시각적, 청각적, 또는 두 가지 모두를 활용한 학습 모드를 선택할 수 있습니다.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <FaCog className="text-3xl text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              맞춤형 설정
            </h3>
            <p className="text-gray-600 text-sm">
              음자리표, 조표, 옥타브 범위 등을 자유롭게 설정하여 난이도를 조절하세요.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <FaTrophy className="text-3xl text-yellow-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              실시간 피드백
            </h3>
            <p className="text-gray-600 text-sm">
              정확도와 시간을 실시간으로 추적하고 개인 기록을 관리하세요.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Link
            href="/game"
            className="inline-flex items-center px-8 py-4 text-lg font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <FaPlay className="mr-2" />
            게임 시작하기
          </Link>

          <div className="text-sm text-gray-500">
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
