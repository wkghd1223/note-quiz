"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { popoverPosition } from "@/components/ui/popover-select-interaction";
import styles from "./ScoreEditor.module.css";

type Props = {
  editor: RefObject<HTMLElement | null>;
  activeGesture: RefObject<unknown>;
  panel: RefObject<HTMLDivElement | null>;
  anchorSelector: string;
  revision: object;
  tool: string;
  title: string;
  measure: string;
  closeLabel: string;
  onClose: (restoreFocus?: boolean) => void;
  children: ReactNode;
};

/** Keep the score interactive while the tool follows its glyph or docks below it. */
export default function ScoreToolPopover({
  editor,
  activeGesture,
  panel,
  anchorSelector,
  revision,
  tool,
  title,
  measure,
  closeLabel,
  onClose,
  children,
}: Props) {
  const titleId = useId();
  const swipe = useRef<number | null>(null);
  useLayoutEffect(() => {
    const surface = editor.current;
    const box = panel.current;
    const boundary = box?.parentElement;
    if (!surface || !box || !boundary) return;
    const mobile = window.matchMedia("(max-width: 767px)");
    const anchor = surface.querySelector(anchorSelector);
    const position = () => {
      if (mobile.matches) {
        box.style.removeProperty("left");
        box.style.removeProperty("top");
        box.style.visibility = "visible";
        return;
      }
      if (!anchor) return;
      const glyph = anchor.getBoundingClientRect();
      const bounds = boundary.getBoundingClientRect();
      const clip =
        anchor.closest("[data-edit-scroll]")?.getBoundingClientRect() ?? bounds;
      if (
        glyph.bottom < bounds.top ||
        glyph.top > bounds.bottom ||
        glyph.right < clip.left ||
        glyph.left > clip.right
      ) {
        box.style.visibility = "hidden";
        return;
      }
      const panelBounds = box.getBoundingClientRect();
      const score = surface.getBoundingClientRect();
      // Prefer the score column, with the selected glyph near the panel edge.
      const span = Math.max(
        panelBounds.width,
        Math.min(score.right, bounds.right) - Math.max(score.left, bounds.left),
      );
      const origin = Math.max(
        bounds.left,
        Math.min(score.left, bounds.right - span),
      );
      const { left, top } = popoverPosition(
        {
          left: glyph.left - origin,
          right: glyph.right - origin + 12,
          top: glyph.top - bounds.top,
          bottom: glyph.bottom - bounds.top,
        },
        panelBounds,
        { width: span, height: bounds.height },
        false,
      );
      box.style.left = origin - bounds.left + left + "px";
      box.style.top = top + "px";
      box.style.visibility = "visible";
    };
    const scrollOwner = surface.closest<HTMLElement>("[data-practice-scroll]");
    let afterRelease = false;
    let frame = 0;
    const revealCoveredAnchor = () => {
      if (!mobile.matches || !scrollOwner || !anchor) return;
      const glyph = anchor.getBoundingClientRect();
      const area = boundary.getBoundingClientRect();
      const overlap = glyph.bottom - (area.bottom - box.offsetHeight - 12);
      if (overlap <= 0 || glyph.top > area.bottom || glyph.bottom < area.top)
        return;
      if (activeGesture.current) {
        // Moving the staff under a held finger would change the chosen pitch.
        afterRelease = true;
      } else {
        scrollOwner.scrollBy({ top: Math.ceil(overlap), behavior: "instant" });
      }
    };
    const finishGesture = () => {
      if (!afterRelease) return;
      afterRelease = false;
      frame = requestAnimationFrame(revealCoveredAnchor);
    };
    const update = () => {
      position();
      revealCoveredAnchor();
    };
    update();
    const resize = new ResizeObserver(update);
    resize.observe(surface);
    resize.observe(box);
    resize.observe(boundary);
    if (anchor) resize.observe(anchor);
    mobile.addEventListener("change", position);
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !box.contains(target) &&
        !surface.contains(target)
      )
        onClose(false);
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("pointerup", finishGesture, true);
    document.addEventListener("pointercancel", finishGesture, true);
    return () => {
      resize.disconnect();
      mobile.removeEventListener("change", position);
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("pointerup", finishGesture, true);
      document.removeEventListener("pointercancel", finishGesture, true);
      cancelAnimationFrame(frame);
    };
  }, [editor, activeGesture, panel, anchorSelector, onClose, tool, revision]);

  return createPortal(
    <div className={styles.overlay}>
      <div
        ref={panel}
        className={styles.panel}
        role="dialog"
        aria-labelledby={titleId}
        data-edit-panel={tool}
      >
        <header
          className={styles.panelHeader}
          onPointerDown={(event) => {
            if (
              event.pointerType !== "touch" ||
              !event.isPrimary ||
              (event.target as Element).closest("button")
            )
              return;
            swipe.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            if (swipe.current !== null && event.clientY - swipe.current > 48)
              onClose();
            swipe.current = null;
          }}
          onPointerCancel={() => {
            swipe.current = null;
          }}
        >
          <strong id={titleId}>{title}</strong>
          <span>{measure}</span>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => onClose()}
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
