import HomeClient from "./HomeClient";
import { languageAlternates } from "@/lib/i18n/seo";
import { homeCopy } from "@/lib/i18n/home";
import { defaultMetadata } from "@/lib/metadata";
import { challengeEnabled } from "@/features/challenge/config";

const copy = homeCopy("en", challengeEnabled);
export const metadata = {
  title: { absolute: copy.metaTitle },
  description: copy.metaDescription,
  alternates: languageAlternates("/", null),
  openGraph: {
    ...defaultMetadata.openGraph,
    title: copy.metaTitle,
    description: copy.metaDescription,
  },
  twitter: {
    ...defaultMetadata.twitter,
    title: copy.metaTitle,
    description: copy.metaDescription,
  },
};

export default function HomePage() {
  return <HomeClient />;
}
