import { expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locale";
import { getTranslation } from "@/lib/i18n/translations";
import { theoryLabel } from "./theoryLabel";

it.each(SUPPORTED_LOCALES)(
  "keeps the existing theory/history labels in %s",
  (locale) => {
    const copy = getTranslation(locale).learning;
    expect(theoryLabel(copy, "higher")).toBe(copy.higher);
    expect(theoryLabel(copy, "M3")).toBe(copy.interval_M3);
    expect(theoryLabel(copy, "major")).toBe(copy.quality_major);
    expect(theoryLabel(copy, "inversion_first")).toBe(copy.first);
    expect(theoryLabel(copy, "inversion_unknown")).toBe(copy.inversion);
    expect(theoryLabel(copy, "progression_I-IV-V-I")).toBe("I → IV → V → I");
    expect(theoryLabel(copy, "unknown-value")).toBe("unknown → value");
  },
);
