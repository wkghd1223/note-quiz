import type { Metadata } from "next";
import Header from "@/components/layouts/header";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://note-quiz.com";

export const metadata: Metadata = {
  title: "Rhythm Practice Note Quiz",
  description:
    "Practice reading note names in rhythm with short staff phrases, active beat tracking, and timing-based musical note drills.",
  keywords: [
    "rhythm practice",
    "music rhythm game",
    "note rhythm training",
    "quarter note practice",
    "music timing game",
    "staff rhythm practice",
  ],
  alternates: {
    canonical: `${siteUrl}/rhythm-training`,
  },
  openGraph: {
    title: "Note Quiz Rhythm Practice",
    description:
      "Train rhythm reading with short note phrases and beat-based answer timing.",
    url: `${siteUrl}/rhythm-training`,
  },
  twitter: {
    title: "Note Quiz Rhythm Practice",
    description:
      "Practice quarter-note rhythm reading and timed note-name input online.",
  },
};

export default function RhythmTrainingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#f4f2f8]">
      <div className="relative z-50 border-b border-[#ded6f7] bg-white/70">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:py-5">
          <Header />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-8 pt-6">{children}</div>
    </div>
  );
}
