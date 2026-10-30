"use client";

import React, { useEffect, useRef, useState } from "react";
import PracticeDialog from "./PracticeDialog";

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
  const [isMobile, setIsMobile] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const syncViewport = () => {
      setIsMobile(!media.matches);
      if (media.matches && isOpen) onCloseRef.current();
    };
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, [isOpen]);

  return (
    <PracticeDialog isOpen={isOpen && isMobile} title={title} onClose={onClose}>
      {children}
    </PracticeDialog>
  );
}
