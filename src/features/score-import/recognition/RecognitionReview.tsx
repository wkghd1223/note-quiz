"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { settingsActionClassName as button } from "@/components/practice/SettingsControls";
import { useTranslation } from "@/hooks/useTranslation";
import { MelodyHeading } from "@/features/melody/components/MelodyWorkspace";
import type { ImportWords } from "../copy";
import { readScoreFile } from "../model";
import ScoreFileButton, { openScoreLabel } from "../ScoreFileButton";
import type { ImportedScore } from "../types";
import { openRecognitionSource, recognizePage } from "./source";

type Source = Awaited<ReturnType<typeof openRecognitionSource>>;
const primary = button + " !border-violet-800 !bg-violet-800 !text-white";

function failureMessage(failure: unknown, words: ImportWords) {
  return failure instanceof Error && failure.message === "fileTooLarge"
    ? words.tooLarge
    : words.recognitionFailed;
}

function excerptOf(canvas: HTMLCanvasElement, top: number, bottom: number) {
  if (top === 0 && bottom === 100) return canvas;
  const excerpt = document.createElement("canvas");
  const y = Math.floor((canvas.height * top) / 100);
  excerpt.width = canvas.width;
  excerpt.height = Math.ceil((canvas.height * bottom) / 100) - y;
  const context = excerpt.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(canvas, 0, -y);
  return excerpt;
}

function imageOf(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("image"))),
      "image/png",
    ),
  );
}

function PageReview({
  source,
  page,
  words,
  onAccept,
}: {
  source: Source;
  page: number;
  words: ImportWords;
  onAccept: (score: ImportedScore) => void;
}) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [crop, setCrop] = useState({ top: 0, bottom: 100 });
  const [score, setScore] = useState<ImportedScore | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const job = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void source
      .render(page, controller.signal)
      .then((image) => {
        if (!controller.signal.aborted) setCanvas(image);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure : new Error());
      });
    return () => {
      controller.abort();
      job.current?.abort();
    };
  }, [source, page]);

  const mountImage = useCallback(
    (element: HTMLDivElement | null) => {
      if (canvas && element) {
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        canvas.style.display = "block";
        element.replaceChildren(canvas);
      }
    },
    [canvas],
  );

  const recognize = async () => {
    if (!canvas || job.current) return;
    const controller = new AbortController();
    job.current = controller;
    setBusy(true);
    setError(null);
    try {
      const excerpt = excerptOf(canvas, crop.top, crop.bottom);
      const file = await recognizePage(excerpt, controller.signal);
      const parsed = await readScoreFile(file, controller.signal);
      const image = await imageOf(excerpt);
      if (!controller.signal.aborted)
        setScore({ ...parsed, sourceExcerpt: { image, page } });
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure : new Error());
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      job.current = null;
    }
  };
  return (
    <>
      {canvas && (
        <>
          <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-50">
            <div
              className="relative mx-auto"
              style={{
                maxWidth: canvas.width,
                width: `min(100%, ${(canvas.width / canvas.height) * 66}vh)`,
              }}
            >
              <div ref={mountImage} role="img" aria-label={words.sourceImage} />
              {crop.top > 0 && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 border-b-2 border-violet-600 bg-slate-900/40"
                  style={{ height: crop.top + "%" }}
                />
              )}
              {crop.bottom < 100 && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 border-t-2 border-violet-600 bg-slate-900/40"
                  style={{ height: 100 - crop.bottom + "%" }}
                />
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["top", "bottom"] as const).map((edge) => (
              <label className="grid gap-1 text-sm" key={edge}>
                <span>
                  {edge === "top" ? words.cropTop : words.cropBottom} ·{" "}
                  {crop[edge]}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  disabled={busy}
                  value={crop[edge]}
                  aria-valuetext={crop[edge] + "%"}
                  onChange={(event) => {
                    const value = Number(event.currentTarget.value);
                    setCrop(
                      edge === "top"
                        ? { ...crop, top: Math.min(value, crop.bottom - 1) }
                        : { ...crop, bottom: Math.max(value, crop.top + 1) },
                    );
                    setScore(null);
                    setError(null);
                  }}
                />
              </label>
            ))}
          </div>
        </>
      )}
      {((!canvas && !error) || busy) && <p role="status">{words.loading}</p>}
      {error && (
        <p role="alert" className="text-red-800">
          {failureMessage(error, words)}
        </p>
      )}
      {score ? (
        <div className="grid justify-items-start gap-3">
          <h2 className="font-semibold">{words.reviewNotes}</h2>
          <ol className="grid max-h-48 w-full gap-1 overflow-auto text-sm">
            {score.lanes[0].bars.map((bar) => (
              <li key={bar.index}>
                {words.bar} {bar.label} ·{" "}
                {bar.events.map((event) => {
                  const head = event.heads[0];
                  const length =
                    head.duration === 4 ? "1" : `1/${4 / head.duration}`;
                  return (
                    <span
                      key={event.id}
                      className="me-3 inline-block whitespace-nowrap"
                    >
                      {head.step}
                      {head.octave}{" "}
                      <small className="text-slate-600">
                        <span className="sr-only">{words.length} </span>
                        {length}
                      </small>
                    </span>
                  );
                })}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className={primary}
            onClick={() => onAccept(score)}
          >
            {words.editRecognized}
          </button>
        </div>
      ) : (
        canvas && (
          <button
            type="button"
            className={primary + " justify-self-start"}
            disabled={busy}
            onClick={recognize}
          >
            {words.readStaff}
          </button>
        )
      )}
    </>
  );
}

export default function RecognitionReview({
  file,
  words,
  onCancel,
  onReplace,
  onAccept,
}: {
  file: File;
  words: ImportWords;
  onCancel: () => void;
  onReplace: (file: File) => void;
  onAccept: (score: ImportedScore) => void;
}) {
  const { language } = useTranslation();
  const [source, setSource] = useState<Source | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let opened: Source | undefined;
    void openRecognitionSource(file, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) value.close();
        else {
          opened = value;
          setSource(value);
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure : new Error());
      });
    return () => {
      controller.abort();
      opened?.close();
    };
  }, [file]);
  return (
    <section data-recognition-review className="grid min-w-0 gap-3">
      <MelodyHeading
        title={words.recognitionLabel}
        description={words.recognitionScope}
      >
        <div className="flex flex-wrap gap-2">
          <ScoreFileButton
            label={openScoreLabel[language]}
            onFile={onReplace}
          />
          <button type="button" className={button} onClick={onCancel}>
            {words.cancel}
          </button>
        </div>
      </MelodyHeading>
      <div className="grid min-w-0 gap-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        {source ? (
          <>
            {source.pageCount > 1 && (
              <label className="flex items-center gap-2 text-sm">
                {words.page}
                <select
                  className="min-h-11 rounded-lg border border-slate-300 px-2"
                  value={page}
                  onChange={(event) =>
                    setPage(Number(event.currentTarget.value))
                  }
                >
                  {Array.from({ length: source.pageCount }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1} / {source.pageCount}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <PageReview
              key={page}
              source={source}
              page={page}
              words={words}
              onAccept={onAccept}
            />
          </>
        ) : error ? (
          <p role="alert" className="text-red-800">
            {failureMessage(error, words)}
          </p>
        ) : (
          <p role="status">{words.loading}</p>
        )}
      </div>
    </section>
  );
}
