"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { preload } from "react-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { localizedHref, stripLocale } from "@/lib/i18n/locale";
import { melodySourceCopy, melodySources } from "../sources";
import {
  getScoreDraft,
  getGeneratedScoreDraft,
  hasScoreEdits,
} from "../score-draft";

export default function MelodyLayout({ children }: { children: ReactNode }) {
  preload("/alphatab/font/Bravura.woff2", {
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  });
  const { t, locale, language } = useTranslation();
  const pathname = stripLocale(usePathname());
  useEffect(() => {
    const draft = getScoreDraft();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasScoreEdits(draft) && !hasScoreEdits(getGeneratedScoreDraft()))
        return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  return (
    <main className="mx-auto grid w-full min-w-0 max-w-6xl gap-4 px-3 py-4 sm:px-4">
      <nav
        data-melody-sources
        aria-label={t.navigation.melody}
        className="grid w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:w-fit sm:min-w-80"
      >
        {melodySources.map((source) => {
          const path = "/melody/" + source;
          return (
            <Link
              key={source}
              href={localizedHref(path, locale)}
              aria-current={pathname === path ? "page" : undefined}
              className="choice-segment flex min-h-11 items-center justify-center rounded-lg px-5 text-center text-sm font-semibold text-slate-600 hover:bg-white/70 focus-visible:outline-violet-700 aria-[current=page]:bg-violet-100 aria-[current=page]:text-violet-900 aria-[current=page]:shadow-sm"
            >
              {melodySourceCopy[language][source]}
            </Link>
          );
        })}
      </nav>
      {children}
    </main>
  );
}
