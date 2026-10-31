"use client";
import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { LearningData } from "@/lib/practice/history";
import { weakestAreas } from "@/lib/practice/history";
import {
  parsePracticeConfig,
  type PracticeConfig,
} from "@/lib/practice/config";
import { theoryLabel } from "./TheoryPracticeMode";
export default function LearningHistory({
  data,
  available,
  onReset,
  onPractice,
}: {
  data: LearningData;
  available: boolean;
  onReset: () => void;
  onPractice: (config: PracticeConfig) => void;
}) {
  const { t, language } = useTranslation(),
    c = t.learning,
    weak = weakestAreas(data.sessions);
  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold">{c.history}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{c.localOnly}</p>
      {!available && (
        <p role="status" className="mt-2 text-sm text-amber-800">
          {c.storageUnavailable}
        </p>
      )}
      {!data.sessions.length ? (
        <p className="mt-4 text-sm">{c.noHistory}</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2">{c.chooseMode}</th>
                  <th>{c.difficulty}</th>
                  <th>{t.scoreboard.accuracy}</th>
                  <th>{c.progress}</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions
                  .slice(-8)
                  .reverse()
                  .map((entry, i) => (
                    <tr
                      key={`${entry.at}-${i}`}
                      className="border-b border-slate-100"
                    >
                      <td className="py-3 pr-3">
                        <p>{c[entry.mode]}</p>
                        {entry.categories.length > 0 && (
                          <details className="mt-1 text-xs text-slate-500">
                            <summary className="cursor-pointer">
                              {c.task}
                            </summary>
                            {entry.categories.map((category) => (
                              <p
                                key={category.id}
                                className="mt-1 [overflow-wrap:anywhere]"
                              >
                                {entry.mode === "note"
                                  ? t.clefs[category.id as ClefType]
                                  : theoryLabel(c, category.id)}
                                : {category.correct}/{category.total}
                              </p>
                            ))}
                          </details>
                        )}
                        <time className="text-xs text-slate-500">
                          {new Date(entry.at).toLocaleDateString(language)}
                        </time>
                      </td>
                      <td className="pr-2">
                        {c[entry.difficulty as "beginner"]}
                      </td>
                      <td>
                        {entry.total
                          ? `${Math.round((entry.correct / entry.total) * 100)}%`
                          : "—"}
                      </td>
                      <td>
                        {entry.completed ? c.complete : c.stopped}
                        <span className="block text-xs text-slate-500">
                          {entry.correct}/{entry.total}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="mt-4 grid gap-2">
        {weak.length ? (
          weak.map((area, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                const config = parsePracticeConfig(area.configuration).config;
                if (area.mode === "interval") {
                  config.task = ["higher", "lower", "same"].includes(area.id)
                    ? "direction"
                    : "interval";
                  config.focus = area.id;
                }
                if (area.mode === "chord") {
                  if (area.id.startsWith("quality_")) {
                    config.task = "quality";
                    config.focus = area.id.slice(8);
                  } else if (area.id.startsWith("inversion_")) {
                    config.task = "inversion";
                    config.focus = area.id.slice(10);
                  } else if (area.id.startsWith("progression_")) {
                    config.task = "progression";
                    config.focus = area.id.slice(12);
                  }
                }
                if (
                  area.mode === "note" &&
                  ["treble", "bass", "alto", "tenor"].includes(area.id)
                )
                  config.clef = area.id as ClefType;
                onPractice(config);
              }}
              className="min-h-11 rounded-lg border border-[#ded6f7] px-3 py-2 text-left text-sm font-bold text-[#5b21b6]"
            >
              {c.practiceType}:{" "}
              {area.mode === "note"
                ? t.clefs[area.id as ClefType]
                : theoryLabel(c, area.id)}{" "}
              ({area.correct}/{area.total})
            </button>
          ))
        ) : (
          <p className="text-sm text-slate-500">{c.insufficient}</p>
        )}
      </div>
      <button
        type="button"
        className="mt-4 min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold"
        onClick={onReset}
      >
        {c.clearHistory}
      </button>
    </section>
  );
}
