import type { LearningTranslations } from "@/lib/i18n/learning";

export function theoryLabel(copy: LearningTranslations, value: string): string {
  if (value.startsWith("inversion_"))
    return (
      copy[value.slice(10) as keyof LearningTranslations] ?? copy.inversion
    );
  if (value.startsWith("progression_"))
    return value.slice(12).replaceAll("-", " → ");
  const key = (
    value in copy
      ? value
      : `interval_${value}` in copy
        ? `interval_${value}`
        : `quality_${value}`
  ) as keyof LearningTranslations;
  return copy[key] ?? value.replaceAll("-", " → ");
}
