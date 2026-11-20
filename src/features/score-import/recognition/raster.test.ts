import { describe, expect, it } from "vitest";
import {
  fitPage,
  MAX_RENDER_PIXELS,
  MAX_RENDER_SIDE,
  readImageSize,
} from "./raster";

const pngHeader = (w: number, h: number) => {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, w);
  view.setUint32(20, h);
  return bytes;
};

describe("recognition image limits", () => {
  it("reads PNG dimensions before decode, including offset views", () => {
    const bytes = new Uint8Array(26);
    bytes.set(pngHeader(2026, 1600), 2);
    expect(readImageSize(bytes.subarray(2))).toEqual({
      width: 2026,
      height: 1600,
    });
    expect(() => readImageSize(pngHeader(6000, 6000))).toThrow("fileTooLarge");
    expect(() => readImageSize(pngHeader(0, 40))).toThrow("invalidFile");
  });

  it("skips metadata before progressive JPEG frame dimensions", () => {
    const frame = Uint8Array.of(
      255,
      216,
      255,
      225,
      0,
      5,
      1,
      2,
      3,
      255,
      194,
      0,
      11,
      8,
      0,
      80,
      1,
      44,
      1,
      1,
      17,
      0,
    );
    expect(readImageSize(frame)).toEqual({ width: 300, height: 80 });
    expect(() => readImageSize(frame.subarray(0, 18))).toThrow("invalidFile");
  });

  it.each([
    [640, 160],
    [8192, 2048],
    [4096, 4096],
    [595, 842],
  ])(
    "fits %i × %i onto a bounded canvas preserving the aspect ratio",
    (w, h) => {
      const size = fitPage(w, h);
      expect(size.width * size.height).toBeLessThanOrEqual(MAX_RENDER_PIXELS);
      expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(
        MAX_RENDER_SIDE,
      );
      expect(Math.abs(size.height - (size.width / w) * h)).toBeLessThan(2);
    },
  );
});
