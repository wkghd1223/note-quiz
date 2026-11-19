import type { ImportWords } from "./copy";

export function reason(error: unknown) {
  return error instanceof Error ? error.message : "invalidFile";
}

export function fileMessage(code: string, w: ImportWords) {
  if (code === "noNotes") return w.noNotes;
  if (code === "invalidRange") return w.outOfRange;
  if (code === "fileTooLarge" || code === "tooLong") return w.tooLarge;
  if (code === "unsupportedNotation") return w.limited;
  return w.invalidFile;
}
