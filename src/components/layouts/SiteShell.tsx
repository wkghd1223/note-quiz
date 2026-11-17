"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Header from "./header";
import Footer from "./footer";
import AdLayoutObserver from "@/components/practice/AdLayoutObserver";
import { stripLocale } from "@/lib/i18n/locale";

/** Keep site chrome above route loading boundaries and inside one study scroll owner. */
export default function SiteShell({ children }: { children: ReactNode }) {
  const path = stripLocale(usePathname());
  const home = path === "/";
  const study =
    path === "/melody"
      ? "melody"
      : path === "/practice" || path.startsWith("/practice/")
        ? "practice"
        : null;
  const scrollOwner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // These previously had separate scroll owners. Keep their entry origins
    // independent while retaining the shared chrome and practice-mode scrolling.
    if (study)
      scrollOwner.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [study]);

  return (
    <div
      ref={scrollOwner}
      data-practice-scroll={study ? true : undefined}
      className={
        study ? "practice-ad-safe bg-[#f6f7fb] text-slate-950" : undefined
      }
    >
      {study && <AdLayoutObserver />}
      <div
        className={
          home
            ? "app-shell min-h-screen bg-[#f6f7fb] text-slate-950"
            : undefined
        }
      >
        {(home || study) && (
          <div className="border-b border-slate-200 bg-white">
            <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4">
              <Header variant="compact" />
            </div>
          </div>
        )}
        {children}
      </div>
      <Footer />
    </div>
  );
}
