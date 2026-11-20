import { afterEach, expect, it, vi } from "vitest";
import { openRecognitionSource } from "./source";

const png = new File(
  [
    Uint8Array.of(
      137,
      80,
      78,
      71,
      13,
      10,
      26,
      10,
      0,
      0,
      0,
      13,
      73,
      72,
      68,
      82,
      0,
      0,
      16,
      0,
      0,
      0,
      12,
      0,
    ),
  ],
  "photo.png",
);
afterEach(() => vi.unstubAllGlobals());

it("releases a large original as soon as its bounded preview is drawn", async () => {
  const bitmap = { width: 4096, height: 3072, close: vi.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn() }),
  };
  vi.stubGlobal("createImageBitmap", async () => bitmap);
  vi.stubGlobal("document", { createElement: () => canvas });
  const signal = new AbortController().signal;
  const source = await openRecognitionSource(png, signal);
  expect(bitmap.close).toHaveBeenCalledOnce();
  expect(await source.render(1, signal)).toBe(canvas);
  expect(canvas.width * canvas.height).toBeLessThanOrEqual(4_000_000);
  source.close();
  expect(canvas.width).toBe(0);
});

it("closes the decoded bitmap when a replacement cancels the original read", async () => {
  const controller = new AbortController();
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", async () => {
    controller.abort();
    return { close };
  });
  vi.stubGlobal("document", { createElement: () => ({}) });
  await expect(
    openRecognitionSource(png, controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(close).toHaveBeenCalledOnce();
});
