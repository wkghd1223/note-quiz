"use client";

import React, { useEffect, useRef } from "react";
import type { AlphaTabApi } from "@coderline/alphatab";
import {
  basicStaffTransform,
  basicStaffViewport,
} from "@/lib/notation/basic-staff";
import type {
  NotationEventColors,
  NotationLayout,
  NotationScore,
  NotationRenderResult,
} from "@/lib/notation/score";

// Browsers cache failed FontFace loads. Change the public font-source URLs only
// after a failed render so a remount can recover without reloading the page.
let fontRetry = 0;

export interface AlphaTabNotationViewProps {
  score: NotationScore;
  accessibleLabel?: string;
  width?: number;
  height?: number;
  /** Existing legacy viewBox bounds, preserved independently of engraving. */
  viewBox?: string;
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Page preserves the legacy fitted geometry; horizontal is a left-aligned rail. */
  layout?: NotationLayout;
  /** One-question practice bars: native weighted layout with a useful physical staff length. */
  fittedBasic?: boolean;
  /** Written event IDs, independent of repeated playback occurrences. */
  eventColors?: NotationEventColors;
  onRender?: (result: NotationRenderResult) => void;
  onError?: (error: Error) => void;
}

/** Render-only, client-owned alphaTab lifecycle. No synth or SoundFont is loaded. */
export default function AlphaTabNotationView({
  score,
  accessibleLabel,
  width = 620,
  height = 260,
  viewBox = `0 0 ${width} ${height}`,
  responsive = true,
  className,
  style,
  layout = "page",
  fittedBasic = false,
  eventColors,
  onRender,
  onError,
}: AlphaTabNotationViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const desired = useRef(score);
  const desiredColors = useRef(eventColors);
  // Equal maps must not rerender just because a caller allocated a new object.
  const colorsKey = JSON.stringify(
    Object.entries(eventColors ?? {}).sort(([a], [b]) => a.localeCompare(b)),
  );
  const desiredColorsKey = useRef(colorsKey);
  const callbacks = useRef({ onRender, onError });
  const update = useRef<() => void>(() => {});
  const top = Number(viewBox.split(" ")[1]) || 0;
  const boxHeight = Number(viewBox.split(" ")[3]) || height;
  const timeSpacing = !!score.timeSpacing;
  const basicFit =
    fittedBasic &&
    layout === "page" &&
    !timeSpacing &&
    (score.bars?.length ?? 1) <= 1 &&
    score.events.every((event) => (event.barIndex ?? 0) === 0);
  const viewport = useRef({ top, height: boxHeight });
  viewport.current = { top, height: boxHeight };
  desired.current = score;
  desiredColors.current = eventColors;
  desiredColorsKey.current = colorsKey;
  callbacks.current = { onRender, onError };

  useEffect(() => {
    const fontAttempt = fontRetry;
    let destroyed = false;
    let failed = false;
    let api: AlphaTabApi | undefined;
    let busy = false;
    let revision = 0;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let renderTimer: ReturnType<typeof setTimeout> | undefined;
    const element = host.current!;
    // AlphaTabApi.render takes its renderer width from the host container.
    // Set this before API construction, so its first engraving already has
    // the intended physical staff length and needs no post-render refit.
    if (basicFit)
      element.style.width = `${basicStaffViewport(width, viewport.current.height).engravingWidth}px`;
    const fail = (error: unknown) => {
      if (destroyed || failed) return;
      failed = true;
      if (api && fontAttempt === fontRetry) fontRetry++;
      clearTimeout(renderTimer);
      clearTimeout(resizeTimer);
      update.current = () => {};
      try {
        api?.destroy();
      } catch {
        // A failed worker must not prevent the recovery UI from appearing.
      }
      api = undefined;
      element.replaceChildren();
      callbacks.current.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    };
    // alphaTab 1.9 does not forward every worker/asset loading error. Bound
    // imports and renders so a missing asset cannot leave Start disabled forever.
    const armRenderTimeout = () => {
      clearTimeout(renderTimer);
      renderTimer = setTimeout(
        () => fail(new Error("Notation rendering timed out")),
        10_000,
      );
    };
    const observed = element.closest("svg") ?? element;
    let observedWidth = observed.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const nextWidth = observed.getBoundingClientRect().width;
      if (Math.abs(nextWidth - observedWidth) < 0.5) return;
      observedWidth = nextWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!destroyed && api) update.current();
      }, 80);
    });
    observer.observe(observed);
    armRenderTimeout();
    void Promise.all([
      import("@coderline/alphatab"),
      import("@/lib/notation/alphatab-score"),
    ])
      .then(([alphaTab, { toAlphaTabScore, notationRenderResult }]) => {
        if (destroyed || failed) return;
        const fontSources =
          alphaTab.CoreSettings.buildDefaultSmuflFontSources("/alphatab/font/");
        if (fontAttempt > 0) {
          for (const [format, url] of fontSources) {
            fontSources.set(format, `${url}?retry=${fontAttempt}`);
          }
        }
        // Register optional spacing before AlphaTabApi creates its renderer.
        let active = toAlphaTabScore(desired.current, desiredColors.current);
        api = new alphaTab.AlphaTabApi(element, {
          core: {
            fontDirectory: "/alphatab/font/",
            smuflFontSources: fontSources,
            engine: "svg",
            // The pinned time-spacing adapter runs with the native renderer;
            // ordinary fitted notation retains its existing worker path.
            useWorkers: !timeSpacing,
            includeNoteBounds: true,
            enableLazyLoading: false,
          },
          display: {
            layoutMode:
              layout === "horizontal"
                ? alphaTab.LayoutMode.Horizontal
                : alphaTab.LayoutMode.Page,
            scale: 2,
            padding: [12, 16, 12, 16],
            staveProfile: "score",
            barsPerRow: 1,
            lastSystemFillThreshold: 0,
            // Automatic weights an empty voice as zero content. Model layout's
            // default bar weight 1 extends a genuinely empty staff, without beats.
            systemsLayoutMode: basicFit
              ? alphaTab.SystemsLayoutMode.UseModelLayout
              : alphaTab.SystemsLayoutMode.Automatic,
            resources: { staffLineColor: "#64748b", mainGlyphColor: "#0f172a" },
          },
          notation: {
            elements: new Map(
              [
                alphaTab.NotationElement.ScoreTitle,
                alphaTab.NotationElement.ScoreSubTitle,
                alphaTab.NotationElement.ScoreArtist,
                alphaTab.NotationElement.ScoreAlbum,
                alphaTab.NotationElement.ScoreWords,
                alphaTab.NotationElement.ScoreMusic,
                alphaTab.NotationElement.ScoreWordsAndMusic,
                alphaTab.NotationElement.ScoreCopyright,
                alphaTab.NotationElement.TrackNames,
                alphaTab.NotationElement.GuitarTuning,
                alphaTab.NotationElement.BarNumber,
                alphaTab.NotationElement.EffectTempo,
              ].map((key) => [key, false]),
            ),
          },
          player: {
            enablePlayer: false,
            enableCursor: false,
            enableUserInteraction: false,
          },
        });
        let input = desired.current;
        let inputColorsKey = desiredColorsKey.current;
        let completedInput: NotationScore | undefined;
        let completedColorsKey: string | undefined;
        let completedObservedWidth: number | undefined;
        let inputObservedWidth = observedWidth;
        let generation = revision;
        let totalWidth = width;
        let totalHeight = height;
        const render = () => {
          if (!api || destroyed || failed || busy) return;
          busy = true;
          const colorOnly =
            completedInput === desired.current &&
            completedColorsKey !== desiredColorsKey.current &&
            completedObservedWidth === observedWidth;
          input = desired.current;
          inputColorsKey = desiredColorsKey.current;
          generation = revision;
          inputObservedWidth = observedWidth;
          // alphaTab clears partial viewports unless reuseViewport is requested.
          // Keep the completed engraving visible while only judgment colors
          // change; music/layout changes still use the bounded loading path.
          if (!colorOnly) element.style.visibility = "hidden";
          element.dataset.rendered = "false";
          armRenderTimeout();
          try {
            active = toAlphaTabScore(input, desiredColors.current);
            api.renderScore(
              active.score,
              [0],
              colorOnly ? { reuseViewport: true } : undefined,
            );
          } catch (error) {
            fail(error);
          }
        };
        update.current = () => {
          revision++;
          render();
        };
        api.error.on(fail);
        api.renderFinished.on((event) => {
          totalWidth = event.totalWidth;
          totalHeight = event.totalHeight;
        });
        api.postRenderFinished.on(() => {
          if (destroyed || failed || !api) return;
          clearTimeout(renderTimer);
          busy = false;
          if (
            generation !== revision ||
            input !== desired.current ||
            inputColorsKey !== desiredColorsKey.current
          ) {
            render();
            return;
          }
          const viewportHeight = viewport.current.height;
          const lines = basicFit
            ? api.boundsLookup?.findMasterBarByIndex(0)?.lineAlignedBounds
            : undefined;
          if (basicFit && !lines) {
            fail(new Error("Native staff bounds unavailable"));
            return;
          }
          const fittedScale = Math.min(
            layout === "horizontal" ? 1 : width / totalWidth,
            viewportHeight / totalHeight,
          );
          const { scale, dx, dy } = lines
            ? basicStaffTransform(
                lines,
                basicStaffViewport(width, viewportHeight),
              )
            : {
                scale: fittedScale,
                dx:
                  layout === "horizontal"
                    ? 0
                    : (width - totalWidth * fittedScale) / 2,
                dy: (viewportHeight - totalHeight * fittedScale) / 2,
              };
          element.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
          if (basicFit) {
            // Native minimum-width engraving may extend past its canvas width.
            // Let that ink reach the existing practice frame; that outer frame
            // owns horizontal clipping and configured vertical clearance.
            element
              .querySelectorAll<HTMLElement>(".at-surface")
              .forEach((surface) => {
                surface.style.overflow = "visible";
              });
          }
          element.style.visibility = "visible";
          // Forced spelling does not force a courtesy glyph in alphaTab 1.9.
          // Preserve legacy explicit #/b when the same alteration is in the key.
          element
            .querySelectorAll("[data-courtesy]")
            .forEach((node) => node.remove());
          active.events.forEach(({ beat }, index) => {
            const bounds = api!.boundsLookup?.findBeat(beat);
            if (!bounds) return;
            const written = input.events[index].notes;
            bounds.notes?.forEach((noteBounds, noteIndex) => {
              const note = written[noteIndex];
              if (
                !note ||
                !note.explicitAccidental ||
                note.explicitAccidental === "natural"
              )
                return;
              const affected =
                note.alter === 1
                  ? "FCGDAEB".slice(0, Math.max(0, input.keySignature))
                  : "BEADGCF".slice(0, Math.max(0, -input.keySignature));
              if (!affected.includes(note.step)) return;
              const accidental = document.createElement("span");
              accidental.dataset.courtesy = "true";
              const head = noteBounds.noteHeadBounds;
              Object.assign(accidental.style, {
                position: "absolute",
                left: `${head.x - 28}px`,
                top: `${head.y + head.h / 2 - 24}px`,
                fontFamily: "serif",
                fontSize: "36px",
                lineHeight: "48px",
                color:
                  beat.style?.colors.get(
                    alphaTab.model.BeatSubElement.StandardNotationStem,
                  )?.rgba ?? "#0f172a",
              });
              accidental.textContent = note.alter === 1 ? "♯" : "♭";
              element.append(accidental);
            });
          });
          completedInput = input;
          completedColorsKey = inputColorsKey;
          completedObservedWidth = inputObservedWidth;
          element.dataset.rendered = "true";
          element.dataset.eventPitches = input.events
            .map((event) => event.notes.map((note) => note.midi).join(","))
            .join(";");
          callbacks.current.onRender?.(
            notationRenderResult(active, api.boundsLookup, {
              scale,
              dx,
              dy,
              top: viewport.current.top,
              width,
              height: viewportHeight,
              contentWidth: totalWidth * scale,
            }),
          );
        });
        // AlphaTab attaches its DOM-partial reset handlers on its first frame.
        // Basic engraving can render synchronously when workers are unavailable.
        if (basicFit) requestAnimationFrame(render);
        else render();
      })
      .catch(fail);
    return () => {
      destroyed = true;
      update.current = () => {};
      clearTimeout(resizeTimer);
      clearTimeout(renderTimer);
      observer.disconnect();
      api?.destroy();
      element.replaceChildren();
    };
  }, [width, height, layout, timeSpacing, basicFit]);

  useEffect(() => {
    update.current();
  }, [score, colorsKey]);
  return (
    <svg
      role={accessibleLabel ? "img" : undefined}
      aria-label={accessibleLabel}
      width={width}
      viewBox={responsive ? viewBox : undefined}
      className={className}
      style={basicFit ? { ...style, overflow: "visible" } : style}
      data-notation-renderer="alphaTab"
    >
      <foreignObject
        x={0}
        y={top}
        width={width}
        height={boxHeight}
        style={basicFit ? { overflow: "visible" } : undefined}
      >
        <div
          aria-hidden="true"
          style={{
            position: "relative",
            width,
            height: boxHeight,
            overflow: basicFit ? "visible" : "hidden",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", width, height: boxHeight }}>
            <div
              ref={host}
              style={{
                width,
                position: "absolute",
                transformOrigin: "0 0",
                visibility: "hidden",
              }}
            />
          </div>
        </div>
      </foreignObject>
    </svg>
  );
}
