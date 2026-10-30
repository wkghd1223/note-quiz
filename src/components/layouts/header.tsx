"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import LanguageSelector from "../ui/LanguageSelector";

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
  const { t } = useTranslation();

  return (
    <header className={headerClasses[variant]}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
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
    </header>
  );
}
