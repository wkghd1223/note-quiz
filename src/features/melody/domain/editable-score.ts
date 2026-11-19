import { parseScoreDocument } from "@/features/score-import/model";
import { createScoreWriter } from "@/features/score-import/formats/writer";
import { clefs, clefKeys } from "@/features/score-import/signature-options";
import { MELODY_TICKS_PER_BEAT, type MelodyGeneration } from "./generator";
import { getTonality } from "./harmony";
import { exerciseScore } from "./notation";

const noteTypes = {
  1: "whole",
  2: "half",
  4: "quarter",
  8: "eighth",
  16: "16th",
} as const;

/** Keep the generated performance grid and its written rhythm side by side.
 * A triplet's written eighth and its performed third of a beat are distinct. */
export function editableMelody(
  generation: Extract<MelodyGeneration, { ok: true }>,
  partName: string,
) {
  const { exercise, settings } = generation;
  const notation = exerciseScore(exercise);
  const writer = createScoreWriter();
  const { add } = writer;
  const part = writer.part("P1", partName);
  const bars = Array.from({ length: exercise.measures }, (_, bar) => {
    const measure = add(part, "measure", undefined, { number: bar + 1 });
    if (!bar) {
      const attr = add(measure, "attributes");
      add(attr, "divisions", MELODY_TICKS_PER_BEAT);
      const key = add(attr, "key");
      add(key, "fifths", notation.keySignature);
      add(key, "mode", getTonality(settings.tonalityId)!.mode);
      const time = add(attr, "time");
      add(time, "beats", exercise.timeSignature[0]);
      add(time, "beat-type", exercise.timeSignature[1]);
      const clef = add(attr, "clef");
      const written = clefs[clefKeys.indexOf(exercise.clef)];
      add(clef, "sign", written.sign);
      add(clef, "line", written.line);
      add(measure, "sound", undefined, { tempo: exercise.bpm });
    }
    const chord = exercise.harmony?.bars[bar];
    if (chord) {
      const harmony = add(measure, "harmony");
      const root = add(harmony, "root");
      const tonic = chord.tones[0];
      add(root, "root-step", tonic.name);
      if (tonic.accidental === "sharp" || tonic.accidental === "flat")
        add(root, "root-alter", tonic.accidental === "sharp" ? 1 : -1);
      add(harmony, "kind", chord.quality);
    }
    return measure;
  });
  notation.events.forEach((event, i) => {
    const note = add(bars[event.barIndex!], "note");
    const head = event.notes[0];
    if (head) {
      const pitch = add(note, "pitch");
      add(pitch, "step", head.step);
      if (head.alter) add(pitch, "alter", head.alter);
      add(pitch, "octave", head.octave);
    } else add(note, "rest");
    add(
      note,
      "duration",
      Math.round(exercise.events[i].durationBeats * MELODY_TICKS_PER_BEAT),
    );
    add(note, "voice", 1);
    add(note, "type", noteTypes[event.duration]);
    if (event.dots) add(note, "dot");
    if (event.tuplet) {
      const ratio = add(note, "time-modification");
      add(ratio, "actual-notes", event.tuplet.numerator);
      add(ratio, "normal-notes", event.tuplet.denominator);
      const id = event.tuplet.groupId;
      const first = notation.events[i - 1]?.tuplet?.groupId !== id;
      const last = notation.events[i + 1]?.tuplet?.groupId !== id;
      if (first || last) {
        const signs = add(note, "notations");
        if (first) add(signs, "tuplet", undefined, { type: "start" });
        if (last) add(signs, "tuplet", undefined, { type: "stop" });
      }
    }
  });
  return parseScoreDocument(writer.document);
}
