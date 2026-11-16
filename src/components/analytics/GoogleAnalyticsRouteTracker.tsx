"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { scheduleAnalyticsPageView } from "@/lib/analytics-runtime";

export default function GoogleAnalyticsRouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) return scheduleAnalyticsPageView(pathname);
  }, [pathname]);

  return null;
}
