export const GA_TRACKING_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-RHJP137HQZ";

export type AnalyticsPayload = Record<
  string,
  string | number | boolean | null | undefined
>;
type GoogleTag = (
  command: "config" | "event" | "js",
  target: string | Date,
  parameters?: AnalyticsPayload,
) => void;

declare global {
  interface Window {
    gtag?: GoogleTag;
    dataLayer?: unknown[];
  }
}

export interface AnalyticsPageContext {
  page_title: string;
  page_path: string;
  page_location: string;
  page_referrer: string;
}
interface AnalyticsRuntime {
  pathname: string | null;
  contextPathname: string | null;
  contextLocation: string | null;
  contextReferrer: string;
  contextTitle: string;
  initialReferrer: string;
}

// Document-lifetime memory only. Shared by effects/helpers, including remounts.
const runtimes = new WeakMap<Window, AnalyticsRuntime>();

function httpUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url;
  } catch {
    // Empty, malformed and non-web referrers are deliberately omitted.
  }
}

export function analyticsPageContext(
  href: string,
  title: string,
  referrer: string,
): AnalyticsPageContext | undefined {
  const url = httpUrl(href);
  if (!url) return;
  const from = httpUrl(referrer);
  return {
    page_title: title.slice(0, 300),
    page_path: url.pathname,
    page_location: `${url.origin}${url.pathname}`,
    // External referring paths can contain personal information. Keep their
    // origin; same-origin navigation keeps its path, never query/hash/userinfo.
    page_referrer: from
      ? `${from.origin}${from.origin === url.origin ? from.pathname : "/"}`.slice(
          0,
          420,
        )
      : "",
  };
}

export function analyticsCampaign(href: string): AnalyticsPayload {
  const fields: AnalyticsPayload = {};
  const url = httpUrl(href);
  if (!url) return fields;
  // These are documented gtag config fields, not arbitrary event parameters.
  const names = {
    utm_id: "campaign_id",
    utm_source: "campaign_source",
    utm_medium: "campaign_medium",
    utm_campaign: "campaign_name",
    utm_term: "campaign_term",
    utm_content: "campaign_content",
  } as const;
  for (const [query, field] of Object.entries(names)) {
    const value = url.searchParams.get(query)?.trim();
    // Reject overlong values, emails, URLs, separators and control characters.
    // Campaign owners should use short public labels, never personal values.
    if (value && /^[\p{L}\p{N} ._+~-]{1,100}$/u.test(value))
      fields[field] = value;
  }
  return fields;
}

export function initializeAnalytics(): AnalyticsRuntime | undefined {
  if (
    process.env.NODE_ENV !== "production" ||
    typeof window === "undefined" ||
    !GA_TRACKING_ID
  )
    return;

  const previous = runtimes.get(window);
  if (previous) return previous;
  const initial = analyticsPageContext(
    window.location.href,
    document.title,
    document.referrer,
  );
  if (!initial) return;

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    const browser = window;
    // Google's standard queue accepts calls before the external script loads.
    browser.gtag = function () {
      // eslint-disable-next-line prefer-rest-params -- Preserve the standard gtag IArguments queue format.
      browser.dataLayer!.push(arguments);
    };
  }
  const runtime = {
    pathname: null,
    contextPathname: window.location.pathname,
    contextLocation: initial.page_location,
    contextReferrer: initial.page_referrer,
    contextTitle: initial.page_title,
    initialReferrer: initial.page_referrer,
  };
  runtimes.set(window, runtime);
  window.gtag!("js", new Date());
  window.gtag!("config", GA_TRACKING_ID, {
    send_page_view: false,
    ...initial,
    ...analyticsCampaign(window.location.href),
  });
  return runtime;
}

export function emitAnalyticsEvent(
  name: string,
  payload: AnalyticsPayload,
  origin?: AnalyticsPageContext,
): void {
  const runtime = initializeAnalytics();
  if (!runtime) return;
  synchronizeAnalyticsContext(runtime);
  // A deferred exit still belongs to its outgoing session. Event scope avoids
  // overwriting the incoming route's defaults when the exit is queued later.
  window.gtag!("event", name, origin ? { ...payload, ...origin } : payload);
}

function runtimeContext(runtime: AnalyticsRuntime): AnalyticsPageContext {
  return {
    page_title: runtime.contextTitle,
    page_path: runtime.contextPathname ?? window.location.pathname,
    page_location:
      runtime.contextLocation ??
      `${window.location.origin}${window.location.pathname}`,
    page_referrer: runtime.contextReferrer,
  };
}

function synchronizeAnalyticsContext(runtime: AnalyticsRuntime): void {
  const pathname = window.location.pathname;
  const changedPath = runtime.contextPathname !== pathname;
  const context = analyticsPageContext(
    window.location.href,
    document.title,
    changedPath
      ? (runtime.contextLocation ?? runtime.initialReferrer)
      : runtime.contextReferrer,
  );
  if (!context) return;
  if (!changedPath && runtime.contextTitle === context.page_title) return;
  runtime.contextPathname = pathname;
  runtime.contextLocation = context.page_location;
  runtime.contextReferrer = context.page_referrer;
  runtime.contextTitle = context.page_title;
  // This synchronous update is queued before the event so it inherits the
  // committed route even when the manual page_view task has not run yet.
  window.gtag!("config", GA_TRACKING_ID, {
    update: true,
    send_page_view: false,
    ...context,
  });
}

/** Sanitized document-memory snapshot for a session's deferred completion. */
export function captureAnalyticsPageContext():
  | AnalyticsPageContext
  | undefined {
  const runtime = initializeAnalytics();
  if (!runtime) return;
  synchronizeAnalyticsContext(runtime);
  return runtimeContext(runtime);
}

export function recordAnalyticsPageView(pathname: string): void {
  const runtime = initializeAnalytics();
  if (
    !runtime ||
    // Ignore a deferred effect for a screen that has already been left.
    window.location.pathname !== pathname ||
    runtime.pathname === pathname
  )
    return;

  synchronizeAnalyticsContext(runtime);
  runtime.pathname = pathname;
  window.gtag!("event", "page_view", { ...runtimeContext(runtime) });
}

export function scheduleAnalyticsPageView(pathname: string): () => void {
  // One bounded task lets the committed route's metadata effects finish. The
  // cleanup cancels StrictMode's throwaway effect and abandoned navigations.
  const task = setTimeout(() => recordAnalyticsPageView(pathname), 0);
  return () => clearTimeout(task);
}
