import type { Metadata } from "next";
import { siteUrl } from "@/lib/metadata";
import PageShell from "@/components/layouts/PageShell";

export const metadata: Metadata = {
  title: "Contact | Note Quiz",
  description: "Contact the Note Quiz creator for questions, feedback, and support.",
  alternates: {
    canonical: `${siteUrl}/contact`,
  },
};

export default function ContactPage() {
  return (
    <PageShell>
      <main className="mx-auto max-w-4xl px-4 py-12 text-slate-800 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-black text-slate-950">Contact</h1>
      <p className="mt-4 max-w-2xl leading-7">
        For questions, feedback, privacy requests, or support related to Note Quiz,
        contact the creator by email.
      </p>

      <a
        className="mt-8 inline-flex rounded-2xl bg-[#6d28d9] px-5 py-3 font-bold text-white shadow-[0_14px_35px_rgba(109,40,217,0.22)] transition hover:bg-[#5b21b6]"
        href="mailto:wkghd951223@gmail.com"
      >
        wkghd951223@gmail.com
      </a>
      </main>
    </PageShell>
  );
}
