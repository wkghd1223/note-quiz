"use client";

import Link from "next/link";
import {
  FaArrowRight,
  FaBook,
  FaHeadphones,
  FaMusic,
  FaWaveSquare,
} from "react-icons/fa";
import { useTranslation } from "@/hooks/useTranslation";
import Header from "@/components/layouts/header";
import { localizedHref } from "@/lib/i18n/locale";
import { homeCopy } from "@/lib/i18n/home";
import { challengeEnabled } from "@/features/challenge/config";

const focusStyle =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2";

export default function HomePage() {
  const { t, language, locale } = useTranslation();
  const copy = homeCopy(language, challengeEnabled);

  return (
    <div className="app-shell min-h-screen bg-[#f6f7fb] text-slate-950">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4">
          <Header variant="compact" />
        </div>
      </div>
      <main className="mx-auto w-full min-w-0 max-w-6xl px-3 pb-10 pt-5 sm:px-4 sm:pt-8">
        <section aria-labelledby="home-heading">
          <div className="mb-4 sm:mb-6">
            <p className="mb-2 text-xs font-semibold text-violet-800">
              {copy.access}
            </p>
            <h1
              id="home-heading"
              className="max-w-3xl text-2xl font-black leading-tight tracking-tight [text-wrap:balance] sm:text-4xl"
            >
              {copy.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              {copy.introduction}
            </p>
          </div>
          <div
            className={`grid min-w-0 gap-3 ${challengeEnabled ? "md:grid-cols-2" : "max-w-2xl"}`}
          >
            <section
              aria-labelledby="home-basic-heading"
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-5"
            >
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 id="home-basic-heading" className="text-lg font-bold">
                  {t.navigation.practice}
                </h2>
                <p className="text-xs text-slate-500">{copy.basicHint}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["note", FaBook],
                    ["ear", FaHeadphones],
                    ["interval", FaWaveSquare],
                    ["chord", FaMusic],
                  ] as const
                ).map(([mode, Icon]) => (
                  <Link
                    key={mode}
                    href={localizedHref(`/practice/${mode}`, locale)}
                    className={`home-practice-card group flex min-h-[76px] min-w-0 items-start gap-2 rounded-lg border border-violet-100 bg-violet-50/40 p-3 hover:border-violet-400 hover:bg-violet-50 ${focusStyle}`}
                  >
                    <Icon
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-sm text-violet-800"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-violet-900">
                        {t.learning[mode]}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-600 [overflow-wrap:anywhere]">
                        {copy.modeDescriptions[mode]}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
            {challengeEnabled && (
              <section
                aria-labelledby="home-melody-heading"
                className="flex min-w-0 flex-col rounded-xl border border-violet-200 bg-[#f1edfb] p-3 sm:p-5"
              >
                <h2 id="home-melody-heading" className="text-lg font-bold">
                  {t.navigation.melody}
                </h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-slate-700">
                  {copy.melodyDescription}
                </p>
                <p className="mb-3 mt-2 text-xs leading-5 text-violet-800">
                  {copy.melodyFeatures}
                </p>
                <Link
                  href={localizedHref("/melody", locale)}
                  className={`motion-control mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-violet-800 px-3 py-2 text-sm font-bold text-white hover:bg-violet-950 ${focusStyle}`}
                >
                  {copy.melodyAction}
                  <FaArrowRight
                    aria-hidden="true"
                    className="shrink-0 text-xs"
                  />
                </Link>
              </section>
            )}
          </div>
          <Link
            href={localizedHref("/practice/note?leaderboard=open", locale)}
            className={`mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-violet-800 underline underline-offset-4 ${focusStyle}`}
          >
            {t.leaderboard.navTitle}
            <FaArrowRight aria-hidden="true" className="text-xs" />
          </Link>
        </section>

        <section
          aria-labelledby="home-how-heading"
          className="mt-6 border-t border-slate-200 pt-6 sm:mt-10 sm:pt-8"
        >
          <h2 id="home-how-heading" className="text-xl font-bold">
            {copy.howTitle}
          </h2>
          <ol className="mt-4 grid gap-5 md:grid-cols-3 md:gap-6">
            {copy.steps.map((step, index) => (
              <li key={step.title} className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-800"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="home-faq-heading"
          className="mt-7 border-t border-slate-200 pt-6 sm:mt-10 sm:pt-8"
        >
          <h2 id="home-faq-heading" className="text-xl font-bold">
            {copy.faqTitle}
          </h2>
          <div className="mt-3 divide-y divide-slate-200">
            {copy.faq.map((item) => (
              <details key={item.question} className="group py-1">
                <summary
                  className={`min-h-11 cursor-pointer rounded-lg py-3 text-sm font-semibold ${focusStyle}`}
                >
                  {item.question}
                </summary>
                <p className="max-w-3xl pb-3 text-sm leading-6 text-slate-600">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
