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
import LanguageSelector from "@/components/ui/LanguageSelector";
import { useLanguageStore } from "@/store/languageStore";

export default function HomePage() {
  const { t } = useTranslation();
  const { isInitialized } = useLanguageStore();

  if (!isInitialized) {
    return <main className="app-shell min-h-screen bg-[#f4f2f8]"></main>;
  }

  return (
    <main className="app-shell min-h-screen bg-[linear-gradient(180deg,_#f7f5fb_0%,_#f2effa_50%,_#f7f5fb_100%)]">
      <header className="border-b border-[#ded6f7] bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6d28d9] to-[#4c1d95] text-white shadow-[0_10px_24px_rgba(91,33,182,0.28)]">
              <FaMusic className="text-xl" />
            </div>
            <div>
              <p className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                {t.gameTitle}
              </p>
              <p className="text-sm font-medium text-[#6d28d9] sm:text-base">
                {t.brandDescription}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <nav className="flex items-center gap-2 rounded-2xl border border-[#ded6f7] bg-[#faf9fe] p-1">
              <Link
                href="/game"
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-[0_8px_18px_rgba(76,29,149,0.08)]"
              >
                {t.gameNavTitle}
              </Link>
              <Link
                href="/ear-training"
                className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
              >
                {t.earTraining.title}
              </Link>
            </nav>
            <LanguageSelector className="w-[5.5rem]" />
          </div>
        </div>
      </header>

      <section className="px-4 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="rounded-[2rem] border border-[#d7cdf7] bg-white p-6 shadow-[0_18px_50px_rgba(76,29,149,0.08)] sm:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#ede9fe] px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-[#6d28d9]">
              <span className="h-2 w-2 rounded-full bg-[#7c3aed]" />
              {t.brandDescription}
            </div>

            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.94] tracking-[-0.05em] text-slate-950 sm:text-6xl">
              {t.home.hero.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              {t.home.hero.description}
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/game"
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#5b21b6] to-[#6d28d9] px-8 py-4 text-lg font-bold text-white shadow-[0_12px_28px_rgba(91,33,182,0.3)] hover:-translate-y-0.5"
              >
                <FaPlay className="mr-2" />
                {t.gameNavTitle}
              </Link>
              <Link
                href="/ear-training"
                className="inline-flex items-center justify-center rounded-2xl border border-[#ded6f7] bg-[#faf9fe] px-8 py-4 text-sm font-bold text-slate-700 transition-colors hover:bg-white"
              >
                <FaHeadphones className="mr-2 text-[#6d28d9]" />
                {t.earTraining.title}
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-[#ede9fe] bg-[#faf9fe] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Mode
                </p>
                <p className="mt-2 text-lg font-black text-slate-950">
                  {t.gameNavTitle}
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-[#ede9fe] bg-[#faf9fe] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Audio
                </p>
                <p className="mt-2 text-lg font-black text-slate-950">
                  {t.earTraining.title}
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-[#ede9fe] bg-[#faf9fe] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Devices
                </p>
                <p className="mt-2 text-lg font-black text-slate-950">Mobile + Web</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-slate-950/70 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.24),transparent_34%),linear-gradient(180deg,_#171129_0%,_#0f172a_100%)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.18)] sm:p-6">
            <div className="absolute right-8 top-8 h-40 w-40 rounded-full bg-[#7c3aed]/20 blur-3xl" />
            <div className="absolute left-8 top-24 h-32 w-32 rounded-full bg-[#38bdf8]/10 blur-3xl" />

            <div className="relative flex h-full min-h-[320px] flex-col">
              <div className="mb-4 flex items-center justify-between rounded-[1.3rem] border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/55">
                    {t.home.hero.previewTitle}
                  </p>
                  <p className="mt-1 text-lg font-black tracking-[-0.04em] text-white">
                    {t.home.hero.previewSubtitle}
                  </p>
                </div>
                <div className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">
                  {t.gameNavTitle}
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <div className="relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#f8fafc] shadow-[0_18px_30px_rgba(15,23,42,0.22)]">
                  <Image
                    src="/clef-note-with-keyboard.png"
                    alt="Note Quiz gameplay preview"
                    width={1280}
                    height={1280}
                    className="h-auto w-full object-cover"
                    priority
                  />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-white/90 p-3 text-center shadow-lg">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      Staff
                    </p>
                    <p className="mt-1 text-sm font-black text-[#5b21b6]">
                      Visual Training
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/12 p-3 text-center text-white">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
                      Input
                    </p>
                    <p className="mt-1 text-sm font-black">Keyboard</p>
                  </div>
                  <div className="rounded-2xl bg-white/12 p-3 text-center text-white">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
                      Goal
                    </p>
                    <p className="mt-1 text-sm font-black">Fast Recall</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-8 sm:px-8 sm:pb-12">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <Link
            href="/game"
            className="group rounded-[1.8rem] border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)] transition-transform hover:-translate-y-1"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ede9fe] text-[#5b21b6]">
                <FaBook className="text-2xl" />
              </div>
              <span className="rounded-full bg-[#faf9fe] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Visual Mode
              </span>
            </div>
            <h2 className="mt-6 text-3xl font-black tracking-[-0.05em] text-slate-950">
              {t.gameNavTitle}
            </h2>
            <p className="mt-3 text-base leading-8 text-slate-600">
              {t.messages.startGameInstruction}
            </p>
            <div className="mt-6 inline-flex items-center rounded-2xl bg-gradient-to-r from-[#5b21b6] to-[#6d28d9] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(91,33,182,0.22)]">
              <FaPlay className="mr-2" />
              {t.startGame}
            </div>
          </Link>

          <Link
            href="/ear-training"
            className="group rounded-[1.8rem] border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)] transition-transform hover:-translate-y-1"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef9f3] text-[#15803d]">
                <FaWaveSquare className="text-2xl" />
              </div>
              <span className="rounded-full bg-[#faf9fe] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Audio Mode
              </span>
            </div>
            <h2 className="mt-6 text-3xl font-black tracking-[-0.05em] text-slate-950">
              {t.earTraining.title}
            </h2>
            <p className="mt-3 text-base leading-8 text-slate-600">
              {t.earTraining.description}
            </p>
            <div className="mt-6 inline-flex items-center rounded-2xl border border-[#ded6f7] bg-[#faf9fe] px-5 py-3 text-sm font-bold text-slate-800">
              <FaHeadphones className="mr-2 text-[#6d28d9]" />
              {t.earTraining.start}
            </div>
          </Link>
        </div>
      </section>

      <section className="border-y border-[#e7e1f5] bg-white/65 px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
            {t.home.features.title}
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[1.6rem] border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
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

            <div className="rounded-[1.6rem] border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
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

            <div className="rounded-[1.6rem] border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
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

            <div className="rounded-[1.6rem] border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
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
                className="flex gap-4 rounded-[1.5rem] border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)]"
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
            {[t.home.faq.q1, t.home.faq.q2, t.home.faq.q3, t.home.faq.q4, t.home.faq.q5, t.home.faq.q6].map(
              (item, index) => (
                <details
                  key={index}
                  className="rounded-[1.5rem] border border-[#ded6f7] bg-white p-6 shadow-[0_14px_40px_rgba(76,29,149,0.08)]"
                >
                  <summary className="flex items-center gap-3 text-lg font-bold text-slate-900">
                    <FaQuestionCircle className="text-[#6d28d9]" />
                    {item.question}
                  </summary>
                  <p className="ml-8 mt-4 leading-7 text-slate-600">{item.answer}</p>
                </details>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
            {t.home.about.title}
          </h2>
          <div className="space-y-4 rounded-[2rem] border border-[#ded6f7] bg-white p-8 leading-8 text-slate-600 shadow-[0_14px_40px_rgba(76,29,149,0.08)]">
            <p>{t.home.about.description1}</p>
            <p>{t.home.about.description2}</p>
            <p>{t.home.about.description3}</p>
            <p>{t.home.about.description4}</p>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-[#5b21b6] bg-gradient-to-r from-[#5b21b6] via-[#6d28d9] to-[#7c3aed] px-8 py-12 text-center text-white shadow-[0_20px_40px_rgba(91,33,182,0.26)]">
          <h2 className="mb-6 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
            {t.home.cta.title}
          </h2>
          <p className="mb-8 text-lg opacity-90 sm:text-xl">
            {t.home.cta.description}
          </p>
          <Link
            href="/game"
            className="inline-flex items-center rounded-2xl bg-white px-8 py-4 text-lg font-bold text-[#5b21b6] shadow-[0_12px_28px_rgba(15,23,42,0.16)] hover:-translate-y-0.5"
          >
            <FaPlay className="mr-2" />
            {t.home.cta.button}
          </Link>
        </div>
      </section>

      <footer className="bg-gray-800 px-4 py-8 text-center text-sm text-gray-300 sm:px-8">
        <p>{t.home.footer.copyright}</p>
        <p className="mt-2">{t.home.footer.tagline}</p>
      </footer>
    </main>
  );
}
