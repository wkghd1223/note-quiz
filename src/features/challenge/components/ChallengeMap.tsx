"use client";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { localizedHref } from "@/lib/i18n/locale";
import { challengeCopy } from "../i18n";
import { worlds } from "../data/worlds";
import { stages } from "../data/stages";
import { isStageUnlocked } from "../store/progress";
import { useChallengeProgress } from "../hooks/useChallengeProgress";
import ChallengeShell, {
  primaryButton,
  secondaryButton,
} from "./ChallengeShell";
export default function ChallengeMap() {
  const { language, locale } = useTranslation(),
    c = challengeCopy(language),
    p = useChallengeProgress();
  const completed = new Set(
    Object.values(p.progress.records)
      .filter((r) => r.bestStars > 0)
      .map((r) => r.stageId),
  );
  const next =
    stages.find(
      (s) => isStageUnlocked(s.id, p.progress) && !completed.has(s.id),
    ) ?? stages[stages.length - 1];
  return (
    <ChallengeShell>
      <div className="mb-7 max-w-2xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-violet-800">
          4 × 6
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">{c.title}</h1>
        <p className="mt-3 text-slate-600">{c.intro}</p>
        <p className="mt-2 text-sm text-slate-600">{c.profileRecords}</p>
        <Link
          className={`${primaryButton} mt-5`}
          href={localizedHref(`/challenge/play/${next.id}`, locale)}
        >
          {c.continue} · {next.world}—{String(next.sequence).padStart(2, "0")}
        </Link>
      </div>
      {!p.hydrated && <p role="status">{c.loading}</p>}
      {p.warning && (
        <p
          role="status"
          className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
        >
          {c.storageWarning}
        </p>
      )}
      <nav aria-label={c.worlds}>
        <ol className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {worlds.map((world, index) => {
            const done = world.stageIds.filter((id) =>
              completed.has(id),
            ).length;
            return (
              <li key={world.id}>
                <Link
                  href={localizedHref(`/challenge/world/${world.id}`, locale)}
                  className="flex min-h-28 items-center gap-4 p-4 hover:bg-violet-50 sm:p-6"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xl font-bold text-violet-900">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold">
                      {c.worldTitles[index]}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      {c.worldObjectives[index]}
                    </span>
                    <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full bg-violet-700"
                        style={{ width: `${(done / 6) * 100}%` }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-slate-600">
                    {done}/6 ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
      <button
        className={`${secondaryButton} mt-7 text-sm`}
        onClick={() => {
          if (window.confirm(c.resetConfirm)) p.reset();
        }}
      >
        {c.reset}
      </button>
    </ChallengeShell>
  );
}
