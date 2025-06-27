import UserAnalytics from '@/components/pages/dashboard/user-analytics';
import Loading from '@/components/ui/loading';
import api from '@/lib/api';
import { Suspense } from 'react';

const userAnalysis: any = {
  concentration: 1,
  power: 3,
};

export default async function StudentPage(params: { userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const userId = params.userId;
  const item = { ...userAnalysis };
  await api.get(`/v1/health-check`);
  return (
    <Suspense fallback={<Loading />}>
      <UserAnalytics item={item} />
    </Suspense>
  );
}
