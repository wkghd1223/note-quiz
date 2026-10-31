import { describe, expect, it } from "vitest";
import { adInsets } from "./adLayout";
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
