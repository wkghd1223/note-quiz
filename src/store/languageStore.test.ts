import { afterEach, describe, expect, it, vi } from "vitest";
import { useLanguageStore } from "./languageStore";

afterEach(() => {
  useLanguageStore.setState({ language: "en", isInitialized: false });
  vi.unstubAllGlobals();
});

describe.each([
  { language: "ka" as const, browser: "ka-GE" },
  { language: "eo" as const, browser: "eo" },
])("$language language preference", ({ language, browser }) => {
  it("initializes the browser language and restores the saved preference", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { language: browser });
    useLanguageStore.getState().initializeLanguage();
    expect(useLanguageStore.getState()).toMatchObject({
      language,
      isInitialized: true,
    });

    useLanguageStore.setState({ language: "en", isInitialized: false });
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () =>
          JSON.stringify({
            state: { language, isInitialized: true },
            version: 0,
          }),
        setItem: vi.fn(),
      },
    });
    vi.stubGlobal("navigator", { language: "en-US" });
    await useLanguageStore.persist.rehydrate();
    useLanguageStore.getState().initializeLanguage();
    expect(useLanguageStore.getState()).toMatchObject({
      language,
      isInitialized: true,
    });
  });

  it("still changes language when preference storage is unavailable", async () => {
    const blocked = () => {
      throw new Error("Controlled blocked storage");
    };
    vi.stubGlobal("window", {
      localStorage: { getItem: blocked, setItem: blocked, removeItem: blocked },
    });
    await useLanguageStore.persist.rehydrate();
    expect(() =>
      useLanguageStore.getState().setLanguage(language),
    ).not.toThrow();
    expect(useLanguageStore.getState().language).toBe(language);
  });
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

describe("Russian language preference", () => {
  it.each(["ru-RU", "ru-ru", "ru", "ru-BY"])(
    "detects %s as the supported Russian language",
    (language) => {
      vi.stubGlobal("window", {});
      vi.stubGlobal("navigator", { language });
      useLanguageStore.getState().initializeLanguage();
      expect(useLanguageStore.getState()).toMatchObject({
        language: "ru",
        isInitialized: true,
      });
    },
  );

  it("restores Russian from existing storage despite a different browser language", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () =>
          JSON.stringify({
            state: { language: "ru", isInitialized: true },
            version: 0,
          }),
        setItem: vi.fn(),
      },
    });
    vi.stubGlobal("navigator", { language: "en-US" });
    await useLanguageStore.persist.rehydrate();
    useLanguageStore.getState().initializeLanguage();
    expect(useLanguageStore.getState()).toMatchObject({
      language: "ru",
      isInitialized: true,
    });
  });

  it("changes to Russian when browser storage is blocked", async () => {
    const blocked = () => {
      throw new Error("Storage blocked");
    };
    vi.stubGlobal("window", {
      localStorage: { getItem: blocked, setItem: blocked, removeItem: blocked },
    });
    vi.stubGlobal("navigator", { language: "en-US" });
    await useLanguageStore.persist.rehydrate();
    useLanguageStore.getState().initializeLanguage();
    expect(() => useLanguageStore.getState().setLanguage("ru")).not.toThrow();
    expect(useLanguageStore.getState().language).toBe("ru");
  });
});
