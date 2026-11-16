import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LanguageSelector from "./LanguageSelector";
import PopoverSelect from "./PopoverSelect";
import { LANGUAGE_OPTIONS } from "@/lib/i18n/language-options";

const fixture = vi.hoisted(() => ({
  pathname: "/practice/ear",
  language: "en" as Language,
  push: vi.fn(),
  setLanguage: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => fixture.pathname,
  useRouter: () => ({ push: fixture.push }),
}));
vi.mock("@/store/languageStore", () => ({
  useLanguageStore: () => ({ setLanguage: fixture.setLanguage }),
}));
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    language: fixture.language,
    t: { settingsLabels: { language: "Language" }, ui: { close: "Close" } },
  }),
}));
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", {
    location: new URL(
      "https://note-quiz.com/practice/ear?mode=ear&sound=1#history",
    ),
  });
  fixture.pathname = "/practice/ear";
  fixture.language = "en";
  fixture.push.mockReset();
  fixture.setLanguage.mockReset();
});
afterEach(() => vi.unstubAllGlobals());
function adapter() {
  const wrapper = LanguageSelector({
    className: "shrink-0",
  }) as React.ReactElement<{
    className: string;
    children: React.ReactElement<
      React.ComponentProps<typeof PopoverSelect<Language>>
    >;
  }>;
  expect(wrapper?.props.className).toBe("language-selector shrink-0");
  const picker = wrapper?.props.children as React.ReactElement<
    React.ComponentProps<typeof PopoverSelect<Language>>
  >;
  expect(picker.type).toBe(PopoverSelect);
  return picker.props;
}

describe("language picker adapter", () => {
  it("passes the translated labels and all eleven native names in their original order", () => {
    const props = adapter();
    expect(props.label).toBe("Language");
    expect(props.closeLabel).toBe("Close");
    expect(props.options).toBe(LANGUAGE_OPTIONS);
    expect(props.options.map(({ value }) => value)).toEqual([
      "en",
      "ko",
      "ja",
      "es",
      "de",
      "fr",
      "zh",
      "pt",
      "ru",
      "ka",
      "eo",
    ]);
    expect(props.options.find(({ value }) => value === "pt")).toMatchObject({
      label: "Português (Brasil)",
      lang: "pt-BR",
      dir: "ltr",
    });
    expect(props.options.find(({ value }) => value === "zh")?.lang).toBe(
      "zh-Hans",
    );
  });
  it("changes unprefixed routes in place through the existing store", () => {
    adapter().onValueChange("ko");
    expect(fixture.setLanguage).toHaveBeenCalledExactlyOnceWith("ko");
    expect(fixture.push).not.toHaveBeenCalled();
  });
  it("uses router navigation for prefixed routes and preserves query/hash byte for byte", () => {
    fixture.pathname = "/en/practice/ear";
    adapter().onValueChange("ko");
    expect(fixture.push).toHaveBeenCalledExactlyOnceWith(
      "/ko/practice/ear?mode=ear&sound=1#history",
    );
    expect(fixture.setLanguage).not.toHaveBeenCalled();
  });
  it.each(["/practice/ear", "/en/practice/ear"])(
    "reselection has no store or router action on %s",
    (pathname) => {
      fixture.pathname = pathname;
      adapter().onValueChange("en");
      expect(fixture.push).not.toHaveBeenCalled();
      expect(fixture.setLanguage).not.toHaveBeenCalled();
    },
  );
});
