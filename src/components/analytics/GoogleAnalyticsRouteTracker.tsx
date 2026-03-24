"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const GA_TRACKING_ID = "G-RHJP137HQZ";

export default function GoogleAnalyticsRouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || !window.gtag) {
      return;
    }

    const query = window.location.search;
    const pagePath = query ? `${pathname}?${query}` : pathname;

    window.gtag("config", GA_TRACKING_ID, {
      page_path: pagePath,
    });
  }, [pathname]);

  return null;
}
