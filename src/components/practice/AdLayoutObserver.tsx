"use client";
import { useEffect } from "react";
import { adInsets } from "@/lib/practice/adLayout";
export default function AdLayoutObserver() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const rectangles = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".adunitwrapper, .adhesion_wrapper, .adhesion_container, [data-slot-id], [data-slotid], .mv-ad-box",
        ),
      )
        .slice(0, 160)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          let ancestor: HTMLElement | null = element,
            anchored = false;
          for (
            let i = 0;
            ancestor && i < 20;
            i++, ancestor = ancestor.parentElement
          ) {
            const position = getComputedStyle(ancestor).position;
            if (
              position === "fixed" ||
              position === "sticky" ||
              position === "absolute"
            ) {
              anchored = true;
              break;
            }
          }
          return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            anchored,
            inSidebar: !!element.closest("[data-practice-settings]"),
          };
        });
      const insets = adInsets(
        rectangles,
        window.innerWidth,
        window.innerHeight,
      );
      const dialogInset = adInsets(
        rectangles.map((rect) => ({ ...rect, inSidebar: false })),
        window.innerWidth,
        window.innerHeight,
      ).right;
      for (const [name, value] of [
        ["--ad-side-inset", insets.right],
        ["--ad-dialog-side-inset", dialogInset],
        ["--ad-bottom-inset", insets.bottom],
      ] as const) {
        const next = `${value}px`;
        if (document.documentElement.style.getPropertyValue(name) !== next)
          document.documentElement.style.setProperty(name, next);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });
    // Wrappers can resize when a creative loads without a DOM mutation.
    const timer = setInterval(schedule, 1000);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
      clearInterval(timer);
      cancelAnimationFrame(frame);
      document.documentElement.style.removeProperty("--ad-side-inset");
      document.documentElement.style.removeProperty("--ad-dialog-side-inset");
      document.documentElement.style.removeProperty("--ad-bottom-inset");
    };
  }, []);
  return null;
}
