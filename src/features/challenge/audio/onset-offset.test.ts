import { describe, expect, it } from "vitest";
import { NoteEventDetector } from "./onset-offset";
import type { InputFrame, PerformanceEvent } from "../domain/performance";

const frame = (time: number, exactMidi: number | null): InputFrame => ({
  streamSampleIndex: Math.round(time * 48000),
  audioTimeSec: time,
  rms: 0.1,
  detectedHz: exactMidi === null ? null : 440 * 2 ** ((exactMidi - 69) / 12),
  confidence: exactMidi === null ? 0 : 0.99,
  isVoiced: exactMidi !== null,
});

function acquireThroughRoundingBoundaries(detector: NoteEventDetector) {
  const events: PerformanceEvent[] = [];
  for (const [time, midi] of [[1, 67], [1.02, 48.55], [1.04, 48.44], [1.08, 47.45], [1.1, 48.2], [1.17, 48.2]]) {
    events.push(...detector.accept(frame(time, midi)));
  }
  return events;
}

describe("initial pitch acquisition versus confirmed legato", () => {
  it("retains the first continuous departure through rounded candidates without moving the energy onset/frontier", () => {
    const detector = new NoteEventDetector();
    detector.reset("acquire", 0.001);
    expect(acquireThroughRoundingBoundaries(detector)).toEqual([]);
    expect(detector.finalizedBeforeAudioSec).toBe(1);
    const [event] = detector.flush(1.3);
    expect(event).toMatchObject({ eventId: "acquire-1", onsetAudioSec: 1, offsetAudioSec: 1.3, observedMidi: 48, attackConfidence: 1 });
    expect(event.pitchSamples).toHaveLength(6);
  });

  it("still debounces genuine later legato at its own boundary and never mutates a closed event", () => {
    const detector = new NoteEventDetector();
    detector.reset("legato", 0.001);
    const events = acquireThroughRoundingBoundaries(detector);
    for (const time of [1.25, 1.4]) events.push(...detector.accept(frame(time, 48)));
    events.push(...detector.accept(frame(1.5, 50)));
    expect(events).toEqual([]);
    events.push(...detector.accept(frame(1.559, 50)));
    expect(events).toEqual([]);
    events.push(...detector.accept(frame(1.57, 50)));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ onsetAudioSec: 1, offsetAudioSec: 1.5, observedMidi: 48 });
    const closed = JSON.stringify(events[0]);
    expect(detector.finalizedBeforeAudioSec).toBe(1.5);
    detector.accept(frame(1.7, 50));
    const [later] = detector.flush(1.8);
    expect(later).toMatchObject({ onsetAudioSec: 1.5, offsetAudioSec: 1.8, observedMidi: 50, attackConfidence: 0 });
    expect(JSON.stringify(events[0])).toBe(closed);
  });

  it.each([67, null])("clears early-departure evidence on return/unknown (%s) so a later change is not attack settling", (interruption) => {
    const detector = new NoteEventDetector();
    detector.reset("return", 0.001);
    detector.accept(frame(1, 67));
    detector.accept(frame(1.02, 48));
    detector.accept(frame(1.04, interruption));
    const events = [
      ...detector.accept(frame(1.2, 48)),
      ...detector.accept(frame(1.27, 48)),
      ...detector.flush(1.4),
    ];
    expect(events).toHaveLength(2);
    expect(events[0].offsetAudioSec).toBe(1.2);
    expect(events[1]).toMatchObject({ onsetAudioSec: 1.2, observedMidi: 48, attackConfidence: 0 });
  });

  it("clears acquisition evidence across detector reset", () => {
    const detector = new NoteEventDetector();
    detector.reset("old", 0.001);
    detector.accept(frame(1, 67));
    detector.accept(frame(1.02, 48));
    detector.reset("new", 0.001);
    detector.accept(frame(2, 67));
    detector.accept(frame(2.2, 48));
    const events = [...detector.accept(frame(2.27, 48)), ...detector.flush(2.4)];
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ eventId: "new-1", onsetAudioSec: 2, offsetAudioSec: 2.2 });
    expect(events[1]).toMatchObject({ eventId: "new-2", onsetAudioSec: 2.2 });
  });

  it("preserves the existing brief-quiet hysteresis during initial acquisition", () => {
    const detector = new NoteEventDetector();
    detector.reset("quiet", 0.001);
    detector.accept(frame(1, 67));
    detector.accept(frame(1.02, 48));
    detector.accept({ ...frame(1.055, null), rms: 0 });
    const events = [
      ...detector.accept(frame(1.065, 48)),
      ...detector.accept(frame(1.09, 48)),
      ...detector.flush(1.3),
    ];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ onsetAudioSec: 1, offsetAudioSec: 1.3, observedMidi: 48, attackConfidence: 1 });
  });
});
