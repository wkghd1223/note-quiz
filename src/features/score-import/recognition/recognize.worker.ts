import { straightenStaff } from "./deskew";

self.onmessage = async ({ data }: MessageEvent<ImageData>) => {
  try {
    // Load the engine as a worker chunk so its webpack runtime is initialized
    // before the alphaTab plugin installs its shared worklet chunk map.
    const { recognizeStaff } = await import("./engine");
    const { width, height, data: rgba } = data;
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < gray.length; i++) {
      const p = i * 4;
      gray[i] = (77 * rgba[p] + 150 * rgba[p + 1] + 29 * rgba[p + 2]) >>> 8;
    }
    try {
      self.postMessage(recognizeStaff(gray, width, height));
    } catch {
      const corrected = straightenStaff(gray, width, height);
      self.postMessage(
        corrected &&
          recognizeStaff(corrected.pixels, corrected.width, corrected.height, {
            deskewed: true,
          }),
      );
    }
  } catch {
    self.postMessage(null);
  }
};
