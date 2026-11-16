"use client";
import { useTranslation } from "@/hooks/useTranslation";
import type { TrainingMode } from "@/lib/practice/types";
import SegmentedControl from "@/components/ui/SegmentedControl";
import styles from "./ModeSwitcher.module.css";
export type PracticeMode = TrainingMode;
export default function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: PracticeMode;
  onChange: (mode: PracticeMode) => void;
}) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      data-practice-mode
      className={styles.switcher}
      label={t.learning.chooseMode}
      value={mode}
      onChange={onChange}
      options={(["note", "ear", "interval", "chord"] as const).map((value) => ({
        value,
        label: t.learning[value],
      }))}
    />
  );
}
