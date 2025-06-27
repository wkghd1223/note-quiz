const Pager = ({
  totalCount,
  page,
  size,
  onPageChange,
}: {
  totalCount: number;
  page: number;
  size: number;
  onPageChange: (newPage: number) => void;
}) => {
  const totalPages = Math.ceil(totalCount / size);

  const handlePrev = () => {
    if (page > 0) onPageChange(page - 1);
  };

  const handleNext = () => {
    if (page < totalPages - 1) onPageChange(page + 1);
  };

  return (
    <div className="flex items-center justify-center space-x-4 p-4 bg-white rounded-lg shadow-md">
      {/* Previous Button */}
      <button
        onClick={handlePrev}
        disabled={page === 0}
        className={`px-4 py-2 border rounded-lg transition-all ${
          page === 0
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        Prev
      </button>

      {/* Page Info */}
      <span className="text-gray-700 text-sm font-semibold">
        Page {page + 1} of {totalPages}
      </span>

      {/* Next Button */}
      <button
        onClick={handleNext}
        disabled={page >= totalPages - 1}
        className={`px-4 py-2 border rounded-lg transition-all ${
          page >= totalPages - 1
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        Next
      </button>
    </div>
  );
};

export default Pager;
