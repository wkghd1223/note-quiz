"use client";

import React from "react";

export interface PracticeMetric {
  label: string;
  value: string;
  icon?: React.ReactNode;
}
export default function PracticeMetrics({
  items,
  detail,
}: {
  items: readonly PracticeMetric[];
  detail?: React.ReactNode;
}) {
  return (
    <div>
      <dl
        data-practice-metrics
        className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 px-2 py-2"
      >
        {items.map(({ label, value, icon }) => (
          <div
            key={label}
            className="flex min-w-0 items-center justify-center gap-1 sm:flex-col sm:items-start sm:gap-0"
          >
            <dt className="sr-only text-xs font-bold text-slate-500 sm:not-sr-only">
              {label}
            </dt>
            <dd className="inline-flex min-w-0 items-center gap-1 text-sm font-bold tabular-nums sm:mt-1 sm:text-lg">
              {icon && (
                <span aria-hidden="true" className="shrink-0 text-xs sm:hidden">
                  {icon}
                </span>
              )}
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {detail && (
        <div className="hidden text-xs leading-5 text-slate-500 sm:block">
          {detail}
        </div>
      )}
    </div>
  );
}
