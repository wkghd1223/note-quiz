import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/metadata";
import { SUPPORTED_LOCALES, localizedHref } from "@/lib/i18n/locale";
import { languageAlternates } from "@/lib/i18n/seo";
import { challengeEnabled } from "@/features/challenge/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const localizedPaths = [
    "/",
    "/practice/note",
    "/practice/ear",
    "/practice/interval",
    "/practice/chord",
    ...(challengeEnabled ? ["/melody/generated", "/melody/upload"] : []),
  ];
  const pages: MetadataRoute.Sitemap = localizedPaths.flatMap((path) =>
    [null, ...SUPPORTED_LOCALES].map((locale) => ({
      url: new URL(localizedHref(path, locale), siteUrl).toString(),
      alternates: {
        languages: languageAlternates(path, locale).languages as Record<
          string,
          string
        >,
      },
      changeFrequency: "weekly" as const,
      priority: path === "/" ? 1 : 0.9,
    })),
  );
  return [
    ...pages,
    ...["/about", "/contact", "/privacy-policy", "/terms-of-service"].map(
      (path) => ({
        url: new URL(path, siteUrl).toString(),
        changeFrequency:
          path === "/about" || path === "/contact"
            ? ("monthly" as const)
            : ("yearly" as const),
        priority: path === "/about" ? 0.5 : 0.4,
      }),
    ),
  ];
}
