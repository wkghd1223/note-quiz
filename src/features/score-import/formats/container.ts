import { decodeXml, openArchive, safeMemberPath } from "../archive";
import { direct, first } from "../score-xml";
import { readXml } from "./xml";

const manifest = "META-INF/container.xml";
function nativeRoot(paths: string[], fileName: string) {
  const scores = paths.filter(
    (name) => !name.includes("/") && /\.mscx$/i.test(name),
  );
  if (scores.length === 1) return scores[0];
  const expected = fileName.replace(/\.[^.]*$/, "").toLowerCase() + ".mscx";
  return scores.find((name) => name.toLowerCase() === expected);
}

/** MXL declares its primary document first. An MSCZ manifest can list a
 * stylesheet first and extracted parts afterwards, or be absent altogether. */
export async function archiveDocument(
  bytes: Uint8Array<ArrayBuffer>,
  name: string,
  signal?: AbortSignal,
) {
  const zip = openArchive(bytes);
  let path: string | undefined;
  if (zip.paths.includes(manifest)) {
    const root = readXml(
      decodeXml(await zip.read(manifest, signal)),
    ).documentElement;
    const files = first(root, "rootfiles");
    if (root.localName !== "container" || !files)
      throw new Error("invalidFile");
    const entries = direct(files, "rootfile");
    const paths = entries.map((entry) => entry.getAttribute("full-path") ?? "");
    const primary = paths[0];
    if (!primary || !safeMemberPath(primary)) throw new Error("invalidFile");
    const isNative =
      !/\.(?:musicxml|xml)$/i.test(primary) &&
      !entries[0].getAttribute("media-type")?.includes("musicxml") &&
      paths.some((path) => /\.mscx$/i.test(path));
    path = isNative ? nativeRoot(paths, name) : primary;
  } else {
    path = nativeRoot(zip.paths, name);
  }
  if (!path) throw new Error("invalidFile");
  const doc = readXml(decodeXml(await zip.read(path, signal)));
  const score =
    doc.documentElement.localName === "museScore"
      ? first(doc.documentElement, "Score")
      : undefined;
  // In MuseScore 4 the external master style carries playback settings too.
  // Embedded settings belong to this score and take priority over defaults.
  if (score && zip.paths.includes("score_style.mss")) {
    const styleDoc = readXml(
      decodeXml(await zip.read("score_style.mss", signal)),
    );
    const external = first(styleDoc.documentElement, "Style");
    if (external) {
      const style =
        first(score, "Style") ?? score.appendChild(doc.createElement("Style"));
      for (const key of ["concertPitch", "swingUnit", "swingRatio"]) {
        const setting = first(external, key);
        if (setting && !first(style, key))
          style.appendChild(doc.importNode(setting, false)).textContent =
            setting.textContent;
      }
    }
  }
  return doc;
}
