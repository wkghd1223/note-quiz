"use client";
import { usePathname } from "next/navigation";
import Footer from "./footer";
/** Practice keeps the same footer inside its ad-safe scroll area. */
export default function GlobalFooter() {
  return usePathname() === "/practice" ? null : <Footer />;
}
