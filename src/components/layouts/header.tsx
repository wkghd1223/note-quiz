"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import LanguageSelector from "../ui/LanguageSelector";
import { usePathname } from "next/navigation";
import { challengeEnabled } from "@/features/challenge/config";
import { localizedHref, stripLocale } from "@/lib/i18n/locale";

export type HeaderVariant = "default" | "app" | "compact";

interface HeaderProps {
  variant?: HeaderVariant;
}

const headerClasses: Record<HeaderVariant, string> = {
  default:
    "rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)]",
  app: "rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)]",
  compact: "bg-white",
};

export default function Header({ variant = "default" }: HeaderProps) {
  const { t, locale } = useTranslation();
  const path = stripLocale(usePathname());
  const items = [
    ["/", t.navigation.home],
    ["/practice/note", t.navigation.practice],
    ...(challengeEnabled ? [["/melody", t.navigation.melody]] : []),
  ];

  const active = (href: string) =>
    path === href ||
    (href === "/practice/note" &&
      (path === "/practice" || path.startsWith("/practice/")));

  return (
    <header className={headerClasses[variant]}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <Link
          href={localizedHref("/", locale)}
          className="flex min-w-0 items-center gap-3"
        >
          <Image
            src="/logo.svg"
            alt="Note Quiz"
            className="h-12 w-12 shrink-0 object-contain"
            width={64}
            height={64}
            priority
          />
          <div className="min-w-0">
            <p className="truncate text-xl font-black leading-tight text-slate-950 sm:text-2xl">
              {t.gameTitle}
            </p>
            <p className="hidden text-sm font-bold text-[#5b21b6] sm:block sm:text-base">
              {t.brandDescription}
            </p>
          </div>
        </Link>

        <LanguageSelector className="shrink-0" />
      </div>
      <nav
        aria-label={t.navigation.label}
        className="mt-3 flex min-w-0 flex-wrap gap-1 border-t border-slate-100 pt-2"
      >
        {items.map(([href, label]) => (
          <Link
            key={href}
            href={localizedHref(href, locale)}
            aria-current={active(href) ? "page" : undefined}
            className={`inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-lg px-2 py-2 text-center text-sm font-semibold leading-snug focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 sm:flex-none sm:px-4 ${active(href) ? "bg-violet-100 text-violet-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
