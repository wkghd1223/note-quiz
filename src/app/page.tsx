"use client";

import Image from "next/image";
import Link from "next/link";
import {
  FaBook,
  FaCheckCircle,
  FaHeadphones,
  FaMusic,
  FaPlay,
  FaQuestionCircle,
  FaWaveSquare,
} from "react-icons/fa";
import { useTranslation } from "@/hooks/useTranslation";
import Header from "@/components/layouts/header";
import { useLanguageStore } from "@/store/languageStore";

export default function HomePage() {
  const { t } = useTranslation();
  const { isInitialized } = useLanguageStore();

  if (!isInitialized) {
    return <main className="app-shell min-h-screen bg-[#f4f2f8]"></main>;
  }

  return (
    <main className="app-shell min-h-screen bg-[linear-gradient(180deg,_#f7f5fb_0%,_#f2effa_50%,_#f7f5fb_100%)]">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4">
          <Header variant="compact" />
        </div>
      </div>

      <section className="px-3 py-5 sm:px-4 sm:py-8">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
          <div>
            <h1 className="max-w-3xl text-3xl font-black leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
              {t.home.hero.title}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              {t.learning.entryDescription}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(
                [
                  [
                    "note",
                    t.learning.note,
                    t.home.hero.sightReadingDescription,
                    FaBook,
                  ],
                  [
                    "ear",
                    t.learning.ear,
                    t.earTraining.description,
                    FaHeadphones,
                  ],
                  [
                    "interval",
                    t.learning.interval,
                    t.learning.directionPreset,
                    FaWaveSquare,
                  ],
                  ["chord", t.learning.chord, t.learning.chordPreset, FaMusic],
                ] as const
              ).map(([mode, title, description, Icon]) => (
                <Link
                  key={mode}
                  href={`/practice?mode=${mode}`}
                  className="group flex flex-col items-start rounded-xl border border-[#ded6f7] bg-white p-4 hover:border-[#7c3aed] sm:p-5"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="text-xl text-[#5b21b6]" />
                    <h2 className="text-xl font-black text-slate-950">
                      {title}
                    </h2>
                  </div>
                  <p className="my-3 flex-1 text-sm leading-6 text-slate-600">
                    {description}
                  </p>
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#5b21b6] px-4 text-sm font-bold text-white">
                    <FaPlay />
                    {t.learning.ten}
                  </span>
                </Link>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold text-[#5b21b6]">
              <Link
                href="/practice?share=1&mode=note&clef=bass&length=ten"
                className="inline-flex min-h-11 items-center underline underline-offset-4"
              >
                {t.learning.bassPreset}
              </Link>
              <Link
                href="/practice?mode=note&daily=1"
                className="inline-flex min-h-11 items-center underline underline-offset-4"
              >
                {t.learning.daily}
              </Link>
            </div>
            <Link
              href="/practice?leaderboard=open"
              className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-[#5b21b6] underline underline-offset-4"
            >
              {t.leaderboard.navTitle}
            </Link>
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-slate-950/70 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.24),transparent_34%),linear-gradient(180deg,_#171129_0%,_#0f172a_100%)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.18)] xl:block">
            <p className="mb-3 text-sm font-bold text-white">
              {t.home.hero.previewTitle}
            </p>
            <Image
              src="/clef-note-with-keyboard.png"
              alt={t.home.hero.previewTitle}
              width={1280}
              height={1280}
              className="max-h-[390px] w-full rounded-lg object-contain"
              priority
            />
          </div>
        </div>
      </section>

      <section className="border-y border-[#e7e1f5] bg-white/65 px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
            {t.home.features.title}
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ede9fe] text-[#5b21b6]">
                <FaHeadphones className="text-2xl" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-900">
                {t.home.features.soundPlayback.title}
              </h3>
              <p className="leading-7 text-slate-600">
                {t.home.features.soundPlayback.description}
              </p>
            </div>

            <div className="rounded-xl border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef9f3] text-[#15803d]">
                <FaBook className="text-2xl" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-900">
                {t.home.features.variousClefs.title}
              </h3>
              <p className="leading-7 text-slate-600">
                {t.home.features.variousClefs.description}
              </p>
            </div>

            <div className="rounded-xl border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f1ecfb] text-[#6d28d9]">
                <FaCheckCircle className="text-2xl" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-900">
                {t.home.features.instantFeedback.title}
              </h3>
              <p className="leading-7 text-slate-600">
                {t.home.features.instantFeedback.description}
              </p>
            </div>

            <div className="rounded-xl border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff1f2] text-[#dc2626]">
                <FaMusic className="text-2xl" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-900">
                {t.home.features.multiLanguage.title}
              </h3>
              <p className="leading-7 text-slate-600">
                {t.home.features.multiLanguage.description}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
            {t.home.howToUse.title}
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className="flex gap-4 rounded-xl border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)]"
              >
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5b21b6] to-[#6d28d9] text-lg font-bold text-white shadow-[0_10px_24px_rgba(91,33,182,0.22)]">
                    {step}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-xl font-bold text-slate-900">
                    {step === 1 && t.home.howToUse.step1.title}
                    {step === 2 && t.home.howToUse.step2.title}
                    {step === 3 && t.home.howToUse.step3.title}
                    {step === 4 && t.home.howToUse.step4.title}
                  </h3>
                  <p className="leading-7 text-slate-600">
                    {step === 1 && t.home.howToUse.step1.description}
                    {step === 2 && t.home.howToUse.step2.description}
                    {step === 3 && t.home.howToUse.step3.description}
                    {step === 4 && t.home.howToUse.step4.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#e7e1f5] bg-white/65 px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
            {t.home.faq.title}
          </h2>
          <div className="space-y-6">
            {[
              t.home.faq.q1,
              t.home.faq.q2,
              t.home.faq.q3,
              t.home.faq.q4,
              t.home.faq.q5,
              t.home.faq.q6,
            ].map((item, index) => (
              <details
                key={index}
                className="rounded-xl border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)]"
              >
                <summary className="flex items-center gap-3 text-lg font-bold text-slate-900">
                  <FaQuestionCircle className="text-[#6d28d9]" />
                  {item.question}
                </summary>
                <p className="ml-8 mt-4 leading-7 text-slate-600">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
            {t.home.about.title}
          </h2>
          <div className="space-y-4 rounded-xl border border-[#ded6f7] bg-white p-8 leading-8 text-slate-600 shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
            <p>{t.home.about.description1}</p>
            <p>{t.home.about.description2}</p>
            <p>{t.home.about.description3}</p>
            <p>{t.home.about.description4}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
