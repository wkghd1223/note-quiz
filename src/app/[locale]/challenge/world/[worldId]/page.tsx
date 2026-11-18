import { notFound, permanentRedirect } from "next/navigation";
import { challengeEnabled } from "@/features/challenge/config";
import { isLanguage, localizedHref } from "@/lib/i18n/locale";
export default async function LegacyChallengePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!challengeEnabled || !isLanguage(locale)) notFound();
  permanentRedirect(localizedHref("/melody/generated", locale));
}
