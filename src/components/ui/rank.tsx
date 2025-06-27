interface RankProps {
  rank: RankType;
}

const Rank = ({ rank }: RankProps) => {
  const ranks = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
  const rankIndex = ranks.indexOf(rank);
  const progress = (rankIndex / (ranks.length - 1)) * 100;

  return (
    <div className="relative w-24 h-24  flex items-center justify-center">
      <svg className="absolute w-full h-full" viewBox="0 0 48 48">
        <circle
          className="text-gray-300 stroke-current"
          strokeWidth="2"
          cx="24"
          cy="24"
          r="22"
          fill="none"
        />
        {progress !== 100 && (
          <circle
            className="text-blue-500 stroke-current"
            strokeWidth="2"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={progress}
            strokeLinecap="round"
            cx="24"
            cy="24"
            r="22"
            fill="none"
          />
        )}
      </svg>
      <span className="text-3xl font-bold text-gray-800">{rank}</span>
    </div>
  );
};
export default Rank;
