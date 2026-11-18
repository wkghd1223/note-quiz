import { describe, expect, it } from "vitest";
import { translations } from "./translations";
import { navigationTranslations } from "./navigation";
import { learningTranslations } from "./learning";
import { homeCopy } from "./home";
import { melodyCopy } from "@/features/melody/i18n";
import { challengeCopy } from "@/features/challenge/i18n";
import {
  esperantoLearning,
  esperantoNavigation,
  esperantoTranslations,
} from "./eo";
import { esperantoBasicHome, esperantoHome } from "./home-eo";
import { esperantoMelody } from "@/features/melody/i18n-eo";
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

const basicEnglish = homeCopy("en", false);
const dictionaries = [
  ["navigation", navigationTranslations.en, esperantoNavigation],
  ["learning", learningTranslations.en, esperantoLearning],
  ["practice", translations.en, esperantoTranslations],
  ["home", homeCopy("en"), esperantoHome],
  [
    "basic home",
    {
      introduction: basicEnglish.introduction,
      steps: basicEnglish.steps,
      faq: basicEnglish.faq,
      metaTitle: basicEnglish.metaTitle,
      metaDescription: basicEnglish.metaDescription,
    },
    esperantoBasicHome,
  ],
  ["melody", melodyCopy("en"), esperantoMelody],
  ["challenge", challengeCopy("en"), esperantoChallenge],
] as const;

describe("explicit Esperanto dictionaries before locale registration", () => {
  it.each(dictionaries)(
    "%s preserves all English paths, array entries and interpolation tokens",
    (_name, english, esperanto) => {
      const expected = leaves(english);
      const actual = leaves(esperanto);
      expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
      for (const [path, value] of Object.entries(actual)) {
        expect(value.trim(), path).not.toBe("");
        expect(value.match(/\{\w+\}/g) ?? [], path).toEqual(
          expected[path].match(/\{\w+\}/g) ?? [],
        );
        expect(value.match(/<\/?[a-z][^>]*>/gi) ?? [], path).toEqual(
          expected[path].match(/<\/?[a-z][^>]*>/gi) ?? [],
        );
        // Short cognates, pitch labels and the product name can be identical.
        // Complete English sentences must never silently become a fallback.
        if (expected[path].length > 30) {
          expect(value, path).not.toBe(expected[path]);
        }
      }
    },
  );

  it("distinguishes pitch, onset, duration, rhythm, clef and key", () => {
    const judgments = [
      esperantoChallenge.pitch,
      esperantoChallenge.onset,
      esperantoChallenge.duration,
    ];
    expect(new Set(judgments).size).toBe(3);
    expect(judgments[0]).toMatch(/tonalto/i);
    expect(judgments[1]).toMatch(/komenca/i);
    expect(judgments[2]).toMatch(/daŭro/i);
    expect(esperantoMelody.livePitchLabel).toBe("Nuna tonalto");
    expect(esperantoMelody.reasonPitchCorrectTooShort).toContain(
      "tro mallonga",
    );
    expect(esperantoMelody.reasonNoSignal).toContain("fidinde konfirmita");
    expect(esperantoMelody.metronome).toMatch(/pulso/);
    expect(esperantoMelody.rhythm).toMatch(/ritm/i);
    expect(esperantoTranslations.settingsLabels.clef).toMatch(/klefo/i);
    expect(esperantoTranslations.settingsLabels.keySignature).toMatch(/tonal/i);
    expect(esperantoLearning.inversionHelp).toMatch(/plej malalta tono/);
    expect(esperantoLearning.progression).toMatch(/akorda sinsekvo/i);
    expect(esperantoLearning.interval_A4).not.toBe(
      esperantoLearning.interval_d5,
    );
    expect(esperantoTranslations.solfege.notes).toEqual({
      C: "Do",
      "C#": "Do♯",
      D: "Re",
      "D#": "Re♯",
      E: "Mi",
      F: "Fa",
      "F#": "Fa♯",
      G: "Sol",
      "G#": "Sol♯",
      A: "La",
      "A#": "La♯",
      B: "Si",
    });
  });

  it("preserves local microphone privacy and the one-note input limitation", () => {
    for (const privacy of [
      esperantoHome.faq[3].answer,
      esperantoBasicHome.faq[2].answer,
      esperantoMelody.privacy,
      esperantoChallenge.micNotice,
    ]) {
      expect(privacy).toMatch(/analiziĝas loke/);
      expect(privacy).toMatch(/ne (?:estas )?(?:registrata|alŝutata)/);
      expect(privacy).toContain("registrata");
      expect(privacy).toContain("alŝutata");
    }
    expect(esperantoHome.faq[1].answer).toMatch(/nur unu noton samtempe/);
    expect(esperantoChallenge.micNotice).toMatch(
      /Nur unu noto samtempe.*C4–G4/,
    );
    expect(esperantoChallenge.pianoMic).toMatch(/limigita/);
    expect(esperantoChallenge.guitarMic).toMatch(/limigita/);
    expect(esperantoChallenge.percussionMic).toMatch(/nesubtenata/);
  });

  it("keeps the basic-only home free of melody promotion or a microphone requirement", () => {
    expect(Object.values(leaves(esperantoBasicHome)).join(" ")).not.toMatch(
      /melodi|ok-takt|metronom|piana ekzemplo/i,
    );
    expect(esperantoBasicHome.faq[1].answer).toMatch(/^Ne\./);
    expect(esperantoBasicHome.faq[1].answer).toMatch(/ekranaj klavoj/);
    expect(esperantoHome.faq[1].answer).toMatch(
      /Melodiaj ekzercoj uzas mikrofonon/,
    );
  });

  it("preserves anonymous country eligibility and complete stage coverage", () => {
    expect(esperantoLearning.leaderboardNotice).toMatch(
      /almenaŭ 10.*notlegado/,
    );
    for (const notice of [
      esperantoLearning.reviewNotice,
      esperantoLearning.dailyNotice,
    ]) {
      expect(notice).toMatch(/ne aldonas poentojn al la landa sumo/);
    }
    expect(esperantoTranslations.leaderboard.privacyNote).toMatch(
      /IP-adresoj ne konserviĝas/,
    );
    expect(esperantoTranslations.leaderboard.privacyNote).toMatch(
      /7 tagoj.*90 tagoj/,
    );
    expect(esperantoTranslations.navigation).toBe(esperantoNavigation);
    expect(esperantoTranslations.learning).toBe(esperantoLearning);
    expect(esperantoChallenge.worldTitles).toHaveLength(4);
    expect(esperantoChallenge.worldObjectives).toHaveLength(4);
    expect(Object.keys(esperantoChallenge.stagesById)).toHaveLength(24);
    for (let world = 1; world <= 4; world++) {
      for (let stage = 1; stage <= 6; stage++) {
        const entry = esperantoChallenge.stagesById[`w${world}-s${stage}`];
        expect(entry.title.trim()).not.toBe("");
        expect(entry.objective).toBe(
          esperantoChallenge.worldObjectives[world - 1],
        );
      }
    }
  });
});
