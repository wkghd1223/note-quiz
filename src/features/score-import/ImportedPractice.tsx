"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FaRegFileAudio } from "react-icons/fa";
import { useTranslation } from "@/hooks/useTranslation";
import { getScoreDraft } from "@/features/melody/score-draft";
import { melodySourceCopy } from "@/features/melody/sources";
import { MelodyHeading } from "@/features/melody/components/MelodyWorkspace";
import { importCopy, type ImportWords } from "./copy";
import { reason, fileMessage } from "./score-error";
import { readScoreFile } from "./model";
import type { ImportedScore } from "./types";
import ScorePracticeWorkspace from "./ScorePracticeWorkspace";
import ScoreFileButton, { openScoreLabel } from "./ScoreFileButton";

function importMessage(code: string, w: ImportWords) {
  return code === "unsupportedFile" || code === "unsupportedNotation"
    ? w.unsupportedImport
    : fileMessage(code, w);
}

export default function ImportedPractice() {
  const { language } = useTranslation();
  const words = useMemo(() => importCopy(language), [language]);
  const draft = getScoreDraft();
  const [request, setRequest] = useState<{ file: File } | null>(null);
  const [loaded, setLoaded] = useState<{
    score: ImportedScore;
    version: number;
  } | null>(() =>
    draft.current ? { score: draft.current.original, version: 0 } : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const importJob = useRef<AbortController | null>(null);
  const openFile = (file: File) => {
    importJob.current?.abort();
    setLoading(true);
    setError("");
    setRequest({ file });
  };
  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    importJob.current = controller;
    void readScoreFile(request.file, controller.signal)
      .then((score) => {
        if (!controller.signal.aborted)
          setLoaded((last) => ({
            score,
            version: (last?.version ?? 0) + 1,
          }));
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(reason(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request]);

  if (loaded)
    return (
      <ScorePracticeWorkspace
        key={loaded.version}
        original={loaded.score}
        draft={draft}
        headerAction={(locked, dirty) => (
          <ScoreFileButton
            label={openScoreLabel[language]}
            disabled={locked && !loading}
            onFile={(file) => {
              if (!dirty || window.confirm(words.discard)) openFile(file);
            }}
          />
        )}
        loading={loading}
        errorMessage={error && importMessage(error, words)}
      />
    );
  return (
    <section className="grid min-w-0 gap-4">
      <MelodyHeading title={melodySourceCopy[language].upload} />
      <div
        data-score-drop-zone
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files"))
            event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) openFile(file);
        }}
        className="grid justify-items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center sm:py-16"
      >
        <FaRegFileAudio
          aria-hidden="true"
          className="h-8 w-8 text-violet-700"
        />
        <p className="max-w-md text-sm leading-6 text-slate-600">
          {melodySourceCopy[language].openHint}
        </p>
        <ScoreFileButton label={openScoreLabel[language]} onFile={openFile} />
        {loading && <p role="status">{words.loading}</p>}
        {error && (
          <p role="alert" className="text-red-800">
            {importMessage(error, words)}
          </p>
        )}
      </div>
    </section>
  );
}
