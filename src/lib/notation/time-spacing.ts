import {
  Environment,
  LayoutMode,
  type model,
  type rendering,
} from "@coderline/alphatab";

// alphaTab 1.9's public spacingRatio/displayWidth options still reserve varying
// prefix widths and center full-bar notes. This narrow, version-pinned adapter
// supplies beat positions BEFORE the native engine lays out beams and bounds.
// Native glyphs, stems, rests, tuplets, collision/skyline handling and SVG paint
// remain alphaTab's. It is opt-in for generated melody scores, never /practice.
interface BeatGlyph {
  beat: model.Beat;
  x: number;
  onTimeX: number;
  _layoutOnsetX(): void;
  scaleToWidth(width: number): void;
  fitToNextBeat(next: BeatGlyph): void;
}
interface VoiceContainer {
  x: number;
  width: number;
  beatGlyphs: BeatGlyph[][];
  scaleToWidth(width: number): void;
  _emitBeatContainerSkyline(glyph: BeatGlyph): void;
}
interface BarRenderer {
  bar: model.Bar;
  voiceContainer: VoiceContainer;
}
interface Layout {
  _scaleBars(result: { renderers: BarRenderer[] }): void;
}
interface LayoutFactory {
  vertical: boolean;
  createLayout(renderer: rendering.ScoreRenderer): Layout;
}

const scores = new WeakMap<model.Score, number>();
let installed = false;
// Eight units contain the native whole-note head while leaving room for the
// final sixteenth before the double barline at 92 units per quarter.
export const timeSpacingInset = 8;

/** Must run in the same realm as the renderer (these eight-bar views use no worker). */
export function enableTimeSpacing(score: model.Score, quarterWidth: number) {
  if (!(quarterWidth >= 60) || !Number.isFinite(quarterWidth))
    throw new Error("Invalid notation time spacing");
  scores.set(score, quarterWidth);
  if (installed) return;
  const environment = Environment as unknown as {
    layoutEngines?: Map<LayoutMode, LayoutFactory>;
  };
  const factory = environment.layoutEngines?.get(LayoutMode.Horizontal);
  if (!factory) throw new Error("Unsupported alphaTab horizontal layout");
  environment.layoutEngines!.set(LayoutMode.Horizontal, {
    ...factory,
    createLayout(renderer) {
      const layout = factory.createLayout(renderer);
      const scaleBars = layout._scaleBars;
      if (typeof scaleBars !== "function")
        throw new Error("Unsupported alphaTab bar layout");
      layout._scaleBars = function (result) {
        const width = renderer.score && scores.get(renderer.score);
        if (width) {
          for (const r of result.renderers) {
            const container = r.voiceContainer;
            if (
              !Array.isArray(container?.beatGlyphs) ||
              typeof container._emitBeatContainerSkyline !== "function"
            )
              throw new Error("Unsupported alphaTab beat layout");
            // The initial clef/key/meter is outside the timed bar body. All
            // musical bars have exactly the same width for the same meter.
            const prefix = r.bar.index === 0 ? Math.max(0, container.x - 6) : 0;
            r.bar.displayWidth =
              (r.bar.masterBar.calculateDuration() / 960) * width + prefix;
            container.scaleToWidth = function (available) {
              this.width = available;
              for (const glyphs of this.beatGlyphs) {
                for (const glyph of glyphs) {
                  if (typeof glyph._layoutOnsetX !== "function")
                    throw new Error("Unsupported alphaTab note layout");
                  glyph._layoutOnsetX();
                  glyph.x =
                    prefix +
                    timeSpacingInset +
                    (glyph.beat.playbackStart / 960) * width -
                    this.x -
                    glyph.onTimeX;
                }
                for (let i = 0; i < glyphs.length; i++) {
                  const glyph = glyphs[i],
                    next = glyphs[i + 1];
                  glyph.scaleToWidth((next?.x ?? this.width) - glyph.x);
                  if (next) glyph.fitToNextBeat(next);
                  this._emitBeatContainerSkyline(glyph);
                }
              }
            };
          }
        }
        scaleBars.call(this, result);
      };
      return layout;
    },
  });
  installed = true;
}
