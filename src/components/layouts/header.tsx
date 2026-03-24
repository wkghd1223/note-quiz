"use client";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/hooks/useTranslation";
import { usePathname } from "next/navigation";
import LanguageSelector from "../ui/LanguageSelector";

const Header = () => {
  const { t } = useTranslation();
  const pathname = usePathname();
  return (
    <>
      <header className="relative z-[70] flex items-center justify-between rounded-[1.75rem] border border-[#ded6f7] bg-white px-4 py-4 shadow-[0_14px_40px_rgba(76,29,149,0.08)] lg:px-6">
        <Link className="flex cursor-pointer items-center space-x-3" href="/">
          <Image
            src="/logo.svg"
            alt="Logo"
            className="h-12 w-12 rounded-2xl"
            width={48}
            height={48}
          />
          <div>
            <h1 className="text-xl font-black tracking-[-0.04em] text-slate-950 lg:text-3xl">
              {t.gameTitle}
            </h1>
            <p className="text-sm font-medium text-[#6d28d9] sm:text-base">
              {t.brandDescription}
            </p>
          </div>
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <nav className="flex items-center gap-1 rounded-2xl border border-[#ded6f7] bg-[#faf9fe] p-1 sm:gap-2">
            <Link
              href="/game"
              className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors sm:px-4 sm:text-sm ${
                pathname === "/game"
                  ? "bg-white text-slate-900 shadow-[0_8px_18px_rgba(76,29,149,0.08)]"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
            >
              {t.gameNavTitle}
            </Link>
            <Link
              href="/ear-training"
              className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors sm:px-4 sm:text-sm ${
                pathname === "/ear-training"
                  ? "bg-white text-slate-900 shadow-[0_8px_18px_rgba(76,29,149,0.08)]"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
            >
              {t.earTraining.title}
            </Link>
          </nav>
          <LanguageSelector className="w-[4.75rem]" />
        </div>
      </header>
    </>
  );
};

export default Header;
