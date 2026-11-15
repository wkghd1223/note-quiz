import { describe, expect, it } from "vitest";
import { adInsets, adViewport } from "./adLayout";
describe("ad layout geometry", () => {
  it("reserves a right rail without relying on sticky alone", () =>
    expect(
      adInsets(
        [
          {
            left: 1120,
            right: 1440,
            top: 120,
            bottom: 720,
            width: 320,
            height: 600,
            anchored: true,
          },
        ],
        1440,
        900,
      ),
    ).toEqual({ right: 336, bottom: 0 }));
  it("reserves anchored mobile footer and ignores normal content slots", () =>
    expect(
      adInsets(
        [
          {
            left: 0,
            right: 390,
            top: 744,
            bottom: 844,
            width: 390,
            height: 100,
            anchored: true,
          },
          {
            left: 10,
            right: 380,
            top: 400,
            bottom: 750,
            width: 370,
            height: 350,
            anchored: false,
          },
        ],
        390,
        844,
      ),
    ).toEqual({ right: 0, bottom: 116 }));
  it("removes reservations when wrappers disappear/offscreen", () =>
    expect(
      adInsets(
        [
          {
            left: 0,
            right: 390,
            top: 900,
            bottom: 1000,
            width: 390,
            height: 100,
            anchored: true,
          },
        ],
        390,
        844,
      ),
    ).toEqual({ right: 0, bottom: 0 }));
});

describe("visible viewport ad reservations", () => {
  const footer = {
    left: 0,
    right: 390,
    top: 744,
    bottom: 844,
    width: 390,
    height: 100,
    anchored: true,
  };
  it("measures the actual Journey geometry without adopting its body padding", () => {
    expect(
      adInsets(
        [
          {
            ...footer,
            right: 2014,
            top: 1122,
            bottom: 1212,
            width: 2014,
            height: 90,
          },
        ],
        2014,
        1212,
      ),
    ).toEqual({ right: 0, bottom: 106 });
  });
  it("uses the visible mobile viewport after chrome or keyboard reduces its height", () => {
    const viewport = adViewport(390, 844, {
      offsetLeft: 0,
      offsetTop: 0,
      width: 390,
      height: 500,
    });
    expect(viewport).toEqual({ left: 0, top: 0, width: 390, height: 500 });
    // A layout-bottom ad outside the currently visible area cannot occlude it.
    expect(
      adInsets([footer], viewport.width, viewport.height, viewport),
    ).toEqual({ right: 0, bottom: 0 });
    expect(
      adInsets(
        [{ ...footer, top: 450, bottom: 500, height: 50 }],
        viewport.width,
        viewport.height,
        viewport,
      ),
    ).toEqual({ right: 0, bottom: 66 });
  });
  it("translates layout geometry to a panned visual viewport during zoom", () => {
    const viewport = adViewport(390, 844, {
      offsetLeft: 40,
      offsetTop: 200,
      width: 250,
      height: 400,
    });
    expect(
      adInsets(
        [
          {
            ...footer,
            left: 40,
            right: 290,
            width: 250,
            top: 550,
            bottom: 600,
            height: 50,
          },
        ],
        viewport.width,
        viewport.height,
        viewport,
      ),
    ).toEqual({ right: 0, bottom: 66 });
    expect(
      adInsets([footer], viewport.width, viewport.height, viewport),
    ).toEqual({ right: 0, bottom: 0 });
  });
  it("uses layout bounds when the visual viewport is unavailable or transiently empty", () => {
    expect(adViewport(390, 844, null)).toEqual({
      left: 0,
      top: 0,
      width: 390,
      height: 844,
    });
    expect(
      adViewport(390, 844, {
        offsetLeft: 0,
        offsetTop: 0,
        width: 390,
        height: 0,
      }),
    ).toEqual({ left: 0, top: 0, width: 390, height: 844 });
    expect(
      adViewport(390, 844, {
        offsetLeft: NaN,
        offsetTop: 0,
        width: 390,
        height: 500,
      }),
    ).toEqual({ left: 0, top: 0, width: 390, height: 844 });
  });
  it("never returns a negative reserve for a very short visible viewport", () => {
    expect(adInsets([{ ...footer, top: 50, bottom: 100 }], 390, 100)).toEqual({
      right: 0,
      bottom: 0,
    });
    expect(adInsets([footer], NaN, 844)).toEqual({ right: 0, bottom: 0 });
  });
  it("ignores nonfinite wrapper geometry rather than poisoning CSS variables", () => {
    expect(adInsets([{ ...footer, top: NaN }], 390, 844)).toEqual({
      right: 0,
      bottom: 0,
    });
  });
});

it("reserves a Journey rail inside the content edge as well as at the viewport edge", () => {
  expect(
    adInsets(
      [
        {
          left: 960,
          right: 1260,
          top: 120,
          bottom: 720,
          width: 300,
          height: 600,
          anchored: true,
        },
      ],
      1440,
      900,
    ),
  ).toEqual({ right: 496, bottom: 0 });
});

it("keeps sidebar-owned ads in their existing flow instead of shifting their own anchor in a loop", () => {
  expect(
    adInsets(
      [
        {
          left: 970,
          right: 1270,
          top: 491,
          bottom: 741,
          width: 300,
          height: 250,
          anchored: true,
          inSidebar: true,
        },
      ],
      1440,
      900,
    ),
  ).toEqual({ right: 0, bottom: 0 });
});
