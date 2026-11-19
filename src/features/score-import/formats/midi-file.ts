import { MAX_FILE_BYTES } from "../archive";
import { MidiPitchChanges } from "./midi-channel";

function invalid(): never {
  throw new Error("invalidFile");
}

class Reader {
  position = 0;
  constructor(readonly bytes: Uint8Array) {}

  take(length: number) {
    const start = this.position;
    if (length > this.bytes.length - start) invalid();
    this.position += length;
    return this.bytes.subarray(start, this.position);
  }

  byte() {
    if (this.position >= this.bytes.length) invalid();
    return this.bytes[this.position++];
  }

  dataByte() {
    const value = this.byte();
    if (value >= 128) invalid();
    return value;
  }

  variableLength() {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const byte = this.byte();
      value = value * 128 + (byte & 127);
      if (byte < 128) return value;
    }
    return invalid();
  }

  chunk() {
    const type = String.fromCharCode(...this.take(4));
    const [a, b, c, d] = this.take(4);
    return { type, data: this.take(((a * 256 + b) * 256 + c) * 256 + d) };
  }
}

export interface MidiNote {
  pitch: number;
  start: number;
  end: number;
}

export interface MidiPart {
  track: number;
  port: number;
  channel: number;
  name: string;
  notes: MidiNote[];
  pitchChanges: MidiPitchChanges["spans"];
}

export interface MidiMark<T> {
  tick: number;
  value: T;
}

export interface MidiMeter {
  beats: number;
  beatType: number;
}

export interface MidiKey {
  fifths: number;
  minor: boolean;
}

export interface MidiFile {
  ppq: number;
  title: string;
  parts: MidiPart[];
  end: number;
  tempos: MidiMark<number>[];
  meters: MidiMark<MidiMeter>[];
  keys: MidiMark<MidiKey>[];
}

interface ChannelEvent {
  tick: number;
  track: number;
  port: number;
  status: number;
  key: number;
  value: number;
}

const MAX_EVENTS = 500_000;
const MAX_TRACKS = 4096;
const handledControllers = new Set([
  0, 6, 38, 64, 96, 97, 98, 99, 100, 101, 120, 121, 123, 124, 125, 126, 127,
]);

// Keep the last change at a tick, including an explicit override of a default.
function ordered<T>(marks: MidiMark<T>[], initial: T): MidiMark<T>[] {
  const result = [{ tick: 0, value: initial }];
  for (const mark of marks.sort((a, b) => a.tick - b.tick)) {
    if (result[result.length - 1].tick === mark.tick) result.pop();
    result.push(mark);
  }
  return result;
}

interface SoundingNote {
  part: MidiPart;
  pitch: number;
  start: number;
  released: boolean;
  pendingOffs: number;
}

function collectParts(events: ChannelEvent[], names: string[], end: number) {
  const parts = new Map<string, MidiPart>();
  // Controllers address the whole port/channel. Keep each track's unison
  // separate so two selectable parts can legitimately play the same pitch.
  const channels = new Map<
    number,
    {
      pedal: boolean;
      bank: number;
      percussion: boolean;
      pitchChanges: MidiPitchChanges;
      pitches: Map<number, Map<number, SoundingNote>>;
    }
  >();
  function finish(note: SoundingNote, tick: number) {
    if (tick > note.start)
      note.part.notes.push({ pitch: note.pitch, start: note.start, end: tick });
  }
  let controllerVisits = 0;
  for (const event of events.sort((a, b) => a.tick - b.tick)) {
    const { track, port, tick, key, value, status } = event;
    const channel = status & 15;
    const id = port * 16 + channel;
    let state = channels.get(id);
    if (!state) {
      state = {
        pedal: false,
        bank: 0,
        percussion: channel === 9,
        pitchChanges: new MidiPitchChanges(),
        pitches: new Map(),
      };
      channels.set(id, state);
    }
    const type = status >> 4;
    if (type === 14) {
      state.pitchChanges.pitchWheel(tick, key, value);
      continue;
    }
    if (type === 12) {
      // General MIDI 2 uses bank MSB 120 for kits, Yamaha XG uses 126/127.
      state.percussion =
        [120, 126, 127].includes(state.bank) ||
        (channel === 9 && state.bank !== 121);
      continue;
    }
    if (type === 11) {
      if (key === 0) {
        state.bank = value;
        continue;
      }
      state.pitchChanges.control(tick, key, value);
      if (key !== 64 && key < 120) continue;
      if (key === 64 && value >= 64) {
        state.pedal = true;
        continue;
      }
      const releasePedal = key === 64 || key === 121;
      if (releasePedal && !state.pedal) continue;
      if (releasePedal) state.pedal = false;
      for (const [pitch, voices] of state.pitches) {
        for (const [owner, note] of voices) {
          if (++controllerVisits > MAX_EVENTS * 8)
            throw new Error("fileTooLarge");
          if (releasePedal && !note.released) continue;
          if (key !== 120 && state.pedal) {
            note.released = true;
            note.pendingOffs = 1;
          } else {
            finish(note, tick);
            voices.delete(owner);
          }
        }
        if (!voices.size) state.pitches.delete(pitch);
      }
      continue;
    }
    let voices = state.pitches.get(key);
    if (type === 9 && value > 0) {
      if (state.percussion) continue;
      if (!voices) {
        voices = new Map();
        state.pitches.set(key, voices);
      }
      const previous = voices.get(track);
      if (previous) finish(previous, tick);
      const pendingOffs =
        previous && !previous.released ? previous.pendingOffs + 1 : 1;
      const partId = [track, port, channel].join("/");
      let part = parts.get(partId);
      if (!part) {
        part = {
          track,
          port,
          channel,
          name: names[track] || "",
          notes: [],
          pitchChanges: state.pitchChanges.spans,
        };
        parts.set(partId, part);
      }
      voices.set(track, {
        part,
        pitch: key,
        start: tick,
        released: false,
        pendingOffs,
      });
    } else if (voices) {
      const note =
        voices.get(track) ??
        (voices.size === 1 ? voices.values().next().value : undefined);
      if (!note || note.released || --note.pendingOffs > 0) continue;
      note.released = true;
      if (!state.pedal) {
        finish(note, tick);
        voices.delete(note.part.track);
        if (!voices.size) state.pitches.delete(key);
      }
    }
  }
  for (const state of channels.values())
    for (const voices of state.pitches.values())
      for (const note of voices.values()) finish(note, end);
  const result = [...parts.values()]
    .filter((p) => p.notes.length)
    .sort(
      (a, b) => a.track - b.track || a.port - b.port || a.channel - b.channel,
    );
  for (const part of result)
    part.notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  if (!result.length) throw new Error("noNotes");
  return result;
}

