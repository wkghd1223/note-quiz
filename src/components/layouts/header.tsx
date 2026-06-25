"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";
import LanguageSelector from "../ui/LanguageSelector";

export type HeaderVariant = "default" | "app" | "compact";

interface HeaderProps {
  variant?: HeaderVariant;
}

const headerClasses: Record<HeaderVariant, string> = {
  default:
    "rounded-2xl border border-[#ded6f7] bg-white/95 px-4 py-3 shadow-[0_10px_28px_rgba(76,29,149,0.07)] backdrop-blur-sm lg:px-5",
  app: "rounded-2xl border border-[#ded6f7] bg-white/95 px-3 py-2.5 shadow-[0_8px_22px_rgba(76,29,149,0.06)] backdrop-blur-sm sm:px-4 sm:py-3",
  compact:
    "rounded-xl border border-[#ded6f7] bg-white/95 px-2.5 py-2 shadow-[0_6px_18px_rgba(76,29,149,0.06)] backdrop-blur-sm sm:px-4 sm:py-3",
};

export default function Header({ variant = "default" }: HeaderProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const isCompact = variant === "compact";

  const navItems = [
    { href: "/game", label: t.gameNavTitle },
    { href: "/ear-training", label: t.earTraining.title },
    { href: "/leaderboard", label: t.leaderboard.navTitle },
  ];

  return (
    <header
      className={`relative z-[70] flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between ${headerClasses[variant]}`}
    >
      <Link
        className="flex min-w-0 cursor-pointer items-center gap-2.5"
        href="/"
      >
        <Image
          src="/logo.svg"
          alt="Logo"
          className={`${isCompact ? "h-8 w-8" : "h-9 w-9 sm:h-10 sm:w-10"} shrink-0 rounded-xl`}
          width={40}
          height={40}
        />
        <div className="min-w-0">
          <h1
            className={`truncate font-black text-slate-950 ${
              isCompact ? "text-base sm:text-lg" : "text-lg md:text-xl"
            }`}
          >
            {t.gameTitle}
          </h1>
          <p
            className={`truncate text-xs font-medium text-[#6d28d9] ${
              isCompact ? "hidden sm:block" : "sm:text-sm"
            }`}
          >
            {t.brandDescription}
          </p>
        </div>
      </Link>

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between md:justify-end">
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-[#ded6f7] bg-[#faf9fe] p-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-center text-xs font-bold transition-colors sm:text-sm ${
                  isActive
                    ? "bg-white text-slate-950 shadow-[0_6px_14px_rgba(76,29,149,0.08)]"
                    : "text-slate-600 hover:bg-white hover:text-slate-950"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <LanguageSelector className="w-[4.75rem] self-center sm:self-auto" />
      </div>
    </header>
  );
}
