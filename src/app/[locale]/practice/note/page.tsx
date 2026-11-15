import { notFound } from "next/navigation";
import NotePracticeEntry from "@/app/(site)/practice/NotePracticeEntry";
import { isLanguage } from "@/lib/i18n/locale";
import { practiceModeMetadata } from "@/lib/i18n/seo";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLanguage(locale)) notFound();
  return practiceModeMetadata("note", locale);
}
export default function PracticePage() {
  return <NotePracticeEntry />;
}
