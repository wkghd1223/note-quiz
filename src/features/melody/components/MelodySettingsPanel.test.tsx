import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locale";
import { melodyCopy } from "../i18n";
import { createMelody } from "../domain/generator";
import { defaultMelodySettings } from "../domain/settings";
import MelodySettingsPanel from "./MelodySettingsPanel";
const locale = vi.hoisted(() => ({ value: "en" as Language }));
vi.mock("@/hooks/useTranslation", async () => {
  const { getTranslation } = await import("@/lib/i18n/translations");
  return {
    useTranslation: () => ({
      t: getTranslation(locale.value),
      language: locale.value,
    }),
  };
});
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());
function markup(settings = defaultMelodySettings) {
  return renderToStaticMarkup(
    <MelodySettingsPanel
      value={settings}
      onChange={() => {}}
      disabled={false}
      generation={createMelody(settings, 3)}
    />,
  );
}
describe("melody tonality and progression controls", () => {
  it.each(SUPPORTED_LOCALES)(
    "provides all 27 tonalities and compact Roman progressions in %s",
    (language) => {
      locale.value = language;
      const c = melodyCopy(language),
        html = markup();
      expect(html).toContain(c.tonality);
      expect(html).toContain(c.progression);
      expect(html.match(/<optgroup /g)).toHaveLength(2);
      expect(html.match(/value="[A-G][#b]?-(major|minor)"/g)).toHaveLength(27);
      expect(html).toContain("I–vi–ii–V / I–IV–V–I");
      expect(html).not.toContain('role="alert"');
    },
  );
  it("shows one actionable issue and keeps an impossible fixed choice visible", () => {
    locale.value = "en";
    const html = markup({
      ...defaultMelodySettings,
      maxMidi: 60,
      progressionId: "major-basic",
    });
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toContain("No G chord tone in this range. Widen the range.");
    expect(html).toMatch(
      /<option value="major-basic" disabled="" selected="">/,
    );
  });
  it("does not warn for one-candidate notes or a candidate-free full-rest chord", () => {
    locale.value = "en";
    expect(
      markup({
        ...defaultMelodySettings,
        maxMidi: 62,
        durations: [4],
        progressionId: "major-descending",
      }),
    ).not.toContain('role="alert"');
  });
});
