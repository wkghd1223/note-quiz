import React from 'react';
interface PercentileTrackerProps {
  items?: PercentileTrackerType[];
}
const PercentileTracker = ({ items = [] }: PercentileTrackerProps) => {
  return (
    <div className="relative w-full h-[85px]">
      {/* Progress Bar */}
      <div
        className="relative w-full h-1 bg-gray-300 rounded-full"
        style={{ transform: 'translateY(41px)' }}
      >
        {[...Array(11)].map((_, i) => (
          <div
            key={`PERCENTILE_MARKERS_${i}`}
            className="absolute w-0.5 h-3 bg-gray-400 top-[-3.5px]"
            style={{ left: `${i * 10}%`, transform: 'translateX(-50%)' }}
          />
        ))}
        {items.map((item, itemKey) => (
          <div
            key={`PERCENTILE_TRACKER_${itemKey}`}
            className={`absolute left-0 transform -translate-x-1/2 flex flex-col items-center ${item.side === 'up' ? 'bottom-0' : ''}`}
            style={{ left: `${item.percentile}%` }}
          >
            {item.side === 'up' ? (
              <>
                <span
                  className={`my-1 text-xs whitespace-nowrap ${item.color === 'blue' ? 'text-blue-600' : 'text-gray-600'}`}
                >
                  {item.label} (상위 {item.percentile}%)
                </span>
                <ArrowDown color={item.color} />
              </>
            ) : (
              <>
                <ArrowUp color={item.color} />
                <span
                  className={`my-1 text-xs whitespace-nowrap ${item.color === 'blue' ? 'text-blue-600' : 'text-gray-600'}`}
                >
                  {item.label} (상위 {item.percentile}%)
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PercentileTracker;

const ArrowUp = ({ color = 'gray' }: { color?: 'blue' | 'gray' }) => {
  return (
    <div
      className={`w-0 h-0 border-l-[12px] border-r-[12px] border-b-[18px] border-transparent ${color === 'blue' ? 'border-b-blue-500' : 'border-b-gray-500'}`}
    ></div>
  );
};
const ArrowDown = ({ color = 'gray' }: { color?: 'blue' | 'gray' }) => {
  return (
    <div
      className={`w-0 h-0 border-l-[12px] border-r-[12px] border-t-[18px] border-transparent ${color === 'blue' ? 'border-t-blue-500' : 'border-t-gray-500'}`}
    ></div>
  );
};