export function readMidi(bytes: Uint8Array, signal?: AbortSignal): MidiFile {
  signal?.throwIfAborted();
  if (bytes.length > MAX_FILE_BYTES) throw new Error("fileTooLarge");
  const source = new Reader(bytes);
  const header = source.chunk();
  if (header.type !== "MThd" || header.data.length < 6) invalid();
  const word = (i: number) => header.data[i] * 256 + header.data[i + 1];
  const format = word(0),
    tracks = word(2),
    ppq = word(4);
  if (format > 1 || ppq & 0x8000) throw new Error("unsupportedFile");
  if (!ppq || !tracks || (format === 0 && tracks !== 1)) invalid();
  if (tracks > MAX_TRACKS) throw new Error("fileTooLarge");
  const events: ChannelEvent[] = [];
  const tempos: MidiMark<number>[] = [],
    meters: MidiMark<MidiMeter>[] = [],
    keys: MidiMark<MidiKey>[] = [];
  const names: string[] = [];
  const decoder = new TextDecoder();
  let end = 0,
    eventCount = 0,
    track = 0;
  while (track < tracks) {
    const chunk = source.chunk();
    if (chunk.type !== "MTrk") continue;
    const input = new Reader(chunk.data);
    let tick = 0,
      running = 0,
      port = 0,
      ended = false;
    while (input.position < input.bytes.length) {
      if (++eventCount > MAX_EVENTS) throw new Error("fileTooLarge");
      if (eventCount % 1024 === 0) signal?.throwIfAborted();
      tick += input.variableLength();
      let status = input.bytes[input.position];
      if (status >= 128) input.position++;
      else if (running) status = running;
      else invalid();
      if (status >= 0x80 && status < 0xf0) {
        running = status;
        const key = input.dataByte();
        const type = status >> 4;
        const value = type === 12 || type === 13 ? 0 : input.dataByte();
        if (
          type === 8 ||
          type === 9 ||
          type === 12 ||
          type === 14 ||
          (type === 11 && handledControllers.has(key))
        )
          events.push({ tick, track, port, status, key, value });
        continue;
      }
      running = 0;
      if (status === 0xf0 || status === 0xf7) {
        input.take(input.variableLength());
        continue;
      }
      if (status !== 0xff) invalid();
      const type = input.byte();
      const data = input.take(input.variableLength());
      if (type === 0x2f) {
        if (data.length || input.position !== input.bytes.length) invalid();
        ended = true;
        break;
      }
      if (type === 3 && !names[track]) {
        names[track] = decoder
          .decode(data.subarray(0, 512))
          .replace(
            /[^\t\n\r\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu,
            "",
          )
          .trim();
      } else if (type === 0x21) {
        if (data.length !== 1) invalid();
        port = data[0];
      } else if (type === 0x51) {
        if (data.length !== 3) invalid();
        const micros = (data[0] * 256 + data[1]) * 256 + data[2];
        if (!micros) invalid();
        tempos.push({ tick, value: 60_000_000 / micros });
      } else if (type === 0x58) {
        if (data.length !== 4 || !data[0]) invalid();
        if (data[1] > 10 || data[3] !== 8) throw new Error("unsupportedFile");
        meters.push({
          tick,
          value: { beats: data[0], beatType: 2 ** data[1] },
        });
      } else if (type === 0x59) {
        const fifths = (data[0] << 24) >> 24;
        if (data.length !== 2 || Math.abs(fifths) > 7 || data[1] > 1) invalid();
        keys.push({ tick, value: { fifths, minor: data[1] === 1 } });
      }
    }
    if (!ended) invalid();
    end = Math.max(end, tick);
    track++;
  }
  return {
    title: names[0] || "",
    ppq,
    end,
    parts: collectParts(events, names, end),
    tempos: ordered(tempos, 120),
    meters: ordered(meters, { beats: 4, beatType: 4 }),
    keys: ordered(keys, { fifths: 0, minor: false }),
  };
}
