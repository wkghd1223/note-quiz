// Only the selected XML entries are inflated. Images and other package members
// stay in the original local file until the caller needs them.
export const MAX_XML_BYTES = 16 * 1024 * 1024;
export const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 8192;

type Member = {
  offset: number;
  method: number;
  flags: number;
  packed: number;
  size: number;
  crc: number;
};

function invalid(): never {
  throw new Error("invalidFile");
}

export function safeMemberPath(path: string): boolean {
  return (
    !!path &&
    !path.includes("\\") &&
    !path.includes(":") &&
    !path.includes("\0") &&
    !path.startsWith("/") &&
    !path.split("/").includes("..")
  );
}

const canonicalPath = (path: string) =>
  path
    .split("/")
    .filter((part) => part && part !== ".")
    .join("/");

export function decodeXml(bytes: Uint8Array): string {
  if (bytes.length > MAX_XML_BYTES) throw new Error("fileTooLarge");
  let encoding = "utf-8";
  if (
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes[0] === 0x3c && bytes[1] === 0)
  ) {
    encoding = "utf-16le";
  } else if (
    (bytes[0] === 0xfe && bytes[1] === 0xff) ||
    (bytes[0] === 0 && bytes[1] === 0x3c)
  ) {
    encoding = "utf-16be";
  } else {
    const declaration = new TextDecoder("ascii").decode(bytes.subarray(0, 256));
    encoding =
      /^\s*<\?xml\b[^?]*?\bencoding\s*=\s*["']([\w.-]+)["']/i.exec(
        declaration,
      )?.[1] ?? encoding;
  }
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    return invalid();
  }
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++)
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});
function checksum(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

/** Central-directory sizes are also checked against the actual streamed output. */
export function openArchive(bytes: Uint8Array<ArrayBuffer>) {
  if (bytes.length > MAX_FILE_BYTES) throw new Error("fileTooLarge");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  let end = bytes.length - 22;
  const first = Math.max(0, end - 65535);
  while (
    end >= first &&
    !(u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.length)
  )
    end--;
  if (
    end < first ||
    u16(end + 4) ||
    u16(end + 6) ||
    u16(end + 8) !== u16(end + 10)
  )
    invalid();
  const count = u16(end + 10);
  const directory = u32(end + 16);
  if (count > MAX_ENTRIES) throw new Error("fileTooLarge");
  const directoryEnd = directory + u32(end + 12);
  if (directoryEnd > end) invalid();
  const members = new Map<string, Member>();
  let pos = directory;
  for (let index = 0; index < count; index++) {
    if (pos + 46 > directoryEnd || u32(pos) !== 0x02014b50) invalid();
    const nameSize = u16(pos + 28);
    const next = pos + 46 + nameSize + u16(pos + 30) + u16(pos + 32);
    if (next > directoryEnd || u16(pos + 34) !== 0) invalid();
    const name = new TextDecoder().decode(
      bytes.subarray(pos + 46, pos + 46 + nameSize),
    );
    if (!safeMemberPath(name)) invalid();
    if (name.endsWith("/")) {
      pos = next;
      continue;
    }
    const path = canonicalPath(name);
    if (!path || members.has(path)) invalid();
    members.set(path, {
      offset: u32(pos + 42),
      method: u16(pos + 10),
      flags: u16(pos + 8),
      packed: u32(pos + 20),
      size: u32(pos + 24),
      crc: u32(pos + 16),
    });
    pos = next;
  }
  if (pos !== directoryEnd) invalid();
  return {
    paths: [...members.keys()],
    async read(
      name: string,
      signal?: AbortSignal,
    ): Promise<Uint8Array<ArrayBuffer>> {
      signal?.throwIfAborted();
      if (!safeMemberPath(name)) return invalid();
      let entry = members.get(canonicalPath(name));
      if (!entry && name.includes("%")) {
        let decoded: string;
        try {
          decoded = decodeURIComponent(name);
        } catch {
          return invalid();
        }
        if (safeMemberPath(decoded))
          entry = members.get(canonicalPath(decoded));
      }
      if (!entry) return invalid();
      if (entry.size > MAX_XML_BYTES) throw new Error("fileTooLarge");
      const { offset, packed, size } = entry;
      if (
        entry.flags & 1 ||
        offset + 30 > directory ||
        u32(offset) !== 0x04034b50 ||
        u16(offset + 8) !== entry.method
      )
        invalid();
      const start = offset + 30 + u16(offset + 26) + u16(offset + 28);
      if (start + packed > directory) invalid();
      const raw = bytes.subarray(start, start + packed);
      if (entry.method === 0) {
        if (packed !== size || checksum(raw) !== entry.crc) invalid();
        return raw;
      }
      if (entry.method !== 8 || typeof DecompressionStream === "undefined") {
        throw new Error("unsupportedFile");
      }
      let decompressor: DecompressionStream;
      try {
        decompressor = new DecompressionStream("deflate-raw");
      } catch {
        throw new Error("unsupportedFile");
      }
      const reader = new Blob([raw])
        .stream()
        .pipeThrough(decompressor)
        .getReader();
      const result = new Uint8Array(size);
      let written = 0;
      try {
        for (;;) {
          signal?.throwIfAborted();
          const { done, value } = await reader.read();
          if (done) break;
          if (written + value.length > size) invalid();
          result.set(value, written);
          written += value.length;
        }
      } catch {
        signal?.throwIfAborted();
        return invalid();
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      if (written !== size || checksum(result) !== entry.crc) invalid();
      return result;
    },
  };
}
