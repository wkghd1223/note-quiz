/** Geometry and keyboard search have no locale, storage, or routing side effects. */
export function popoverPosition(
  anchor: { left: number; right: number; top: number; bottom: number },
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  rtl: boolean,
) {
  const clamp = (value: number, maximum: number) => Math.max(8, Math.min(value, maximum));
  const below = anchor.bottom + 6;
  return {
    left: clamp(rtl ? anchor.left : anchor.right - panel.width, viewport.width - panel.width - 8),
    top: clamp(below + panel.height <= viewport.height - 8 ? below : anchor.top - panel.height - 6, viewport.height - panel.height - 8),
  };
}

export function nextOptionIndex(index: number, count: number, key: string) {
  if (!count) return -1;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowDown") return (index + 1 + count) % count;
  if (key === "ArrowUp") return index < 0 ? count - 1 : (index - 1 + count) % count;
  return index;
}

export function typeaheadMatch(labels: readonly string[], query: string, from: number) {
  for (let offset = 1; offset <= labels.length; offset++) {
    const index = (from + offset + labels.length) % labels.length;
    if (labels[index].toLowerCase().startsWith(query.toLowerCase())) return index;
  }
  return -1;
}
