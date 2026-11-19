/** SMuFL time signatures use dedicated numerals. Bravura's advance widths
 * below are in font units (1,000 per em); one staff space is 1/4 em. */
const digitAdvances = [470, 334, 446, 421, 470, 403, 434, 441, 436, 434];

export function meterGlyphs(
  meter: {
    beats: number;
    beatType: number;
    displayBeats?: string;
    symbol?: "common" | "cut";
  },
  staffSpace: number,
) {
  const scale = (4 * staffSpace) / 1000;
  if (meter.symbol && !meter.displayBeats) {
    const cut = meter.symbol === "cut";
    return {
      rows: [cut ? "\uE08B" : "\uE08A"],
      width: (cut ? 417 : 424) * scale,
    };
  }
  const labels = [
    meter.displayBeats ?? String(meter.beats),
    String(meter.beatType),
  ];
  const rows = labels.map((label) =>
    Array.from(label, (digit) =>
      digit === "+" ? "\uE08C" : String.fromCodePoint(0xe080 + Number(digit)),
    ).join(""),
  );
  const width =
    Math.max(
      ...labels.map((label) =>
        Array.from(label).reduce(
          (sum, digit) =>
            sum + (digit === "+" ? 500 : digitAdvances[Number(digit)]),
          0,
        ),
      ),
    ) * scale;
  return { rows, width };
}
