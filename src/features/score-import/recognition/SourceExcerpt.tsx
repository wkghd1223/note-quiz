"use client";

import { useEffect, useState } from "react";
import type { ImportedScore } from "../types";
import type { ImportWords } from "../copy";

export default function SourceExcerpt({
  excerpt,
  words,
}: {
  excerpt: NonNullable<ImportedScore["sourceExcerpt"]>;
  words: ImportWords;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(excerpt.image);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [excerpt.image]);
  return (
    <details className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <summary className="cursor-pointer text-sm font-semibold">
        {words.sourceImage} · {words.page} {excerpt.page}
      </summary>
      {url && (
        // The image is a tab-local blob.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={words.sourceImage}
          className="mt-2 max-h-96 w-full object-contain"
        />
      )}
    </details>
  );
}
