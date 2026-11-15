import { describe, expect, it } from "vitest";
import { translations, getTranslation } from "./translations";
import { chineseLearning, chineseTranslations } from "./zh";
import { learningTranslations } from "./learning";
const SUPPORTED_LOCALES = Object.keys(translations) as Language[];
import { portugueseLearning, portugueseTranslations } from "./pt";
import { challengeCopy } from "@/features/challenge/i18n";
import { melodyCopy } from "@/features/melody/i18n";

function leaves(value: object, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof entry === "string"
        ? [[path, entry]]
        : Object.entries(leaves(entry, path));
    }),
  );
}

describe("complete supported-language dictionaries", () => {
  it.each(SUPPORTED_LOCALES)(
    "provides every existing key in %s without blank values",
    (language) => {
      const english = leaves(translations.en),
        actual = leaves(getTranslation(language));
      expect(Object.keys(actual).sort()).toEqual(Object.keys(english).sort());
      for (const [key, value] of Object.entries(actual)) {
        expect(value.trim(), key).not.toBe("");
        expect(value.match(/\{\w+\}/g) ?? [], key).toEqual(
          english[key].match(/\{\w+\}/g) ?? [],
        );
      }
    },
  );
  it("registers explicit Chinese dictionaries rather than falling back to English", () => {
    expect(getTranslation("zh")).toBe(chineseTranslations);
    expect(learningTranslations.zh).toBe(chineseLearning);
    expect(Object.keys(chineseLearning).sort()).toEqual(
      Object.keys(learningTranslations.en).sort(),
    );
    const english = leaves(translations.en);
    const brandNames = new Set(["gameTitle", "home.hero.title"]);
    for (const [key, value] of Object.entries(leaves(chineseTranslations))) {
      if (!brandNames.has(key)) {
        expect(value, key).not.toBe(english[key]);
        expect(value, key).toMatch(/[\u3400-\u9fff]/);
      }
    }
  });
  it("registers the Brazilian Portuguese dictionaries", () => {
    expect(getTranslation("pt")).toBe(portugueseTranslations);
    expect(learningTranslations.pt).toBe(portugueseLearning);
    expect(getTranslation("pt").settingsLabels.language).toBe("Idioma");
  });
  it.each(SUPPORTED_LOCALES)(
    "provides complete melody and challenge copy in %s",
    (language) => {
      for (const copy of [melodyCopy, challengeCopy]) {
        const english = leaves(copy("en"));
        const actual = leaves(copy(language));
        expect(Object.keys(actual).sort()).toEqual(Object.keys(english).sort());
        for (const [key, value] of Object.entries(actual)) {
          expect(value.trim(), key).not.toBe("");
          expect(value.match(/\{\w+\}/g) ?? [], key).toEqual(
            english[key].match(/\{\w+\}/g) ?? [],
          );
        }
      }
    },
  );
});
