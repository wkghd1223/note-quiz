"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AlphaTabApi, model, rendering } from "@coderline/alphatab";
import { child, elements } from "./model";
import {
  fullScoreSignatures,
  staffBarId,
  type EngravedBar,
} from "./full-score-signatures";
import { displayedPitch, shiftedKey } from "./editor-pitch";
import type { ImportWords } from "./copy";
import type { ImportedLane, ImportedScore, ScoreStep } from "./types";

interface BarRegion {
  index: number;
  number: string;
  partId?: string;
  staff: number;
  lane?: ImportedLane;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** All staves played together occupy one system. Bounds include the score
 * heading and the actual height of each system, even before lazy SVG painting. */
export function fullScoreViewportHeight(lookup: rendering.BoundsLookup) {
  const [, , third, fourth] = lookup.staffSystems;
  if (!fourth) return undefined;
  const bottom = third.realBounds.y + third.realBounds.h;
  return Math.ceil(Math.min(bottom, fourth.realBounds.y));
}

/** One selectable area per engraved staff/bar. The renderer's beat hit test
 * chooses by x alone within a system and cannot distinguish stacked parts. */
export function fullScoreBarRegions(
  lookup: rendering.BoundsLookup,
  partIds: string[],
  lanes: ImportedLane[],
  engraving: EngravedBar[] = [],
): BarRegion[] {
  const byStaff = new Map<string, ImportedLane[]>();
  for (const lane of lanes) {
    const key = JSON.stringify([lane.partId, Number(lane.staff)]);
    const group = byStaff.get(key);
    if (group) group.push(lane);
    else byStaff.set(key, [lane]);
  }
  const regions: BarRegion[] = [];
  for (const system of lookup.staffSystems) {
    const written = new Map<string, BarRegion>();
    for (const master of system.bars) {
      const index = engraving[master.index]?.original ?? master.index;
      for (const bound of master.bars) {
        const { staff } = bound.bar;
        const key = JSON.stringify([
          partIds[staff.track.index],
          staff.index + 1,
        ]);
        const candidates = byStaff.get(key) ?? [];
        const inBar = candidates.filter(
          (lane) => lane.bars[index]?.events.length,
        );
        const lane =
          candidates.length === 1
            ? candidates[0]
            : inBar.length === 1
              ? inBar[0]
              : undefined;
        const { x, y, w, h } = bound.realBounds;
        if (w > 0 && h > 0) {
          const identity = staffBarId(
            staff.track.index.toString(),
            staff.index,
            index,
          );
          const previous = written.get(identity);
          if (previous) {
            previous.w = Math.max(previous.x + previous.w, x + w) - previous.x;
            const bottom = Math.max(previous.y + previous.h, y + h);
            previous.y = Math.min(previous.y, y);
            previous.h = bottom - previous.y;
            continue;
          }
          const region = {
            index,
            partId: partIds[staff.track.index],
            staff: staff.index + 1,
            number: candidates[0]?.bars[index]?.label ?? String(index + 1),
            lane,
            x,
            y,
            w,
            h,
          };
          regions.push(region);
          written.set(identity, region);
        }
      }
    }
  }
  return regions;
}

function localNotationBytes(root: Element): Uint8Array {
  // Serialize just the music element. DTDs and stylesheet instructions on the
  // document, as well as linked artwork/resources, never reach the renderer.
  for (const node of Array.from(root.getElementsByTagName("*"))) {
    if (["credit-image", "image", "opus", "link"].includes(node.localName)) {
      node.remove();
      continue;
    }
    for (const attribute of Array.from(node.attributes)) {
      if (
        ["href", "src", "source", "font-family"].includes(attribute.localName)
      ) {
        node.removeAttributeNode(attribute);
      }
    }
  }
  return new TextEncoder().encode(new XMLSerializer().serializeToString(root));
}

/** alphaTab imports transposing instruments as concert-pitch notes and
 * subtracts staff.displayTranspositionPitch to restore the written part.
 * The native display offset alone does not move key signatures or chord names. */
export function transposeFullScore(
  parsed: model.Score,
  partIds: string[],
  lanes: ImportedLane[],
  semitones: number,
  Chord: typeof model.Chord,
  engraving: EngravedBar[] = [],
) {
  for (const track of parsed.tracks) {
    for (const staff of track.staves) {
      if (staff.isPercussion) continue;
      const lane = lanes.find(
        (item) =>
          item.partId === partIds[track.index] &&
          Number(item.staff) === staff.index + 1,
      );
      let instrumentOffset = lane ? 0 : staff.displayTranspositionPitch;
      staff.displayTranspositionPitch = -semitones;
      for (const bar of staff.bars) {
        const source =
          lane?.bars[engraving[bar.index]?.original ?? bar.index]?.source;
        if (source) {
          for (const attributes of elements(source, "attributes")) {
            for (const trans of elements(attributes, "transpose")) {
              const number = trans.getAttribute("number");
              if (number && Number(number) !== staff.index + 1) continue;
              instrumentOffset =
                Number(child(trans, "chromatic")?.textContent ?? 0) +
                12 * Number(child(trans, "octave-change")?.textContent ?? 0);
            }
          }
        }
        const shift = instrumentOffset + semitones;
        if (!shift || shift % 12 === 0) continue;
        const originalKey = bar.keySignature;
        bar.keySignature = shiftedKey(originalKey, shift);
        for (const voice of bar.voices)
          for (const beat of voice.beats) {
            // Recompute the written accidental against the new key and the
            // preceding notes, including naturals needed to cancel the new key.
            for (const note of beat.notes) note.accidentalMode = 0;
            const chord = beat.chord;
            if (!chord || !beat.chordId) continue;
            const root = /^([A-G])([#b]{0,2})/.exec(chord.name);
            if (!root) continue;
            const alter = root[2].length * (root[2].startsWith("b") ? -1 : 1);
            const spelling = displayedPitch(
              { step: root[1] as ScoreStep, octave: 4, alter },
              originalKey,
              shift,
            );
            const name =
              spelling.step +
              (spelling.alter < 0 ? "b" : "#").repeat(
                Math.abs(spelling.alter),
              ) +
              chord.name.slice(root[0].length);
            const id = JSON.stringify([beat.chordId, name]);
            if (!staff.hasChord(id)) {
              // A fingering diagram belongs to the original chord position.
              const replacement = Object.assign(new Chord(), chord, {
                name,
                showDiagram: false,
                showFingering: false,
              });
              staff.addChord(id, replacement);
            }
            beat.chordId = id;
          }
      }
    }
  }
}

function pageCredits(document: XMLDocument) {
  const pages = new Map<string, string[]>();
  for (const credit of elements(document.documentElement, "credit")) {
    // alphaTab 1.9 maps only some first-page credits into score metadata.
    // Keep the original page association and text runs available at every size.
    const text = Array.from(credit.children)
      .filter(
        (node) =>
          node.localName === "credit-words" ||
          node.localName === "credit-symbol",
      )
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();
    if (!text) continue;
    const page = credit.getAttribute("page") || "1";
    const entries = pages.get(page);
    if (entries) entries.push(text);
    else pages.set(page, [text]);
  }
  return Array.from(pages);
}

type View = {
  source: XMLDocument;
  semitones?: number;
  status: "loading" | "ready" | "error";
  regions: BarRegion[];
  viewportHeight?: number;
};

export default function FullScore({
  score,
  words,
  onBar,
  playhead,
  semitones,
}: {
  score: ImportedScore;
  words: ImportWords;
  onBar?: (index: number, laneId?: string) => void;
  playhead?: { barIndex: number; partId: string; staff: string };
  semitones?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>();
  const [attempt, setAttempt] = useState(0);
  const { document: source, lanes } = score;
  const credits = useMemo(() => pageCredits(source), [source]);
  const engraving = useMemo(() => fullScoreSignatures(score), [score]);
  const current =
    view?.source === source && view.semitones === semitones ? view : undefined;
  const status = current?.status ?? "loading";
  const { barIndex, partId, staff } = playhead ?? {};
  const active = useMemo(() => {
    if (barIndex === undefined || !current) return [];
    const bars = current.regions.filter((region) => region.index === barIndex);
    const staves = bars.filter(
      (region) => region.partId === partId && region.staff === Number(staff),
    );
    return staves.length ? staves : bars;
  }, [current, barIndex, partId, staff]);

  useEffect(() => {
    const scroller = viewport.current;
    const bar = active[0];
    if (!scroller || !bar) return;
    const { scrollLeft, scrollTop, clientWidth, clientHeight } = scroller;
    // Move only this sheet. Keep the surrounding playback controls in place.
    if (bar.y < scrollTop || bar.y + bar.h > scrollTop + clientHeight)
      scroller.scrollTop = Math.max(0, bar.y - (clientHeight - bar.h) / 2);
    if (bar.x < scrollLeft || bar.x + bar.w > scrollLeft + clientWidth)
      scroller.scrollLeft = Math.max(0, bar.x - 8);
  }, [active]);

  useEffect(() => {
    const host = container.current!;
    // Each load owns its surface. A render arriving after a file/undo change
    // cannot paint into the next score's host.
    const surface = window.document.createElement("div");
    host.appendChild(surface);
    let api: AlphaTabApi | undefined;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    function stop() {
      active = false;
      clearTimeout(timer);
      try {
        api?.destroy();
      } finally {
        api = undefined;
        surface.remove();
      }
    }
    function fail() {
      if (!active) return;
      setView({ source, semitones, status: "error", regions: [] });
      stop();
    }
    function loading() {
      if (!active) return;
      setView({
        source,
        semitones,
        status: "loading",
        regions: [],
        viewportHeight: viewport.current?.clientHeight,
      });
      clearTimeout(timer);
      timer = setTimeout(fail, 30_000);
    }
    loading();
    void import("@coderline/alphatab")
      .then((alphaTab) => {
        if (!active) return;
        const settings = new alphaTab.Settings();
        settings.fillFromJson({
          core: {
            engine: "svg",
            useWorkers: false,
            fontDirectory: "/alphatab/font/",
            logLevel: "none",
          },
          importer: { mergePartGroupsInMusicXml: false },
          display: {
            layoutMode: "page",
            scale: 0.95,
            padding: [12, 12, 12, 12],
          },
          player: {
            enablePlayer: false,
            enableCursor: false,
            enableUserInteraction: false,
          },
        });
        if (attempt) {
          const fonts =
            alphaTab.CoreSettings.buildDefaultSmuflFontSources(
              "/alphatab/font/",
            );
          for (const [format, url] of fonts)
            fonts.set(format, url + "?retry=" + attempt);
          settings.core.smuflFontSources = fonts;
        }
        api = new alphaTab.AlphaTabApi(surface, settings);
        api.error.on(fail);
        const parsed = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
          localNotationBytes(engraving.root),
          settings,
        );
        if (!parsed.tracks.length || !parsed.masterBars.length) return fail();
        const list = child(source.documentElement, "part-list");
        const parts = list
          ? elements(list, "score-part").map(
              (el) => el.getAttribute("id") ?? "",
            )
          : [];
        const partIds = parts.length === parsed.tracks.length ? parts : [];
        for (const track of parsed.tracks) {
          for (const staff of track.staves) {
            const lane = lanes.find(
              (l) =>
                l.partId === partIds[track.index] &&
                Number(l.staff) === staff.index + 1,
            );
            for (const bar of staff.bars) {
              const piece = engraving.map[bar.index];
              if (!piece) continue;
              // A display-only boundary has no printed barline or measure number.
              if (piece.beat) {
                bar.barLineLeft = alphaTab.model.BarLineStyle.None;
                bar.barNumberDisplay = alphaTab.model.BarNumberDisplay.Hide;
              }
              if (piece.continues)
                bar.barLineRight = alphaTab.model.BarLineStyle.None;
              // Restore the real opening after an earlier unsupported change.
              const original = lane?.bars[piece.original];
              if (!piece.beat && original) {
                const { fifths, keyMode, clef } = original;
                if (Number.isInteger(fifths) && Math.abs(fifths) <= 7)
                  bar.keySignature = fifths;
                bar.keySignatureType =
                  keyMode === "minor"
                    ? alphaTab.model.KeySignatureType.Minor
                    : alphaTab.model.KeySignatureType.Major;
                const c = alphaTab.model.Clef;
                const signs: Record<string, model.Clef> = {
                  G2: c.G2,
                  F4: c.F4,
                  C3: c.C3,
                  C4: c.C4,
                };
                const actual = signs[clef.sign + clef.line];
                if (actual !== undefined) {
                  bar.clef = actual;
                  const octave = 2 - (clef.octaveChange ?? 0);
                  if (octave >= 0 && octave <= 4) bar.clefOttava = octave;
                }
              }
            }
          }
        }
        if (semitones !== undefined) {
          transposeFullScore(
            parsed,
            partIds,
            lanes,
            semitones,
            alphaTab.model.Chord,
            engraving.map,
          );
        }
        api.renderStarted.on(loading);
        api.postRenderFinished.on(() => {
          if (!active || !api) return;
          clearTimeout(timer);
          const lookup = api.boundsLookup;
          setView({
            source,
            semitones,
            status: "ready",
            regions: lookup
              ? fullScoreBarRegions(lookup, partIds, lanes, engraving.map)
              : [],
            viewportHeight: lookup
              ? fullScoreViewportHeight(lookup)
              : undefined,
          });
        });
        // AlphaTab observes its own container and publishes fresh bounds after
        // reflow. Passing all indices also includes parts outside the practice lane.
        api.renderScore(
          parsed,
          parsed.tracks.map((track) => track.index),
        );
      })
      .catch(fail);
    return stop;
  }, [source, lanes, attempt, semitones, engraving]);

  return (
    <section
      aria-label={words.full}
      data-full-score={status}
      className="min-w-0 space-y-2"
    >
      {status === "loading" && (
        <p role="status" className="text-sm text-slate-600">
          {words.loading}
        </p>
      )}
      {status === "error" && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 text-sm text-slate-700"
        >
          <span>{words.fullScoreError}</span>
          <button
            type="button"
            className="rounded border px-3 py-1.5"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {words.retry}
          </button>
        </div>
      )}
      {engraving.marked.size > 0 && (
        <p className="text-sm text-amber-900">{words.fullInlineHint}</p>
      )}
      <div
        ref={viewport}
        data-full-score-viewport
        tabIndex={current?.viewportHeight ? 0 : undefined}
        style={{ maxHeight: current?.viewportHeight }}
        className="max-w-full overflow-auto overscroll-contain rounded-lg bg-white ring-1 ring-inset ring-slate-200 [scrollbar-gutter:stable] focus-visible:outline-violet-700"
      >
        <div
          className="relative"
          style={{ visibility: status === "ready" ? "visible" : "hidden" }}
        >
          <div
            ref={container}
            role="img"
            className="isolate"
            aria-label={[words.full, score.title].filter(Boolean).join(" · ")}
          />
          {active.map((region, index) => (
            <div
              key={index}
              data-playing-bar={region.index}
              aria-hidden="true"
              className="pointer-events-none absolute rounded-sm border-2 border-violet-600/70 bg-violet-400/10"
              style={{
                top: region.y,
                left: region.x,
                width: region.w,
                height: region.h,
              }}
            />
          ))}
          {status === "ready" &&
            current?.regions.map((region) => {
              const key = staffBarId(
                region.partId ?? "",
                region.staff,
                region.index,
              );
              if (!engraving.marked.has(key)) return null;
              return (
                <span
                  key={key}
                  aria-hidden="true"
                  data-inline-signature-warning
                  className="pointer-events-none absolute rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-950 ring-1 ring-inset ring-amber-300"
                  style={{ top: region.y, left: region.x }}
                >
                  {words.signatures}
                </span>
              );
            })}
          {onBar &&
            status === "ready" &&
            current?.regions.map((region, i) => {
              const marked = engraving.marked.get(
                staffBarId(region.partId ?? "", region.staff, region.index),
              );
              const lane = region.lane ?? marked;
              const label = [
                lane?.label,
                words.bar + " " + region.number,
                marked && words.fullInlineHint,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={label}
                  title={label}
                  className="absolute touch-manipulation rounded-sm hover:bg-violet-500/10 focus-visible:bg-violet-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-violet-700"
                  style={{
                    top: region.y,
                    left: region.x,
                    width: region.w,
                    height: region.h,
                  }}
                  onClick={() => onBar(region.index, lane?.id)}
                />
              );
            })}
        </div>
      </div>
      <p className="text-xs text-slate-600">
        {words.fullScoreCaption}{" "}
        <a
          href="/licenses/score-notation.txt"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          alphaTab · Bravura
        </a>
      </p>
      {credits.length > 0 && (
        <details className="text-sm text-slate-700">
          <summary className="cursor-pointer">{words.credits}</summary>
          <dl className="mt-2 grid gap-3">
            {credits.map(([page, texts]) => (
              <div key={page}>
                <dt className="font-semibold">
                  {words.page} {page}
                </dt>
                {texts.map((text, i) => (
                  <dd key={i} className="whitespace-pre-wrap break-words">
                    {text}
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}
