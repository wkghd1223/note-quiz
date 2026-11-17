"use client";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import AlphaTabNotationView from "@/components/notation/AlphaTabNotationView";
import type { NotationRenderResult, NotationScore } from "@/lib/notation/score";
import type { ExerciseDefinition } from "../domain/stage";
import type {
  AttemptResult,
  PlaybackTransition,
  TargetEvent,
} from "../domain/performance";
import { exerciseScore } from "@/features/melody/domain/notation";
import { melodyQuarterWidthFor } from "@/features/melody/domain/score-layout";
import {
  visibleLivePitchFeedback,
  type ProvisionalPitchFeedback,
} from "@/features/melody/domain/live-feedback";
import { beatsPerMeasure } from "../domain/stage";
import type { ChallengeCopy } from "../i18n";
import {
  incorrectNoteColor,
  matchedNoteColor,
  scoreCursorPosition,
  scoreNoteColors,
  type ScorePreRoll,
} from "./score-scroll";
import styles from "./ScoreViewport.module.css";

export { melodyQuarterWidth } from "@/features/melody/domain/score-layout";
export const stageScore = exerciseScore;

interface ScoreBarLabel {
  barIndex: number;
  label: string;
}

const noBarLabels: readonly ScoreBarLabel[] = [];
const barLabelBandHeight = 24;

/** Written-bar positions are already projected into the score rail's coordinates. */
export function scoreBarLabels(
  labels: readonly ScoreBarLabel[],
  render: NotationRenderResult | null,
) {
  const measures = new Map(
    render?.measures?.map((measure) => [measure.index, measure]),
  );
  return labels.flatMap((label) => {
    const x = measures.get(label.barIndex)?.timeStartX;
    return x === undefined ? [] : [{ ...label, x }];
  });
}

/** Retained for the written-music regression oracle, independent of viewport layout. */
export function stageBarScore(
  stage: ExerciseDefinition,
  bar: number,
): NotationScore {
  const score = stageScore(stage);
  return {
    ...score,
    bars: score.bars?.slice(bar, bar + 1),
    events: score.events
      .filter((event) => event.barIndex === bar)
      .map((event) => ({ ...event, barIndex: 0 })),
  };
}

