"use client";
import { usePathname } from "next/navigation";
import Footer from "./footer";
import { stripLocale } from "@/lib/i18n/locale";
/** Practice keeps the same footer inside its ad-safe scroll area. */
export default function GlobalFooter() {
  const path = stripLocale(usePathname());
  return path === "/practice" ||
    path.startsWith("/practice/") ||
    path === "/melody" ? null : (
    <Footer />
  );
}
