"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { ImportWords } from "./copy";
import { MAX_SCORE_REPEAT_PASSES } from "./model";
import type {
  ImportedBar,
  ImportedEvent,
  ImportedHead,
  ImportedLane,
  ImportedScore,
  ScoreClef,
} from "./types";
import {
  accidentalGlyph,
  bottom,
  clefGlyph,
  keyPositions,
  layoutBar,
  layoutScoreLine,
  lineBarAt,
  lineCursorX,
  type LineBar,
  lengthChoices,
  noteRank,
  noteY,
  restGlyph,
  space,
  type LayoutHead,
} from "./editor-layout";
import {
  addHeadEdit,
  canEditEvent,
  clefEdit,
  divideTupletEdit,
  durationEdit,
  groupTupletEdit,
  meterEdit,
  pitchEdit,
  repeatEdit,
  repeatRanges,
  restEdit,
  tieAction,
  ungroupEdit,
  writtenLength,
  writtenRhythm,
  type Edit,
} from "./score-edits";
import { canDropNote, moveNoteEdit } from "./move-note";
import { beginNoteDrag } from "./note-drag";
import {
  displayedPitch,
  fromPosition,
  keyAlter,
  pitchLabel,
  shiftedKey,
  sourcePitch,
  staffPosition,
  type Spelling,
} from "./editor-pitch";
import ScoreToolPopover from "./ScoreToolPopover";
import {
  clefs,
  clefKeys,
  clefValue,
  meters,
  signatureText,
} from "./signature-options";
import styles from "./ScoreEditor.module.css";

export interface ScoreEditorProps {
  score: ImportedScore;
  lane: ImportedLane;
  barIndex: number;
  semitones: number;
  locked: boolean;
  activeEventId?: string;
  playPosition?: { barIndex: number; beat: number };
  onBar: (index: number) => void;
  onEdit: (change: Edit) => boolean | void;
  words: ImportWords;
}
type Tool = "note" | "meter" | "clef" | "tuplet" | "repeat" | "move" | null;
type Selection = { event: number; head: number };
const presets = ["3:2", "4:3", "5:4", "7:4", "2:3"];

function glyph(text: string, x: number, y: number, size = 48) {
  return (
    <text
      aria-hidden="true"
      className={styles.glyph}
      fill="currentColor"
      x={x}
      y={y}
      fontSize={size}
    >
      {text}
    </text>
  );
}
function stemGlyph(
  type: string,
  x: number,
  y: number,
  down: boolean,
  endY?: number,
) {
  const rank = noteRank.indexOf(type);
  if (rank < 4) return null;
  const sx = x + (down ? -5.6 : 5.6),
    ey = endY ?? y + (down ? 33 : -33);
  return (
    <g aria-hidden="true" className={styles.ink}>
      <line
        x1={sx}
        x2={sx}
        y1={y}
        y2={ey}
        stroke="currentColor"
        strokeWidth="1.4"
      />
      {rank >= 6 &&
        glyph(
          String.fromCodePoint(0xe240 + (rank - 6) * 2 + (down ? 1 : 0)),
          sx,
          ey,
        )}
    </g>
  );
}
function ledger(x: number, y: number) {
  const lines: number[] = [];
  for (
    let pos = bottom + space;
    pos <= y + 1 && lines.length < 25;
    pos += space
  )
    lines.push(pos);
  for (
    let pos = bottom - space * 5;
    pos >= y - 1 && lines.length < 25;
    pos -= space
  )
    lines.push(pos);
  return lines.map((pos) => (
    <line
      key={pos}
      x1={x - 10}
      x2={x + 10}
      y1={pos}
      y2={pos}
      stroke="currentColor"
      strokeWidth="1.1"
      className={styles.ink}
    />
  ));
}
type EventSlot = { barIndex: number; eventIndex: number };

function focusWrittenEvent(sheet: SVGSVGElement | null, index: number) {
  const target = sheet?.querySelector<SVGElement>(
    `[data-edit-event="${index}"]`,
  );
  const viewport = sheet?.closest<HTMLElement>("[data-edit-scroll]");
  if (!target || !viewport) return;
  const box = target.getBoundingClientRect(),
    clip = viewport.getBoundingClientRect();
  if (box.left < clip.left + 8) viewport.scrollLeft += box.left - clip.left - 8;
  else if (box.right > clip.right - 8)
    viewport.scrollLeft += box.right - clip.right + 8;
  target.focus({ preventScroll: true });
}

export default function ScoreEditor(props: ScoreEditorProps) {
  return <ScoreLine key={props.lane.id} {...props} />;
}

