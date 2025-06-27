import NoticeBoard from '@/components/pages/notice/notice-board';
import { getNotice } from '@/services/noticeService';
import { Suspense } from 'react';

export default async function NoticePage({
  params,
}: {
  params: { noticeId: string };
}) {
  const { noticeId } = await params;
  const item = await getNotice(noticeId);

  if (!item) {
    return <>에러</>;
  }
  return (
    <Suspense fallback={<>로딩</>}>
      <NoticeBoard item={item} />
    </Suspense>
  );
}
