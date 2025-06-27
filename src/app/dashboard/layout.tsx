import UserList from '@/components/pages/dashboard/user-list';

export default function Layout({
  profile,
  analytics,
  feed,
}: Readonly<{
  profile: React.ReactNode;
  analytics: React.ReactNode;
  feed: React.ReactNode;
}>) {
  const users = [
    { id: 1, number: '2024325001', status: '완료' },
    { id: 2, number: '2024325002', status: '완료' },
    { id: 3, number: '2024325003', status: '완료' },
    { id: 4, number: '2024325004', status: '완료' },
    { id: 5, number: '2024325005', status: '미완료' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 bg-white p-4 shadow-md min-w-[300px]">
        <UserList users={users} />
      </aside>
      <main className="flex-1">
        <div className="grid grid-cols-12 grid-rows-12 gap-1 p-1 min-w-[1100px] h-[1100px]">
          <section className="col-span-7 row-span-6 bg-white p-4">
            <h2 className="font-semibold text-lg border-b pb-2">
              ㅇㅠㅈㅓ ㅍㅡㄹㅗㅍㅣㄹ
            </h2>
            {profile}
          </section>
          <section className="col-span-5 row-span-6 bg-white p-4">
            <h2 className="font-semibold text-lg border-b pb-2">ㅍㅣㄷㅡ</h2>
            {feed}
          </section>
          <section className="col-span-12 row-span-6 bg-white p-4">
            <h2 className="font-semibold text-lg border-b pb-2">
              ㅎㅏㄱㅅㅐㅇ 분석
            </h2>
            {analytics}
          </section>
        </div>
      </main>
    </div>
  );
}
