"use client";

import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { localizedHref } from "@/lib/i18n/locale";
import { challengeEnabled } from "../config";
import { melodyCopy } from "@/features/melody/i18n";

export default function ChallengeLink() {
  const { language, locale } = useTranslation();
  if (!challengeEnabled) return null;

  return (
    <Link
      href={localizedHref("/melody", locale)}
      className="inline-flex min-h-11 items-center text-sm font-bold text-[#5b21b6] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {melodyCopy(language).title}
    </Link>
  );
}
