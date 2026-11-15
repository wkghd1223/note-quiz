export interface AdRectangle {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  anchored: boolean;
  inSidebar?: boolean;
}
export interface AdViewport {
  left: number;
  top: number;
  width: number;
  height: number;
}
/** Visual viewport shrinks/pans with mobile browser chrome, zoom and keyboard. */
export function adViewport(
  width: number,
  height: number,
  visual?: Pick<
    VisualViewport,
    "offsetLeft" | "offsetTop" | "width" | "height"
  > | null,
): AdViewport {
  if (
    visual &&
    [visual.width, visual.height, visual.offsetLeft, visual.offsetTop].every(
      Number.isFinite,
    ) &&
    visual.width > 0 &&
    visual.height > 0
  )
    return {
      left: Math.max(0, visual.offsetLeft),
      top: Math.max(0, visual.offsetTop),
      width: Math.min(width, visual.width),
      height: Math.min(height, visual.height),
    };
  return { left: 0, top: 0, width, height };
}
/** Measures public wrapper geometry only; never reads or changes iframe content. */
export function adInsets(
  rectangles: AdRectangle[],
  width: number,
  height: number,
  origin: Pick<AdViewport, "left" | "top"> = { left: 0, top: 0 },
) {
  let right = 0,
    bottom = 0;
  if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0)
    return { right, bottom };
  for (const rectangle of rectangles) {
    const r = {
      ...rectangle,
      left: rectangle.left - origin.left,
      right: rectangle.right - origin.left,
      top: rectangle.top - origin.top,
      bottom: rectangle.bottom - origin.top,
    };
    if (
      ![r.left, r.right, r.top, r.bottom, r.width, r.height].every(
        Number.isFinite,
      ) ||
      !r.anchored ||
      r.inSidebar ||
      r.width < 40 ||
      r.height < 40 ||
      r.bottom <= 0 ||
      r.top >= height ||
      r.right <= 0 ||
      r.left >= width
    )
      continue;
    if (width >= 1024 && r.left >= width * 0.55 && r.height >= 120)
      right = Math.max(right, Math.min(width * 0.45, width - r.left + 16));
    if (
      r.top >= height * 0.5 &&
      r.bottom >= height - 8 &&
      r.width >= width * 0.55
    )
      bottom = Math.max(
        bottom,
        Math.min(Math.max(0, height - 160), height - r.top + 16),
      );
  }
  return { right: Math.ceil(right), bottom: Math.ceil(bottom) };
}