export default function ScoreViewport({
  stage,
  targets,
  transitions,
  elapsed,
  scorePreRoll = null,
  active,
  finished,
  reviewable = finished,
  reducedMotion,
  result,
  c,
  onError,
  onReady,
  timeSpacing = false,
  barLabels = noBarLabels,
  provisionalFeedback = null,
  footerFeedback,
  footerFeedbackVisible = false,
}: {
  stage: ExerciseDefinition;
  targets: readonly TargetEvent[];
  transitions: readonly PlaybackTransition[];
  elapsed: number;
  scorePreRoll?: ScorePreRoll | null;
  active: boolean;
  finished: boolean;
  /** Caller permits manual reading while the transport is stopped. */
  reviewable?: boolean;
  reducedMotion: boolean;
  result: AttemptResult | null;
  c: ChallengeCopy;
  onError: () => void;
  onReady: () => void;
  timeSpacing?: boolean;
  /** Final display strings indexed by written bar, independent of playback visits. */
  barLabels?: readonly ScoreBarLabel[];
  /** Current microphone pitch guidance, independent of finalized judgments. */
  provisionalFeedback?: ProvisionalPitchFeedback | null;
  footerFeedback?: ReactNode;
  footerFeedbackVisible?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [render, setRender] = useState<NotationRenderResult | null>(null);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const reviewing = reviewable && !active;
  const quarterWidth = melodyQuarterWidthFor(stage);
  useLayoutEffect(() => {
    // A review offset must never displace the fixed playhead on the next attempt.
    if (!reviewing && viewport.current) viewport.current.scrollLeft = 0;
  }, [reviewing, stage.id]);
  const score = useMemo(
    () => ({
      ...stageScore(stage),
      ...(timeSpacing ? { timeSpacing: { quarterWidth } } : {}),
    }),
    [stage, timeSpacing, quarterWidth],
  );
  const visualTargets = useMemo(
    () =>
      targets.map((target) => {
        const id = target.sourceEventId ?? target.stageEventId;
        const event = stage.events.find((candidate) => candidate.id === id)!;
        return {
          ...target,
          sourceEventId: id,
          sourceBarIndex:
            target.sourceBarIndex ??
            Math.floor(event.startBeat / beatsPerMeasure(stage)),
          visit: target.visit ?? 1,
        };
      }),
    [stage, targets],
  );
  useEffect(() => {
    const host = viewport.current!;
    const observer = new ResizeObserver(() =>
      setWidth(Math.floor(host.clientWidth)),
    );
    observer.observe(host);
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setSystemReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", updatePreference);
    };
  }, []);
  const scoreWidth = Math.max(
    width,
    // Reserve the complete time-spaced rail before rendering. Growing it from
    // the first render's bounds would remount the engine after reporting Ready.
    timeSpacing
      ? 512 + stage.measures * beatsPerMeasure(stage) * quarterWidth * 2
      : 320 + stage.events.length * 100,
    Math.ceil(render?.contentWidth ?? 0),
  );
  const notationHeight = timeSpacing ? 176 : 200;
  const labelBandHeight = barLabels.length ? barLabelBandHeight : 0;
  const labels = useMemo(
    () => scoreBarLabels(barLabels, render),
    [barLabels, render],
  );
  const labelDescription = useMemo(
    () =>
      barLabels
        .map(({ barIndex, label }) => `${c.measure} ${barIndex + 1}: ${label}`)
        .join("; "),
    [barLabels, c.measure],
  );
  const position = render
    ? scoreCursorPosition(
        visualTargets,
        transitions,
        render,
        elapsed,
        reducedMotion || systemReducedMotion,
        scorePreRoll,
      )
    : { x: 0, barIndex: 0, rewinding: false };
  const playheadX = timeSpacing
    ? Math.min(240, Math.max(140, width * 0.55))
    : Math.min(160, Math.max(100, width * 0.3));
  const provisional = visibleLivePitchFeedback(
    active && !finished && !scorePreRoll ? provisionalFeedback : null,
    targets,
    result,
    elapsed,
  );
  const provisionalColor = provisional
    ? provisional.pitchMatches
      ? matchedNoteColor
      : incorrectNoteColor
    : undefined;
  const colorKey = JSON.stringify(
    scoreNoteColors(
      visualTargets,
      transitions,
      result,
      finished ? Infinity : elapsed,
      stage.scoring.required.includes("rest"),
    ),
  );
  // Only settled judgments recolor the engraving. Live pitch changes the
  // lightweight playhead, avoiding whole-score renders for every pitch wobble.
  const colors = useMemo<Readonly<Record<string, string>>>(
    () => JSON.parse(colorKey),
    [colorKey],
  );
  const description = stage.events
    .map(
      (event) =>
        `${event.writtenSpelling ?? c.rest} · ${event.tuplet ? "⅓" : event.durationBeats} ♩`,
    )
    .join(" → ");
  return (
    <section
      aria-label={c.sheetMusic}
      className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-slate-100 px-3 py-2 text-xs">
        <span className="font-semibold text-violet-900">
          {active ? c.playhead : c.sheetMusic}
        </span>
        <span className="flex gap-3">
          <span style={{ color: matchedNoteColor }}>✓ {c.passed}</span>
          <span style={{ color: incorrectNoteColor }}>× {c.incorrect}</span>
        </span>
      </div>
      <div
        ref={viewport}
        role="region"
        tabIndex={reviewing ? 0 : undefined}
        aria-label={c.sheetMusic}
        aria-describedby="challenge-score-hint"
        className={`relative min-w-0 ${reviewing ? styles.review : "overflow-clip"}`}
        data-score-viewport
        data-score-review={reviewing}
        data-score-bar={position.barIndex + 1}
        data-score-rewinding={position.rewinding}
        data-score-colors={colorKey}
        data-score-provisional={
          provisional
            ? provisional.pitchMatches
              ? "matched"
              : "incorrect"
            : "neutral"
        }
      >
        {!render && (
          <p
            role="status"
            className="absolute inset-0 flex items-center justify-center text-sm text-slate-500"
          >
            {c.loading}
          </p>
        )}
        <div
          data-score-rail
          className="relative shrink-0"
          style={{
            height: notationHeight + labelBandHeight,
            // Keep the renderer's reserved width stable, but don't make review
            // scroll through its unused preparation space after the final bar.
            width: reviewing
              ? Math.max(width, Math.ceil(render?.contentWidth ?? scoreWidth))
              : scoreWidth,
            overflow: reviewing ? "hidden" : undefined,
            transform: active
              ? `translateX(${playheadX - position.x}px)`
              : undefined,
          }}
        >
          <AlphaTabNotationView
            score={score}
            width={scoreWidth}
            height={notationHeight}
            layout="horizontal"
            horizontalScale={timeSpacing ? 0.85 : 1}
            eventColors={colors}
            accessibleLabel={
              labelDescription
                ? `${description} · ${labelDescription}`
                : description
            }
            className="block"
            style={
              labelBandHeight
                ? { position: "relative", top: labelBandHeight }
                : undefined
            }
            onRender={(next) => {
              setRender(next);
              onReady();
            }}
            onError={onError}
          />
          {labels.map(({ barIndex, label, x }) => (
            <span
              key={barIndex}
              aria-hidden="true"
              data-score-chord
              data-bar-index={barIndex}
              className={styles.barLabel}
              style={{ left: x, height: labelBandHeight }}
            >
              {label}
            </span>
          ))}
        </div>
        {active && render && (
          <div
            aria-hidden="true"
            data-score-playhead
            className="pointer-events-none absolute bottom-3 top-3 w-0.5 bg-violet-600"
            style={{
              left: playheadX,
              top: labelBandHeight ? labelBandHeight + 12 : undefined,
              backgroundColor: provisionalColor,
            }}
          >
            <span
              className="absolute -left-[3px] -top-1 h-2 w-2 rounded-full bg-violet-600"
              style={{ backgroundColor: provisionalColor }}
            />
            {provisional && (
              <span
                className="absolute -left-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-white text-xs font-bold"
                style={{ color: provisionalColor }}
              >
                {provisional.pitchMatches ? "✓" : "×"}
              </span>
            )}
          </div>
        )}
      </div>
      <div
        data-score-feedback-band
        className="relative min-h-11 border-t border-slate-100 px-3 py-2"
      >
        <p
          id="challenge-score-hint"
          className={`text-xs leading-relaxed text-slate-600 ${footerFeedbackVisible ? "opacity-0" : ""}`}
        >
          {active ? c.scrollHint : c.scrollReview}
        </p>
        {footerFeedback}
      </div>
    </section>
  );
}
