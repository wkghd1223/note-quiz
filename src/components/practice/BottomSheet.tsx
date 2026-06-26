"use client";

import React, { useEffect } from "react";
import { FaTimes } from "react-icons/fa";

interface BottomSheetProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function BottomSheet({
  isOpen,
  title,
  onClose,
  children,
}: BottomSheetProps) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] lg:hidden">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-950/35"
        onClick={onClose}
      />
      <section className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-[0_-18px_48px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-black text-slate-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700"
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </div>
        <div className="max-h-[calc(82dvh-65px)] overflow-y-auto p-4">
          {children}
        </div>
      </section>
    </div>
  );
}
