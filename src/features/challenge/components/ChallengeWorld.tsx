"use client";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { localizedHref } from "@/lib/i18n/locale";
import { challengeCopy } from "../i18n";
import { stages } from "../data/stages";
import { isStageUnlocked } from "../store/progress";
import { useChallengeProgress } from "../hooks/useChallengeProgress";
import ChallengeShell from "./ChallengeShell";
export default function ChallengeWorld({ worldId }: { worldId: string }) {
  const { language, locale } = useTranslation(),
    c = challengeCopy(language),
    p = useChallengeProgress();
  const world = Number(worldId.slice(1));
  return (
    <ChallengeShell>
      <Link
        className="inline-flex min-h-12 items-center text-sm font-semibold text-violet-800"
        href={localizedHref("/challenge", locale)}
      >
        ‹ {c.worlds}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">
        {world}. {c.worldTitles[world - 1]}
      </h1>
      <p className="mt-3 text-slate-600">{c.worldObjectives[world - 1]}</p>
      {p.warning && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-950"
        >
          {c.storageWarning}
        </p>
      )}
      <ol className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {stages
          .filter((s) => s.world === world)
          .map((s) => {
            const unlocked = isStageUnlocked(s.id, p.progress),
              records = Object.values(p.progress.records).filter(
                (r) => r.stageId === s.id,
              ),
              stars = Math.max(0, ...records.map((r) => r.bestStars));
            return (
              <li key={s.id}>
                <Link
                  href={localizedHref(`/challenge/play/${s.id}`, locale)}
                  className="flex min-h-24 items-center gap-3 p-4 hover:bg-violet-50"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold ${unlocked ? "bg-violet-100 text-violet-900" : "bg-slate-100 text-slate-600"}`}
                  >
                    {String(s.sequence).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {c.stagesById[s.id].title}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      {unlocked
                        ? `${s.bpm} BPM · ${s.measures * 4} ♩`
                        : c.locked}
                    </span>
                  </span>
                  <span
                    className="shrink-0 text-lg text-violet-800"
                    aria-label={`${c.best}: ${stars}/3`}
                  >
                    {"★".repeat(stars)}
                    {"☆".repeat(3 - stars)}
                  </span>
                </Link>
              </li>
            );
          })}
      </ol>
    </ChallengeShell>
  );
}
