import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { challengeEnabled } from "@/features/challenge/config";
import MelodyLayout from "@/features/melody/components/MelodyLayout";

export default function Layout({ children }: { children: ReactNode }) {
  if (!challengeEnabled) notFound();
  return <MelodyLayout>{children}</MelodyLayout>;
}
