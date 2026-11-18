import { describe, expect, it } from "vitest";
import { translations, getTranslation } from "./translations";
import { chineseLearning, chineseTranslations } from "./zh";
import { learningTranslations } from "./learning";
import { SUPPORTED_LOCALES } from "./locale";
import { portugueseLearning, portugueseTranslations } from "./pt";
import { challengeCopy } from "@/features/challenge/i18n";
import { melodyCopy } from "@/features/melody/i18n";
import { russianLearning, russianTranslations } from "./ru";
import { russianMelody } from "@/features/melody/i18n-ru";
import { russianChallenge } from "@/features/challenge/i18n-ru";
import { georgianLearning, georgianTranslations } from "./ka";
import { esperantoLearning, esperantoTranslations } from "./eo";
import { georgianMelody } from "@/features/melody/i18n-ka";
import { esperantoMelody } from "@/features/melody/i18n-eo";
import { georgianChallenge } from "@/features/challenge/i18n-ka";
import { esperantoChallenge } from "@/features/challenge/i18n-eo";

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
  it.each([
    {
      language: "ka" as const,
      practice: georgianTranslations,
      learning: georgianLearning,
      melody: georgianMelody,
      challenge: georgianChallenge,
    },
    {
      language: "eo" as const,
      practice: esperantoTranslations,
      learning: esperantoLearning,
      melody: esperantoMelody,
      challenge: esperantoChallenge,
    },
  ])(
    "uses the explicit $language dictionaries on every practice surface",
    ({ language, practice, learning, melody, challenge }) => {
      expect(getTranslation(language)).toBe(practice);
      expect(learningTranslations[language]).toBe(learning);
      expect(melodyCopy(language)).toBe(melody);
      expect(challengeCopy(language)).toBe(challenge);
    },
  );
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
  it("registers complete Russian dictionaries with translated human labels", () => {
    expect(getTranslation("ru")).toBe(russianTranslations);
    expect(learningTranslations.ru).toBe(russianLearning);
    expect(melodyCopy("ru")).toBe(russianMelody);
    expect(challengeCopy("ru")).toBe(russianChallenge);
    for (const dictionary of [
      russianTranslations,
      russianMelody,
      russianChallenge,
    ]) {
      for (const [key, value] of Object.entries(leaves(dictionary))) {
        if (key === "gameTitle" || key === "home.hero.title") continue;
        expect(value, key).toMatch(/[А-Яа-яЁё]/);
      }
    }
    // Pitch, rhythmic onset and note duration are different judgments.
    expect(russianChallenge.pitch).toBe("Высота звука");
    expect(russianChallenge.onset).toBe("Момент начала");
    expect(russianChallenge.duration).toBe("Длительность");
    expect(russianTranslations.solfege.notes.B).toBe("Си");
    expect(russianLearning.interval_TT).toBe("Тритон");
    expect(russianMelody.livePitchLabel).toBe("Текущая высота");
    expect(russianMelody.reasonPitchCorrectTooShort).toContain(
      "но нота слишком короткая",
    );
    expect(russianMelody.reasonNoSignal).toContain("надёжно определить");
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
