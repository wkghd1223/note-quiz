import { writtenNote, type NotationScore } from "./score";

export interface LegacyStaffInput {
  clef: ClefType;
  keySignature: KeySignature;
  /** Already key-adjusted displayNote, never apply the key a second time. */
  note?: Note;
  originalNote?: Note;
}

export function legacyToScore({
  clef,
  keySignature,
  note,
  originalNote,
}: LegacyStaffInput): NotationScore {
  let explicit = originalNote?.accidental ?? null;
  // Legacy displays naturals only when cancelling a key-signature alteration.
  if (
    explicit === "natural" &&
    !keySignature.sharps.includes(originalNote!.name) &&
    !keySignature.flats.includes(originalNote!.name)
  )
    explicit = null;
  return {
    clef,
    keySignature: keySignature.sharps.length - keySignature.flats.length,
    events: note
      ? [
          {
            id: "legacy-note",
            duration: 4,
            notes: [writtenNote(note, explicit)],
          },
        ]
      : [],
  };
}
