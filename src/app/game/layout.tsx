export default function Layout({
  header,
  main,
  control,
}: Readonly<{
  header: React.ReactNode;
  main: React.ReactNode;
  control: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        {header}

        {/* 게임 컨트롤 */}
        {control}

        {/* 메인 게임 영역 */}
        {main}
      </div>
    </div>
  );
}
