import { notFound } from "next/navigation";
import MelodyPractice from "@/features/melody/components/MelodyPractice";
import { challengeEnabled } from "@/features/challenge/config";
import { isLanguage } from "@/lib/i18n/locale";
import { localeMetadata } from "@/lib/i18n/seo";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLanguage(locale) || !challengeEnabled) notFound();
  return localeMetadata(locale, "/melody");
}
export default function MelodyPage() {
  if (!challengeEnabled) notFound();
  return <MelodyPractice />;
}
