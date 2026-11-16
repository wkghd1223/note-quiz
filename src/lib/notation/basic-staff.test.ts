import { describe, expect, it, vi } from "vitest";
import {
  NotationElement,
  Settings,
  StaveProfile,
  SystemsLayoutMode,
  rendering,
  model,
} from "@coderline/alphatab";
import { toAlphaTabScore } from "./alphatab-score";
import {
  basicStaffReserve,
  basicStaffTransform,
  basicStaffViewport,
  trebleStaffRange,
} from "./basic-staff";
import { writtenNote, type NotationScore } from "./score";

const letters = ["C", "D", "E", "F", "G", "A", "B"] as const;
const bottomLine: Record<ClefType, number> = {
  treble: 4 * 7 + 2, // E4
  bass: 2 * 7 + 4, // G2
  alto: 3 * 7 + 3, // F3
  tenor: 3 * 7 + 1, // D3
};
function noteAt(clef: ClefType, staffPosition: number): Note {
  const position = bottomLine[clef] + staffPosition;
  return {
    name: letters[position % 7],
    octave: Math.floor(position / 7) as Octave,
    accidental: null,
  };
}
function engrave(input: NotationScore, width: number) {
  const built = toAlphaTabScore(input);
  const settings = new Settings();
  settings.core.engine = "svg";
  settings.core.includeNoteBounds = true;
  settings.core.enableLazyLoading = false;
  settings.display.scale = 2;
  settings.display.padding = [12, 16, 12, 16];
  settings.display.staveProfile = StaveProfile.Score;
  settings.display.barsPerRow = 1;
  settings.display.lastSystemFillThreshold = 0;
  settings.display.systemsLayoutMode = SystemsLayoutMode.UseModelLayout;
  settings.display.resources.staffLineColor = model.Color.fromJson("#64748b")!;
  settings.notation.elements = new Map(
    [
      NotationElement.TrackNames,
      NotationElement.BarNumber,
      NotationElement.EffectTempo,
    ].map((element) => [element, false]),
  );
  const renderer = new rendering.ScoreRenderer(settings);
  renderer.width = width;
  let totalHeight = 0;
  const parts: string[] = [];
  renderer.renderFinished.on((event) => {
    totalHeight = event.totalHeight;
  });
  renderer.partialRenderFinished.on((event) =>
    parts.push(String(event.renderResult)),
  );
  renderer.error.on((error) => {
    throw error;
  });
  renderer.renderScore(built.score, [0]);
  const lines =
    renderer.boundsLookup!.findMasterBarByIndex(0)!.lineAlignedBounds;
  const svg = parts.join("");
  const staffRects = [
    ...svg.matchAll(
      /<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" fill="#64748B"/g,
    ),
  ]
    .map((match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
      w: Number(match[3]),
      h: Number(match[4]),
    }))
    .filter((rect) => rect.w > lines.w * 0.9);
  const heads = built.events.flatMap(
    ({ beat }) =>
      renderer
        .boundsLookup!.findBeat(beat)
        ?.notes?.map((note) => note.noteHeadBounds) ?? [],
  );
  return { lines, staffRects, heads, totalHeight, svg };
}

