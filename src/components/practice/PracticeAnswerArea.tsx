"use client";

import React, { useLayoutEffect, useRef, useState } from "react";

/** Preserve the input footprint when a live microphone detaches at session end. */
export default function PracticeAnswerArea({
  children,
  finished,
}: {
  children: React.ReactNode;
  finished: boolean;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (finished) return;
    const element = area.current!;
    const measure = () => setHeight(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [finished]);
  return (
    <div
      ref={area}
      data-practice-input
      className="min-w-0 overflow-hidden"
      style={{ minHeight: finished ? height : undefined }}
    >
      {children}
    </div>
  );
}
