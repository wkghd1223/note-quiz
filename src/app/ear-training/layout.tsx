import type { Metadata } from "next";
import Header from "@/components/layouts/header";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://note-quiz.com";

export const metadata: Metadata = {
  title: "Ear Training",
  description:
    "Practice ear training, note recognition, absolute pitch, and perfect pitch with interactive listening exercises in Note Quiz.",
  keywords: [
    "ear training",
    "note ear training",
    "absolute pitch",
    "perfect pitch",
    "pitch recognition",
    "music ear training",
    "note listening practice",
  ],
  alternates: {
    canonical: `${siteUrl}/ear-training`,
  },
  openGraph: {
    title: "Note Quiz Ear Training",
    description:
      "Train note recognition by ear with interactive absolute pitch and perfect pitch style exercises.",
    url: `${siteUrl}/ear-training`,
  },
  twitter: {
    title: "Note Quiz Ear Training",
    description:
      "Practice note recognition, ear training, absolute pitch, and perfect pitch drills online.",
  },
};

export default function EarTrainingLayout({
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
