import { decodeXml, MAX_FILE_BYTES } from "../archive";
import { archiveDocument } from "./container";
import { readXml } from "./xml";
import type { ScoreFormat } from "../types";

interface ScoreAdapter<T> {
  format: ScoreFormat;
  extensions: readonly string[];
  matches: (source: T) => boolean;
  toMusicXml: (
    source: T,
    signal?: AbortSignal,
  ) => XMLDocument | Promise<XMLDocument>;
}

const xmlAdapters: ScoreAdapter<XMLDocument>[] = [
  {
    format: "musicxml",
    extensions: [".musicxml", ".xml", ".mxl"],
    matches: (doc) =>
      ["score-partwise", "score-timewise"].includes(
        doc.documentElement.localName,
      ),
    toMusicXml: (doc) => doc,
  },
  {
    format: "musescore",
    extensions: [".mscx", ".mscz"],
    matches: (doc) => doc.documentElement.localName === "museScore",
    async toMusicXml(doc, signal) {
      const { museScoreToMusicXml } = await import("./musescore");
      signal?.throwIfAborted();
      return museScoreToMusicXml(doc, signal);
    },
  },
];

const binaryAdapters: ScoreAdapter<Uint8Array>[] = [
  {
    format: "midi",
    extensions: [".mid", ".midi"],
    matches: (bytes) =>
      bytes[0] === 0x4d &&
      bytes[1] === 0x54 &&
      bytes[2] === 0x68 &&
      bytes[3] === 0x64, // MThd
    async toMusicXml(bytes, signal) {
      const { midiToMusicXml } = await import("./midi");
      signal?.throwIfAborted();
      return midiToMusicXml(bytes, signal);
    },
  },
];

export const acceptedScoreFiles = [...xmlAdapters, ...binaryAdapters]
  .flatMap((adapter) => adapter.extensions)
  .join(",");

async function adapt<T>(
  adapter: ScoreAdapter<T>,
  source: T,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const document = await adapter.toMusicXml(source, signal);
  signal?.throwIfAborted();
  return { document, format: adapter.format };
}

export async function readScoreDocument(file: File, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (file.size > MAX_FILE_BYTES) throw new Error("fileTooLarge");
  const bytes = new Uint8Array(await file.arrayBuffer());
  signal?.throwIfAborted();
  const binary = binaryAdapters.find((adapter) => adapter.matches(bytes));
  if (binary) return adapt(binary, bytes, signal);
  const doc =
    bytes[0] === 0x50 && bytes[1] === 0x4b
      ? await archiveDocument(bytes, file.name, signal)
      : readXml(decodeXml(bytes));
  const adapter = xmlAdapters.find((adapter) => adapter.matches(doc));
  if (!adapter) throw new Error("unsupportedFile");
  return adapt(adapter, doc, signal);
}
