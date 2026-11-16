"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { GA_TRACKING_ID, initializeAnalytics } from "@/lib/analytics-runtime";

export default function GoogleAnalytics() {
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    setInitialized(Boolean(initializeAnalytics()));
  }, []);

  if (!initialized) return null;

  return (
    <Script
      id="google-analytics"
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
      strategy="afterInteractive"
    />
  );
}
