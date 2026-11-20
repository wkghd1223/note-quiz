import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { openPdfSource } from "./pdf-source";

const { getDocument } = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument,
  GlobalWorkerOptions: {},
  version: "test",
  AnnotationMode: { DISABLE: 0 },
}));
const bytes = new Uint8Array([37, 80, 68, 70]);
beforeEach(() => {
  vi.stubGlobal("window", { location: { origin: "https://note-quiz.test" } });
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0 }) });
});
afterEach(() => vi.unstubAllGlobals());

it("settles a cancelled open before the PDF worker handshake completes", async () => {
  const destroy = vi.fn().mockResolvedValue(undefined);
  getDocument.mockReturnValue({ promise: new Promise(() => {}), destroy });
  const controller = new AbortController();
  const opening = openPdfSource(bytes, controller.signal);
  controller.abort();
  await expect(opening).rejects.toMatchObject({ name: "AbortError" });
  expect(destroy).toHaveBeenCalledOnce();
});

it.each([
  ["PasswordException", "passwordPdf"],
  ["InvalidPDFException", "invalidPdf"],
])("releases a document that fails to load with %s", async (name, expected) => {
  const failure = Object.assign(new Error("fixture"), { name });
  const destroy = vi.fn().mockResolvedValue(undefined);
  getDocument.mockReturnValue({ promise: Promise.reject(failure), destroy });
  await expect(
    openPdfSource(bytes, new AbortController().signal),
  ).rejects.toThrow(expected);
  expect(destroy).toHaveBeenCalledOnce();
});

it("renders only the requested page and releases the previous canvas on page change or close", async () => {
  const page = {
    getViewport: ({ scale }: { scale: number }) => ({
      width: 1300 * scale,
      height: 1500 * scale,
    }),
    render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
    cleanup: vi.fn(),
  };
  const getPage = vi.fn().mockResolvedValue(page);
  const destroy = vi.fn().mockResolvedValue(undefined);
  getDocument.mockReturnValue({
    promise: Promise.resolve({ numPages: 32, getPage }),
    destroy,
  });
  const signal = new AbortController().signal;
  const source = await openPdfSource(bytes, signal);
  expect(getPage).not.toHaveBeenCalled();
  const first = await source.render(31, signal);
  expect(first.width * first.height).toBeLessThanOrEqual(4_000_000);
  const second = await source.render(2, signal);
  expect(getPage.mock.calls).toEqual([[31], [2]]);
  expect(first.width).toBe(0);
  expect(second.width).toBeGreaterThan(0);
  source.close();
  source.close();
  expect(second.width).toBe(0);
  expect(destroy).toHaveBeenCalledOnce();
});

it("cancels an active page render without closing the document needed for the next page", async () => {
  let finish!: () => void;
  const promise = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const cancel = vi.fn(finish);
  const page = {
    getViewport: () => ({ width: 100, height: 100 }),
    render: vi.fn().mockReturnValue({ promise, cancel }),
    cleanup: vi.fn(),
  };
  const destroy = vi.fn().mockResolvedValue(undefined);
  getDocument.mockReturnValue({
    promise: Promise.resolve({ numPages: 2, getPage: async () => page }),
    destroy,
  });
  const source = await openPdfSource(bytes, new AbortController().signal);
  const rendering = new AbortController();
  const firstPage = source.render(1, rendering.signal);
  await vi.waitFor(() => expect(page.render).toHaveBeenCalled());
  rendering.abort();
  await expect(firstPage).rejects.toMatchObject({ name: "AbortError" });
  expect(cancel).toHaveBeenCalledOnce();
  expect(page.cleanup).toHaveBeenCalledOnce();
  expect(destroy).not.toHaveBeenCalled();
  source.close();
});
