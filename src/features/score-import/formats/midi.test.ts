import { afterEach, describe, expect, it, vi } from "vitest";
import { stubScoreDocument } from "@/test/score-document";
import { parseScoreDocument } from "../model";
import { prepareScore } from "../timeline";
import { readMidi } from "./midi-file";
import { midiToMusicXml } from "./midi";

const ascii = (text: string) => [...new TextEncoder().encode(text)];
const end = [0, 0xff, 0x2f, 0];
const chunk = (name: string, bytes: number[]) => [
  ...ascii(name),
  (bytes.length >>> 24) & 255,
  (bytes.length >>> 16) & 255,
  (bytes.length >>> 8) & 255,
  bytes.length & 255,
  ...bytes,
];
const smf = (
  tracks: number[][],
  format = tracks.length > 1 ? 1 : 0,
  division = 48,
) =>
  Uint8Array.from([
    ...chunk("MThd", [
      0,
      format,
      0,
      tracks.length,
      division >> 8,
      division & 255,
    ]),
    ...tracks.flatMap((track) => chunk("MTrk", track)),
  ]);
const name = (text: string) => [0, 0xff, 3, text.length, ...ascii(text)];

afterEach(() => vi.unstubAllGlobals());

describe("Standard MIDI file import", () => {
  it("turns a multitrack performance into editable bars with exact chord, rest and tempo timing", () => {
    stubScoreDocument();
    const conductor = [
      name("Trio"),
      [0, 0xff, 0x58, 4, 3, 2, 24, 8],
      [48, 0xff, 0x51, 3, 0x0f, 0x42, 0x40], // 60 BPM at quarter 1
      [24, 0xff, 0x59, 2, 254, 1], // two flats, minor
      [24, 0xff, 0x58, 4, 2, 2, 24, 8], // 2/4 before the 3/4 bar completes
      end,
    ].flat();
    const piano = [
      name("Piano"),
      [24, 0x90, 60, 90],
      [0, 64, 72], // C and E together
      [48, 64, 0],
      [24, 67, 80], // lift E, then add G
      [96, 0x80, 60, 20],
      [24, 67, 0],
      [24, 0xff, 0x2f, 0],
    ].flat();
    const bass = [...name("Bass"), 0, 0x92, 38, 80, 48, 38, 0, ...end];
    const score = parseScoreDocument(
      midiToMusicXml(smf([conductor, piano, bass])),
    );
    expect(score.title).toBe("Trio");
    expect(score.issues).toEqual([]);
    expect(score.lanes.map((lane) => lane.label)).toEqual(["Piano", "Bass"]);
    const lane = score.lanes[0];
    expect(lane.bars.map((bar) => [bar.duration, bar.meter.beats])).toEqual([
      [2, 3],
      [2, 2],
      [1, 2],
    ]);
    expect(lane.bars[1].fifths).toBe(-2);
    expect(lane.bars[1].keyMode).toBe("minor");
    expect(score.lanes[1].bars[0].clef.sign).toBe("F");
    const timeline = prepareScore(score, lane.id, {
      fromBar: 0,
      toBar: 2,
      speed: 1,
      semitones: 0,
      repeats: true,
    });
    expect(timeline.notes).toEqual([
      { midi: 60, startSec: 0.25, endSec: 3.5 },
      { midi: 64, startSec: 0.25, endSec: 1 },
      { midi: 67, startSec: 1.5, endSec: 4 },
    ]);
    expect(
      timeline.targets.map((t) => [t.startSec, t.endSec, t.midis]),
    ).toEqual([
      [0, 0.25, []],
      [0.25, 1, [60, 64]],
      [1, 1.5, [60]],
      [1.5, 3.5, [60, 67]],
      [3.5, 4, [67]],
      [4, 4.5, []],
    ]);
  });

  it("uses the longest chord head as leader and retains off-grid release times", () => {
    stubScoreDocument();
    const track = [
      [0, 0x90, 60, 80],
      [0, 64, 80],
      [17, 60, 0],
      [31, 64, 0],
      end,
    ].flat();
    const score = parseScoreDocument(midiToMusicXml(smf([track])));
    expect(score.issues).toEqual([]);
    const event = score.lanes[0].bars[0].events[0];
    expect(event.heads.map((head) => [head.midi, head.duration])).toEqual([
      [64, 1],
      [60, 17 / 48],
    ]);
    expect(event.duration).toBe(1);
  });

  it("applies the sustain pedal across tracks and gives a re-attacked key a new onset", () => {
    const pedal = [0, 0xb1, 64, 127, 96, 64, 0, ...end];
    const notes = [0, 0x91, 65, 80, 24, 65, 0, 24, 65, 90, 12, 65, 0, ...end];
    expect(readMidi(smf([pedal, notes])).parts[0].notes).toEqual([
      { pitch: 65, start: 0, end: 48 },
      { pitch: 65, start: 48, end: 96 },
    ]);
  });

  it("keeps independent tracks playing a unison, handles multi-byte deltas and skips SysEx", () => {
    const a = [
      [0, 0xf0, 2, 0x7d, 0xf7],
      [0, 0x90, 60, 100],
      [0x81, 0, 60, 0],
      end,
    ].flat();
    const b = [12, 0x90, 60, 90, 12, 60, 0, ...end];
    expect(readMidi(smf([a, b])).parts.map((p) => p.notes)).toEqual([
      [{ pitch: 60, start: 0, end: 128 }],
      [{ pitch: 60, start: 12, end: 24 }],
    ]);
  });

  it("separates channels in type 0 and omits General MIDI percussion", () => {
    const notes = [
      [0, 0x99, 36, 80],
      [0, 0x92, 50, 90],
      [0, 0x90, 70, 90],
      [48, 0x80, 70, 0],
      [0, 0x82, 50, 0],
      [0, 0x89, 36, 0],
      end,
    ].flat();
    const bytes = smf([notes]);
    expect(
      readMidi(bytes).parts.map((p) => [p.channel, p.notes[0].pitch]),
    ).toEqual([
      [0, 70],
      [2, 50],
    ]);
    expect(() => readMidi(smf([[0, 0x99, 36, 80, 48, 36, 0, ...end]]))).toThrow(
      "noNotes",
    );
  });

  it("restricts only the sounding bars and lanes affected by pitch wheel or channel tuning", () => {
    stubScoreDocument();
    const bent = [
      name("Bend"),
      [0, 0xe0, 0, 64],
      [0, 0x90, 60, 80],
      [48, 60, 0],
      [0, 0xe0, 127, 127],
      [96, 0xe0, 0, 64], // bend in a rest
      [48, 0x90, 62, 80],
      [24, 0xe0, 127, 127],
      [24, 0x90, 62, 0],
      [0, 0xb0, 121, 0], // reset controllers
      [0x81, 16, 0xb0, 101, 0],
      [0, 100, 2],
      [0, 6, 65], // +1 semitone
      [0, 0x90, 64, 80],
      [48, 64, 0],
      [0, 0xb0, 6, 64],
      [0x81, 16, 0xb0, 100, 1],
      [0, 38, 1], // fine tuning +1/8192
      [0, 0x90, 65, 80],
      [48, 65, 0],
      end,
    ].flat();
    const plain = [name("Melody"), [0, 0x92, 67, 80], [96, 67, 0], end].flat();
    const drums = [
      [0, 0xe9, 127, 127],
      [0, 0x99, 36, 80],
      [48, 36, 0],
      end,
    ].flat();
    const score = parseScoreDocument(midiToMusicXml(smf([bent, plain, drums])));
    expect(score.lanes.map((l) => l.label)).toEqual(["Bend", "Melody"]);
    expect(score.issues.map((i) => [i.partId, i.barIndex, i.code])).toEqual([
      ["P1", 1, "pitch"],
      ["P1", 2, "pitch"],
      ["P1", 3, "pitch"],
    ]);
    const settings = {
      fromBar: 0,
      toBar: 3,
      semitones: 0,
      repeats: true,
      speed: 1,
    };
    expect(() => prepareScore(score, score.lanes[0].id, settings)).toThrow(
      "unsupportedNotation",
    );
    expect(
      prepareScore(score, score.lanes[0].id, { ...settings, toBar: 0 }).notes,
    ).toHaveLength(1);
    expect(prepareScore(score, score.lanes[1].id, settings).notes).toHaveLength(
      1,
    );
  });

  it("excludes GM2 and XG drums selected on other channels", () => {
    const first = [
      [0, 0xb0, 0, 120],
      [0, 0xc0, 1],
      [0, 0x90, 36, 80],
      [48, 36, 0],
      [0, 0xb0, 0, 127],
      [0, 0xc0, 1],
      [0, 0x90, 38, 80],
      [48, 38, 0],
      [0, 0xb0, 0, 121],
      [0, 0xc0, 0],
      [0, 0x90, 65, 80],
      [48, 65, 0],
      end,
    ].flat();
    expect(readMidi(smf([first])).parts[0].notes).toEqual([
      { pitch: 65, start: 96, end: 144 },
    ]);
  });

  it("rejects independent patterns and SMPTE divisions explicitly", () => {
    expect(() => readMidi(smf([end], 2))).toThrow("unsupportedFile");
    expect(() => readMidi(smf([end], 0, 0xe728))).toThrow("unsupportedFile");
  });

  it.each([
    [0, 60, 90, ...end], // data without running status
    [0, 0x90, 60, 0x90, ...end], // status embedded inside message
    [0x81, 0x81, 0x81, 0x81, 0, 0xff, 0x2f, 0], // overlong delta
    [0, 0xff, 0x51, 8, 5, 1, 2, ...end], // truncated meta payload
    [0, 0x90, 60, 90], // missing end-of-track
  ])("rejects malformed track data", (...data: number[]) => {
    expect(() => readMidi(smf([data]))).toThrow("invalidFile");
  });

  it("bounds expansion of huge rests before constructing a DOM", () => {
    const data = [0, 0x90, 60, 90, 0xff, 0xff, 0xff, 0x7f, 60, 0, ...end];
    expect(() => midiToMusicXml(smf([data]))).toThrow("fileTooLarge");
    expect(() => midiToMusicXml(smf([data]), AbortSignal.abort())).toThrow();
  });
});
