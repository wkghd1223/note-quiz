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
      <header className="flex justify-between items-center md:mr-4 md:ml-4 md:mb-4">
        <Link
          className="flex items-center space-x-2 md:m-4 cursor-pointer"
          href="/"
        >
          <Image
            src="/logo.svg"
            alt="Logo"
            className="w-12 h-12"
            width={12}
            height={12}
          />
          <h1 className="md:text-3xl text-xl font-bold text-gray-900">
            {t.gameTitle}
          </h1>
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* 언어 선택기 */}
            <LanguageSelector />
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
