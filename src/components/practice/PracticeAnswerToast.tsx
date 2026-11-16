"use client";

import React from "react";
import { FaCheck, FaTimes } from "react-icons/fa";
import styles from "./PracticeAnswerToast.module.css";

export interface PracticeAnswerToastProps {
  message?: string;
  correct?: boolean;
  details?: React.ReactNode;
  announcementKey: string | number;
}

/** Presentation only. Each mode owns the answer details and their visible lifetime. */
export default function PracticeAnswerToast({
  message,
  correct,
  details,
  announcementKey,
}: PracticeAnswerToastProps) {
  const visible = !!message;
  const Icon = correct ? FaCheck : FaTimes;
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
        key={announcementKey}
        aria-hidden={!visible}
        data-answer-toast
        data-visible={visible}
        data-correct={!!correct}
        className={styles.toast}
      >
        {visible && (
          <>
            <div className={styles.heading}>
              <Icon aria-hidden="true" className={styles.icon} />
              <span className={styles.message}>{message}</span>
            </div>
            {details && (
              <div data-answer-toast-details className={styles.details}>
                {details}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
