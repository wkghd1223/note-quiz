export const SUPPORTED_LOCALES = [
  "en",
  "ko",
  "ja",
  "es",
  "de",
  "fr",
  "zh",
  "pt",
  "ru",
  "ka",
  "eo",
] as const satisfies readonly Language[];

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" &&
    SUPPORTED_LOCALES.some((locale) => locale === value)
  );
}

export function localeFromPathname(pathname: string): Language | null {
  const segment = pathname.split("/")[1];
  return isLanguage(segment) ? segment : null;
}

export function stripLocale(pathname: string): string {
  const locale = localeFromPathname(pathname);
  return locale ? pathname.slice(locale.length + 1) || "/" : pathname;
}

function hasLocalizedPage(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/practice" ||
    /^\/practice\/(note|ear|interval|chord)$/.test(pathname) ||
    pathname === "/melody" ||
    pathname === "/challenge" ||
    pathname.startsWith("/challenge/")
  );
}

/** Legal, API, asset and external destinations retain their existing URLs. */
export function localizedHref(href: string, locale: Language | null): string {
  if (!locale || !href.startsWith("/") || href.startsWith("//")) return href;
  const suffixAt = href.search(/[?#]/);
  const pathname = suffixAt < 0 ? href : href.slice(0, suffixAt);
  const suffix = suffixAt < 0 ? "" : href.slice(suffixAt);
  const plain = stripLocale(pathname);
  if (!hasLocalizedPage(plain)) return href;
  return `/${locale}${plain === "/" ? "" : plain}${suffix}`;
}

/** A null target preserves the legacy unprefixed in-place language selector. */
export function languageSwitchHref(
  pathname: string,
  search: string,
  hash: string,
  language: Language,
): string | null {
  return localeFromPathname(pathname)
    ? `${localizedHref(stripLocale(pathname), language)}${search}${hash}`
    : null;
}

export function htmlLanguage(language: Language): string {
  return language === "zh" ? "zh-Hans" : language === "pt" ? "pt-BR" : language;
}

export function resolveLanguage(
  pathname: string,
  storedLanguage: Language,
  initialized: boolean,
) {
  const locale = localeFromPathname(pathname);
  return {
    locale,
    language: locale ?? storedLanguage,
    isInitialized: locale !== null || initialized,
  };
}
