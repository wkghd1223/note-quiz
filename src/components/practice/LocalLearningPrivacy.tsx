"use client";
import { useTranslation } from "@/hooks/useTranslation";
export default function LocalLearningPrivacy() {
  const { t } = useTranslation();
  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-950">
        {t.learning.history}
      </h2>
      <p className="mt-3">{t.learning.localOnly}</p>
    </section>
  );
}
