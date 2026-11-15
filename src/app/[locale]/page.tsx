import { notFound } from "next/navigation";
import HomeClient from "@/app/(site)/HomeClient";
import { isLanguage } from "@/lib/i18n/locale";
import { localeMetadata } from "@/lib/i18n/seo";
import { homeCopy } from "@/lib/i18n/home";
import { challengeEnabled } from "@/features/challenge/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLanguage(locale)) notFound();
  const copy = homeCopy(locale, challengeEnabled);
  return localeMetadata(locale, "/", {
    title: copy.metaTitle,
    description: copy.metaDescription,
  });
}

export default function LocalizedHomePage() {
  return <HomeClient />;
}
