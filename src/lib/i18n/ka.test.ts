import { describe, expect, it } from "vitest";
import { translations } from "./translations";
import { homeCopy } from "./home";
import { melodyCopy } from "@/features/melody/i18n";
import { challengeCopy } from "@/features/challenge/i18n";
import {
  georgianLearning,
  georgianNavigation,
  georgianTranslations,
} from "./ka";
import { georgianBasicHome, georgianHome } from "./home-ka";
import { georgianMelody } from "@/features/melody/i18n-ka";
import { georgianChallenge } from "@/features/challenge/i18n-ka";

function leaves(value: unknown, path = ""): Record<string, string> {
  if (typeof value === "string") return { [path]: value };
  return Object.fromEntries(
    Object.entries(value as object).flatMap(([key, entry]) =>
      Object.entries(leaves(entry, path ? `${path}.${key}` : key)),
    ),
  );
}

const dictionaries = [
  ["practice", georgianTranslations, translations.en],
  ["home", georgianHome, homeCopy("en")],
  [
    "basic home",
    { ...georgianHome, ...georgianBasicHome },
    homeCopy("en", false),
  ],
  ["melody", georgianMelody, melodyCopy("en")],
  ["challenge", georgianChallenge, challengeCopy("en")],
] as const;

describe("explicit Georgian dictionaries before registry integration", () => {
  it.each(dictionaries)(
    "preserves every %s key, array entry and placeholder",
    (_, actual, english) => {
      const translated = leaves(actual),
        reference = leaves(english);
      expect(Object.keys(translated).sort()).toEqual(
        Object.keys(reference).sort(),
      );
      for (const [key, value] of Object.entries(translated)) {
        expect(value.trim(), key).not.toBe("");
        expect(value.match(/\{\w+\}/g) ?? [], key).toEqual(
          reference[key].match(/\{\w+\}/g) ?? [],
        );
        if (["gameTitle", "home.hero.title"].includes(key)) {
          expect(value).toBe("Note Quiz");
        } else {
          expect(value, key).toMatch(/[\u10a0-\u10ff\u1c90-\u1cbf]/);
          expect(value, key).not.toBe(reference[key]);
        }
      }
    },
  );

  it("keeps musical judgments and the 24-stage learning progression distinct", () => {
    expect(georgianTranslations.navigation).toBe(georgianNavigation);
    expect(georgianTranslations.learning).toBe(georgianLearning);
    expect(
      new Set([
        georgianChallenge.pitch,
        georgianChallenge.onset,
        georgianChallenge.duration,
        georgianMelody.rhythm,
      ]).size,
    ).toBe(4);
    expect(georgianChallenge.pitch).toContain("სიმაღლე");
    expect(georgianChallenge.onset).toContain("დაწყების");
    expect(georgianChallenge.duration).toContain("გრძლიობა");
    expect(georgianMelody.livePitchHint).toContain("დასრულების შემდეგ");
    expect(georgianLearning.interval_A4).not.toBe(georgianLearning.interval_d5);
    expect(georgianLearning.inversion).not.toBe(georgianLearning.progression);
    expect(georgianTranslations.solfege.notes).toEqual({
      C: "დო",
      "C#": "დო♯",
      D: "რე",
      "D#": "რე♯",
      E: "მი",
      F: "ფა",
      "F#": "ფა♯",
      G: "სოლ",
      "G#": "სოლ♯",
      A: "ლა",
      "A#": "ლა♯",
      B: "სი",
    });
    expect(Object.keys(georgianChallenge.stagesById)).toHaveLength(24);
    for (let world = 1; world <= 4; world++) {
      for (let stage = 1; stage <= 6; stage++) {
        expect(
          georgianChallenge.stagesById[`w${world}-s${stage}`].objective,
        ).toBe(georgianChallenge.worldObjectives[world - 1]);
      }
    }
  });

  it("explains local microphone analysis, single notes and device limitations", () => {
    for (const privacy of [
      georgianHome.faq[3].answer,
      georgianBasicHome.faq[2].answer,
      georgianMelody.privacy,
      georgianChallenge.micNotice,
    ]) {
      expect(privacy).toContain("ადგილობრივად");
      expect(privacy).toContain("არ იწერება");
      expect(privacy).toContain("არ იტვირთება");
    }
    expect(georgianHome.faq[1].answer).toContain("მხოლოდ ერთ ბგერას");
    expect(georgianChallenge.micNotice).toContain("C4–G4");
    expect(georgianChallenge.pianoMic).toContain("შეზღუდული");
    expect(georgianChallenge.guitarMic).toContain("შეზღუდული");
    expect(georgianChallenge.percussionMic).toContain("მხარდაჭერის გარეშე");
    expect(georgianChallenge.unsupportedInput).toContain("ეკრანის კლავიატურა");
  });

  it("keeps basic-only home free of melody promises and country eligibility separate", () => {
    const basic = Object.values(leaves(georgianBasicHome)).join(" ");
    expect(basic).not.toMatch(/მელოდი/);
    expect(georgianBasicHome.faq[1].answer).toMatch(/^არა\./);
    expect(georgianBasicHome.metaDescription).toContain("რეგისტრაციის გარეშე");
    expect(georgianLearning.leaderboardNotice).toContain("მინიმუმ 10");
    expect(georgianLearning.reviewNotice).toContain(
      "ქვეყნის ქულებს არ ემატება",
    );
    expect(georgianLearning.dailyNotice).toContain("ქვეყნის ქულებს არ ემატება");
    expect(georgianTranslations.leaderboard.privacyNote).toContain(
      "IP მისამართები არ ინახება",
    );
  });
});
