"use client";

import React, { useState } from "react";
import { FaCheck, FaTimes } from "react-icons/fa";
import styles from "./PracticeAnswerToast.module.css";

export interface PracticeAnswerToastProps {
  message?: string;
  correct?: boolean;
  announcementKey: string | number;
}

/** Presentation only. The caller owns the judgment and its visible lifetime. */
export default function PracticeAnswerToast({
  message,
  correct,
  announcementKey,
}: PracticeAnswerToastProps) {
  const [content, setContent] = useState({ message, correct, announcementKey });
  // Retain the last text only for the CSS exit transition. No answer timer,
  // focus change or scoring event is introduced by this presentation component.
  if (
    message &&
    (content.message !== message ||
      content.correct !== correct ||
      content.announcementKey !== announcementKey)
  ) {
    setContent({ message, correct, announcementKey });
  }
  const visible = !!message;
  const Icon = content.correct ? FaCheck : FaTimes;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-practice-feedback
      data-feedback-visible={visible}
      className={styles.anchor}
    >
      <div
        key={content.announcementKey}
        aria-hidden={!visible}
        data-answer-toast
        data-visible={visible}
        data-correct={!!content.correct}
        className={styles.toast}
      >
        <Icon aria-hidden="true" className={styles.icon} />
        <span className={styles.message}>{content.message}</span>
      </div>
    </div>
  );
}
