/**
 * Native alphaTab 1.9 at display.scale=2: an empty treble score is 172px
 * high, with its five staff lines at y=44..116 (center 80, 6px above 86).
 * Keep that existing empty-staff geometry, independently of note overflow.
 */
export function basicStaffViewport(width: number, height: number) {
  const scale = Math.min(1, height / 172);
  const staffWidth = Math.min(width * 0.8, 560);
  return {
    width,
    height,
    scale,
    // display.padding=[12,16,12,16] has 12px on either horizontal edge.
    engravingWidth: Math.round(staffWidth / scale + 24),
    staffCenterY: height / 2 - 6 * scale,
  };
}

/** Native lineAlignedBounds excludes ledger notes, stems and clef overflow. */
export function basicStaffTransform(
  lines: { x: number; y: number; w: number; h: number },
  viewport: ReturnType<typeof basicStaffViewport>,
) {
  const { scale, width, staffCenterY } = viewport;
  return {
    scale,
    dx: (width - lines.w * scale) / 2 - lines.x * scale,
    dy: staffCenterY - (lines.y + lines.h / 2) * scale,
  };
}

export interface BasicStaffRange {
  ledgerLinesAbove: number;
  ledgerLinesBelow: number;
}

/** Possible ear-training letters are C at the minimum octave through B at max. */
export function trebleStaffRange(octaves: {
  min: number;
  max: number;
}): BasicStaffRange {
  return {
    ledgerLinesAbove: Math.max(0, Math.ceil((octaves.max * 7 + 6 - 38) / 2)),
    ledgerLinesBelow: Math.max(0, Math.ceil((30 - octaves.min * 7) / 2)),
  };
}

/** Reserve outside the fixed staff viewport using settings, never this answer. */
export function basicStaffReserve(height: number, range?: BasicStaffRange) {
  if (!range || height <= 0) return { top: 0, bottom: 0 };
  const { scale, staffCenterY } = basicStaffViewport(0, height);
  // Native lines are 18px apart. Existing explicit courtesy accidentals use
  // a centered 48px line box; 26px covers its half-height and the native
  // 1.17px note-head/staff-line offset, as well as native head/accidental ink.
  const above = (Math.max(0, range.ledgerLinesAbove) * 18 + 26) * scale;
  const below = (Math.max(0, range.ledgerLinesBelow) * 18 + 26) * scale;
  const staffTop = staffCenterY - 36 * scale;
  const staffBottom = staffCenterY + 36 * scale;
  return {
    top: Math.max(0, Math.ceil(above - staffTop)),
    bottom: Math.max(0, Math.ceil(staffBottom + below - height)),
  };
}
