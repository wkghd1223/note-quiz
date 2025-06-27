import { MdOutlineSentimentDissatisfied } from 'react-icons/md';
import { motion } from 'framer-motion';

interface NoDataProps {
  message?: string;
  className?: string;
}

const NoData: React.FC<NoDataProps> = ({ message, className }) => {
  return (
    <motion.div
      className={`flex flex-col items-center justify-center py-16 rounded-lg ${className || ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <MdOutlineSentimentDissatisfied className="text-7xl text-gray-400 mb-4" />
      <p className="text-xl font-semibold text-gray-600">
        {message || 'No data available'}
      </p>
    </motion.div>
  );
};

export default NoData;
