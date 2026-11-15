import type { InputMethod } from "./performance";
import type { InputProfileId, Skill, ExerciseDefinition } from "./stage";
export interface ScoringCapabilities {
  pitch: boolean;
  onset: boolean;
  duration: boolean;
  rest: boolean;
  rearticulation: boolean;
  polyphony: boolean;
}
export interface InstrumentProfile {
  id: string;
  family: "voice" | "wind" | "bowed" | "keyboard" | "plucked" | "percussion";
  displayNameKey: string;
  clef: ExerciseDefinition["clef"];
  concertTransposeSemitones: number;
  writtenRange: [number, number];
  recommendedInput: InputMethod;
  scoringProfileId: InputProfileId;
  scoringCapabilities: ScoringCapabilities;
  attackStyle: "sustained" | "decaying" | "percussive";
}
const full: ScoringCapabilities = {
  pitch: true,
  onset: true,
  duration: true,
  rest: true,
  rearticulation: true,
  polyphony: false,
};
const make = (
  id: string,
  family: InstrumentProfile["family"],
  input: InputMethod,
  attackStyle: InstrumentProfile["attackStyle"],
  caps: ScoringCapabilities,
): InstrumentProfile => ({
  id,
  family,
  displayNameKey: `challenge.instrument.${id}`,
  clef: "treble",
  concertTransposeSemitones: 0,
  writtenRange: id === "voice" ? [48, 84] : [60, 67],
  recommendedInput: input,
  scoringProfileId:
    input === "touch"
      ? "touch-keyboard-v1"
      : attackStyle === "sustained"
        ? "sustained-mic-v1"
        : "onset-only-v1",
  scoringCapabilities: { ...caps },
  attackStyle,
});
export const instrumentProfiles: InstrumentProfile[] = [
  make("voice", "voice", "microphone", "sustained", full),
  make("flute", "wind", "microphone", "sustained", full),
  make("touch-keyboard", "keyboard", "touch", "sustained", full),
  make("piano-mic", "keyboard", "microphone", "decaying", {
    ...full,
    duration: false,
  }),
  make("guitar-mic", "plucked", "microphone", "decaying", {
    ...full,
    duration: false,
  }),
  make("percussion-mic", "percussion", "microphone", "percussive", {
    ...full,
    pitch: false,
    duration: false,
  }),
];
export const getInstrumentProfile = (id: string) =>
  instrumentProfiles.find((profile) => profile.id === id);
export function concertMidi(
  writtenMidi: number,
  profile: InstrumentProfile,
): number {
  if (
    !Number.isInteger(writtenMidi) ||
    !Number.isInteger(profile.concertTransposeSemitones)
  )
    throw new Error("invalidPitch");
  const midi = writtenMidi + profile.concertTransposeSemitones;
  if (midi < 0 || midi > 127) throw new Error("pitchOutOfRange");
  return midi;
}
export function supportsStage(
  stage: ExerciseDefinition,
  profile: InstrumentProfile,
  input: InputMethod = profile.recommendedInput,
): boolean {
  return (
    profile.recommendedInput === input &&
    profile.concertTransposeSemitones === 0 &&
    stage.supportedInputProfiles.includes(profile.scoringProfileId) &&
    stage.scoring.required.every(
      (skill) => profile.scoringCapabilities[skill],
    ) &&
    stage.events.every(
      (event) =>
        event.kind === "rest" ||
        (event.writtenMidi! >= profile.writtenRange[0] &&
          event.writtenMidi! <= profile.writtenRange[1]),
    )
  );
}
export interface ScoringProfile {
  id: InputProfileId;
  version: 1;
  required: Skill[];
  inputMethod: InputMethod;
  supported: boolean;
  pitchToleranceCents: number;
  validPitchRatio: number;
  confidenceThreshold: number;
  onsetToleranceSec: number;
  durationToleranceRatio: number;
  restToleranceSec: number;
  attackConfidenceThreshold: number;
}
export function getScoringProfile(
  stage: ExerciseDefinition,
  inputProfileId: string,
): ScoringProfile {
  const instrument = getInstrumentProfile(inputProfileId);
  const id = instrument?.scoringProfileId ?? (inputProfileId as InputProfileId);
  const easy = stage.scoring.thresholds === "easy-v1";
  return {
    id,
    version: 1,
    required: [...stage.scoring.required],
    inputMethod: id === "touch-keyboard-v1" ? "touch" : "microphone",
    supported: instrument
      ? supportsStage(stage, instrument)
      : stage.supportedInputProfiles.includes(id),
    pitchToleranceCents: easy ? 60 : 45,
    validPitchRatio: easy ? 0.65 : 0.75,
    confidenceThreshold: 0.6,
    onsetToleranceSec: easy ? 0.18 : 0.12,
    durationToleranceRatio: easy ? 0.3 : 0.22,
    restToleranceSec: 0.12,
    attackConfidenceThreshold: 0.6,
  };
}
