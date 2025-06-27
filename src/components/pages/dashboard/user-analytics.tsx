import Rank from '@/components/ui/rank';
import Link from 'next/link';
import PercentileTracker from '@/components/ui/percentile-tracker';
import { FiAlertCircle } from 'react-icons/fi';

interface UserAnalyticsInf {
  item: any;
}
const UserAnalytics = ({ item }: UserAnalyticsInf) => {
  /* Analysis Section */
  return (
    <section>
      <div>
        <h3>분석</h3>
        <p>분석내용</p>
      </div>
    </section>
  );
};

export default UserAnalytics;
