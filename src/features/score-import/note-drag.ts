type BeatSlot = { barIndex: number; eventIndex: number };

interface NoteDragOptions {
  handle: SVGGElement;
  pointer: PointerEvent;
  scale: number;
  stepHeight: number;
  moveImmediately: boolean;
  canDrop: (slot: BeatSlot) => boolean;
  onTap: () => void;
  onGrab: () => void;
  onPan: () => void;
  onPitchPreview: (steps: number) => void;
  onPitch: (steps: number) => void;
  onDrop: (slot: BeatSlot) => void;
  onInvalidDrop: () => void;
  onRelease: () => void;
}

// A held note must keep its pointer when it crosses a barline. Only the
// original note owns capture; destination hit testing uses screen coordinates.
export function beginNoteDrag(options: NoteDragOptions) {
  const { handle, pointer } = options;
  const viewport = handle.closest<HTMLElement>("[data-edit-scroll]");
  if (!viewport) return null;
  const scroll = viewport;
  const origin = handle.closest("[data-edit-slot]");
  let mode: "pending" | "pitch" | "pan" | "move" = "pending";
  let x = pointer.clientX,
    y = pointer.clientY;
  const startScroll = scroll.scrollLeft;
  let steps = 0;
  let moved = false;
  let frame = 0;
  let hold: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  let target: SVGGElement | undefined;
  let slot: BeatSlot | undefined;

  function clearTarget() {
    target?.removeAttribute("data-drop-state");
    target = undefined;
    slot = undefined;
  }

  function aim() {
    const bounds = scroll.getBoundingClientRect();
    let next: SVGGElement | undefined;
    if (
      x >= bounds.left &&
      x <= bounds.right &&
      y >= bounds.top &&
      y <= bounds.bottom
    ) {
      const svg = document
        .elementFromPoint(x, y)
        ?.closest<SVGSVGElement>("svg[data-edit-bar]");
      const matrix = svg?.getScreenCTM();
      if (svg && scroll.contains(svg) && matrix) {
        const localX = new DOMPoint(x, y).matrixTransform(matrix.inverse()).x;
        let nearest = 44 / Math.abs(matrix.a);
        for (const mark of svg.querySelectorAll<SVGGElement>(
          "[data-edit-slot]",
        )) {
          const distance = Math.abs(Number(mark.dataset.slotX) - localX);
          if (distance < nearest) {
            nearest = distance;
            next = mark;
          }
        }
      }
    }
    if (next === target) return;
    clearTarget();
    if (!next || next === origin) return;
    const barIndex = Number(
      next.closest<SVGElement>("[data-edit-bar]")?.dataset.editBar,
    );
    const candidate = { barIndex, eventIndex: Number(next.dataset.editSlot) };
    const allowed = options.canDrop(candidate);
    target = next;
    target.dataset.dropState = allowed ? "ready" : "blocked";
    if (allowed) slot = candidate;
  }

  function edgeSpeed() {
    const bounds = scroll.getBoundingClientRect();
    if (
      x < bounds.left - 12 ||
      x > bounds.right + 12 ||
      y < bounds.top ||
      y > bounds.bottom
    )
      return 0;
    const edge = 35;
    if (x < bounds.left + edge)
      return -Math.min(15, (bounds.left + edge - x) / 3);
    if (x > bounds.right - edge)
      return Math.min(15, (x - bounds.right + edge) / 3);
    return 0;
  }

  function scrollEdge() {
    frame = 0;
    if (!active || mode !== "move") return;
    const speed = edgeSpeed();
    if (!speed) return;
    const before = scroll.scrollLeft;
    scroll.scrollLeft += speed;
    aim();
    if (scroll.scrollLeft !== before) frame = requestAnimationFrame(scrollEdge);
  }

  function grab() {
    mode = "move";
    handle.setAttribute("data-note-held", "");
    options.onGrab();
  }

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pointer.pointerId || !active) return;
    x = ev.clientX;
    y = ev.clientY;
    const dx = x - pointer.clientX,
      dy = y - pointer.clientY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 5 && !moved) return;
    moved = true;
    clearTimeout(hold);
    if (mode === "pending") {
      mode = Math.abs(dx) > Math.abs(dy) * 1.15 ? "pan" : "pitch";
      if (mode === "pan") options.onPan();
    }
    if (mode === "pan") {
      // Touch-action is decided before the long press. Forward quick swipes
      // that start on a head to the same scroll surface as the rest of the staff.
      scroll.scrollLeft = startScroll - dx;
    } else if (mode === "pitch") {
      steps = Math.max(
        -28,
        Math.min(28, Math.round(-dy / (options.scale * options.stepHeight))),
      );
      options.onPitchPreview(steps);
    } else {
      aim();
      if (!frame && edgeSpeed()) frame = requestAnimationFrame(scrollEdge);
    }
  };
  // SVG noteheads are not CSS boxes on every browser. Cancel one-finger
  // native panning here so Chrome/WebKit do not cancel capture mid-drag.
  function touchMove(ev: TouchEvent) {
    if (ev.touches.length === 1 && ev.cancelable) ev.preventDefault();
  }
  function additionalPointer(ev: PointerEvent) {
    if (ev.pointerType === "touch" && ev.pointerId !== pointer.pointerId)
      cancel();
  }
  function cancel() {
    if (!active) return;
    active = false;
    clearTimeout(hold);
    cancelAnimationFrame(frame);
    clearTarget();
    handle.removeAttribute("data-note-held");
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", up);
    handle.removeEventListener("pointercancel", lost);
    handle.removeEventListener("lostpointercapture", lost);
    handle.removeEventListener("touchmove", touchMove);
    window.removeEventListener("pointerdown", additionalPointer, true);
    window.removeEventListener("blur", cancel);
    window.removeEventListener("keydown", escape, true);
    if (handle.hasPointerCapture(pointer.pointerId))
      handle.releasePointerCapture(pointer.pointerId);
    options.onRelease();
  }
  function up(ev: PointerEvent) {
    if (ev.pointerId !== pointer.pointerId) return;
    move(ev);
    if (mode === "move") aim();
    const drop = slot;
    const blocked = !!target && !drop;
    cancel();
    if (!moved) options.onTap();
    else if (mode === "move" && drop) options.onDrop(drop);
    else if (mode === "move" && blocked) options.onInvalidDrop();
    else if (mode === "pitch" && steps) options.onPitch(steps);
  }
  function lost(ev: PointerEvent) {
    if (ev.pointerId === pointer.pointerId) cancel();
  }
  function escape(ev: KeyboardEvent) {
    if (ev.key !== "Escape") return;
    ev.preventDefault();
    cancel();
  }
  handle.setPointerCapture(pointer.pointerId);
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", up);
  handle.addEventListener("pointercancel", lost);
  handle.addEventListener("lostpointercapture", lost);
  handle.addEventListener("touchmove", touchMove, { passive: false });
  window.addEventListener("pointerdown", additionalPointer, true);
  window.addEventListener("blur", cancel);
  window.addEventListener("keydown", escape, true);
  if (options.moveImmediately) grab();
  else hold = setTimeout(grab, 420);
  return { cancel };
}
