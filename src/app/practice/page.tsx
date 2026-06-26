import type { Metadata } from "next";
import { Suspense } from "react";
import PracticeClient from "./PracticeClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://note-quiz.com";

export const metadata: Metadata = {
  title: "Practice Music Notes and Ear Training",
  description:
    "Practice note reading and ear training in one focused music learning console.",
  alternates: {
    canonical: `${siteUrl}/practice`,
  },
};

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f7fb]" />}>
      <PracticeClient />
    </Suspense>
  );
}
