import type { Metadata } from "next";
import { siteUrl } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "Terms of Service | Note Quiz",
  description: "Terms of Service for using Note Quiz.",
  alternates: {
    canonical: `${siteUrl}/terms-of-service`,
  },
};

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 text-slate-800 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-black text-slate-950">Terms of Service</h1>
      <p className="mt-3 text-sm text-slate-500">Last updated: June 22, 2026</p>

      <div className="mt-8 space-y-8 leading-7">
        <section>
          <h2 className="text-2xl font-bold text-slate-950">Use of the Site</h2>
          <p className="mt-3">
            Note Quiz is provided as a free educational tool for practicing music note
            reading and ear training. You agree to use the site lawfully and not attempt
            to disrupt, abuse, or manipulate the service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-950">Leaderboard Fair Use</h2>
          <p className="mt-3">
            Leaderboard scores are intended to reflect normal gameplay. Automated,
            fraudulent, or manipulated submissions may be rejected, adjusted, or removed.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-950">No Warranty</h2>
          <p className="mt-3">
            The site is provided as is. We do not guarantee uninterrupted access,
            error-free functionality, or that all educational content will meet every
            user&apos;s needs.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-950">Contact</h2>
          <p className="mt-3">
            Questions about these terms can be sent to{" "}
            <a className="font-bold text-[#6d28d9]" href="mailto:wkghd951223@gmail.com">
              wkghd951223@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
