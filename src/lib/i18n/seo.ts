import type { Metadata } from "next";
import { siteUrl } from "@/lib/metadata";
import { melodyCopy } from "@/features/melody/i18n";
import { getTranslation } from "./translations";
import {
  htmlLanguage,
  localizedHref,
  stripLocale,
  SUPPORTED_LOCALES,
} from "./locale";

const absolute = (pathname: string) => new URL(pathname, siteUrl).toString();

/** Redirecting practice indexes share the canonical identity of their final leaf. */
function canonicalPagePath(href: string): string {
  const url = new URL(href, siteUrl);
  const path = stripLocale(url.pathname);
  if (path !== "/practice") return path;
  const requested = url.searchParams.get("mode");
  const mode =
    requested === "ear" || requested === "interval" || requested === "chord"
      ? requested
      : "note";
  return `/practice/${mode}`;
}

export function languageAlternates(
  pathname: string,
  locale: Language | null,
): NonNullable<Metadata["alternates"]> {
  const path = canonicalPagePath(pathname);
  return {
    canonical: absolute(localizedHref(path, locale)),
    languages: {
      ...Object.fromEntries(
        SUPPORTED_LOCALES.map((language) => [
          htmlLanguage(language),
          absolute(localizedHref(path, language)),
        ]),
      ),
      "x-default": absolute(path),
    },
  };
}

export function localeMetadata(
  locale: Language,
  pathname: string,
  copy?: { title: string; description: string },
): Metadata {
  const path = canonicalPagePath(pathname);
  const mode = path.match(/^\/practice\/(note|ear|interval|chord)$/)?.[1] as
    | import("@/lib/practice/types").TrainingMode
    | undefined;
  const t = getTranslation(locale),
    challenge = melodyCopy(locale);
  const page =
    copy ??
    (path === "/"
      ? {
          title: `${t.gameTitle} — ${t.home.hero.description}`,
          description: t.learning.entryDescription,
        }
      : path === "/practice" || mode
        ? {
            title: mode
              ? `${t.learning[mode]} | Note Quiz`
              : `${t.learning.note} · ${t.learning.ear} | Note Quiz`,
            description: mode
              ? t.learning[`${mode}Description`]
              : t.learning.entryDescription,
          }
        : {
            title: `${challenge.title} | Note Quiz`,
            description: challenge.intro,
          });
  const ogLocales: Record<Language, string | null> = {
    en: "en_US",
    ko: "ko_KR",
    ja: "ja_JP",
    es: "es_ES",
    de: "de_DE",
    fr: "fr_FR",
    zh: "zh_CN",
    pt: "pt_BR",
    ru: "ru_RU",
    ka: "ka_GE",
    // og:locale is optional and requires a territory; Esperanto has no target region.
    eo: null,
  };
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: languageAlternates(path, locale),
    openGraph: {
      title: page.title,
      description: page.description,
      url: absolute(localizedHref(path, locale)),
      ...(ogLocales[locale] ? { locale: ogLocales[locale] } : {}),
      siteName: "Note Quiz",
      type: "website",
      images: [
        {
          url: `${siteUrl}/logo.png`,
          width: 1200,
          height: 630,
          alt: "Note Quiz",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [`${siteUrl}/logo.png`],
    },
  };
}

/** Mode labels share the same translation contract as the practice switcher. */
export function practiceModeMetadata(
  mode: import("@/lib/practice/types").TrainingMode,
  locale: Language | null,
): Metadata {
  const t = getTranslation(locale ?? "en");
  const path = `/practice/${mode}`;
  const copy = {
    title: `${t.learning[mode]} | Note Quiz`,
    description: t.learning[`${mode}Description`],
  };
  return locale
    ? localeMetadata(locale, path, copy)
    : {
        title: { absolute: copy.title },
        description: copy.description,
        alternates: languageAlternates(path, null),
        openGraph: {
          title: copy.title,
          description: copy.description,
          url: absolute(path),
        },
        twitter: {
          card: "summary_large_image",
          title: copy.title,
          description: copy.description,
        },
      };
}
