import {
  AnnotationMode,
  getDocument,
  GlobalWorkerOptions,
  version,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import { fitPage, MAX_IMAGE_PIXELS, MAX_RENDER_PIXELS } from "./raster";
import type { RecognitionSource } from "./source";

function pdfError(error: unknown) {
  return new Error(
    error instanceof Error && error.name === "PasswordException"
      ? "passwordPdf"
      : "invalidPdf",
  );
}

export async function openPdfSource(
  bytes: Uint8Array,
  signal: AbortSignal,
): Promise<RecognitionSource> {
  signal.throwIfAborted();
  const assets = new URL(
    `/_next/static/pdfjs/${version}/`,
    window.location.origin,
  ).href;
  GlobalWorkerOptions.workerSrc = assets + "legacy/build/pdf.worker.min.mjs";
  const loading = getDocument({
    data: bytes,
    cMapUrl: assets + "cmaps/",
    standardFontDataUrl: assets + "standard_fonts/",
    wasmUrl: assets + "wasm/",
    iccUrl: assets + "iccs/",
    useWorkerFetch: true,
    stopAtErrors: true,
    isEvalSupported: false,
    maxImageSize: MAX_IMAGE_PIXELS,
    canvasMaxAreaInBytes: MAX_RENDER_PIXELS * 4,
  });

  let closed = false;
  let preview: HTMLCanvasElement | undefined;
  const ensureOpen = (renderSignal: AbortSignal) => {
    renderSignal.throwIfAborted();
    if (closed) throw new DOMException("Closed PDF", "AbortError");
  };
  const clearPreview = () => {
    if (preview) preview.width = preview.height = 0;
    preview = undefined;
  };
  const close = () => {
    if (closed) return;
    closed = true;
    clearPreview();
    void loading.destroy().catch(() => {});
  };
  // Destroying a loading task before its worker handshake can leave its own
  // promise pending. Settle our caller immediately when the user chooses again.
  let rejectLoading: (reason: unknown) => void;
  const cancelled = new Promise<never>((_, reject) => {
    rejectLoading = reject;
  });
  const cancel = () => {
    close();
    rejectLoading(signal.reason);
  };
  signal.addEventListener("abort", cancel, { once: true });
  let pdf: PDFDocumentProxy;
  try {
    pdf = await Promise.race([loading.promise, cancelled]);
    signal.throwIfAborted();
  } catch (error) {
    close();
    signal.throwIfAborted();
    throw pdfError(error);
  } finally {
    signal.removeEventListener("abort", cancel);
  }

  return {
    pageCount: pdf.numPages,
    close,
    async render(pageNumber, renderSignal) {
      ensureOpen(renderSignal);
      if (
        !Number.isInteger(pageNumber) ||
        pageNumber < 1 ||
        pageNumber > pdf.numPages
      )
        throw new Error("invalidRange");

      clearPreview();
      let page: PDFPageProxy | undefined;
      let canvas: HTMLCanvasElement | undefined;
      try {
        page = await pdf.getPage(pageNumber);
        ensureOpen(renderSignal);
        const unit = page.getViewport({ scale: 1 });
        const size = fitPage(unit.width, unit.height, 3);
        canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const task = page.render({
          canvas,
          viewport: page.getViewport({ scale: size.scale }),
          annotationMode: AnnotationMode.DISABLE,
          background: "white",
        });
        const stop = () => task.cancel();
        renderSignal.addEventListener("abort", stop, { once: true });
        try {
          await task.promise;
          ensureOpen(renderSignal);
        } finally {
          renderSignal.removeEventListener("abort", stop);
        }
        preview = canvas;
        return canvas;
      } catch (error) {
        if (canvas) canvas.width = canvas.height = 0;
        ensureOpen(renderSignal);
        throw pdfError(error);
      } finally {
        page?.cleanup();
      }
    },
  };
}
