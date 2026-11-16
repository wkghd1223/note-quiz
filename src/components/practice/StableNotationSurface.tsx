"use client";

import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  basicStaffReserve,
  type BasicStaffRange,
} from "@/lib/notation/basic-staff";

export interface PracticeNotationViewport {
  width: number;
  height: number;
  onReady: () => void;
}
const viewportClassName =
  "absolute inset-0 [&>svg]:!h-full [&>svg]:!max-h-none [&>svg]:!w-full [&>[data-notation-fallback]>svg]:!h-full [&>[data-notation-fallback]>svg]:!w-full";
export const practiceNotationFrameClassName = "h-[156px] sm:h-[220px]";

/** One measured CSS-pixel viewport; placeholders cover every unfinished score revision. */
export default function StableNotationSurface({
  children,
  placeholder,
  className = practiceNotationFrameClassName,
  concealed = false,
  revision,
  staffRange,
}: {
  children:
    | React.ReactNode
    | ((viewport: PracticeNotationViewport) => React.ReactNode);
  placeholder?:
    | React.ReactNode
    | ((viewport: { width: number; height: number }) => React.ReactNode);
  className?: string;
  concealed?: boolean;
  revision?: unknown;
  staffRange?: BasicStaffRange;
}) {
  const surface = useRef<HTMLDivElement>(null),
    blank = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [renderedRevision, setRenderedRevision] = useState<unknown>(null);
  const onReady = useCallback(
    () => setRenderedRevision(() => revision),
    [revision],
  );
  const ready = revision === undefined || renderedRevision === revision;
  useLayoutEffect(() => {
    const element = surface.current!;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.round(rect.width * 2) / 2,
        height = Math.round(rect.height * 2) / 2;
      if (width > 0 && height > 0)
        setSize((previous) =>
          previous.width === width && previous.height === height
            ? previous
            : { width, height },
        );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const element = surface.current!;
    const update = () => {
      if (blank.current)
        blank.current.hidden =
          ready &&
          !!element.firstElementChild?.querySelector(
            '[data-rendered="true"], [data-notation-fallback]',
          );
    };
    const observer = new MutationObserver(update);
    observer.observe(element, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-rendered"],
    });
    update();
    return () => observer.disconnect();
  }, [ready]);
  const measured = size.width > 0 && size.height > 0;
  const reserve = basicStaffReserve(size.height, staffRange);
  return (
    <div
      ref={surface}
      data-answer-revealed={!concealed}
      aria-busy={!ready}
      data-practice-notation
      className={`relative min-w-0 overflow-x-clip overflow-y-visible rounded-lg bg-white ${className}`}
      style={{ marginTop: reserve.top, marginBottom: reserve.bottom }}
    >
      <div aria-hidden={concealed || undefined} className={viewportClassName}>
        {typeof children === "function"
          ? measured
            ? children({ ...size, onReady })
            : null
          : children}
      </div>
      <div
        ref={blank}
        aria-hidden="true"
        data-notation-placeholder
        className={`${viewportClassName} pointer-events-none bg-white`}
        style={{ top: -reserve.top, bottom: -reserve.bottom }}
      >
        {typeof placeholder === "function"
          ? placeholder(measured ? size : { width: 320, height: 112 })
          : (placeholder ?? <div data-notation-loading className="h-full" />)}
      </div>
    </div>
  );
}
