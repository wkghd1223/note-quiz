import type { ScoreChange } from "./edit-history";
import { scoreBeatOf } from "./model";
import { attributesAtStart, direct, element, fail, near } from "./score-xml";
import type { ImportedBar, ImportedEvent } from "./types";

export function attributesAtBeat(bar: ImportedBar, event?: ImportedEvent) {
  if (event && !bar.events.includes(event)) return fail();
  return direct(bar.source, "attributes").filter((a) =>
    near(scoreBeatOf(a), event?.start ?? 0),
  );
}

/** A non-leading voice can have an attribute at the same beat after a backup.
 * Use its actual position in musical time; only insert when there is no block. */
export function signatureAttributes(
  copy: Parameters<ScoreChange>[0],
  bar: ImportedBar,
  event?: ImportedEvent,
) {
  const existing = attributesAtBeat(bar, event).at(-1);
  if (existing) return copy(existing);
  if (!event || near(event.start, 0))
    return attributesAtStart(copy(bar.source));
  const note = copy(event.source);
  const attributes = element(note, "attributes");
  note.before(attributes);
  return attributes;
}
