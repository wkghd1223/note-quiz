import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Play Game",
  description:
    "Start playing the note identification game. Test your sight-reading skills with customizable settings including clefs, key signatures, and difficulty levels.",
  openGraph: {
    title: "Note Quiz Game - Play Now",
    description:
      "Test your music sight-reading skills with our interactive note identification game.",
  },
};

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
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 - 모바일에서 sticky */}
      <div className="sticky top-0 z-40 bg-gray-50 md:relative md:bg-transparent">
        <div className="max-w-7xl mx-auto px-4 pt-4 md:pt-0 md:bg-transparent bg-white">
          {header}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-4">
        {/* 게임 컨트롤 */}
        {control}

        {/* 메인 게임 영역 */}
        {main}
      </div>
    </div>
  );
}
