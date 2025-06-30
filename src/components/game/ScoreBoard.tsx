"use client";

import React from "react";
import { useGameStore } from "@/store/gameStore";

interface ScoreBoardProps {
  className?: string;
}

const ScoreBoard: React.FC<ScoreBoardProps> = ({ className = "" }) => {
  const {
    answers,
    getCurrentScore,
    getAccuracy,
    gameResult,
    stats,
    gameState,
  } = useGameStore();

  const currentScore = getCurrentScore();
  const currentAccuracy = getAccuracy();
  const totalQuestions = answers.length;

  return (
    <div className={`scoreboard-container ${className}`}>
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
          점수판
        </h3>

        {/* 현재 게임 점수 */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">정답</span>
            <span className="text-lg font-bold text-green-600">
              {currentScore}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">총 문제</span>
            <span className="text-lg font-bold text-blue-600">
              {totalQuestions}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">정확도</span>
            <span className="text-lg font-bold text-purple-600">
              {currentAccuracy.toFixed(1)}%
            </span>
          </div>

          {/* 정확도 진행 바 */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${currentAccuracy}%` }}
            />
          </div>
        </div>

        {/* 게임 완료 시 결과 */}
        {gameState === "finished" && gameResult && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-md font-semibold text-gray-800 mb-3">
              게임 결과
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">최종 점수</span>
                <span className="font-medium">
                  {gameResult.correctAnswers}/{gameResult.totalQuestions}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">최종 정확도</span>
                <span className="font-medium">
                  {gameResult.accuracy.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">총 시간</span>
                <span className="font-medium">
                  {(gameResult.totalTime / 1000).toFixed(1)}초
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">평균 시간</span>
                <span className="font-medium">
                  {(gameResult.averageTime / 1000).toFixed(1)}초/문제
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 전체 통계 */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-md font-semibold text-gray-800 mb-3">
            전체 통계
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">플레이한 게임</span>
              <span className="font-medium">{stats.gamesPlayed}게임</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">전체 정확도</span>
              <span className="font-medium">
                {stats.averageAccuracy.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">최고 정확도</span>
              <span className="font-medium text-green-600">
                {stats.bestAccuracy.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">최고 기록</span>
              <span className="font-medium text-blue-600">
                {stats.bestTime === Infinity
                  ? "-"
                  : `${(stats.bestTime / 1000).toFixed(1)}초`}
              </span>
            </div>
          </div>
        </div>

        {/* 최근 답안 히스토리 */}
        {answers.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-md font-semibold text-gray-800 mb-3">
              최근 답안
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {answers
                .slice(-5)
                .reverse()
                .map((answer, index) => (
                  <div
                    key={`answer-${answers.length - index}`}
                    className={`p-2 rounded text-sm ${
                      answer.isCorrect
                        ? "bg-green-50 text-green-800"
                        : "bg-red-50 text-red-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {answer.note.name}
                        {answer.note.accidental === "sharp" && "#"}
                        {answer.note.accidental === "flat" && "♭"}
                        {answer.note.octave}
                      </span>
                      <span
                        className={`text-xs ${
                          answer.isCorrect ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {answer.isCorrect ? "✓" : "✗"}
                      </span>
                    </div>
                    <div className="text-xs opacity-75 mt-1">
                      {(answer.timeSpent / 1000).toFixed(1)}초
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 성취 배지 */}
        {gameState === "finished" && gameResult && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-md font-semibold text-gray-800 mb-3">성취</h4>
            <div className="flex flex-wrap gap-2">
              {gameResult.accuracy === 100 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  🏆 완벽!
                </span>
              )}
              {gameResult.accuracy >= 90 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ⭐ 우수
                </span>
              )}
              {gameResult.accuracy >= 70 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  👍 양호
                </span>
              )}
              {gameResult.totalQuestions >= 10 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  💪 지구력
                </span>
              )}
              {gameResult.averageTime < 3000 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  ⚡ 빠름
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoreBoard;
