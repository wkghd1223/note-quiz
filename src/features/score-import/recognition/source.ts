import { MAX_FILE_BYTES } from "../archive";
import { createScoreWriter } from "../formats/writer";
import { parseScoreDocument } from "../model";
import {
  resolveReading,
  type ReadingContext,
  type StaffReading,
} from "./reading";
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

/** Build the score only after every missing signature has been confirmed. */
export function scoreFromReading(
  reading: StaffReading,
  context: ReadingContext,
) {
  const { bars, hasPickup } = resolveReading(reading, context);
  const { document: doc, add, part: makePart } = createScoreWriter();
  const part = makePart("P1", "1");
  bars.forEach((events, index) => {
    const measure = add(part, "measure", undefined, { number: index + 1 });
    if (hasPickup && (index === 0 || index === bars.length - 1))
      measure.setAttribute("implicit", "yes");
    if (index === 0) {
      const attributes = add(measure, "attributes");
      add(attributes, "divisions", 4);
      add(add(attributes, "key"), "fifths", context.fifths);
      const time = add(attributes, "time");
      add(time, "beats", context.meter.beats);
      add(time, "beat-type", context.meter.beatType);
      if (context.meter.symbol)
        time.setAttribute("symbol", context.meter.symbol);
      const clef = add(attributes, "clef");
      add(clef, "sign", context.clef);
      add(clef, "line", context.clef === "G" ? 2 : 4);
    }
    for (const event of events) {
      const heads = event.heads.length ? event.heads : [null];
      for (const [headIndex, head] of heads.entries()) {
        const note = add(measure, "note");
        if (headIndex) add(note, "chord");
        if (head) {
          const pitch = add(note, "pitch");
          add(pitch, "step", head.step);
          if (head.alter) add(pitch, "alter", head.alter);
          add(pitch, "octave", head.octave);
        } else {
          const rest = add(note, "rest");
          if (event.type === "whole" && events.length === 1)
            rest.setAttribute("measure", "yes");
        }
        add(note, "duration", event.beats * 4);
        add(note, "type", event.type);
        if (event.dotted) add(note, "dot");
        if (head?.accidental != null)
          add(
            note,
            "accidental",
            head.accidental === 0
              ? "natural"
              : head.accidental > 0
                ? "sharp"
                : "flat",
          );
      }
    }
  });
  return parseScoreDocument(doc);
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
    const result = await new Promise<StaffReading>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<StaffReading | null>) =>
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
    return result;
  } finally {
    removeAbort?.();
    worker.terminate();
  }
}
