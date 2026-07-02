import type { Metadata } from "next";
import { siteUrl } from "@/lib/metadata";
import PageShell from "@/components/layouts/PageShell";

export const metadata: Metadata = {
  title: "Privacy Policy | Note Quiz",
  description:
    "Privacy Policy for Note Quiz, including analytics, advertising, and country leaderboard data.",
  alternates: {
    canonical: `${siteUrl}/privacy-policy`,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <PageShell>
      <main className="mx-auto max-w-4xl px-4 py-12 text-slate-800 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-black text-slate-950">Privacy Policy</h1>
      <p className="mt-3 text-sm text-slate-500">Last updated: July 2, 2026</p>

      <div className="mt-8 space-y-8 leading-7">
        <section>
          <h2 className="text-2xl font-bold text-slate-950">Overview</h2>
          <p className="mt-3">
            Note Quiz provides free music note reading and ear training tools. This
            policy explains what information may be collected when you use this site.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-950">Information We Collect</h2>
          <p className="mt-3">
            We do not require account registration. The site may process basic technical
            information such as browser type, device information, pages visited, and
            approximate country for analytics, advertising, security, and leaderboard
            functionality.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-950">Analytics and Advertising</h2>
          <p className="mt-3">
            We use Google Analytics to understand site usage and improve the product. We
            may work with advertising partners, including Mediavine or similar ad
            management services, to display ads and measure ad performance. These
            partners may use cookies or similar technologies for ad delivery,
            measurement, fraud prevention, frequency capping, and personalization where
            permitted by law. You can manage cookies and ad personalization through your
            browser, device, and applicable consent settings.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-950">Country Leaderboard</h2>
          <p className="mt-3">
            For the nationality leaderboard, we detect your country server-side from the
            request IP address, hosting headers, or Free IP API as an IP geolocation provider, then
            group completed game scores by country. We store daily country-level
            aggregate data such as country code, total score, submission count, and
            accuracy totals. Daily aggregate leaderboard rows are retained for 90 days.
            We do not store raw IP addresses for leaderboard scoring.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-950">Contact</h2>
          <p className="mt-3">
            For privacy questions, contact us at{" "}
            <a className="font-bold text-[#6d28d9]" href="mailto:wkghd951223@gmail.com">
              wkghd951223@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
      </main>
    </PageShell>
  );
}
