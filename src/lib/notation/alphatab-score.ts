import * as alphaTab from "@coderline/alphatab";
import { enableTimeSpacing } from "./time-spacing";
import type {
  NotationDirection,
  NotationEventColors,
  NotationRenderResult,
  NotationScore,
} from "./score";

const directions: Record<NotationDirection, alphaTab.model.Direction> = {
  segno: alphaTab.model.Direction.TargetSegno,
  coda: alphaTab.model.Direction.TargetCoda,
  fine: alphaTab.model.Direction.TargetFine,
  toCoda: alphaTab.model.Direction.JumpDaCoda,
  daCapo: alphaTab.model.Direction.JumpDaCapo,
  daCapoAlFine: alphaTab.model.Direction.JumpDaCapoAlFine,
  daCapoAlCoda: alphaTab.model.Direction.JumpDaCapoAlCoda,
  dalSegno: alphaTab.model.Direction.JumpDalSegno,
  dalSegnoAlFine: alphaTab.model.Direction.JumpDalSegnoAlFine,
  dalSegnoAlCoda: alphaTab.model.Direction.JumpDalSegnoAlCoda,
};

/** Constructs alphaTab's typed object graph; alphaTex never owns app data. */
export function toAlphaTabScore(
  input: NotationScore,
  eventColors?: NotationEventColors,
) {
  const m = alphaTab.model;
  const score = new m.Score();
  const track = new m.Track();
  score.addTrack(track);
  track.playbackInfo.program = 0;
  const staff = new m.Staff();
  staff.showTablature = false;
  staff.showStandardNotation = true;
  track.addStaff(staff);
  score.stylesheet.hideDynamics = true;
  score.stylesheet.showSingleStaffBrackets = false;
  score.stylesheet.scoreConfig = {
    timeSignature: { isVisible: !!input.showTimeSignature },
  };
  const barCount = Math.max(
    1,
    input.bars?.length ?? 0,
    ...input.events.map((event) => (event.barIndex ?? 0) + 1),
  );
  const voices = Array.from({ length: barCount }, (_, index) => {
    const master = new m.MasterBar();
    master.timeSignatureNumerator =
      input.timeSignature?.numerator ?? Math.max(1, input.events.length);
    master.timeSignatureDenominator = input.timeSignature?.denominator ?? 4;
    const metadata = input.bars?.[index];
    if (metadata) {
      master.isRepeatStart = metadata.repeatStart ?? false;
      master.repeatCount = metadata.repeatCount ?? 0;
      for (const direction of metadata.directions ?? [])
        master.addDirection(directions[direction]);
    }
    score.addMasterBar(master);
    const bar = new m.Bar();
    bar.clef = {
      treble: m.Clef.G2,
      bass: m.Clef.F4,
      alto: m.Clef.C3,
      tenor: m.Clef.C4,
    }[input.clef];
    bar.keySignature = input.keySignature as alphaTab.model.KeySignature;
    staff.addBar(bar);
    const voice = new m.Voice();
    bar.addVoice(voice);
    return voice;
  });
  const events = input.events.map((event) => {
    const beat = new m.Beat();
    beat.duration = event.duration;
    beat.dots = event.dots ?? 0;
    if (event.tuplet) {
      beat.tupletNumerator = event.tuplet.numerator;
      beat.tupletDenominator = event.tuplet.denominator;
    }
    voices[event.barIndex ?? 0].addBeat(beat);
    const color = eventColors?.[event.id]
      ? m.Color.fromJson(eventColors[event.id])
      : null;
    if (color) {
      beat.style = new m.BeatStyle();
      for (const element of [
        m.BeatSubElement.StandardNotationStem,
        m.BeatSubElement.StandardNotationFlags,
        m.BeatSubElement.StandardNotationBeams,
        m.BeatSubElement.StandardNotationRests,
      ])
        beat.style.colors.set(element, color);
    }
    for (const written of event.notes) {
      const note = new m.Note();
      // alphaTab pitched notes use MIDI octave (C4 = octave 5), not scientific octave.
      note.octave = Math.floor(written.midi / 12);
      note.tone = ((written.midi % 12) + 12) % 12;
      note.accidentalMode =
        written.alter === 1
          ? m.NoteAccidentalMode.ForceSharp
          : written.alter === -1
            ? m.NoteAccidentalMode.ForceFlat
            : m.NoteAccidentalMode.ForceNatural;
      if (color) {
        note.style = new m.NoteStyle();
        note.style.colors.set(m.NoteSubElement.StandardNotationNoteHead, color);
        note.style.colors.set(
          m.NoteSubElement.StandardNotationAccidentals,
          color,
        );
        note.style.colors.set(m.NoteSubElement.StandardNotationEffects, color);
      }
      beat.addNote(note);
    }
    return { id: event.id, beat };
  });
  score.finish(new alphaTab.Settings());
  if (input.timeSpacing)
    enableTimeSpacing(score, input.timeSpacing.quarterWidth);
  return { score, events, timeSpacing: input.timeSpacing };
}

/** Project actual engine bounds through exactly the transform used by the view. */
export function notationRenderResult(
  built: ReturnType<typeof toAlphaTabScore>,
  lookup: alphaTab.rendering.BoundsLookup | null,
  transform: {
    scale: number;
    dx: number;
    dy: number;
    top: number;
    width: number;
    height: number;
    contentWidth: number;
  },
): NotationRenderResult {
  const { scale, dx, dy, top, width, height, contentWidth } = transform;
  const project = (b: alphaTab.rendering.Bounds) => ({
    x: dx + b.x * scale,
    y: top + dy + b.y * scale,
    width: b.w * scale,
    height: b.h * scale,
  });
  return {
    events: built.events.flatMap(({ id, beat }) => {
      const bounds = lookup?.findBeat(beat);
      return bounds
        ? [
            {
              id,
              ...project(bounds.visualBounds),
              anchorX: dx + bounds.onNotesX * scale,
            },
          ]
        : [];
    }),
    measures: built.score.masterBars.flatMap((bar) => {
      const bounds = lookup?.findMasterBar(bar);
      const first = built.events.find(
        ({ beat }) => beat.voice.bar.index === bar.index,
      );
      const firstBounds = first && lookup?.findBeat(first.beat);
      // Derive scale from the measured bar width, excluding its initial prefix.
      const modelBar = built.score.tracks[0].staves[0].bars[bar.index];
      const unitScale =
        bounds && modelBar.displayWidth > 0
          ? bounds.realBounds.w / modelBar.displayWidth
          : 1;
      return bounds
        ? [
            {
              index: bar.index,
              ...project(bounds.realBounds),
              ...(built.timeSpacing && first && firstBounds
                ? {
                    timeStartX:
                      dx +
                      (firstBounds.onNotesX -
                        (first.beat.playbackStart / 960) *
                          built.timeSpacing.quarterWidth *
                          unitScale) *
                        scale,
                    timeWidth:
                      (bar.calculateDuration() / 960) *
                      built.timeSpacing.quarterWidth *
                      unitScale *
                      scale,
                  }
                : {}),
            },
          ]
        : [];
    }),
    width,
    height,
    contentWidth,
  };
}
