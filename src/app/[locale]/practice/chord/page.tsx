import { notFound } from "next/navigation";
import ChordPracticeEntry from "@/app/(site)/practice/ChordPracticeEntry";
import { isLanguage } from "@/lib/i18n/locale";
import { practiceModeMetadata } from "@/lib/i18n/seo";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLanguage(locale)) notFound();
  return practiceModeMetadata("chord", locale);
}
export default function PracticePage() {
  return <ChordPracticeEntry />;
}
