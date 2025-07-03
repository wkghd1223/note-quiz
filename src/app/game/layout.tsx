import { Metadata } from "next";
import Timer from "@/components/game/Timer";

const gameJsonLd = {
  "@context": "https://schema.org",
  "@type": "Game",
  name: "Note Quiz Game",
  description:
    "Interactive music note identification game for sight-reading practice",
  url: "https://note-quiz.com/game",
  applicationCategory: "EducationalApplication",
  gameItem: {
    "@type": "Thing",
    name: "Musical Note",
    description: "Musical notes on staff notation",
  },
  educationalUse: "Music Education",
  learningResourceType: "Interactive Game",
  audience: {
    "@type": "EducationalAudience",
    educationalRole: "student",
  },
  creator: {
    "@type": "Person",
    name: "JEON HYEONTAE",
  },
};

export const metadata: Metadata = {
  title: "Play Game",
  description:
    "Start playing the note identification game. Test your sight-reading skills with customizable settings including clefs, key signatures, and difficulty levels.",
  openGraph: {
    title: "Note Quiz - Play Now",
    description:
      "Test your music sight-reading skills with our interactive note identification game.",
  },
  other: {
    "application/ld+json": JSON.stringify(gameJsonLd),
  },
};

export default function Layout({
  header,
  main,
}: Readonly<{
  header: React.ReactNode;
  main: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-gray-50 md:bg-transparent">
        <div className="max-w-7xl mx-auto px-4 pt-4 md:pt-0 md:bg-transparent bg-white">
          {header}
        </div>
      </div>

      {/* 타이머 - 모바일에서만 sticky */}
      <div className="md:hidden sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <Timer className="mx-auto" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-4">
        {/* 메인 게임 영역 */}
        {main}
      </div>
    </div>
  );
}
