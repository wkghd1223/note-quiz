"use client";

import React from "react";
import { useLanguageStore } from "@/store/languageStore";
import { useTranslation } from "@/hooks/useTranslation";
import { usePathname, useRouter } from "next/navigation";
import { languageSwitchHref } from "@/lib/i18n/locale";

import PopoverSelect from "./PopoverSelect";
import { LANGUAGE_OPTIONS } from "@/lib/i18n/language-options";

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

  return (
    <div className={`language-selector ${className}`}>
      <PopoverSelect
        label={t.settingsLabels.language}
        closeLabel={t.ui.close}
        value={language}
        options={LANGUAGE_OPTIONS}
        onValueChange={(nextLanguage) => {
          if (nextLanguage === language) return;
          const href = languageSwitchHref(
            pathname,
            window.location.search,
            window.location.hash,
            nextLanguage,
          );
          if (href) router.push(href);
          else setLanguage(nextLanguage);
        }}
      />
    </div>
  );
};

export default LanguageSelector;
