import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/globals.css";
import { defaultMetadata } from "@/lib/metadata";
import Footer from "@/components/layouts/footer";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import GoogleAnalyticsRouteTracker from "@/components/analytics/GoogleAnalyticsRouteTracker";
import LanguageInitializer from "@/components/providers/LanguageInitializer";
import GoogleAdsense from "@/components/adsense/GoogleAdsense";
// import Head from "next/head";/

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = defaultMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <GoogleAnalytics />
        <GoogleAdsense />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageInitializer />
        <GoogleAnalyticsRouteTracker />
        {children}
        <Footer />
      </body>
    </html>
  );
}
