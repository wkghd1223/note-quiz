import { writtenNote, type NotationScore } from "./score";

export function theoryToScore(
  notes: readonly Note[],
  chord = false,
): NotationScore {
  const written = notes.map((note) =>
    writtenNote(note, note.accidental === "natural" ? null : note.accidental),
  );
  return {
    clef: "treble",
    keySignature: 0,
    events: chord
      ? [{ id: "theory-chord", duration: 4, notes: written }]
      : written.map((note, i) => ({
          id: `theory-note-${i}`,
          duration: 4,
          notes: [note],
        })),
  };
}
