"use client";

import {
  cloneElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
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
  exiting?: boolean;
  children: ReactNode;
};

const exitMs = 130;

/** The closing surface is immediately inert. Keeping its last contents for the
 * short exit lets focus and the next editing gesture move on independently. */
export function ScoreToolPresence({
  children,
}: {
  children: ReactElement<Props> | false | null;
}) {
  const last = useRef<ReactElement<Props> | null>(null);
  const [present, setPresent] = useState(false);
  const open = !!children;
  useLayoutEffect(() => {
    if (children) last.current = children;
  }, [children]);
  useLayoutEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const clear = () => {
      last.current = null;
      setPresent(false);
    };
    if (
      !present ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      clear();
      return;
    }
    const timer = window.setTimeout(clear, exitMs);
    return () => window.clearTimeout(timer);
  }, [open, present]);
  return (
    children ||
    (present && last.current
      ? cloneElement(last.current, { exiting: true })
      : null)
  );
}

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
  exiting,
  children,
}: Props) {
  const titleId = useId();
  const swipe = useRef<number | null>(null);
  useLayoutEffect(() => {
    const surface = editor.current;
    const box = panel.current;
    const boundary = box?.parentElement;
    if (!surface || !box || !boundary || exiting) return;
    if (swipe.current === null) box.style.removeProperty("--drag-y");
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
      // Layout uses the final box even during its entrance or a swipe.
      const panelBounds = { width: box.offsetWidth, height: box.offsetHeight };
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
      box.dataset.placement = bounds.top + top < glyph.top ? "above" : "below";
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
  }, [
    editor,
    activeGesture,
    panel,
    anchorSelector,
    onClose,
    tool,
    revision,
    exiting,
  ]);

  function releaseSwipe(distance: number) {
    const box = panel.current;
    if (!box || swipe.current === null) return;
    swipe.current = null;
    delete box.dataset.swiping;
    if (distance > 48) onClose();
    else box.style.removeProperty("--drag-y");
  }

  return createPortal(
    <div className={styles.overlay}>
      <div
        ref={panel}
        className={styles.panel}
        role="dialog"
        aria-labelledby={titleId}
        inert={exiting}
        aria-hidden={exiting}
        data-edit-panel={exiting ? undefined : tool}
        data-exiting={exiting || undefined}
        style={exiting ? { animationDuration: exitMs + "ms" } : undefined}
      >
        <header
          className={styles.panelHeader}
          onPointerDown={(event) => {
            if (
              event.pointerType !== "touch" ||
              !event.isPrimary ||
              !window.matchMedia("(max-width: 767px)").matches ||
              (event.target as Element).closest("button")
            )
              return;
            swipe.current = event.clientY;
            const box = panel.current;
            if (box) {
              for (const animation of box.getAnimations()) animation.finish();
              box.dataset.swiping = "";
            }
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const box = panel.current;
            if (!box || swipe.current === null || !event.isPrimary) return;
            const distance = Math.max(0, event.clientY - swipe.current);
            box.style.setProperty(
              "--drag-y",
              Math.min(box.offsetHeight, distance) + "px",
            );
          }}
          onPointerUp={(event) => {
            if (swipe.current !== null)
              releaseSwipe(event.clientY - swipe.current);
          }}
          onPointerCancel={() => releaseSwipe(0)}
          onLostPointerCapture={() => releaseSwipe(0)}
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
