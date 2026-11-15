import { serializePracticeConfig, type PracticeConfig } from "./config";
import { practiceModeHref } from "./routing";

const configKeys =
  "share mode level length seconds view task direction focus clef key above below input sound accidentals probability notes min max intervals chords inversions".split(
    " ",
  );
const base = "https://practice.invalid";
const relative = (url: URL) => `${url.pathname}${url.search}${url.hash}`;

/** Replace serialized settings while retaining overlays, daily intent and unrelated query keys. */
export function practiceSettingsHref(
  config: PracticeConfig,
  currentHref: string,
): string {
  const url = new URL(currentHref, base);
  for (const key of configKeys) url.searchParams.delete(key);
  for (const [key, value] of new URLSearchParams(
    serializePracticeConfig(config),
  ))
    url.searchParams.set(key, value);
  url.pathname = practiceModeHref(config.mode, url.pathname);
  return relative(url);
}
export function patchPracticeQuery(
  currentHref: string,
  patch: Record<string, string | null>,
): string {
  const url = new URL(currentHref, base);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  return relative(url);
}

/** Compose rapid UI intents before Next's asynchronous replaces have committed. */
export function createPracticeUrlIntent(initialHref: string) {
  let href = relative(new URL(initialHref, base));
  let pending: string[] = [];
  return {
    get href() {
      return href;
    },
    replace(nextHref: string) {
      href = relative(new URL(nextHref, base));
      if (pending.at(-1) !== href) pending.push(href);
      return href;
    },
    observe(committedHref: string) {
      const committed = relative(new URL(committedHref, base));
      const index = pending.indexOf(committed);
      if (index >= 0) {
        pending = pending.slice(index + 1);
        if (pending.length) return false;
      } else {
        // An external link or back/forward navigation becomes authoritative.
        pending = [];
      }
      href = committed;
      return true;
    },
  };
}
