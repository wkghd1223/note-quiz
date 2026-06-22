import type { LeaderboardCountry } from "@/types/leaderboard";

const FALLBACK_COUNTRY_CODE = "XX";

const COUNTRY_HEADER_NAMES = [
  "cloudfront-viewer-country",
  "cf-ipcountry",
  "x-vercel-ip-country",
  "x-country-code",
  "x-appengine-country",
];

const countryNameFormatter =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export function normalizeCountryCode(value: string | null | undefined): string {
  if (!value) return FALLBACK_COUNTRY_CODE;

  const countryCode = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode) || countryCode === "ZZ") {
    return FALLBACK_COUNTRY_CODE;
  }

  return countryCode;
}

export function getCountryName(countryCode: string): string {
  if (countryCode === FALLBACK_COUNTRY_CODE) return "Unknown";
  return countryNameFormatter?.of(countryCode) ?? countryCode;
}

export function getCountryFlag(countryCode: string): string {
  if (countryCode === FALLBACK_COUNTRY_CODE) return "🏳";

  return countryCode
    .split("")
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join("");
}

export function getCountryFromCode(countryCode: string): LeaderboardCountry {
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  return {
    countryCode: normalizedCountryCode,
    countryName: getCountryName(normalizedCountryCode),
    flag: getCountryFlag(normalizedCountryCode),
  };
}

export function detectCountryFromHeaders(headersList: Headers): LeaderboardCountry {
  for (const headerName of COUNTRY_HEADER_NAMES) {
    const countryCode = normalizeCountryCode(headersList.get(headerName));
    if (countryCode !== FALLBACK_COUNTRY_CODE) {
      return getCountryFromCode(countryCode);
    }
  }

  return getCountryFromCode(FALLBACK_COUNTRY_CODE);
}
