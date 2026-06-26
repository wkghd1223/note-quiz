"use client";

import React from "react";
import { FaSlidersH } from "react-icons/fa";
import BottomSheet from "./BottomSheet";

interface SettingsSurfaceProps {
  title: string;
  summary: string;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  children: React.ReactNode;
}

export default function SettingsSurface({
  title,
  summary,
  isMobileOpen,
  onMobileClose,
  children,
}: SettingsSurfaceProps) {
  return (
    <>
      <aside className="hidden lg:block">
        <div className="sticky top-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
              <FaSlidersH />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-950">{title}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">{summary}</p>
            </div>
          </div>
          {children}
        </div>
      </aside>

      <BottomSheet isOpen={isMobileOpen} title={title} onClose={onMobileClose}>
        <p className="mb-4 text-sm leading-6 text-slate-500">{summary}</p>
        {children}
      </BottomSheet>
    </>
  );
}
