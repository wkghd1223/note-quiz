import type { LeaderboardCountry } from "@/types/leaderboard";

const FALLBACK_COUNTRY_CODE = "XX";

const COUNTRY_HEADER_NAMES = [
  "cloudfront-viewer-country",
  "cf-ipcountry",
  "x-vercel-ip-country",
  "x-country-code",
  "x-appengine-country",
];

const IP_HEADER_NAMES = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-real-ip",
  "x-forwarded-for",
  "forwarded",
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

function normalizeIpAddress(value: string | null | undefined): string | null {
  if (!value) return null;

  const firstValue = value.split(",")[0]?.trim();
  if (!firstValue) return null;

  const forwardedForMatch = firstValue.match(/for="?([^";,\s]+)"?/i);
  const ipAddress = (forwardedForMatch?.[1] ?? firstValue)
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/^::ffff:/, "");

  if (!ipAddress || ipAddress === "unknown") return null;
  return ipAddress;
}

function isPrivateIpv4(ipAddress: string): boolean {
  const parts = ipAddress.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function getClientIpFromHeaders(headersList: Headers): string | null {
  for (const headerName of IP_HEADER_NAMES) {
    const headerValue = headersList.get(headerName);
    const ipAddress = normalizeIpAddress(headerValue);
    if (ipAddress && !isPrivateIpv4(ipAddress)) {
      return ipAddress;
    }
  }

  return null;
}

async function lookupCountryByIp(ipAddress: string): Promise<LeaderboardCountry | null> {
  try {
    const response = await fetch(
      `https://freeipapi.com/api/json/${encodeURIComponent(ipAddress)}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      countryCode?: string;
    };

    if (!payload.countryCode) return null;
    return getCountryFromCode(payload.countryCode);
  } catch (error) {
    console.error("Failed to look up country by IP:", error);
    return null;
  }
}

export async function detectCountryFromHeaders(
  headersList: Headers,
): Promise<LeaderboardCountry> {
  const clientIp = getClientIpFromHeaders(headersList);
  if (clientIp) {
    const country = await lookupCountryByIp(clientIp);
    if (country) return country;
  }

  for (const headerName of COUNTRY_HEADER_NAMES) {
    const countryCode = normalizeCountryCode(headersList.get(headerName));
    if (countryCode !== FALLBACK_COUNTRY_CODE) {
      return getCountryFromCode(countryCode);
    }
  }

  return getCountryFromCode(FALLBACK_COUNTRY_CODE);
}
