"use client";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/hooks/useTranslation";
import { useState } from "react";
import GameSettings from "../game/GameSettings";
import LanguageSelector from "../ui/LanguageSelector";

const Header = () => {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
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
            <p className="text-sm font-medium text-[#6d28d9]">
              Master the Musical Staff
            </p>
          </div>
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* 언어 선택기 */}
            <LanguageSelector className="w-[4.75rem]" />
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-2xl border border-[#ded6f7] bg-[#faf9fe] px-4 py-2 text-sm font-bold text-slate-700 shadow-[0_8px_18px_rgba(76,29,149,0.08)] hover:-translate-y-0.5 hover:border-[#c4b5fd]"
            >
              {t.settings}
            </button>
          </div>
        </div>
      </header>
      {/* 설정 모달 */}
      <GameSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
};

export default Header;
