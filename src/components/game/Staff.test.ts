import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KEY_SIGNATURES } from "@/lib/music/constants";
import Staff from "./Staff";

function renderStaff(octave: Octave, responsive = true) {
  const note: Note = { name: "B", octave, accidental: "sharp" };
  return renderToStaticMarkup(
    React.createElement(Staff, {
      clef: "treble",
      keySignature: KEY_SIGNATURES.C,
      note,
      originalNote: note,
      width: 620,
      height: 260,
      responsive,
    }),
  );
}

function getVerticalBounds(markup: string) {
  const viewBox = markup.match(/viewBox="([^"]+)"/)?.[1];
  expect(viewBox).toBeDefined();
  const [, top, , height] = viewBox!.split(" ").map(Number);
  return { top, bottom: top + height };
}

describe("responsive staff bounds", () => {
  it("keeps a low ledger note and its accidental inside the SVG", () => {
    // B2 is ten staff positions below E4; its note head is at y=270.
    const { top, bottom } = getVerticalBounds(renderStaff(2));
    expect(top).toBeLessThanOrEqual(90);
    expect(bottom).toBeGreaterThanOrEqual(279);
  });

  it("keeps a high ledger note, stem, and accidental inside the SVG", () => {
    // B6 is ten staff positions above F5; its note head is at y=-10.
    const { top, bottom } = getVerticalBounds(renderStaff(6));
    expect(top).toBeLessThanOrEqual(-44);
    expect(bottom).toBeGreaterThanOrEqual(170);
  });

  it("preserves the existing non-responsive rendering", () => {
    const markup = renderStaff(4, false);
    expect(markup).not.toContain("viewBox=");
    expect(markup).toContain("min-height:260px");
  });
});
