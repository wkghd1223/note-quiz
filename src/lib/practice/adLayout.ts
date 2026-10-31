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
/** Measures public wrapper geometry only; never reads or changes iframe content. */
export function adInsets(
  rectangles: AdRectangle[],
  width: number,
  height: number,
) {
  let right = 0,
    bottom = 0;
  for (const r of rectangles) {
    if (
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
      bottom = Math.max(bottom, Math.min(height - 160, height - r.top + 16));
  }
  return { right: Math.ceil(right), bottom: Math.ceil(bottom) };
}
