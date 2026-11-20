import { MAX_FILE_BYTES } from "../archive";
import { createScoreWriter } from "../formats/writer";
import type { recognizeStaff } from "./engine";
import { fitPage, MAX_RENDER_PIXELS, readImageSize } from "./raster";

export const recognitionExtensions = ".png,.jpg,.jpeg,.pdf";

export function isRecognitionFile(file: File) {
  return (
    /\.(png|jpe?g|pdf)$/i.test(file.name) ||
    ["image/png", "image/jpeg", "application/pdf"].includes(file.type)
  );
}

export interface RecognitionSource {
  pageCount: number;
  render(page: number, signal: AbortSignal): Promise<HTMLCanvasElement>;
  close(): void;
}

export async function openRecognitionSource(
  file: File,
  signal: AbortSignal,
): Promise<RecognitionSource> {
  signal.throwIfAborted();
  if (file.size > MAX_FILE_BYTES) throw new Error("fileTooLarge");
  const bytes = new Uint8Array(await file.arrayBuffer());
  signal.throwIfAborted();
  // Use the file header even when the browser supplies a generic MIME type.
  const prefix = new TextDecoder().decode(bytes.subarray(0, 1024));
  if (
    prefix.trimStart().startsWith("%PDF-") ||
    file.type === "application/pdf" ||
    /\.pdf$/i.test(file.name)
  ) {
    const { openPdfSource } = await import("./pdf-source");
    signal.throwIfAborted();
    return openPdfSource(bytes, signal);
  }
  readImageSize(bytes);
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  try {
    signal.throwIfAborted();
    const size = fitPage(bitmap.width, bitmap.height);
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("invalidFile");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  } finally {
    bitmap.close();
  }
  return {
    pageCount: 1,
    async render(page, renderSignal) {
      renderSignal.throwIfAborted();
      if (page !== 1) throw new Error("invalidRange");
      return canvas;
    },
    close() {
      canvas.width = canvas.height = 0;
    },
  };
}

type Recognition = ReturnType<typeof recognizeStaff>;

function musicXml(result: Recognition): File {
  const writer = createScoreWriter();
  const part = writer.part("P1", "1");
  const add = writer.add;
  result.bars.forEach((notes, index) => {
    const measure = add(part, "measure", undefined, { number: index + 1 });
    if (index === 0) {
      const attributes = add(measure, "attributes");
      add(attributes, "divisions", 1);
      const key = add(attributes, "key");
      add(key, "fifths", 0);
      const time = add(attributes, "time");
      add(time, "beats", 4);
      add(time, "beat-type", 4);
      const clef = add(attributes, "clef");
      add(clef, "sign", "G");
      add(clef, "line", 2);
    }
    for (const { step, octave, beats } of notes) {
      const note = add(measure, "note");
      const pitch = add(note, "pitch");
      add(pitch, "step", step);
      add(pitch, "octave", octave);
      add(note, "duration", beats);
      add(
        note,
        "type",
        ({ 1: "quarter", 2: "half", 4: "whole" } as const)[beats],
      );
    }
  });
  return new File(
    [new XMLSerializer().serializeToString(writer.document)],
    "score.musicxml",
    { type: "application/vnd.recordare.musicxml+xml" },
  );
}

export async function recognizePage(
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (canvas.width * canvas.height > MAX_RENDER_PIXELS)
    throw new Error("fileTooLarge");
  const pixels = canvas
    .getContext("2d")
    ?.getImageData(0, 0, canvas.width, canvas.height);
  if (!pixels) throw new Error("invalidFile");
  const worker = new Worker(new URL("./recognize.worker.ts", import.meta.url));
  let removeAbort: (() => void) | undefined;
  try {
    const result = await new Promise<Recognition>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<Recognition | null>) =>
        data ? resolve(data) : reject(new Error("unsupportedNotation"));
      worker.onerror = () => reject(new Error("invalidFile"));
      worker.onmessageerror = () => reject(new Error("invalidFile"));
      signal.addEventListener("abort", onAbort, { once: true });
      function onAbort() {
        reject(signal.reason);
      }
      removeAbort = () => signal.removeEventListener("abort", onAbort);
      worker.postMessage(pixels, [pixels.data.buffer]);
    });
    signal.throwIfAborted();
    return musicXml(result);
  } finally {
    removeAbort?.();
    worker.terminate();
  }
}
