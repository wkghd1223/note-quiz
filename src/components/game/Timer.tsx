'use client';

import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';

interface TimerProps {
  className?: string;
}

const Timer: React.FC<TimerProps> = ({ className = '' }) => {
  const { 
    gameState, 
    elapsedTime, 
    updateTimer, 
    settings,
    endGame 
  } = useGameStore();
  
  const [displayTime, setDisplayTime] = useState(0);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (gameState === 'playing') {
      intervalId = setInterval(() => {
        const now = Date.now();
        updateTimer(now);
        setDisplayTime(elapsedTime);

        // 시간 제한 체크
        if (settings.timeLimit && elapsedTime >= settings.timeLimit * 1000) {
          endGame();
        }
      }, 100); // 100ms마다 업데이트
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [gameState, elapsedTime, updateTimer, settings.timeLimit, endGame]);

  // 시간을 MM:SS.T 형식으로 포맷
  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((milliseconds % 1000) / 100);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  };

  // 시간 제한이 있을 때 남은 시간 계산
  const getRemainingTime = (): number => {
    if (!settings.timeLimit) return 0;
    return Math.max(0, settings.timeLimit * 1000 - elapsedTime);
  };

  const remainingTime = getRemainingTime();
  const isTimeRunningOut = settings.timeLimit && remainingTime < 10000; // 10초 미만

  return (
    <div className={`timer-container ${className}`}>
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="text-center">
          <div className="text-sm font-medium text-gray-600 mb-1">
            {settings.timeLimit ? '남은 시간' : '경과 시간'}
          </div>
          <div 
            className={`text-3xl font-mono font-bold transition-colors duration-200 ${
              isTimeRunningOut 
                ? 'text-red-600 animate-pulse' 
                : gameState === 'playing' 
                  ? 'text-blue-600' 
                  : 'text-gray-800'
            }`}
          >
            {settings.timeLimit 
              ? formatTime(remainingTime)
              : formatTime(elapsedTime)
            }
          </div>
          
          {/* 시간 제한이 있을 때 진행 바 */}
          {settings.timeLimit && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-200 ${
                    isTimeRunningOut ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{
                    width: `${(remainingTime / (settings.timeLimit * 1000)) * 100}%`
                  }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {settings.timeLimit}초 제한
              </div>
            </div>
          )}
          
          {/* 게임 상태 표시 */}
          <div className="mt-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              gameState === 'playing' 
                ? 'bg-green-100 text-green-800'
                : gameState === 'paused'
                  ? 'bg-yellow-100 text-yellow-800'
                  : gameState === 'finished'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
            }`}>
              {gameState === 'playing' && '진행 중'}
              {gameState === 'paused' && '일시정지'}
              {gameState === 'finished' && '완료'}
              {gameState === 'idle' && '대기'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timer;
