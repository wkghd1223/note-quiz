import { afterEach, describe, expect, it, vi } from "vitest";
import { useLanguageStore } from "./languageStore";

afterEach(() => {
  useLanguageStore.setState({ language: "en", isInitialized: false });
  vi.unstubAllGlobals();
});

describe("Portuguese browser language", () => {
  it.each(["pt-BR", "pt-br", "pt", "pt-PT"])(
    "initializes %s with Portuguese copy",
    (language) => {
      vi.stubGlobal("window", {});
      vi.stubGlobal("navigator", { language });
      useLanguageStore.getState().initializeLanguage();
      expect(useLanguageStore.getState()).toMatchObject({
        language: "pt",
        isInitialized: true,
      });
    },
  );

  it("preserves an initialized language preference", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { language: "pt-BR" });
    useLanguageStore.setState({ language: "ko", isInitialized: true });
    useLanguageStore.getState().initializeLanguage();
    expect(useLanguageStore.getState().language).toBe("ko");
  });
});
