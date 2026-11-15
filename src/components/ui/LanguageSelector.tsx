"use client";

import React from "react";
import { useLanguageStore } from "@/store/languageStore";
import { useTranslation } from "@/hooks/useTranslation";
import { usePathname, useRouter } from "next/navigation";
import { languageSwitchHref } from "@/lib/i18n/locale";

interface LanguageSelectorProps {
  className?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  className = "",
}) => {
  const { setLanguage } = useLanguageStore();
  const { t, language } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  const languages = [
    { code: "en" as Language, name: "English", flag: "🇬🇧" },
    { code: "ko" as Language, name: "한국어", flag: "🇰🇷" },
    { code: "ja" as Language, name: "日本語", flag: "🇯🇵" },
    { code: "es" as Language, name: "Español", flag: "🇪🇸" },
    { code: "de" as Language, name: "Deutsch", flag: "🇩🇪" },
    { code: "fr" as Language, name: "Français", flag: "🇫🇷" },
    { code: "zh" as Language, name: "简体中文", flag: "🇨🇳" },
    { code: "pt" as Language, name: "Português (Brasil)", flag: "🇧🇷" },
  ];

  return (
    <div className={`language-selector ${className}`}>
      <select
        aria-label={t.settingsLabels.language}
        value={language}
        onChange={(e) => {
          const nextLanguage = e.target.value as Language;
          const href = languageSwitchHref(
            pathname,
            window.location.search,
            window.location.hash,
            nextLanguage,
          );
          if (href) router.push(href);
          else setLanguage(nextLanguage);
        }}
        className="w-full max-w-[8.5rem] rounded-lg border border-[#ded6f7] bg-white px-3 py-2 font-semibold text-slate-700 shadow-[0_8px_18px_rgba(76,29,149,0.08)] focus:border-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-[#c4b5fd]"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag}
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;
