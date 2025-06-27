'use client';

import React from 'react';
import { GameResult } from '@/types/music';
import { useTranslation } from '@/hooks/useTranslation';

interface GameResultModalProps {
  isOpen: boolean;
  result: GameResult | null;
  onClose: () => void;
  onPlayAgain: () => void;
  className?: string;
}

const GameResultModal: React.FC<GameResultModalProps> = ({
  isOpen,
  result,
  onClose,
  onPlayAgain,
  className = ''
}) => {
  const { t } = useTranslation();

  if (!isOpen || !result) return null;

  const getGradeColor = (accuracy: number) => {
    if (accuracy >= 90) return 'text-green-600';
    if (accuracy >= 70) return 'text-blue-600';
    if (accuracy >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getGradeText = (accuracy: number) => {
    if (accuracy === 100) return '완벽!';
    if (accuracy >= 90) return '우수';
    if (accuracy >= 70) return '양호';
    if (accuracy >= 50) return '보통';
    return '연습 필요';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg shadow-xl max-w-md w-full mx-4 ${className}`}>
        {/* 헤더 */}
        <div className="text-center p-6 border-b">
          <div className="mb-4">
            {result.accuracy === 100 ? (
              <div className="text-6xl">🏆</div>
            ) : result.accuracy >= 90 ? (
              <div className="text-6xl">⭐</div>
            ) : result.accuracy >= 70 ? (
              <div className="text-6xl">👍</div>
            ) : (
              <div className="text-6xl">📚</div>
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t.messages.gameComplete}
          </h2>
          <p className={`text-xl font-semibold ${getGradeColor(result.accuracy)}`}>
            {getGradeText(result.accuracy)}
          </p>
        </div>

        {/* 결과 상세 */}
        <div className="p-6">
          <div className="space-y-4">
            {/* 점수 */}
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {result.correctAnswers}/{result.totalQuestions}
              </div>
              <div className="text-sm text-gray-600">정답 / 총 문제</div>
            </div>

            {/* 정확도 */}
            <div className="text-center">
              <div className={`text-3xl font-bold ${getGradeColor(result.accuracy)} mb-2`}>
                {result.accuracy.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">정확도</div>
              
              {/* 정확도 진행 바 */}
              <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 ${
                    result.accuracy >= 90 ? 'bg-green-500' :
                    result.accuracy >= 70 ? 'bg-blue-500' :
                    result.accuracy >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${result.accuracy}%` }}
                />
              </div>
            </div>

            {/* 시간 정보 */}
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-gray-800">
                  {(result.totalTime / 1000).toFixed(1)}초
                </div>
                <div className="text-xs text-gray-600">총 시간</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-800">
                  {(result.averageTime / 1000).toFixed(1)}초
                </div>
                <div className="text-xs text-gray-600">평균 시간</div>
              </div>
            </div>

            {/* 성취 배지 */}
            <div className="text-center">
              <div className="text-sm font-medium text-gray-700 mb-2">성취</div>
              <div className="flex flex-wrap justify-center gap-2">
                {result.accuracy === 100 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    🏆 완벽!
                  </span>
                )}
                {result.accuracy >= 90 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ⭐ 우수
                  </span>
                )}
                {result.accuracy >= 70 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    👍 양호
                  </span>
                )}
                {result.totalQuestions >= 10 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    💪 지구력
                  </span>
                )}
                {result.averageTime < 3000 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    ⚡ 빠름
                  </span>
                )}
                {result.totalQuestions >= 20 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    🎯 집중력
                  </span>
                )}
              </div>
            </div>

            {/* 개선 제안 */}
            {result.accuracy < 70 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm text-blue-800">
                  <strong>💡 팁:</strong>
                  <ul className="mt-1 ml-4 list-disc">
                    {result.accuracy < 50 && (
                      <li>쉬운 난이도부터 시작해보세요</li>
                    )}
                    {result.averageTime > 10000 && (
                      <li>시간을 두고 천천히 생각해보세요</li>
                    )}
                    <li>소리를 들으며 연습하면 도움이 됩니다</li>
                    <li>꾸준한 연습이 실력 향상의 비결입니다</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            닫기
          </button>
          <button
            onClick={onPlayAgain}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            다시 하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameResultModal;