describe("basic native staff geometry", () => {
  it("documents the native empty-treble reference instead of measuring note overflow", () => {
    const native = engrave(
      { clef: "treble", keySignature: 0, events: [] },
      288,
    );
    expect(native.totalHeight).toBe(172);
    expect(native.lines).toMatchObject({ x: 12, y: 44, w: 264, h: 72 });
    expect(native.lines.y + native.lines.h / 2 - native.totalHeight / 2).toBe(
      -6,
    );
  });

  it.each(["treble", "bass", "alto", "tenor"] as const)(
    "keeps all five %s staff lines fixed through empty, low/high ledger and chord engravings",
    (clef) => {
      for (const [width, height] of [
        [229, 156],
        [299, 156],
        [708, 220],
      ]) {
        const viewport = basicStaffViewport(width, height);
        const variants = [[], [-10], [18], [-10, 4, 18]];
        let expectedLines: number[] | undefined;
        const nativeHeights = new Set<number>();
        for (const positions of variants) {
          const input: NotationScore = {
            clef,
            keySignature: 0,
            events: positions.length
              ? [
                  {
                    id: "native",
                    duration: 4,
                    notes: positions.map((position) =>
                      writtenNote(noteAt(clef, position)),
                    ),
                  },
                ]
              : [],
          };
          const native = engrave(input, viewport.engravingWidth);
          const transform = basicStaffTransform(native.lines, viewport);
          const reserve = basicStaffReserve(height, {
            ledgerLinesAbove: 5,
            ledgerLinesBelow: 5,
          });
          nativeHeights.add(native.totalHeight);
          expect(native.staffRects).toHaveLength(5);
          const physicalLines = native.staffRects.map(
            (line) => line.y * transform.scale + transform.dy,
          );
          if (!expectedLines) expectedLines = physicalLines;
          physicalLines.forEach((line, index) =>
            expect(line).toBeCloseTo(expectedLines![index], 8),
          );
          expect(physicalLines[4] - physicalLines[0]).toBeCloseTo(
            72 * viewport.scale,
          );
          expect(native.lines.h * transform.scale).toBeCloseTo(
            height === 156 ? 65.30232558 : 72,
          );
          expect(native.lines.w * transform.scale).toBeCloseTo(
            Math.min(width * 0.8, 560),
            0,
          );
          expect(native.lines.x * transform.scale + transform.dx).toBeCloseTo(
            (width - native.lines.w * transform.scale) / 2,
          );
          expect(
            (native.lines.y + native.lines.h / 2) * transform.scale +
              transform.dy,
          ).toBeCloseTo(viewport.staffCenterY);
          if (positions.length) {
            expect(native.heads).toHaveLength(positions.length);
            expect(native.svg).toContain("&#57508;"); // native Bravura quarter-note head
            native.heads.forEach((head, index) => {
              const headCenter = head.y + head.h / 2;
              // The existing courtesy accidental's complete 48px line box
              // must also stay clear of the adjacent toast/input bands.
              expect(
                (headCenter - 24) * transform.scale + transform.dy,
              ).toBeGreaterThanOrEqual(-reserve.top);
              expect(
                (headCenter + 24) * transform.scale + transform.dy,
              ).toBeLessThanOrEqual(height + reserve.bottom);
              expect(
                head.y * transform.scale + transform.dy,
              ).toBeGreaterThanOrEqual(-reserve.top);
              expect(
                (head.y + head.h) * transform.scale + transform.dy,
              ).toBeLessThanOrEqual(height + reserve.bottom);
              expect(headCenter - native.lines.y).toBeCloseTo(
                (8 - positions[index]) * 9 - 1.17,
                0,
              );
            });
          }
        }
        // Ledger overflow really changed; a totalHeight fit would fail this matrix.
        expect(nativeHeights.size).toBeGreaterThan(1);
      }
    },
  );

  it.each(["treble", "bass", "alto", "tenor"] as const)(
    "preserves the %s staff through key signatures and native accidentals",
    (clef) => {
      const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
      const viewport = basicStaffViewport(229, 156);
      for (const keySignature of [-7, 0, 7])
        for (const accidental of ["flat", "natural", "sharp"] as const) {
          const input: NotationScore = {
            clef,
            keySignature,
            events: [
              {
                id: "native",
                duration: 4,
                notes: [
                  writtenNote({ ...noteAt(clef, 18), accidental }, accidental),
                ],
              },
            ],
          };
          const native = engrave(input, viewport.engravingWidth);
          const { scale, dx, dy } = basicStaffTransform(native.lines, viewport);
          expect(native.staffRects).toHaveLength(5);
          // Native clef + seven accidentals can exceed the requested 80% rail.
          // Its minimum content width must never change the glyph scale/y.
          expect(native.lines.w * scale).toBeGreaterThanOrEqual(
            229 * 0.8 - 0.5,
          );
          expect(native.lines.w * scale).toBeLessThanOrEqual(229);
          expect(native.lines.x * scale + dx).toBeCloseTo(
            (229 - native.lines.w * scale) / 2,
          );
          expect(
            (native.lines.y + native.lines.h / 2) * scale + dy,
          ).toBeCloseTo(viewport.staffCenterY);
          expect(native.svg).toContain("&#57508;");
        }
      expect(warnings).toHaveBeenCalledWith(
        expect.stringContaining("compressed below the minimum size"),
      );
    },
  );

  it("reserves only configured overflow while preserving compact ordinary ranges", () => {
    expect(
      basicStaffReserve(156, { ledgerLinesAbove: 0, ledgerLinesBelow: 0 }),
    ).toEqual({ top: 0, bottom: 0 });
    expect(
      basicStaffReserve(156, { ledgerLinesAbove: 1, ledgerLinesBelow: 1 }),
    ).toEqual({ top: 0, bottom: 0 });
    expect(
      basicStaffReserve(220, { ledgerLinesAbove: 2, ledgerLinesBelow: 2 }),
    ).toEqual({ top: 0, bottom: 0 });
    expect(
      basicStaffReserve(156, { ledgerLinesAbove: 5, ledgerLinesBelow: 5 }),
    ).toEqual({ top: 66, bottom: 55 });
    expect(
      basicStaffReserve(220, { ledgerLinesAbove: 5, ledgerLinesBelow: 5 }),
    ).toEqual({ top: 48, bottom: 36 });
    expect(
      basicStaffReserve(0, { ledgerLinesAbove: 5, ledgerLinesBelow: 5 }),
    ).toEqual({ top: 0, bottom: 0 });
  });

  it("bounds every possible ear letter from configured octaves without an answer", () => {
    expect(trebleStaffRange({ min: 4, max: 4 })).toEqual({
      ledgerLinesAbove: 0,
      ledgerLinesBelow: 1,
    });
    expect(trebleStaffRange({ min: 3, max: 5 })).toEqual({
      ledgerLinesAbove: 2,
      ledgerLinesBelow: 5,
    });
    expect(trebleStaffRange({ min: 0, max: 8 })).toEqual({
      ledgerLinesAbove: 12,
      ledgerLinesBelow: 15,
    });
    for (let octave = 0; octave <= 8; octave++) {
      const range = trebleStaffRange({ min: octave, max: octave });
      for (let letter = 0; letter < 7; letter++) {
        const staffPosition = octave * 7 + letter - bottomLine.treble;
        expect(staffPosition).toBeGreaterThanOrEqual(
          -range.ledgerLinesBelow * 2,
        );
        expect(staffPosition).toBeLessThanOrEqual(
          8 + range.ledgerLinesAbove * 2,
        );
      }
    }
  });
});
