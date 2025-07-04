import { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://note-quiz.com";

export const siteConfig = {
  name: "Note Quiz",
  description:
    "Learn to read musical notes by sight and sound! A comprehensive web-based music note identification game designed to help musicians improve their sight-reading skills.",
  url: siteUrl,
  ogImage: `${siteUrl}/logo.png`,
  creator: "@note-quiz",
  keywords: [
    "music education",
    "note reading",
    "sight reading",
    "music theory",
    "piano practice",
    "harmonica",
    "music quiz",
    "note identification",
    "solfege",
    "music training",
    "ear training",
    "music game",
  ],
};

export const jsonLdSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Note Quiz",
  description:
    "Learn to read musical notes by sight and sound! A comprehensive web-based music note identification game designed to help musicians improve their sight-reading skills.",
  url: siteUrl,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web Browser",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  creator: {
    "@type": "Person",
    name: "JEON HYEONTAE",
  },
  keywords:
    "music education, note reading, sight reading, music theory, piano practice, harmonica, music quiz",
};

export const defaultMetadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [
    {
      name: "JEON HYEONTAE",
    },
  ],
  creator: siteConfig.creator,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: siteConfig.creator,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "G-RHJP137HQZ",
  },
  other: {
    "application/ld+json": JSON.stringify(jsonLdSchema),
  },
};
