"use client";
import { useEffect } from "react";
import { adInsets, adViewport } from "@/lib/practice/adLayout";

const adSelector =
  ".adunitwrapper, .adhesion_wrapper, .adhesion_container, [data-slot-id], [data-slotid], .mv-ad-box";

export default function AdLayoutObserver() {
  useEffect(() => {
    let frame = 0;
    let stopped = false;
    let discover = true;
    let wrappers: HTMLElement[] = [];
    const update = () => {
      frame = 0;
      if (discover) {
        discover = false;
        const next = Array.from(
          document.querySelectorAll<HTMLElement>(adSelector),
        ).slice(0, 160);
        const previous = new Set(wrappers);
        const current = new Set(next);
        for (const wrapper of wrappers)
          if (!current.has(wrapper)) sizes.unobserve(wrapper);
        for (const wrapper of next)
          if (!previous.has(wrapper)) sizes.observe(wrapper);
        wrappers = next;
      }
      const viewport = adViewport(
        window.innerWidth,
        window.innerHeight,
        window.visualViewport,
      );
      const rectangles = wrappers.map((element) => {
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
        viewport.width,
        viewport.height,
        viewport,
      );
      const dialogInset = adInsets(
        rectangles.map((rect) => ({ ...rect, inSidebar: false })),
        viewport.width,
        viewport.height,
        viewport,
      ).right;
      for (const [name, value] of [
        ["--ad-side-inset", insets.right],
        ["--ad-dialog-side-inset", dialogInset],
        ["--ad-bottom-inset", insets.bottom],
        ["--practice-viewport-left", viewport.left],
        ["--practice-viewport-top", viewport.top],
        ["--practice-viewport-width", viewport.width],
        ["--practice-viewport-height", viewport.height],
      ] as const) {
        const next = `${value}px`;
        if (document.documentElement.style.getPropertyValue(name) !== next)
          document.documentElement.style.setProperty(name, next);
      }
    };
    const schedule = () => {
      if (!stopped && !frame) frame = requestAnimationFrame(update);
    };
    const sizes = new ResizeObserver(schedule);
    const related = (element: Element) =>
      element.matches(adSelector) ||
      element.closest(adSelector) !== null ||
      wrappers.some((wrapper) => element.contains(wrapper));
    const changesWrappers = (node: Node) =>
      node instanceof Element &&
      (node.matches(adSelector) ||
        node.querySelector(adSelector) !== null ||
        wrappers.some((wrapper) => node.contains(wrapper)));
    const observer = new MutationObserver((records) => {
      let changed = false;
      for (const record of records) {
        const target = record.target;
        if (record.type === "attributes" && target instanceof Element) {
          const tracked = wrappers.includes(target as HTMLElement);
          if (!tracked && !related(target)) continue;
          // A removed class/slot attribute can stop matching the selector.
          if (
            record.attributeName !== "style" &&
            (tracked || target.matches(adSelector))
          )
            discover = true;
          changed = true;
        } else if (record.type === "childList") {
          const membershipChanged = [
            ...record.addedNodes,
            ...record.removedNodes,
          ].some(changesWrappers);
          if (membershipChanged) discover = true;
          if (
            membershipChanged ||
            (target instanceof Element && related(target))
          )
            changed = true;
        }
      }
      if (changed) schedule();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-slot-id", "data-slotid"],
    });
    window.addEventListener("resize", schedule);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", schedule);
    visualViewport?.addEventListener("scroll", schedule);
    document.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });
    // Retain discovery/geometry fallback for provider changes outside observed DOM.
    const timer = setInterval(() => {
      discover = true;
      schedule();
    }, 1000);
    schedule();
    return () => {
      stopped = true;
      observer.disconnect();
      sizes.disconnect();
      window.removeEventListener("resize", schedule);
      visualViewport?.removeEventListener("resize", schedule);
      visualViewport?.removeEventListener("scroll", schedule);
      document.removeEventListener("scroll", schedule, true);
      clearInterval(timer);
      cancelAnimationFrame(frame);
      document.documentElement.style.removeProperty("--ad-side-inset");
      document.documentElement.style.removeProperty("--ad-dialog-side-inset");
      document.documentElement.style.removeProperty("--ad-bottom-inset");
      for (const axis of ["left", "top", "width", "height"])
        document.documentElement.style.removeProperty(
          `--practice-viewport-${axis}`,
        );
    };
  }, []);
  return null;
}
