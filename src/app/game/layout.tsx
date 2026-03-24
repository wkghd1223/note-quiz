import { Metadata } from "next";

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
    <div className="min-h-screen bg-[#f4f2f8]">
      {/* 헤더 */}
      <div className="relative z-50 border-b border-[#ded6f7] bg-white/70">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:py-5">{header}</div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-8 pt-6">
        {/* 메인 게임 영역 */}
        {main}
      </div>
    </div>
  );
}
