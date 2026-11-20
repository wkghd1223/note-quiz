// Check dimensions before asking the browser to allocate a decoded bitmap.
export const MAX_IMAGE_PIXELS = 24_000_000;
export const MAX_RENDER_PIXELS = 4_000_000;
export const MAX_RENDER_SIDE = 3200;

export function readImageSize(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  if (
    bytes.length >= 24 &&
    view.getUint32(0) === 0x89504e47 &&
    view.getUint32(4) === 0x0d0a1a0a &&
    view.getUint32(12) === 0x49484452
  ) {
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    // JPEG header segments carry their own lengths; pixel data begins at SOS.
    let at = 2;
    while (at + 4 <= bytes.length && bytes[at++] === 0xff) {
      while (bytes[at] === 0xff) at++;
      const marker = bytes[at++];
      if (marker === 0xda || marker === 0xd9 || at + 2 > bytes.length) break;
      const length = view.getUint16(at);
      if (length < 2 || at + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8) {
        height = view.getUint16(at + 3);
        width = view.getUint16(at + 5);
        break;
      }
      at += length;
    }
  }
  if (!width || !height) throw new Error("invalidFile");
  if (width * height > MAX_IMAGE_PIXELS || Math.max(width, height) > 32768)
    throw new Error("fileTooLarge");
  return { width, height };
}

export function fitPage(width: number, height: number, maxScale = 1) {
  if (![width, height, maxScale].every((v) => Number.isFinite(v) && v > 0))
    throw new Error("invalidFile");
  const scale = Math.min(
    maxScale,
    MAX_RENDER_SIDE / Math.max(width, height),
    Math.sqrt(MAX_RENDER_PIXELS / (width * height)),
  );
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scale,
  };
}
