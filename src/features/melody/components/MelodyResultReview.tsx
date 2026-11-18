"use client";
import { practiceControlSizeClassName } from "@/components/practice/SettingsControls";
import type { ExerciseDefinition } from "@/features/challenge/domain/stage";
import { beatsPerMeasure } from "@/features/challenge/domain/stage";
import type { MelodyReviewEvent, ReviewReason } from "../domain/result-review";
import type { MelodyCopy } from "../i18n";

const reasonKey = {
  wrongPitch: "reasonWrongPitch",
  tooShort: "reasonTooShort",
  tooLong: "reasonTooLong",
  early: "reasonEarly",
  late: "reasonLate",
  missed: "reasonMissed",
  noSignal: "reasonNoSignal",
  unsupportedInput: "reasonUnsupportedInput",
  missingAttack: "reasonMissingAttack",
  restViolation: "reasonRestViolation",
  pitchCorrectTooShort: "reasonPitchCorrectTooShort",
  pitchCorrectTooLong: "reasonPitchCorrectTooLong",
} satisfies Record<ReviewReason, keyof MelodyCopy>;
export function reviewEventLabel(
  event: MelodyReviewEvent,
  m: MelodyCopy,
  rest: string,
) {
  return m.reviewPosition
    .replace("{bar}", String(event.barIndex + 1))
    .replace("{ordinal}", String(event.ordinal))
    .replace("{note}", event.name ?? rest);
}
export default function MelodyResultReview({
  events,
  selectedId,
  onSelect,
  stage,
  playback,
  onListen,
  onStop,
  m,
  rest,
}: {
  events: readonly MelodyReviewEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  stage: ExerciseDefinition;
  playback: "idle" | "preparing" | "playing" | "error";
  onListen: (id: string) => void;
  onStop: () => void;
  m: MelodyCopy;
  rest: string;
}) {
  if (!events.length) return null;
  const selected = events.find((event) => event.stageEventId === selectedId);
  const barBeats = beatsPerMeasure(stage);
  const hasNotes =
    selected &&
    stage.events.some(
      (event) =>
        event.kind === "note" &&
        Math.floor(event.startBeat / barBeats) === selected.barIndex,
    );
  const playing = playback === "playing" || playback === "preparing";
  return (
    <div
      data-melody-result-review
      className="grid gap-2 border-t border-slate-100 pt-3 text-sm"
    >
      <label className="grid gap-1 font-semibold">
        {m.reviewSelect}
        <select
          value={selected?.stageEventId ?? ""}
          onChange={(event) => onSelect(event.target.value || null)}
          className="min-h-11 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
        >
          <option value="">{m.reviewPrompt}</option>
          {events.map((event) => (
            <option key={event.stageEventId} value={event.stageEventId}>
              {reviewEventLabel(event, m, rest)}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <div className="grid gap-2" aria-live="polite" aria-atomic="true">
          <p className="font-semibold">{reviewEventLabel(selected, m, rest)}</p>
          <ul className="list-inside list-disc text-slate-600">
            {selected.reasons.map((reason) => (
              <li key={reason}>{m[reasonKey[reason]]}</li>
            ))}
          </ul>
          {hasNotes && (
            <button
              type="button"
              onClick={() =>
                playing ? onStop() : onListen(selected.stageEventId)
              }
              className={`justify-self-start rounded-lg border border-slate-300 font-bold text-violet-900 ${practiceControlSizeClassName}`}
            >
              {playing ? m.reviewStop : m.reviewListen}
            </button>
          )}
          {playback === "preparing" && (
            <p role="status" className="text-xs text-slate-600">
              {m.preparingAudio}
            </p>
          )}
          {playback === "error" && (
            <p role="alert" className="text-xs text-red-800">
              {m.reviewError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
