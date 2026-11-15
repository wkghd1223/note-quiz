import { notFound } from "next/navigation";
import MelodyPractice from "@/features/melody/components/MelodyPractice";
import { challengeEnabled } from "@/features/challenge/config";
import { localeMetadata } from "@/lib/i18n/seo";
import { languageAlternates } from "@/lib/i18n/seo";
export const metadata = {
  ...localeMetadata("en", "/melody"),
  alternates: languageAlternates("/melody", null),
};
export default function MelodyPage() {
  if (!challengeEnabled) notFound();
  return <MelodyPractice />;
}