function ScoreLine({
  lane,
  score,
  barIndex,
  semitones,
  locked,
  activeEventId,
  playPosition,
  onBar,
  onEdit,
  words: w,
}: ScoreEditorProps) {
  const editor = useRef<HTMLElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const [repeatHost, setRepeatHost] = useState<HTMLSpanElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(350);
  const [windowRange, setWindowRange] = useState({ first: 0, last: 2 });
  const localSelection = useRef<number | null>(null);
  const keyboardTarget = useRef<EventSlot | null>(null);
  const lastSelected = useRef<number | null>(null);
  const restingScroll = useRef<number | null>(null);
  const line = useMemo(
    () => layoutScoreLine(lane, semitones, viewportWidth),
    [lane, semitones, viewportWidth],
  );
  const repeats = useMemo(() => repeatRanges(lane), [lane]);
  // Give the first and last beats the same fixed reading position as the middle of the piece.
  const leadIn = playPosition ? Math.round(viewportWidth * 0.42) : 0;
  const leadOut = playPosition ? viewportWidth - leadIn : 0;
  const updateRange = useCallback(() => {
    const viewport = scrollArea.current;
    if (!viewport || !line.bars.length) return;
    const first = Math.max(
      0,
      lineBarAt(line.bars, viewport.scrollLeft - leadIn) - 1,
    );
    const last = Math.min(
      line.bars.length - 1,
      lineBarAt(
        line.bars,
        viewport.scrollLeft - leadIn + viewport.clientWidth,
      ) + 1,
    );
    setWindowRange((current) =>
      current.first === first && current.last === last
        ? current
        : { first, last },
    );
  }, [line, leadIn]);
  useLayoutEffect(() => {
    const viewport = scrollArea.current;
    if (!viewport) return;
    const resize = () => {
      setViewportWidth(viewport.clientWidth);
      updateRange();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [updateRange]);
  const activate = useCallback(
    (index: number) => {
      localSelection.current = index;
      onBar(index);
    },
    [onBar],
  );
  const navigate = (index: number) => {
    const place = line.bars[index];
    if (!place || !scrollArea.current) return;
    scrollArea.current.scrollLeft = place.left;
    updateRange();
    onBar(index);
  };
  const cursorBar = playPosition && lane.bars[playPosition.barIndex];
  const cursorX =
    cursorBar && playPosition
      ? lineCursorX(
          cursorBar,
          line.bars[cursorBar.index],
          playPosition.beat,
          line.bars[cursorBar.index + 1],
        )
      : undefined;
  useLayoutEffect(() => {
    const viewport = scrollArea.current;
    if (!viewport) return;
    if (cursorX !== undefined) {
      restingScroll.current ??= viewport.scrollLeft;
      viewport.scrollLeft = cursorX;
      updateRange();
      return;
    }
    if (restingScroll.current !== null) {
      viewport.scrollLeft = restingScroll.current;
      restingScroll.current = null;
      updateRange();
    }
    if (lastSelected.current !== barIndex) {
      const place = line.bars[barIndex];
      if (place && localSelection.current !== barIndex) {
        viewport.scrollLeft = place.left;
        updateRange();
      }
      lastSelected.current = barIndex;
      localSelection.current = null;
    }
  }, [cursorX, barIndex, line, updateRange]);

  const visible = new Set(
    Array.from(
      {
        length: Math.max(
          0,
          Math.min(line.bars.length - 1, windowRange.last) -
            windowRange.first +
            1,
        ),
      },
      (_, i) => windowRange.first + i,
    ),
  );
  // Pin the selected bar so a captured pointer survives dragging or scrolling past it.
  if (line.bars[barIndex]) visible.add(barIndex);
  if (cursorBar) visible.add(cursorBar.index);
  const barOptions = useMemo(
    () =>
      lane.bars.map((b) => (
        <option key={b.index} value={b.index}>
          {w.bar} {b.label}
        </option>
      )),
    [lane, w.bar],
  );

  return (
    <section
      ref={editor}
      className={styles.editor}
      data-score-editor
      data-score-line
      aria-label={w.editor}
    >
      <header className={styles.header}>
        {lane.label && <h3>{lane.label}</h3>}
        <nav aria-label={w.bar}>
          <label>
            <span className="sr-only">{w.bar}</span>
            <select
              value={barIndex}
              disabled={locked}
              onChange={(e) => navigate(Number(e.target.value))}
            >
              {barOptions}
            </select>
          </label>
          <span ref={setRepeatHost} />
        </nav>
      </header>
      <div
        data-edit-scroll
        ref={scrollArea}
        className={styles.scoreScroll}
        onScroll={updateRange}
      >
        <div
          className={styles.lineTrack}
          style={{
            width: line.width + leadIn + leadOut,
            height: line.height,
          }}
        >
          <div
            className={styles.lineMusic}
            style={{ left: leadIn, width: line.width }}
          >
            {[...visible]
              .sort((a, b) => a - b)
              .map((index) => (
                <MemoEditorBar
                  key={index}
                  lane={lane}
                  score={score}
                  semitones={semitones}
                  locked={locked}
                  barIndex={index}
                  bar={lane.bars[index]}
                  selectedBar={barIndex === index}
                  activeEventId={
                    cursorBar?.index === index ? activeEventId : undefined
                  }
                  onBar={onBar}
                  onEdit={onEdit}
                  onActivate={activate}
                  words={w}
                  layout={line.bars[index]}
                  lineTop={line.top}
                  lineHeight={line.height}
                  editor={editor}
                  repeatHost={repeatHost}
                  keyboardTarget={keyboardTarget}
                  repeats={repeats}
                />
              ))}
            {cursorX !== undefined && (
              <div
                aria-hidden="true"
                data-line-cursor
                className={styles.lineCursor}
                style={{
                  left: cursorX,
                  top: bottom - line.top - 4 * space - 21,
                  height: 4 * space + 42,
                }}
              />
            )}
          </div>
        </div>
      </div>
      {!locked && <p className={styles.hint}>{w.editorHint}</p>}
    </section>
  );
}

interface EditorBarProps extends Omit<ScoreEditorProps, "playPosition"> {
  bar: ImportedBar;
  selectedBar: boolean;
  layout: LineBar;
  lineTop: number;
  lineHeight: number;
  onActivate: (index: number) => void;
  editor: RefObject<HTMLElement | null>;
  repeatHost: HTMLSpanElement | null;
  keyboardTarget: RefObject<EventSlot | null>;
  repeats: ReturnType<typeof repeatRanges>;
}
const MemoEditorBar = memo(EditorBar);

function EditorBar({
  score,
  lane,
  bar,
  barIndex,
  semitones,
  locked,
  activeEventId,
  onBar,
  onEdit,
  words: w,
  layout,
  lineTop,
  lineHeight,
  selectedBar,
  onActivate,
  editor,
  repeatHost,
  keyboardTarget,
  repeats,
}: EditorBarProps) {
  const [tool, setTool] = useState<Tool>(null);
  const [selected, setSelected] = useState<Selection>({ event: 0, head: 0 });
  const [rangeFrom, setRangeFrom] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{
    head: LayoutHead;
    delta: number;
  } | null>(null);
  const drag = useRef<ReturnType<typeof beginNoteDrag>>(null);
  const sheet = useRef<SVGSVGElement>(null);
  const focusPanel = useRef<HTMLDivElement>(null);
  const [meter, setMeter] = useState(
    signatureText(bar.meter.beats, bar.meter.beatType),
  );
  const [customBeats, setCustomBeats] = useState(String(bar.meter.beats));
  const [customBeatType, setCustomBeatType] = useState(bar.meter.beatType);
  const [clef, setClef] = useState(clefValue(bar.clef));
  const [preset, setPreset] = useState("3:2"),
    [customActual, setCustomActual] = useState("5"),
    [customNormal, setCustomNormal] = useState("4");
  const [firstBar, setFirstBar] = useState(barIndex),
    [lastBar, setLastBar] = useState(barIndex),
    [repeatCount, setRepeatCount] = useState(2);
  const [issue, setIssue] = useState(false);
  const drawing = useMemo(
    () => layoutBar(bar, semitones, layout),
    [bar, semitones, layout],
  );
  const eventIndex = Math.max(
    0,
    Math.min(selected.event, bar.events.length - 1),
  );
  const event = bar.events[eventIndex];
  const editable = event && canEditEvent(event);
  const rhythm = event ? writtenRhythm(event) : null;
  const headIndex = Math.max(
    0,
    Math.min(selected.head, (event?.heads.length ?? 0) - 1),
  );
  const head = event?.heads[headIndex];
  const current = drawing.events[eventIndex];
  const currentHead = current?.heads[headIndex];
  const tie =
    !locked && tool === "note" && head
      ? tieAction(lane, barIndex, eventIndex, headIndex)
      : undefined;
  const [a, n] =
    preset === "custom"
      ? [Number(customActual), Number(customNormal)]
      : preset.split(":").map(Number);
  const range =
    rangeFrom !== null && rangeEnd !== null
      ? bar.events.slice(
          Math.min(rangeFrom, rangeEnd),
          Math.max(rangeFrom, rangeEnd) + 1,
        )
      : [];
  const durationSum = range.length
    ? range.reduce((t, e) => t + e.duration, 0)
    : (event?.duration ?? 0);
  const validRatio =
    Number.isInteger(a) &&
    Number.isInteger(n) &&
    a >= 1 &&
    n >= 1 &&
    a <= 128 &&
    n <= 128 &&
    a !== n;
  const unitLength = durationSum / (range.length ? a : n);
  const unit = writtenLength(unitLength);
  const unitLabel = unit
    ? lengthChoices.find(([type]) => type === unit.type)?.[1] +
      "·".repeat(unit.dots)
    : "";
  const visible = locked || !selectedBar ? null : tool;
  const eventSelector = `[data-edit-event="${eventIndex}"]`;
  const barSelector = `[data-edit-bar="${barIndex}"] `;
  const anchorSelector =
    visible === "repeat"
      ? '[data-edit-symbol="repeat"]'
      : barSelector +
        (visible === "clef" || visible === "meter"
          ? `[data-edit-symbol="${visible}"]`
          : head
            ? eventSelector + `[data-edit-head="${headIndex}"]`
            : eventSelector);
  function focusTools() {
    requestAnimationFrame(() => {
      const panel = focusPanel.current;
      const control = panel?.querySelector<HTMLElement>(
        "select:not(:disabled), input:not(:disabled), button:not(header button, :disabled)",
      );
      control?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    if (locked || !selectedBar) {
      drag.current?.cancel();
      setGhost(null);
      setTool(null);
      setRangeFrom(null);
      setRangeEnd(null);
    }
  }, [locked, selectedBar]);
  useLayoutEffect(() => {
    const next = keyboardTarget.current;
    if (!selectedBar || locked || next?.barIndex !== barIndex) return;
    keyboardTarget.current = null;
    setSelected({ event: next.eventIndex, head: 0 });
    setRangeFrom(null);
    setRangeEnd(null);
    setIssue(false);
    setTool("note");
    focusWrittenEvent(sheet.current, next.eventIndex);
  }, [selectedBar, locked, barIndex, keyboardTarget]);
  useEffect(() => () => drag.current?.cancel(), [bar]);
  useEffect(() => {
    setClef(clefValue(bar.clef));
    setMeter(signatureText(bar.meter.beats, bar.meter.beatType));
    setCustomBeats(String(bar.meter.beats));
    setCustomBeatType(bar.meter.beatType);
  }, [bar.clef, bar.meter.beats, bar.meter.beatType]);
  function open(t: Tool) {
    if (locked) return;
    setTool(t);
    setIssue(false);
  }
  const close = useCallback(
    (restoreFocus = true) => {
      drag.current?.cancel();
      setGhost(null);
      setTool(null);
      setRangeFrom(null);
      setRangeEnd(null);
      if (!restoreFocus) return;
      const focusTarget = editor.current?.querySelector(anchorSelector);
      if (
        focusTarget instanceof SVGElement ||
        focusTarget instanceof HTMLElement
      )
        focusTarget.focus({ preventScroll: true });
    },
    [anchorSelector, editor],
  );
  function select(eventNumber: number, h: number) {
    if (locked) return;
    if (
      tool === "move" &&
      eventNumber !== eventIndex &&
      bar.events[eventNumber]
    ) {
      if (!event || !canDropNote(event, bar.events[eventNumber])) {
        setIssue(true);
        return;
      }
      dropAt(eventIndex, headIndex, barIndex, eventNumber);
      return;
    } else if (rangeFrom !== null && rangeEnd === null) {
      setRangeEnd(eventNumber);
      setTool("tuplet");
    } else {
      setRangeFrom(null);
      setRangeEnd(null);
      setTool("note");
    }
    setSelected({ event: eventNumber, head: h });
    setIssue(false);
  }
  function change(edit: Edit) {
    if (locked) return false;
    try {
      const applied = onEdit(edit) !== false;
      setIssue(!applied);
      return applied;
    } catch {
      setIssue(true);
      return false;
    }
  }
  function originFor(m: LayoutHead, delta: number): Spelling {
    const e = bar.events[m.eventIndex];
    const target = fromPosition(staffPosition(m.shown) + delta);
    target.alter = keyAlter(target.step, shiftedKey(e.fifths, m.shift));
    // Ordinary vertical steps follow the currently sounding accidental in this bar.
    for (const prev of drawing.events.slice(0, m.eventIndex)) {
      if (prev.fifths !== drawing.events[m.eventIndex].fifths) continue;
      for (const h of prev.heads)
        if (staffPosition(h.shown) === staffPosition(target))
          target.alter = h.shown.alter;
    }
    return sourcePitch(target, e.fifths, m.shift);
  }
  function nudge(h: LayoutHead, delta: number) {
    change(pitchEdit(bar.events[h.eventIndex], h.head, originFor(h, delta)));
  }
  function dropAt(
    sourceIndex: number,
    sourceHead: number,
    destinationBar: number,
    destinationEvent: number,
    dropUnderPointer = false,
  ) {
    const source = bar.events[sourceIndex];
    const target = lane.bars[destinationBar]?.events[destinationEvent];
    if (!target || !canDropNote(source, target)) return;
    const midi = source.heads[sourceHead]?.midi;
    const surface = editor.current;
    if (!change(moveNoteEdit(lane, source, target))) return;
    setTool(null);
    setGhost(null);
    if (destinationBar !== barIndex) {
      if (dropUnderPointer) onActivate(destinationBar);
      else onBar(destinationBar);
    }
    // Moving unequal durations can change event indices when a rest is split.
    // Keep keyboard focus on the moved pitch nearest the drop point.
    requestAnimationFrame(() => {
      const heads = surface?.querySelectorAll<SVGElement>(
        `[data-edit-bar="${destinationBar}"] [data-edit-head][data-midi="${midi === undefined ? "" : midi + semitones}"]`,
      );
      const nearest =
        heads &&
        Array.from(heads).sort(
          (a, b) =>
            Math.abs(Number(a.dataset.editEvent) - destinationEvent) -
            Math.abs(Number(b.dataset.editEvent) - destinationEvent),
        )[0];
      nearest?.focus({ preventScroll: true });
    });
  }
  function adjacentEvent(
    index: number,
    direction: number,
    moved?: ImportedEvent,
  ) {
    for (let b = barIndex; b >= 0 && b < lane.bars.length; b += direction) {
      const events = lane.bars[b].events;
      const start =
        b === barIndex
          ? index + direction
          : direction > 0
            ? 0
            : events.length - 1;
      for (let i = start; i >= 0 && i < events.length; i += direction)
        if (!moved || canDropNote(moved, events[i]))
          return { barIndex: b, eventIndex: i };
    }
  }
  function startDrag(e: React.PointerEvent<SVGGElement>, h: LayoutHead) {
    if (locked || !e.isPrimary || e.button !== 0) return;
    const source = bar.events[h.eventIndex];
    if (!canEditEvent(source) || (rangeFrom !== null && rangeEnd === null)) {
      select(h.eventIndex, h.index);
      return;
    }
    if (tool === "move" && h.eventIndex !== eventIndex) {
      select(h.eventIndex, h.index);
      return;
    }
    e.currentTarget.focus({ preventScroll: true });
    const scale = sheet.current?.getScreenCTM()?.d;
    if (!scale) return;
    drag.current?.cancel();
    drag.current = beginNoteDrag({
      handle: e.currentTarget,
      pointer: e.nativeEvent,
      scale,
      stepHeight: space / 2,
      moveImmediately: tool === "move" && h.eventIndex === eventIndex,
      canDrop: ({ barIndex: b, eventIndex: i }) => {
        const target = lane.bars[b]?.events[i];
        return !!target && canDropNote(source, target);
      },
      onTap: () => select(h.eventIndex, h.index),
      onGrab: () => {
        setSelected({ event: h.eventIndex, head: h.index });
        setTool(null);
        setIssue(false);
      },
      onPan: () => setTool(null),
      onPitchPreview: (delta) => setGhost({ head: h, delta }),
      onPitch: (delta) => {
        select(h.eventIndex, h.index);
        nudge(h, delta);
      },
      onDrop: ({ barIndex: b, eventIndex: i }) =>
        dropAt(h.eventIndex, h.index, b, i, true),
      onInvalidDrop: () => {
        select(h.eventIndex, h.index);
        setIssue(true);
      },
      onRelease: () => {
        drag.current = null;
        setGhost(null);
      },
    });
  }
  function navigateNote(index: number, direction: number) {
    const target = adjacentEvent(index, direction);
    if (!target) return;
    if (target.barIndex !== barIndex) {
      keyboardTarget.current = target;
      onActivate(target.barIndex);
      return;
    }
    select(target.eventIndex, 0);
    focusWrittenEvent(sheet.current, target.eventIndex);
  }
  function headKeys(e: React.KeyboardEvent<SVGGElement>, h: LayoutHead) {
    if (locked) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(h.eventIndex, h.index);
      focusTools();
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      select(h.eventIndex, h.index);
      nudge(h, e.key === "ArrowUp" ? 1 : -1);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const direction = e.key === "ArrowRight" ? 1 : -1;
      if (e.shiftKey) {
        const target = adjacentEvent(
          h.eventIndex,
          direction,
          bar.events[h.eventIndex],
        );
        if (target)
          dropAt(h.eventIndex, h.index, target.barIndex, target.eventIndex);
        return;
      }
      navigateNote(h.eventIndex, direction);
    }
  }
  const buttonKey = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };
  function add() {
    if (!event) return;
    if (head) {
      if (!change(addHeadEdit(event, head))) return;
      setSelected({ event: eventIndex, head: event.heads.length });
    } else {
      const previous = bar.events
        .slice(0, eventIndex)
        .reverse()
        .find((e) => e.heads.length)?.heads[0];
      const p: Spelling = previous
        ? {
            step: previous.step,
            alter: previous.alter,
            octave: previous.octave,
          }
        : { step: "C", octave: 4, alter: keyAlter("C", event.fifths) };
      change(pitchEdit(event, undefined, p));
    }
  }
  function repeatPanel() {
    const existing = repeats.ranges
      .filter((r) => r.start <= barIndex && r.end >= barIndex)
      .sort((a, b) => a.end - a.start - (b.end - b.start))[0];
    setRepeatCount(Number(existing?.backward[0]?.getAttribute("times") || 2));
    setFirstBar(existing?.start ?? barIndex);
    setLastBar(existing?.end ?? barIndex);
    open("repeat");
  }
  const meterX = layout.meterX ?? 0;
  function keyGlyphs(fifths: number, c: ScoreClef, x: number) {
    return keyPositions(fifths, c).map((y, i) => (
      <g key={i}>{glyph(accidentalGlyph(Math.sign(fifths)), x + 10 * i, y)}</g>
    ));
  }
  function renderNote(h: LayoutHead, e: ImportedEvent) {
    const focused =
      !!visible && h.eventIndex === eventIndex && h.index === headIndex;
    const isGhost = ghost?.head.head.id === h.head.id;
    const pitch = isGhost
      ? displayedPitch(originFor(h, ghost!.delta), e.fifths, h.shift)
      : h.shown;
    const y = noteY(pitch, e.clef),
      rank = noteRank.indexOf(h.type),
      openHead = rank >= 0 && rank <= 4;
    const sameStem = drawing.events[h.eventIndex].heads.filter((other) =>
      nearDuration(other.head, h.head),
    );
    const lowY = Math.max(...sameStem.map((other) => other.y)),
      highY = Math.min(...sameStem.map((other) => other.y));
    const down = lowY + highY < 2 * (bottom - space * 2),
      colour =
        focused || isGhost
          ? "#6d28d9"
          : activeEventId === e.id
            ? "#047857"
            : "currentColor";
    const showStem = sameStem[0] === h;
    return (
      <g
        key={h.head.id}
        data-edit-event={h.eventIndex}
        data-edit-head={h.index}
        data-midi={h.head.midi + semitones}
        role="button"
        tabIndex={locked ? -1 : 0}
        aria-label={`${w.pitch} ${pitchLabel(pitch)} · ${w.bar} ${bar.label}`}
        aria-haspopup="dialog"
        aria-expanded={focused}
        aria-pressed={focused}
        aria-disabled={locked}
        className={styles.head}
        color={colour}
        style={
          visible === "move" && h.eventIndex === eventIndex
            ? { touchAction: "none", cursor: "ew-resize" }
            : undefined
        }
        onContextMenu={(ev) => ev.preventDefault()}
        onPointerDown={(ev) => startDrag(ev, h)}
        onKeyDown={(ev) => headKeys(ev, h)}
        onClick={(ev) => {
          if (ev.detail === 0) select(h.eventIndex, h.index);
        }}
      >
        <rect
          data-notehead-hit
          className={styles.hit}
          x={h.x - 13}
          y={y - 8}
          width="26"
          height="16"
          rx="4"
        />
        {ledger(h.x, y)}
        {focused && (
          <ellipse
            className={styles.ink}
            cx={h.x}
            cy={y}
            rx="10"
            ry="8"
            fill="#ede9fe"
            stroke="#8b5cf6"
          />
        )}
        {(isGhost || h.accidental) &&
          glyph(accidentalGlyph(pitch.alter), h.x - 20 - (h.index % 2) * 3, y)}
        {showStem &&
          stemGlyph(
            h.type,
            h.x,
            down ? Math.min(highY, y) : Math.max(lowY, y),
            down,
            down ? Math.max(lowY, y) + 33 : Math.min(highY, y) - 33,
          )}
        <ellipse
          className={styles.ink}
          cx={h.x}
          cy={y}
          rx={rank <= 3 ? 7.4 : 6.2}
          ry="4.25"
          transform={`rotate(-18 ${h.x} ${y})`}
          fill={openHead ? "white" : "currentColor"}
          stroke="currentColor"
          strokeWidth={openHead ? 2.2 : 1}
        />
        {Array.from({ length: Math.min(4, h.dots) }, (_, i) => (
          <circle
            key={i}
            className={styles.ink}
            cx={h.x + 12 + 4 * i}
            cy={y - 2.7}
            r="1.7"
            fill="currentColor"
          />
        ))}
        {isGhost && (
          <text
            x={h.x}
            y={y - 16}
            textAnchor="middle"
            fontSize="12"
            fill="currentColor"
          >
            {pitchLabel(pitch)}
          </text>
        )}
      </g>
    );
  }
  return (
    <div
      onKeyDown={(ev) => {
        if (visible && ev.key === "Escape") {
          ev.preventDefault();
          close();
        }
      }}
    >
      {selectedBar &&
        repeatHost &&
        createPortal(
          <button
            type="button"
            data-edit-symbol="repeat"
            aria-haspopup="dialog"
            aria-expanded={visible === "repeat"}
            disabled={locked}
            onClick={(e) => {
              repeatPanel();
              if (e.detail === 0) focusTools();
            }}
          >
            {w.repeat}
          </button>,
          repeatHost,
        )}
      <svg
        ref={sheet}
        className={styles.sheet}
        data-edit-bar={barIndex}
        data-selected-bar={selectedBar || undefined}
        viewBox={`0 ${lineTop} ${layout.width} ${lineHeight}`}
        style={{ left: layout.left, width: layout.width, height: lineHeight }}
        onFocusCapture={() => {
          if (!locked && !selectedBar) onActivate(barIndex);
        }}
        onPointerDownCapture={() => {
          if (!locked && !selectedBar) onActivate(barIndex);
        }}
        preserveAspectRatio="xMinYMid meet"
        role="group"
        aria-label={`${w.bar} ${bar.label}`}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={barIndex === 0 ? 8 : 0}
            x2={drawing.width}
            y1={bottom - i * space}
            y2={bottom - i * space}
            stroke="#8290a1"
            strokeWidth="1"
          />
        ))}
        <path
          d={`${barIndex === 0 ? `M8 ${bottom - 4 * space}v${space * 4}` : ""} M${drawing.width - 0.5} ${bottom - 4 * space}v${space * 4}`}
          stroke="#334155"
        />
        <text
          x={barIndex === 0 ? 9 : 4}
          y={bottom - 5 * space - 3}
          fontSize="10"
          fill="#64748b"
        >
          {bar.label}
        </text>
        {!!repeats.bars[barIndex]?.forward.length && (
          <g aria-hidden="true" fill="currentColor">
            <circle cx="16" cy={bottom - 1.5 * space} r="2" />
            <circle cx="16" cy={bottom - 2.5 * space} r="2" />
          </g>
        )}
        {!!repeats.bars[barIndex]?.backward.length && (
          <g aria-hidden="true" fill="currentColor">
            <circle cx={drawing.width - 18} cy={bottom - 1.5 * space} r="2" />
            <circle cx={drawing.width - 18} cy={bottom - 2.5 * space} r="2" />
          </g>
        )}
        {layout.clefX !== undefined && (
          <g
            transform={`translate(${layout.clefX - 22},0)`}
            role="button"
            aria-label={w.clef}
            data-edit-symbol="clef"
            aria-haspopup="dialog"
            aria-expanded={visible === "clef"}
            aria-disabled={locked}
            tabIndex={locked ? -1 : 0}
            className={styles.symbol}
            onClick={() => open("clef")}
            onKeyDown={(e) =>
              buttonKey(e, () => {
                open("clef");
                focusTools();
              })
            }
          >
            <rect
              className={styles.hit}
              x="20"
              y={bottom - 60}
              width="36"
              height="78"
            />
            {glyph(
              clefGlyph(bar.clef),
              22,
              bottom - (bar.clef.line - 1) * space,
            )}
            {!!bar.clef.octaveChange && (
              <text
                x="41"
                y={bar.clef.octaveChange > 0 ? bottom - 55 : bottom + 20}
                fontSize="11"
              >
                {Math.abs(bar.clef.octaveChange) === 1 ? "8" : "15"}
              </text>
            )}
          </g>
        )}
        {layout.keyX !== undefined &&
          (layout.cancelledKey
            ? keyPositions(layout.cancelledKey, bar.clef).map((y, i) => (
                <g key={i}>
                  {glyph(accidentalGlyph(0), layout.keyX! + 10 * i, y)}
                </g>
              ))
            : keyGlyphs(drawing.key, bar.clef, layout.keyX))}
        {layout.meterX !== undefined && (
          <g
            role="button"
            aria-label={w.meter}
            data-edit-symbol="meter"
            aria-haspopup="dialog"
            aria-expanded={visible === "meter"}
            aria-disabled={locked}
            tabIndex={locked ? -1 : 0}
            className={styles.symbol}
            onClick={() => open("meter")}
            onKeyDown={(e) =>
              buttonKey(e, () => {
                open("meter");
                focusTools();
              })
            }
          >
            <rect
              className={styles.hit}
              x={meterX - 4}
              y={bottom - 54}
              width="35"
              height="63"
            />
            {[bar.meter.beats, bar.meter.beatType].map((v, i) => (
              <text
                key={i}
                className={styles.ink}
                x={meterX + 9}
                y={bottom - 2 * space + 1 + i * space * 1.7}
                textAnchor="middle"
                fill="currentColor"
                fontFamily="serif"
                fontWeight="bold"
                fontSize="25"
              >
                {v}
              </text>
            ))}
          </g>
        )}
        {drawing.events.map(
          ({ event: e, eventIndex: i, x, heads, contextChange, fifths }) => (
            <g key={e.id} data-edit-slot={i} data-slot-x={x}>
              <rect
                className={styles.dropMark}
                x={x - 14}
                y={bottom - 54}
                width="28"
                height="60"
                rx="5"
              />
              {visible === "move" && event && canDropNote(event, e) && (
                <rect
                  x={x - 17}
                  width="34"
                  y={bottom - 51}
                  height="55"
                  rx="4"
                  fill="#ecfdf5"
                  stroke="#059669"
                  strokeDasharray="3 3"
                />
              )}
              {contextChange && (
                <g>
                  {glyph(
                    clefGlyph(e.clef),
                    x - 36 - Math.abs(fifths) * 10,
                    bottom - (e.clef.line - 1) * space,
                    34,
                  )}
                  {keyGlyphs(
                    fifths,
                    e.clef,
                    x - 18 - Math.min(7, Math.abs(fifths)) * 10,
                  )}
                </g>
              )}
              {rangeFrom !== null &&
                i >= Math.min(rangeFrom, rangeEnd ?? rangeFrom) &&
                i <= Math.max(rangeFrom, rangeEnd ?? rangeFrom) && (
                  <rect
                    x={x - 15}
                    y={bottom - 54}
                    width="31"
                    height="60"
                    fill="#ddd6fe"
                    opacity=".52"
                  />
                )}
              {heads.length ? (
                heads.map((h) => renderNote(h, e))
              ) : (
                <g
                  data-edit-event={i}
                  tabIndex={locked ? -1 : 0}
                  role="button"
                  aria-label={`${canEditEvent(e) ? w.rest : w.limited} · ${w.bar} ${bar.label}`}
                  className={styles.symbol}
                  color={
                    i === eventIndex && visible ? "#6d28d9" : "currentColor"
                  }
                  onClick={() => select(i, 0)}
                  aria-haspopup="dialog"
                  aria-expanded={i === eventIndex && !!visible}
                  onKeyDown={(ev) => {
                    if (locked) return;
                    if (
                      !ev.shiftKey &&
                      (ev.key === "ArrowLeft" || ev.key === "ArrowRight")
                    ) {
                      ev.preventDefault();
                      navigateNote(i, ev.key === "ArrowRight" ? 1 : -1);
                    } else
                      buttonKey(ev, () => {
                        select(i, 0);
                        focusTools();
                      });
                  }}
                >
                  <rect
                    className={styles.hit}
                    x={x - 14}
                    y={bottom - 44}
                    width="29"
                    height="41"
                  />
                  {canEditEvent(e) ? (
                    glyph(
                      restGlyph(writtenRhythm(e).type),
                      x - 6,
                      bottom - space * 2,
                    )
                  ) : (
                    <text x={x - 5} y={bottom - space * 2} fill="currentColor">
                      ×
                    </text>
                  )}
                  {Array.from(
                    { length: Math.min(writtenRhythm(e).dots, 3) },
                    (_, d) => (
                      <circle
                        key={d}
                        cx={x + 9 + d * 4}
                        cy={bottom - space * 2.5}
                        r="1.5"
                        fill="currentColor"
                      />
                    ),
                  )}
                </g>
              )}
            </g>
          ),
        )}
        {drawing.ties.map((tie, i) => (
          <path
            key={i}
            className={styles.ink}
            data-written-tie
            d={`M${tie.from} ${tie.y} Q${(tie.from + tie.to) / 2} ${tie.y + 13} ${tie.to} ${tie.y} Q${(tie.from + tie.to) / 2} ${tie.y + 9} ${tie.from} ${tie.y}`}
            fill="currentColor"
          />
        ))}
        {drawing.groups.map((g) => (
          <g key={g.from} className={styles.ink}>
            <path
              d={`M${drawing.events[g.from].x - 9} ${drawing.top + 20}v-6H${drawing.events[g.to].x + 9}v6`}
              stroke="#475569"
              fill="none"
            />
            <text
              x={(drawing.events[g.from].x + drawing.events[g.to].x) / 2}
              y={drawing.top + 13}
              textAnchor="middle"
              fontSize="12"
              fill="currentColor"
            >
              {g.label}
            </text>
          </g>
        ))}
        {visible === "note" && editable && currentHead && !ghost && (
          <g
            role="button"
            tabIndex={0}
            aria-label={w.addHead}
            data-chord-plus
            className={styles.symbol}
            onClick={add}
            onKeyDown={(e) => buttonKey(e, add)}
          >
            <circle
              cx={currentHead.x + 19}
              cy={currentHead.y - 16}
              r="13"
              fill="white"
              stroke="#7c3aed"
            />
            <text
              x={currentHead.x + 19}
              y={currentHead.y - 11}
              textAnchor="middle"
              className={styles.ink}
              fill="#6d28d9"
              fontSize="19"
            >
              +
            </text>
          </g>
        )}
      </svg>
      {visible && (
        <ScoreToolPopover
          editor={editor}
          activeGesture={drag}
          panel={focusPanel}
          anchorSelector={anchorSelector}
          revision={bar}
          tool={visible}
          title={
            visible === "note"
              ? currentHead
                ? pitchLabel(currentHead.shown)
                : editable
                  ? w.rest
                  : w.editor
              : w[visible]
          }
          measure={`${w.bar} ${bar.label}`}
          closeLabel={w.close}
          onClose={close}
        >
          {visible === "note" && event && !editable && (
            <p role="status">{w.editConflict}</p>
          )}
          {visible === "note" && editable && event && (
            <div className={styles.toolbar}>
              {event.heads.length > 1 && (
                <label>
                  {w.pitch}
                  <select
                    value={headIndex}
                    onChange={(ev) =>
                      setSelected({
                        event: eventIndex,
                        head: Number(ev.target.value),
                      })
                    }
                  >
                    {current.heads.map((h) => (
                      <option key={h.head.id} value={h.index}>
                        {pitchLabel(h.shown)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {currentHead && (
                <>
                  <button
                    type="button"
                    aria-label={w.pitch + " ↓"}
                    onClick={() => nudge(currentHead, -1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={w.pitch + " ↑"}
                    onClick={() => nudge(currentHead, 1)}
                  >
                    ↑
                  </button>
                  <label>
                    {w.accidental}
                    <select
                      value={currentHead.shown.alter}
                      onChange={(ev) =>
                        change(
                          pitchEdit(
                            event,
                            head,
                            sourcePitch(
                              {
                                ...currentHead.shown,
                                alter: Number(ev.target.value),
                              },
                              event.fifths,
                              currentHead.shift,
                            ),
                            true,
                          ),
                        )
                      }
                    >
                      {[-2, -1, 0, 1, 2].map((v, i) => (
                        <option key={v} value={v}>
                          {["𝄫", "♭", "♮", "♯", "𝄪"][i]}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <label>
                {w.length}
                <select
                  value={rhythm?.type}
                  disabled={!!event.tuplet}
                  onChange={(ev) =>
                    change(
                      durationEdit(
                        bar,
                        event,
                        ev.target.value,
                        rhythm?.dots ?? 0,
                      ),
                    )
                  }
                >
                  {!lengthChoices.some(([t]) => t === rhythm?.type) && (
                    <option value={rhythm?.type}>{rhythm?.type || "—"}</option>
                  )}
                  {lengthChoices.map(([t, s]) => (
                    <option key={t} value={t}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                aria-pressed={!!rhythm?.dots}
                disabled={!!event.tuplet || !rhythm?.type}
                onClick={() =>
                  change(
                    durationEdit(
                      bar,
                      event,
                      rhythm!.type,
                      rhythm?.dots ? 0 : 1,
                    ),
                  )
                }
              >
                {w.dot}
              </button>
              {head ? (
                <>
                  {tie && (
                    <button type="button" onClick={() => change(tie.change)}>
                      {tie.linked ? w.untie : w.tie}
                    </button>
                  )}
                  <button type="button" onClick={() => change(restEdit(event))}>
                    {event.heads.length > 1 ? w.chordRest : w.rest}
                  </button>
                  {event.heads.length > 1 && (
                    <button
                      type="button"
                      onClick={() => change(restEdit(event, head))}
                    >
                      {w.removeHead}
                    </button>
                  )}
                  <button type="button" onClick={() => open("move")}>
                    {w.move}
                  </button>
                </>
              ) : (
                <button type="button" onClick={add}>
                  {w.addNote}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setRangeFrom(null);
                  setRangeEnd(null);
                  open("tuplet");
                }}
              >
                {w.tuplet}
              </button>
              <button
                type="button"
                aria-pressed={rangeFrom !== null}
                onClick={() => {
                  setRangeFrom(eventIndex);
                  setRangeEnd(null);
                }}
              >
                {w.range}
              </button>
              {rangeFrom !== null && rangeEnd === null && (
                <span role="status">{w.selectEnd}</span>
              )}
            </div>
          )}
          {visible === "move" && event && (
            <div className={styles.toolbar}>
              {[-1, 1].map((dir) => {
                const candidate = adjacentEvent(eventIndex, dir, event);
                return (
                  <button
                    key={dir}
                    type="button"
                    disabled={!candidate}
                    aria-label={dir < 0 ? w.previous : w.next}
                    onClick={() => {
                      if (candidate)
                        dropAt(
                          eventIndex,
                          headIndex,
                          candidate.barIndex,
                          candidate.eventIndex,
                        );
                    }}
                  >
                    {dir < 0 ? "←" : "→"}
                  </button>
                );
              })}
            </div>
          )}
          {visible === "tuplet" && event && (
            <>
              <div className={styles.toolbar}>
                <label>
                  {w.tuplet}
                  <select
                    value={preset}
                    onChange={(ev) => setPreset(ev.target.value)}
                  >
                    {presets.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                    <option value="custom">{w.custom}</option>
                  </select>
                </label>
                {preset === "custom" && (
                  <>
                    <input
                      type="number"
                      aria-label={w.tuplet}
                      value={customActual}
                      min="1"
                      max="128"
                      onChange={(ev) => setCustomActual(ev.target.value)}
                    />
                    <span>{w.of}</span>
                    <input
                      type="number"
                      aria-label={w.of}
                      value={customNormal}
                      min="1"
                      max="128"
                      onChange={(ev) => setCustomNormal(ev.target.value)}
                    />
                  </>
                )}
                <output>
                  {validRatio && unit
                    ? `${a} × ${unitLabel} → ${n} × ${unitLabel}`
                    : w.tupletFit}
                </output>
                <button
                  type="button"
                  disabled={!unit || !validRatio}
                  onClick={() => {
                    if (
                      !change(
                        range.length
                          ? groupTupletEdit(bar, range, a, n)
                          : divideTupletEdit(event, a, n),
                      )
                    )
                      return;
                    setRangeFrom(null);
                    setRangeEnd(null);
                    setTool("note");
                  }}
                >
                  {range.length ? w.group : w.divide}
                </button>
                {event.tuplet && (
                  <button
                    type="button"
                    onClick={() => {
                      if (change(ungroupEdit(lane, event))) setTool("note");
                    }}
                  >
                    {w.ungroup}
                  </button>
                )}
              </div>
            </>
          )}
          {visible === "clef" && (
            <div className={styles.toolbar}>
              <label>
                {w.clef}
                <select
                  value={clef}
                  onChange={(ev) => setClef(ev.target.value)}
                >
                  {!clefs.some((c) => clefValue(c) === clefValue(bar.clef)) && (
                    <option value={clefValue(bar.clef)}>
                      {[bar.clef.sign, bar.clef.line, bar.clef.octaveChange]
                        .filter((v) => v !== undefined)
                        .join(" · ")}
                    </option>
                  )}
                  {clefs.map((c, i) => (
                    <option key={c.sign + c.line} value={clefValue(c)}>
                      {w.clefNames[clefKeys[i]]}
                    </option>
                  ))}
                </select>
              </label>
              <span>{w.fromHere}</span>
              <button
                type="button"
                onClick={() => {
                  const c = clefs.find((v) => clefValue(v) === clef);
                  if (
                    c &&
                    clef !== clefValue(bar.clef) &&
                    !change(clefEdit(bar, lane, c))
                  )
                    return;
                  close();
                }}
              >
                {w.apply}
              </button>
            </div>
          )}
          {visible === "meter" && (
            <div className={styles.toolbar}>
              <label>
                {w.meter}
                <select
                  value={meter}
                  onChange={(ev) => setMeter(ev.target.value)}
                >
                  {Array.from(
                    new Set([
                      signatureText(bar.meter.beats, bar.meter.beatType),
                      ...meters,
                    ]),
                  ).map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                  <option value="custom">{w.custom}</option>
                </select>
              </label>
              {meter === "custom" && (
                <label>
                  <input
                    aria-label={w.meter + " 𝅘𝅥"}
                    type="number"
                    min={1}
                    max={32}
                    value={customBeats}
                    onChange={(ev) => setCustomBeats(ev.target.value)}
                  />{" "}
                  /{" "}
                  <select
                    aria-label={w.length}
                    value={customBeatType}
                    onChange={(ev) =>
                      setCustomBeatType(Number(ev.target.value))
                    }
                  >
                    {[1, 2, 4, 8, 16, 32].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              )}
              <span>{w.fromHere}</span>
              <button
                type="button"
                disabled={
                  meter === "custom" &&
                  (!Number.isInteger(Number(customBeats)) ||
                    Number(customBeats) < 1 ||
                    Number(customBeats) > 32)
                }
                onClick={() => {
                  const [beats, beatType] =
                    meter === "custom"
                      ? [Number(customBeats), customBeatType]
                      : meter.split("/").map(Number);
                  if (
                    (beats !== bar.meter.beats ||
                      beatType !== bar.meter.beatType) &&
                    !change(meterEdit(score, lane, bar, { beats, beatType }))
                  )
                    return;
                  close();
                }}
              >
                {w.apply}
              </button>
            </div>
          )}
          {visible === "repeat" && (
            <div className={styles.toolbar}>
              {(
                [
                  ["from", firstBar, setFirstBar],
                  ["to", lastBar, setLastBar],
                ] as const
              ).map(([name, v, setter]) => (
                <label key={name}>
                  {w[name]}
                  <select
                    value={v}
                    onChange={(ev) => setter(Number(ev.target.value))}
                  >
                    {lane.bars.map((b) => (
                      <option key={b.index} value={b.index}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                ×{" "}
                <input
                  type="number"
                  min={1}
                  max={MAX_SCORE_REPEAT_PASSES}
                  value={repeatCount}
                  aria-label={w.repeat}
                  onChange={(ev) => setRepeatCount(Number(ev.target.value))}
                />
              </label>
              <button
                disabled={lastBar < firstBar}
                type="button"
                onClick={() =>
                  change(
                    repeatEdit(score, firstBar, lastBar, repeatCount, false),
                  )
                }
              >
                {w.apply}
              </button>
              <button
                type="button"
                onClick={() =>
                  change(
                    repeatEdit(score, firstBar, lastBar, repeatCount, true),
                  )
                }
              >
                {w.remove}
              </button>
            </div>
          )}
          {issue && (
            <p role="alert" className={styles.status}>
              {w.editConflict}
            </p>
          )}
        </ScoreToolPopover>
      )}
    </div>
  );
}

function nearDuration(a: ImportedHead, b: ImportedHead) {
  return Math.abs(a.duration - b.duration) < 1e-7;
}
