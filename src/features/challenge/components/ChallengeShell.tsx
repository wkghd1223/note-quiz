"use client";
import Link from "next/link";
import LanguageSelector from "@/components/ui/LanguageSelector";
import AdLayoutObserver from "@/components/practice/AdLayoutObserver";
import { useTranslation } from "@/hooks/useTranslation";
import { localizedHref } from "@/lib/i18n/locale";
import { challengeCopy } from "../i18n";
import type { ReactNode } from "react";
export const primaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-800 px-4 py-3 text-center font-semibold text-white hover:bg-violet-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500";
export const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-semibold text-slate-800 hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-50";
export default function ChallengeShell({ children }: { children: ReactNode }) {
  const { language, locale } = useTranslation(),
    c = challengeCopy(language);
  return (
    <div
      className="practice-ad-safe bg-[#f6f5fa] text-slate-950"
      data-challenge-scroll
    >
      <AdLayoutObserver />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Link
            href={localizedHref("/challenge", locale)}
            className="inline-flex min-h-12 items-center text-lg font-bold text-violet-900"
          >
            ♪ {c.title}
          </Link>
          <LanguageSelector />
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-5xl px-3 py-5 sm:px-6 sm:py-7">
        {children}
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-6 text-sm text-slate-600">
        <Link
          className="inline-flex min-h-12 items-center underline underline-offset-4"
          href={localizedHref("/practice", locale)}
        >
          ‹ {c.practice}
        </Link>
        <p>{c.local}</p>
      </footer>
    </div>
  );
}
