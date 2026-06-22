import type { Metadata } from "next";
import { siteUrl } from "@/lib/metadata";
import PageShell from "@/components/layouts/PageShell";

export const metadata: Metadata = {
  title: "About | Note Quiz",
  description:
    "Learn about Note Quiz, a free music note reading and ear training practice site.",
  alternates: {
    canonical: `${siteUrl}/about`,
  },
};

export default function AboutPage() {
  return (
    <PageShell>
      <main className="mx-auto max-w-4xl px-4 py-12 text-slate-800 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-black text-slate-950">About Note Quiz</h1>

      <div className="mt-8 space-y-6 leading-7">
        <p>
          Note Quiz is a free web app for practicing music note reading, sight-reading
          basics, and ear training. It is designed for learners who want quick, focused
          practice without registration or payment.
        </p>
        <p>
          The main quiz helps users identify notes across clefs and key signatures. Ear
          training mode helps users connect sound with notation through simple practice
          sessions.
        </p>
        <p>
          Note Quiz is created and maintained by JEON HYEONTAE. Feedback and support
          requests can be sent through the contact page.
        </p>
      </div>
      </main>
    </PageShell>
  );
}
