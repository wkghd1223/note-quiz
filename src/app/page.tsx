"use client";

import Link from "next/link";
import {
  FaMusic,
  FaPlay,
  FaBook,
  FaQuestionCircle,
  FaCheckCircle,
  FaHeadphones,
} from "react-icons/fa";
import { useTranslation } from "@/hooks/useTranslation";
import LanguageSelector from "@/components/ui/LanguageSelector";
import { useLanguageStore } from "@/store/languageStore";

export default function HomePage() {
  const { t } = useTranslation();
  const { isInitialized } = useLanguageStore();

  // 언어 초기화가 완료될 때까지 로딩
  if (!isInitialized) {
    return (
      <main className="min-h-[calc(100vh)] bg-gradient-to-br from-blue-50 to-indigo-100"></main>
    );
  }

  return (
    <main className="bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="flex justify-end w-full p-4 sm:p-8">
        <LanguageSelector />
      </header>

      {/* Hero Section */}
      <section className="px-4 sm:px-8 py-8 sm:py-12 text-center">
        <div className="max-w-4xl mx-auto">
          <FaMusic className="text-5xl sm:text-7xl text-blue-600 mx-auto mb-6" />
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-800 mb-4">
            {t.home.hero.title}
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-8 px-2">
            {t.home.hero.description}
          </p>
          <Link
            href="/game"
            className="inline-flex items-center px-8 sm:px-10 py-4 text-lg font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shadow-lg"
          >
            <FaPlay className="mr-2" />
            {t.home.hero.cta}
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 sm:px-8 py-12 sm:py-16 bg-white bg-opacity-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-12 text-center">
            {t.home.features.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <FaHeadphones className="text-4xl text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {t.home.features.soundPlayback.title}
              </h3>
              <p className="text-gray-600">
                {t.home.features.soundPlayback.description}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <FaBook className="text-4xl text-green-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {t.home.features.variousClefs.title}
              </h3>
              <p className="text-gray-600">
                {t.home.features.variousClefs.description}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <FaCheckCircle className="text-4xl text-purple-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {t.home.features.instantFeedback.title}
              </h3>
              <p className="text-gray-600">
                {t.home.features.instantFeedback.description}
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <FaMusic className="text-4xl text-red-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {t.home.features.multiLanguage.title}
              </h3>
              <p className="text-gray-600">
                {t.home.features.multiLanguage.description}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How to Use Section */}
      <section className="px-4 sm:px-8 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-12 text-center">
            {t.home.howToUse.title}
          </h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-600 text-white font-bold text-lg">
                  1
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {t.home.howToUse.step1.title}
                </h3>
                <p className="text-gray-600">
                  {t.home.howToUse.step1.description}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-600 text-white font-bold text-lg">
                  2
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {t.home.howToUse.step2.title}
                </h3>
                <p className="text-gray-600">
                  {t.home.howToUse.step2.description}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-600 text-white font-bold text-lg">
                  3
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {t.home.howToUse.step3.title}
                </h3>
                <p className="text-gray-600">
                  {t.home.howToUse.step3.description}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-600 text-white font-bold text-lg">
                  4
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {t.home.howToUse.step4.title}
                </h3>
                <p className="text-gray-600">
                  {t.home.howToUse.step4.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 sm:px-8 py-12 sm:py-16 bg-white bg-opacity-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-12 text-center">
            {t.home.faq.title}
          </h2>
          <div className="space-y-6">
            <details className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow">
              <summary className="flex items-center gap-3 font-semibold text-gray-800 text-lg">
                <FaQuestionCircle className="text-blue-600" />
                {t.home.faq.q1.question}
              </summary>
              <p className="text-gray-600 mt-4 ml-8">{t.home.faq.q1.answer}</p>
            </details>

            <details className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow">
              <summary className="flex items-center gap-3 font-semibold text-gray-800 text-lg">
                <FaQuestionCircle className="text-blue-600" />
                {t.home.faq.q2.question}
              </summary>
              <p className="text-gray-600 mt-4 ml-8">{t.home.faq.q2.answer}</p>
            </details>

            <details className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow">
              <summary className="flex items-center gap-3 font-semibold text-gray-800 text-lg">
                <FaQuestionCircle className="text-blue-600" />
                {t.home.faq.q3.question}
              </summary>
              <p className="text-gray-600 mt-4 ml-8">{t.home.faq.q3.answer}</p>
            </details>

            <details className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow">
              <summary className="flex items-center gap-3 font-semibold text-gray-800 text-lg">
                <FaQuestionCircle className="text-blue-600" />
                {t.home.faq.q4.question}
              </summary>
              <p className="text-gray-600 mt-4 ml-8">{t.home.faq.q4.answer}</p>
            </details>

            <details className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow">
              <summary className="flex items-center gap-3 font-semibold text-gray-800 text-lg">
                <FaQuestionCircle className="text-blue-600" />
                {t.home.faq.q5.question}
              </summary>
              <p className="text-gray-600 mt-4 ml-8">{t.home.faq.q5.answer}</p>
            </details>

            <details className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow">
              <summary className="flex items-center gap-3 font-semibold text-gray-800 text-lg">
                <FaQuestionCircle className="text-blue-600" />
                {t.home.faq.q6.question}
              </summary>
              <p className="text-gray-600 mt-4 ml-8">{t.home.faq.q6.answer}</p>
            </details>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="px-4 sm:px-8 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-8 text-center">
            {t.home.about.title}
          </h2>
          <div className="bg-white rounded-lg shadow-md p-8 space-y-4 text-gray-700 leading-relaxed">
            <p>{t.home.about.description1}</p>
            <p>{t.home.about.description2}</p>
            <p>{t.home.about.description3}</p>
            <p>{t.home.about.description4}</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 sm:px-8 py-12 sm:py-16 bg-blue-600 text-white text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            {t.home.cta.title}
          </h2>
          <p className="text-lg sm:text-xl mb-8 opacity-90">
            {t.home.cta.description}
          </p>
          <Link
            href="/game"
            className="inline-flex items-center px-8 sm:px-10 py-4 text-lg font-medium text-blue-600 bg-white border border-transparent rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white transition-colors shadow-lg"
          >
            <FaPlay className="mr-2" />
            {t.home.cta.button}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-8 py-8 bg-gray-800 text-gray-300 text-center text-sm">
        <p>{t.home.footer.copyright}</p>
        <p className="mt-2">{t.home.footer.tagline}</p>
      </footer>
    </main>
  );
}
