"use client";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/hooks/useTranslation";
import { usePathname } from "next/navigation";
import LanguageSelector from "../ui/LanguageSelector";

const Header = () => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const navItems = [
    { href: "/game", label: t.gameNavTitle },
    { href: "/ear-training", label: t.earTraining.title },
    { href: "/leaderboard", label: t.leaderboard.navTitle },
  ];

  return (
    <>
      <header className="relative z-[70] flex flex-col gap-4 rounded-2xl border border-[#ded6f7] bg-white/95 px-4 py-3 shadow-[0_10px_28px_rgba(76,29,149,0.07)] backdrop-blur-sm md:flex-row md:items-center md:justify-between lg:px-5">
        <Link className="flex min-w-0 cursor-pointer items-center gap-3" href="/">
          <Image
            src="/logo.svg"
            alt="Logo"
            className="h-10 w-10 shrink-0 rounded-xl"
            width={40}
            height={40}
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black text-slate-950 md:text-xl">
              {t.gameTitle}
            </h1>
            <p className="truncate text-xs font-medium text-[#6d28d9] sm:text-sm">
              {t.brandDescription}
            </p>
          </div>
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:justify-end">
          <nav className="flex w-full items-center gap-1 rounded-xl border border-[#ded6f7] bg-[#faf9fe] p-1 sm:w-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-bold transition-colors sm:flex-none ${
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
          <LanguageSelector className="w-[4.75rem]" />
        </div>
      </header>
    </>
  );
};

export default Header;
