/* eslint-disable @next/next/no-head-element -- Shared HTML root document used by both root layouts, not a page-level head. */
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "@/styles/globals.css";
import SiteShell from "@/components/layouts/SiteShell";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import GoogleAnalyticsRouteTracker from "@/components/analytics/GoogleAnalyticsRouteTracker";
import LanguageInitializer from "@/components/providers/LanguageInitializer";
import { htmlLanguage } from "@/lib/i18n/locale";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootDocument({
  children,
  language,
}: Readonly<{
  children: React.ReactNode;
  language: Language;
}>) {
  return (
    <html lang={htmlLanguage(language)}>
      <head>
        <GoogleAnalytics />
        <Script
          src="https://scripts.scriptwrapper.com/tags/5b2560fd-53fe-4920-872c-67302bb9311c.js"
          strategy="afterInteractive"
          async
          data-noptimize="1"
          data-cfasync="false"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageInitializer />
        <GoogleAnalyticsRouteTracker />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
