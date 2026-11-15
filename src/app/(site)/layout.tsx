import { defaultMetadata } from "@/lib/metadata";
import RootDocument from "@/components/layouts/RootDocument";

export const metadata = defaultMetadata;

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RootDocument language="en">{children}</RootDocument>;
}
