"use client";

import React from "react";

/** All state labels determine one footprint at the current width and language. */
export default function StablePracticeActions({
  active,
  states,
}: {
  active: string;
  states: Record<string, React.ReactNode>;
}) {
  return (
    <div className="grid min-w-0" data-practice-action-frame>
      {Object.entries(states).map(([state, controls]) => (
        <div
          key={state}
          data-action-state={state}
          aria-hidden={active !== state || undefined}
          inert={active !== state || undefined}
          className={`grid min-w-0 [grid-area:1/1] ${active === state ? "" : "invisible"}`}
        >
          {controls}
        </div>
      ))}
    </div>
  );
}
