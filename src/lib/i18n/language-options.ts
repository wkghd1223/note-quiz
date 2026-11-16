import type { PopoverSelectOption } from "@/components/ui/PopoverSelect";

/** Native names are stable metadata, independent of the current UI language. */
export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English", lang: "en", dir: "ltr" },
  { value: "ko", label: "한국어", lang: "ko", dir: "ltr" },
  { value: "ja", label: "日本語", lang: "ja", dir: "ltr" },
  { value: "es", label: "Español", lang: "es", dir: "ltr" },
  { value: "de", label: "Deutsch", lang: "de", dir: "ltr" },
  { value: "fr", label: "Français", lang: "fr", dir: "ltr" },
  { value: "zh", label: "简体中文", lang: "zh-Hans", dir: "ltr" },
  { value: "pt", label: "Português (Brasil)", lang: "pt-BR", dir: "ltr" },
  { value: "ru", label: "Русский", lang: "ru", dir: "ltr" },
  { value: "ka", label: "ქართული", lang: "ka", dir: "ltr" },
  { value: "eo", label: "Esperanto", lang: "eo", dir: "ltr" },
] as const satisfies readonly PopoverSelectOption<Language>[];
