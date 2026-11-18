import { describe, expect, it } from "vitest";
import { decodeXml, openArchive, safeMemberPath } from "./archive";

// A standard ZIP generated with Python zipfile: deflated manifest and stored root.
const fixture =
  "UEsDBBQAAAAIADJ6cl1aUwVoPgAAAFUAAAAWAAAATUVUQS1JTkYvY29udGFpbmVyLnhtbLNJzs8rSczMSy2ysynKzy9Jy8xJLUYwFdJKc3J0CxJLMmyVckuLM5P1i5Pzi1L1KnJzlPTtbPSRtOgjTAIAUEsDBBQAAAAAADJ6cl1SSB0QEQAAABEAAAAPAAAAbXVzaWMvc2NvcmUueG1sPHNjb3JlLXBhcnR3aXNlLz5QSwECFAMUAAAACAAyenJdWlMFaD4AAABVAAAAFgAAAAAAAAAAAAAAgAEAAAAATUVUQS1JTkYvY29udGFpbmVyLnhtbFBLAQIUAxQAAAAAADJ6cl1SSB0QEQAAABEAAAAPAAAAAAAAAAAAAACAAXIAAABtdXNpYy9zY29yZS54bWxQSwUGAAAAAAIAAgCBAAAAsAAAAAAA";
const bytes = () => Uint8Array.from(Buffer.from(fixture, "base64"));

describe("local MXL archive", () => {
  it("reads a stored score and its compressed rootfile manifest", async () => {
    const zip = openArchive(bytes());
    expect(decodeXml(await zip.read("META-INF/container.xml"))).toContain(
      'full-path="music/score.xml"',
    );
    expect(decodeXml(await zip.read("music/score.xml"))).toBe(
      "<score-partwise/>",
    );
  });
  it("rejects truncated, damaged, and ambiguous member names", async () => {
    expect(() => openArchive(bytes().slice(0, -8))).toThrow("invalidFile");
    const damaged = bytes();
    damaged[damaged.indexOf(60)] = 32;
    await expect(openArchive(damaged).read("music/score.xml")).rejects.toThrow(
      "invalidFile",
    );
    expect(safeMemberPath("../score.xml")).toBe(false);
    expect(safeMemberPath("/other.xml")).toBe(false);
  });
  it("honors cancellation and encoding declarations", async () => {
    await expect(
      openArchive(bytes()).read("music/score.xml", AbortSignal.abort()),
    ).rejects.toThrow();
    const latin = Buffer.from(
      '<?xml version="1.0" encoding="iso-8859-1"?><title>été</title>',
      "latin1",
    );
    expect(decodeXml(latin)).toContain("été");
  });
});
