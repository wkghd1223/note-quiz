'use client';
import Table from '@/components/ui/table';
import Pager from '@/components/ui/pager';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getNotices } from '@/services/noticeService';
import { useRouter } from 'next/navigation';
import { FRONT_URL_PATH } from '@/lib/constants';

const columns: TableColumnType[] = [
  { name: 'noticeId', text: '공지번호' },
  { name: 'authorName', text: '작성자' },
  { name: 'title', text: '제목' },
  { name: 'createdAt', text: '작성일' },
];

const NoticeList = () => {
  const router = useRouter();
  const [query, setQuery] = useState({
    page: 0,
    size: 10,
  });
  const [items, setItems] = useState<NoticeListType[]>([]);
  const [totalCount, setTotalCounts] = useState(0);
  const tableColumns = useMemo(() => columns, []);

  const handlePageChange = (newPage: number) => {
    setQuery((prev) => ({ ...prev, page: newPage }));
  };

  const getNoticeList = useCallback(async () => {
    const data = await getNotices(query);
    setItems(data.items);
    setTotalCounts(data.totalCount);
  }, [query]);

  useEffect(() => {
    getNoticeList();
  }, [query]);

  const onClick = (item: NoticeListType) => {
    router.push(`${FRONT_URL_PATH.NOTICE}/${item.noticeId}`);
  };

  return (
    <section>
      <Table items={items} columns={tableColumns} onClick={onClick}></Table>
      <Pager
        totalCount={totalCount}
        page={query.page}
        size={query.size}
        onPageChange={handlePageChange}
      />
    </section>
  );
};

export default NoticeList;
