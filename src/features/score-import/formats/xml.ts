import { MAX_XML_BYTES } from "../archive";

export const MAX_SCORE_ELEMENTS = 350_000;

export function readXml(text: string): XMLDocument {
  if (text.length > MAX_XML_BYTES) throw new Error("fileTooLarge");
  // Keep ordinary MusicXML PUBLIC doctypes. A score never needs entity definitions.
  if (/<!ENTITY\s/i.test(text)) throw new Error("unsupportedFile");
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (
    !doc.documentElement ||
    doc.documentElement.localName === "parsererror" ||
    doc.getElementsByTagNameNS("*", "parsererror").length
  )
    throw new Error("invalidFile");
  if (doc.getElementsByTagName("*").length > MAX_SCORE_ELEMENTS)
    throw new Error("fileTooLarge");
  return doc;
}
