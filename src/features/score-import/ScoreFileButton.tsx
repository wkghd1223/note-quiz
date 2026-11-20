"use client";

import { useRef } from "react";
import { supportsPdf } from "./recognition/source";
import { acceptedScoreFiles } from "./formats/read-document";
import { settingsActionClassName } from "@/components/practice/SettingsControls";

export const openScoreLabel: Record<Language, string> = {
  en: "Open my score",
  ko: "내 악보 열기",
  ja: "楽譜を開く",
  es: "Abrir mi partitura",
  de: "Eigene Partitur öffnen",
  fr: "Ouvrir ma partition",
  zh: "打开我的乐谱",
  pt: "Abrir minha partitura",
  ru: "Открыть мои ноты",
  ka: "ჩემი ნოტების გახსნა",
  eo: "Malfermi mian partituron",
};

export default function ScoreFileButton({
  label,
  disabled,
  onFile,
}: {
  label: string;
  disabled?: boolean;
  onFile: (file: File) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className={settingsActionClassName}
        disabled={disabled}
        onClick={() => picker.current?.click()}
      >
        {label}
      </button>
      <input
        ref={picker}
        type="file"
        hidden
        accept={
          acceptedScoreFiles + ",.png,.jpg,.jpeg" + (supportsPdf ? ",.pdf" : "")
        }
        aria-label={label}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}
