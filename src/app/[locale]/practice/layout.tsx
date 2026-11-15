import { Suspense, type ReactNode } from "react";
import PracticeLayoutShell from "@/app/(site)/practice/PracticeLayoutShell";
export default function PracticeLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f7fb]" />}>
      <PracticeLayoutShell>{children}</PracticeLayoutShell>
    </Suspense>
  );
}
