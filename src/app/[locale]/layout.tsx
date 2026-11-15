import { notFound } from "next/navigation";
import RootDocument from "@/components/layouts/RootDocument";
import { defaultMetadata } from "@/lib/metadata";
import { isLanguage, SUPPORTED_LOCALES } from "@/lib/i18n/locale";

export const metadata = defaultMetadata;
export const dynamicParams = false;

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocalizedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLanguage(locale)) notFound();
  return <RootDocument language={locale}>{children}</RootDocument>;
}
