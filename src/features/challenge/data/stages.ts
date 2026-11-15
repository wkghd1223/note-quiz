import type { Skill, StageDefinition } from "../domain/stage";

// Authored educational content. Rests cover all time, including unscored rests.
type Pattern = [number | null, number][];
const patterns: Pattern[] = [
  [[60, 4]],
  [
    [60, 2],
    [62, 2],
  ],
  [
    [60, 2],
    [62, 1],
    [64, 1],
  ],
  [
    [64, 2],
    [67, 2],
  ],
  [
    [67, 1],
    [64, 1],
    [62, 1],
    [60, 1],
  ],
  [
    [60, 2],
    [62, 2],
    [64, 2],
    [67, 2],
  ],
  [
    [60, 2],
    [62, 2],
  ],
  [
    [60, 1],
    [62, 1],
    [64, 1],
    [67, 1],
  ],
  [
    [60, 2],
    [62, 1],
    [64, 1],
  ],
  [[67, 4]],
  [
    [64, 1],
    [62, 1],
    [60, 2],
  ],
  [
    [60, 4],
    [62, 2],
    [64, 1],
    [67, 1],
  ],
  [
    [60, 1],
    [null, 3],
  ],
  [
    [60, 1],
    [62, 1],
    [64, 1],
    [67, 1],
  ],
  [
    [60, 1],
    [60, 1],
    [62, 2],
  ],
  [
    [null, 2],
    [64, 2],
  ],
  [
    [62, 1],
    [64, 1],
    [67, 2],
  ],
  [
    [60, 1],
    [60, 1],
    [null, 2],
    [64, 2],
    [67, 2],
  ],
  [
    [60, 1],
    [62, 1],
    [64, 1],
    [67, 1],
  ],
  [
    [60, 1],
    [60, 1],
    [62, 1],
    [64, 1],
  ],
  [
    [60, 1],
    [null, 1],
    [64, 1],
    [67, 1],
  ],
  [
    [60, 1],
    [62, 1],
    [64, 2],
    [67, 1],
    [64, 1],
    [60, 2],
  ],
  [
    [60, 2],
    [null, 1],
    [62, 1],
    [64, 1],
    [67, 1],
    [64, 2],
  ],
  [
    [60, 1],
    [62, 1],
    [64, 1],
    [null, 1],
    [67, 1],
    [64, 1],
    [62, 1],
    [60, 1],
  ],
];
const bpms = [
  60, 60, 60, 65, 65, 70, 60, 65, 65, 70, 70, 75, 60, 65, 65, 70, 70, 75, 75,
  75, 80, 80, 80, 85,
];
const spelling: Record<number, string> = {
  60: "C4",
  62: "D4",
  64: "E4",
  67: "G4",
};
export const stages: StageDefinition[] = patterns.map((pattern, index) => {
  const world = (Math.floor(index / 6) + 1) as StageDefinition["world"];
  const sequence = (index % 6) + 1;
  const id = `w${world}-s${sequence}`;
  const required: Skill[] = ["pitch", "duration"];
  if (world >= 3) required.push("onset");
  if (
    (world === 3 && sequence === 6) ||
    (world === 4 && [3, 5, 6].includes(sequence))
  )
    required.push("rest");
  if (
    (world === 3 && [3, 6].includes(sequence)) ||
    (world === 4 && sequence === 2)
  )
    required.push("rearticulation");
  let cursor = 0;
  const events = pattern.map(([midi, durationBeats], i) => {
    const event = {
      id: `${id}-e${i + 1}`,
      kind: midi === null ? ("rest" as const) : ("note" as const),
      startBeat: cursor,
      durationBeats,
      ...(midi === null
        ? {}
        : { writtenMidi: midi, writtenSpelling: spelling[midi] }),
    };
    cursor += durationBeats;
    return event;
  });
  return {
    id,
    world,
    sequence,
    titleKey: `challenge.w${world}s${sequence}.title`,
    objectiveKey: `challenge.w${world}s${sequence}.objective`,
    lessonTags: [...required],
    timeSignature: [4, 4],
    measures: cursor / 4,
    bpm: bpms[index],
    clef: "treble",
    keySignature: "C",
    events,
    scoring: {
      version: 1,
      required,
      thresholds: world < 3 ? "easy-v1" : "normal-v1",
    },
    supportedInputProfiles: ["sustained-mic-v1", "touch-keyboard-v1"],
    prerequisites:
      index === 0
        ? []
        : [`w${Math.floor((index - 1) / 6) + 1}-s${((index - 1) % 6) + 1}`],
  };
});
export const getStage = (id: string): StageDefinition | undefined =>
  stages.find((stage) => stage.id === id);
