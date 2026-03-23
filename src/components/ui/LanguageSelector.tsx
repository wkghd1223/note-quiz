"use client";

import React from "react";
import { useLanguageStore } from "@/store/languageStore";
// import { useTranslation } from "@/hooks/useTranslation";

interface LanguageSelectorProps {
  className?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  className = "",
}) => {
  const { language, setLanguage } = useLanguageStore();
  //   const { t } = useTranslation();

  const languages = [
    { code: "en" as Language, name: "English", flag: "🇺🇸" },
    { code: "ko" as Language, name: "한국어", flag: "🇰🇷" },
    { code: "ja" as Language, name: "日本語", flag: "🇯🇵" },
    { code: "es" as Language, name: "Español", flag: "🇪🇸" },
    { code: "de" as Language, name: "Deutsch", flag: "🇩🇪" },
    { code: "fr" as Language, name: "Français", flag: "🇫🇷" },
  ];

  return (
    <div className={`language-selector ${className}`}>
      {/* <label className="block text-sm font-medium text-gray-700 mb-2">
        {t.settingsLabels.language}
      </label> */}
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="w-full rounded-2xl border border-[#ded6f7] bg-white px-3 py-2 font-semibold text-slate-700 shadow-[0_8px_18px_rgba(76,29,149,0.08)] focus:border-[#7c3aed] focus:outline-none focus:ring-2 focus:ring-[#c4b5fd]"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag}
            {/* {lang.name} */}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;
