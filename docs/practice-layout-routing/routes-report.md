# P-ROUTES implementation report

Status: implementation complete; focused checks passed; integrated type/build/browser verification remains coordinator-owned.

## Behavior and boundaries

- Added static `/practice/note`, `/practice/ear`, `/practice/interval`, `/practice/chord` page trees and their seven locale-prefixed equivalents. Unknown child paths have no matching page; unknown legacy query modes reach `notFound()`.
- Both practice trees now have persistent nested layouts. `PracticeLayoutShell` owns the existing AppShell/header/ticker/ad-safe scroll area. It has no game-store or timer subscriptions. Existing AppShell itself was unchanged.
- Each page mounts a dedicated client entry importing only its mode implementation. Note/ear have separate imports; interval/chord use the existing shared theory implementation with explicit route modes. `PracticeClient` is the shared settings/daily/history controller and only imports mode components as types.
- With coordinator approval, extracted the existing `theoryLabel` implementation verbatim to a pure helper and changed LearningHistory's single import. P-UI owns TheoryPracticeMode's corresponding import/re-export; this worker did not edit that file. This removes the common history component's runtime dependency on a mode component.
- Existing `/practice` without a mode resolves to `/practice/note`, including `/en/practice`, `/ko/practice`, `/ja/practice`, `/es/practice`, `/de/practice`, `/fr/practice`, `/zh/practice`. `next.config.ts` performs HTTP redirects before layout streaming; the server index pages also redirect as a fallback.
- Explicit legacy `?mode=ear|interval|chord|note` links select the corresponding child, retaining incoming query/share/daily/settings/leaderboard intent. Existing `/game`, `/ear-training`, `/leaderboard` redirect directly to matching child destinations. The existing alphaTab webpack configuration and melody routes were preserved.
- The child path overrides stale/conflicting query modes, including when oversized query settings are discarded. Mode navigation and cross-mode history/presets use `router.push`; same-mode config, panel settings and overlays use `router.replace`.
- Note/ear panel setting changes serialize supported actual store settings into the URL, preserving current daily/overlay/fragment intent. URL application suppresses subscription feedback. This lets browser history restore the settings associated with a prior mode. Shared config serialization, daily generation, completion/history/review callbacks and existing controls are retained.
- Overlay-only query changes are excluded from the config signature, preserve the mode key and do not apply/reset config. Sessions stay inside leaf pages, so mode navigation unmounts the old implementation and retains its existing audio/microphone/store cleanup. No store/domain/timer/audio code was changed.
- Locale links/switching, header active state and footer exclusion recognize child paths. Mode metadata uses the existing translated labels. Canonical/language alternates and sitemap entries use the four child paths; sitemap excludes the now-redirecting practice indexes. Existing melody navigation/metadata remains covered by its existing tests.

## Focused verification actually run

```sh
node_modules/.bin/vitest run src/lib/practice/routing.test.ts src/lib/practice/redirects.test.ts src/lib/practice/theoryLabel.test.ts src/lib/practice/config.test.ts src/lib/i18n/locale.test.ts src/lib/i18n/seo.test.ts --no-cache
```

Result: **6 files, 142 tests passed**. This includes 35 routing/config-history contract tests, 18 redirect tests, seven extracted-label regressions, 27 existing config tests, 38 locale tests and 17 SEO/sitemap tests.

The redirect tests execute the installed Next 15 path/query matching and destination preparation functions against the actual `next.config.ts` redirects. They cover mode-free indexes across all eight prefixes, explicit legacy modes and preserved queries, older routes, and unmatched unknown modes/locales. This is focused framework-matcher evidence, not a live HTTP-server observation.

Also passed:

- `node --check scripts/verify-practice-routes.cjs`.
- In-memory TypeScript `transpileModule` syntax diagnostics over all 32 owned TypeScript files: zero errors. This emits no files and is **not** a project type check.
- `git diff --check`: clean.
- Formatter applied only to owned files (LearningHistory's approved import remains a one-line change).

## Coordinator integration handoff

New `scripts/verify-practice-routes.cjs` targets an **already running** isolated snapshot and requires explicit `UI_BASE_URL`; it starts no server. It verifies 32 child pages, eight mode-free HTTP redirects, unknown routes, a legacy shared daily/leaderboard link, shell/header identity through sibling navigation, push versus replace history, same-mode overlay session retention, settings restoration with back/forward, locale switching, matching shared URLs, one footer, canonical/alternates, and mobile/desktop screenshots. Leaderboard and clipboard are fixtures; score submission is forbidden by the runner.

Example (coordinator supplies installed external browser tooling and its isolated port):

```sh
UI_BASE_URL=http://localhost:3014 PLAYWRIGHT_MODULE=/path/to/playwright BROWSER_PATH=/path/to/chrome UI_ARTIFACT_DIR=/tmp/note-quiz-practice-routes node scripts/verify-practice-routes.cjs
```

Not run by this worker: project TypeScript, full unit suite, lint, build, browser integration, physical microphone/audio verification. Per dispatch these belong to the coordinator's isolated snapshot. Runtime persistent-layout/session cleanup claims above describe inspected implementation; the new browser script still needs execution. Root `.next`, node_modules contents, user3001/PID28754, melody3013, package configuration, database and unrelated files were not modified; no servers, packages, commits, pushes or deployments were started.

## Exact files changed by this worker in the initial dispatch

- `src/app/(site)/practice/ChordPracticeEntry.tsx`
- `src/app/(site)/practice/EarPracticeEntry.tsx`
- `src/app/(site)/practice/IntervalPracticeEntry.tsx`
- `src/app/(site)/practice/NotePracticeEntry.tsx`
- `src/app/(site)/practice/PracticeClient.tsx`
- `src/app/(site)/practice/PracticeLayoutShell.tsx`
- `src/app/(site)/practice/chord/page.tsx`
- `src/app/(site)/practice/ear/page.tsx`
- `src/app/(site)/practice/interval/page.tsx`
- `src/app/(site)/practice/layout.tsx`
- `src/app/(site)/practice/note/page.tsx`
- `src/app/(site)/practice/page.tsx`
- `src/app/[locale]/practice/chord/page.tsx`
- `src/app/[locale]/practice/ear/page.tsx`
- `src/app/[locale]/practice/interval/page.tsx`
- `src/app/[locale]/practice/layout.tsx`
- `src/app/[locale]/practice/note/page.tsx`
- `src/app/[locale]/practice/page.tsx`
- `next.config.ts`
- `src/app/sitemap.ts`
- `src/components/layouts/header.tsx`
- `src/components/layouts/GlobalFooter.tsx`
- `src/components/practice/LearningHistory.tsx`
- `src/lib/i18n/locale.ts`
- `src/lib/i18n/locale.test.ts`
- `src/lib/i18n/seo.ts`
- `src/lib/i18n/seo.test.ts`
- `src/lib/practice/routing.ts`
- `src/lib/practice/routing.test.ts`
- `src/lib/practice/redirects.test.ts`
- `src/lib/practice/theoryLabel.ts`
- `src/lib/practice/theoryLabel.test.ts`
- `scripts/verify-practice-routes.cjs`
- `docs/practice-layout-routing/routes-report.md`

## Follow-up: permanent practice migration and retained SEO/sitemap

Task `task_91387c731894`; implemented the coordinator's new user requirement. `st` was interpreted as sitemap, and existing shared settings/state intent remains preserved. Supported legacy practice indexes stay reachable through redirects to their matching leaves.

[Google's URL move guidance](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes) calls for permanent server redirects, self-canonical destination pages, updated hreflang URLs and a sitemap of the new URLs. This implementation applies those signals to the approved practice path migration; it does not perform any Search Console or production action.

- Changed only the new practice-index redirect rules to `permanent: true` (Next 15 HTTP **308**), covering the unprefixed index and all seven locale prefixes, both mode-free note defaults and explicit supported mode queries.
- Both server index fallbacks now use `permanentRedirect`, retaining the same validated destination and full query serialization. Unsupported modes/locales retain the previous 404 behavior; no supported old index was deleted.
- Kept the previously existing `/game`, `/ear-training` and `/leaderboard` redirect configuration unchanged in this follow-up, including their temporary **307** policy.
- SEO helpers now normalize legacy `/practice` inputs to the final mode leaf before producing canonical, hreflang, localized OpenGraph URL/title/description and Twitter copy. Leaf metadata remains based on existing translated mode labels. Redirect-source URLs are not duplicated as canonical destinations.
- The sitemap implementation was preserved: final child routes and existing home/melody/legal/contact pages remain listed. Added direct coverage matching each practice sitemap entry and its language alternates to the final canonical metadata, with no query/hash or old practice index entries.
- The existing browser route verifier now checks actual **308** redirect response status for mode-free indexes, plus 32 explicit-mode redirects with `maxRedirects: 0`, matching locale and share/settings/daily/leaderboard query intent. Its 32 leaf page checks also compare OpenGraph URL and description/title with canonical page and Twitter metadata. This browser script was syntax checked only; coordinator execution remains required.

Focused command actually run:

```sh
node_modules/.bin/vitest run src/lib/practice/redirects.test.ts src/lib/practice/redirectPages.test.ts src/lib/i18n/seo.test.ts --no-cache
```

Result: **3 files, 67 tests passed** (18 actual-config matcher/status tests, 16 server-fallback tests, 33 SEO/sitemap tests). Matcher tests now use installed Next 15's `getRedirectStatus` to verify **308** for practice migration and **307** for the unchanged older redirects. Server-fallback tests call the actual index pages and decode Next's thrown redirect error to verify **308** and the preserved locale/query destination.

Also passed: `node --check scripts/verify-practice-routes.cjs`, in-memory `transpileModule` syntax diagnostics over the seven changed TypeScript files (zero errors; not a project type check), and `git diff --check`. No integrated type/build/browser command or server startup was run; those remain coordinator-owned in the isolated snapshot. Shared active sessions, root `.next`, node_modules, versions, database and package files were untouched.

Exact follow-up files:

- `next.config.ts`
- `src/app/(site)/practice/page.tsx`
- `src/app/[locale]/practice/page.tsx`
- `src/lib/i18n/seo.ts`
- `src/lib/i18n/seo.test.ts`
- `src/lib/practice/redirects.test.ts`
- `src/lib/practice/redirectPages.test.ts` (new)
- `scripts/verify-practice-routes.cjs`
- `docs/practice-layout-routing/routes-report.md`

## Follow-up: safely narrow redirect test errors

Task `task_d031bf588182`; fixed the strict TypeScript errors reported at the two redirect decoder calls in `redirectPages.test.ts`.

- The catch block now uses installed Next 15's `isRedirectError(error)` type guard before calling `getRedirectStatusCodeFromError` and `getURLFromRedirectError`. Non-redirect failures are rethrown unchanged; no assertion cast was introduced.
- Added six focused regressions for `undefined`, `null`, `false`, `0`, empty string and an ordinary Error thrown by the page. Each must remain a rejected failure, rather than being decoded as a successful redirect. Existing real permanent-redirect tests across all eight URL prefixes continue to verify 308 and preserved destinations/queries.
- Changed only `src/lib/practice/redirectPages.test.ts` and this report. Production routes, stores, other workers' files, root `.next`, node_modules and active servers were untouched.

Verification actually run:

```sh
node_modules/.bin/vitest run src/lib/practice/redirectPages.test.ts --no-cache
git diff --check
```

Result: **1 file, 22 tests passed**; diff whitespace check clean.

Also ran an actual scoped **semantic** TypeScript Compiler API check through `node` stdin (not `transpileModule`): read the repository tsconfig, override `files` to `src/lib/practice/redirectPages.test.ts`, `src/types/music.d.ts`, and `next-env.d.ts`, set `include: []`, exclude `node_modules` and `.next` from root discovery, and force `noEmit: true`, `incremental: false`. `ts.createProgram` resolved the real imported page/Next/Vitest declarations and dependencies; `ts.getPreEmitDiagnostics` returned **zero diagnostics**. Installed Next's declaration explicitly narrows `unknown` to `RedirectError`; both formerly failing decoder calls were therefore checked under the project's strict compiler options without a cast. The command emitted no files or build info and did not include root `.next` types.

Project-wide build/browser/type QA remains coordinator-owned after the idle-UI follow-up; this focused compile check does not claim a full integration pass.

## Follow-up: real HTTP 404 for unsupported legacy modes

Task `task_fa6e7699e806`; fixes the independent QA finding from snapshot `HsiE7osVoETwnlOC77tRv`. The original `/practice?mode=unknown` response committed HTTP 200 while its server page awaited search params beneath the persistent layout's Suspense boundary, then emitted `NEXT_HTTP_ERROR_FALLBACK;404`. QA recorded this in `/tmp/note-quiz-practice-qa-evyhg6om/logs/routes.log` and `routes/report.json`; unknown leaf paths and unsupported locales already returned 404.

Changed the two index entry points from server **pages** to GET **Route Handlers**, sharing one small implementation. A Route Handler decides its native Response status outside layout/RSC streaming: unsupported modes return an empty **HTTP 404** with `X-Robots-Tag: noindex` and no Location. Valid fallback requests return a native **308** Response with the matching leaf Location, preserving locale and the complete query (including repeated non-mode keys). Repeated mode selection uses the final query value, matching installed Next's custom redirect matcher. Unsupported locale/index paths return 404 as well.

The existing `next.config.ts` permanent practice redirects are unchanged and still resolve ordinary valid links before this fallback. The shared persistent layouts, mode leaf pages, SEO/canonical/hreflang/social metadata, sitemap and older game/leaderboard redirect policies are untouched. This supersedes the earlier page-based `permanentRedirect` fallback and its thrown-error decoder tests; those index pages no longer coexist with the Route Handlers. Simply dropping both fallback pages would rely on framework unmatched-route handling; the explicit GET fallback provides a directly testable HTTP 404 while retaining the existing valid-link safety net, without middleware or a wider layout change.

Reworked `redirectPages.test.ts` to call the actual GET exports and assert native Response statuses/Location/body, rather than treating a thrown Next navigation error as proof of an HTTP status. The 26 handler tests cover mode-free and explicit modes across all eight prefixes, preserved share/daily/settings/leaderboard/duplicate-query intent, unknown modes across all prefixes, unsupported locale/path, and repeated-mode precedence. Added a raw `maxRedirects: 0` HTTP 404 assertion for each root/locale index to the browser verifier, retaining its existing navigation-based unknown-route checks and every previous acceptance assertion.

Coordinator follow-up `msg_186a78cb6220` requested verifier synchronization based on QA's `routes-diagnostic-waits.cjs` and `routes-waits/report.json`. The source verifier now waits until `settings=open` is present after each of its three Settings clicks before reading/changing/closing the panel; all existing close operations already wait until `settings` is absent. This observes asynchronous `router.replace` completion and does not change product behavior or skip assertions. QA's temporary script had bypassed the known streamed-404 failure to inspect later interactions; the source verifier retains that failing assertion and adds coverage across all locales.

Verification actually run:

```sh
node_modules/.bin/vitest run src/lib/practice/redirectPages.test.ts src/lib/practice/redirects.test.ts src/lib/practice/routing.test.ts src/lib/i18n/locale.test.ts src/lib/i18n/seo.test.ts --no-cache
node --check scripts/verify-practice-routes.cjs
git diff --check
```

Result: **5 files, 150 tests passed** (26 native HTTP-handler response tests, 18 existing actual-config matcher/status tests, 35 routed config/link tests, 38 locale tests, 33 SEO/sitemap tests). Script syntax and whitespace checks passed.

Also ran a scoped semantic TypeScript Compiler API check under the repository's strict options: root files were both new `route.ts` files, `redirectPages.test.ts`, `src/types/music.d.ts`, and `next-env.d.ts`, with real resolved dependencies, `noEmit: true`, `incremental: false`, empty include and `.next` excluded from root discovery. **Zero diagnostics**; no emitted files or build info.

No server or QA snapshot was started, restarted, modified or queried by this worker. The tests above assert actual native HTTP Response objects from the handlers; an updated built snapshot's observed network status still needs coordinator QA. Root `.next`, node_modules and sessions on 3001/3013/3014 remain untouched.

Exact files in this follow-up:

- `src/app/(site)/practice/page.tsx` (removed; replaced by Route Handler)
- `src/app/[locale]/practice/page.tsx` (removed; replaced by Route Handler)
- `src/app/(site)/practice/route.ts` (new shared GET implementation)
- `src/app/[locale]/practice/route.ts` (new GET re-export)
- `src/lib/practice/redirectPages.test.ts`
- `scripts/verify-practice-routes.cjs`
- `docs/practice-layout-routing/routes-report.md`

## Follow-up: move entry controls into SettingsSurface and remove daily/share entry UI

Task `task_5a7cb013e18e`; implements the newly coordinated user request without changing the previously completed native 404 route handlers, permanent migration redirects or SEO.

UI rules implemented in the controller:

- Removed the top preset/difficulty/session/share `<details>` and today's-ten-question card completely. Removed the copy-link button, clipboard handler, share fallback input/state and copy-only notices. No daily entry button/banner is rendered.
- Builds `sharedProps.settingsIntro` with the existing translated preset/difficulty controls, plus theory-only session length and seconds controls. It reuses existing SettingsControls select/action styles, uses a narrow-panel-safe grid, and is passed to all mode entries. P-UI owns the optional props and SettingsSurface forwarding; this worker did not edit PracticeShell, mode components or GameControl.
- Existing `share=1` links still parse/apply settings. The shared-settings explanation and leaderboard scoring notice remain in settingsIntro. The malformed-settings warning stays as one visible `role=status` paragraph above the leaf even with mobile settings closed. History-clear notices remain visible near LearningHistory.
- Existing `daily=1` URLs still generate daily run options, preserve daily history/eligibility semantics and have a **Normal practice** action only inside SettingsSurface. Same-mode setting URL replacements retain daily intent; the explicit normal-practice action removes it and resets sessions as before. Daily initialization, question generation, completion/history and authoritative scoring/audio/store code were not changed.
- Same-mode presets/difficulty/theory length/seconds retain locale, settings/leaderboard intent, daily flag, unrelated/repeated query fields and fragment while replacing only serialized configuration keys. Cross-mode navigation continues to push history and unmount the old mode.

Added the small pure `settingsNavigation.ts` helper to compose settings intents before asynchronous router replacements settle. Every local query/config action synchronously updates the latest intended URL; note/ear panel subscriptions now use that URL rather than stale `window.location.search`. Intermediate URL acknowledgements are ignored until the latest local intent commits, preventing stale configuration application or settings-dialog closure during rapid changes. External navigation/back/forward becomes authoritative. Intro length/seconds callbacks read the latest config ref so consecutive controls compose current values. Duplicate/coalesced replacements are covered too.

Replaced the route verifier's removed clipboard QA with mobile390/desktop1440 SettingsSurface checks: direct old shared URL restoration, absence of top/share/daily entry UI, rapid preset/difficulty/note-panel updates, retained query/fragment/open-settings/history, refresh restoration, theory length/seconds updates and refresh, and a settings-only exit from a direct daily URL. It deliberately does not wait for a URL commit between consecutive configuration selections. Existing 32 leaf, permanent308, native404, canonical/hreflang/social metadata, shell/header identity and browser-history assertions remain. The clipboard fixture was removed; no new user-facing strings or translation fields were added.

Focused command actually run:

```sh
node_modules/.bin/vitest run src/lib/practice/settingsNavigation.test.ts src/lib/practice/routing.test.ts src/lib/practice/config.test.ts src/lib/practice/redirectPages.test.ts src/lib/practice/redirects.test.ts src/lib/i18n/locale.test.ts src/lib/i18n/seo.test.ts --no-cache
```

Result: **7 files, 192 tests passed**, including 15 new settings-intent tests, 35 routing, 27 config, 26 native route-response, 18 redirect matcher/status, 38 locale and 33 SEO/sitemap tests. Settings regressions cover all eight prefixes, lossless unrelated query/fragment preservation, stale config-field removal for four modes, deterministic open→preset→difficulty→length→seconds→close composition while intermediate commits arrive, coalescing/duplicates, external history restoration and explicit daily exit.

Also passed: `node --check scripts/verify-practice-routes.cjs`, `git diff --check`, and scoped semantic TypeScript checking under the repository strict options with the controller, both new helper/test files, music global declarations and next-env as roots plus real dependencies: **zero diagnostics**, `noEmit: true`, `incremental: false`, `.next` excluded from root discovery. No root build output or node_modules content was written.

Limits: browser/build/full-suite integration remains coordinator-owned in a fresh isolated snapshot. This worker did not run or query any active server, so the newly revised browser cases have been syntax checked, not browser observed. Peer UI forwarding and its owned verify-practice-ui updates must be included in that integrated snapshot. Store/timer/scoring/audio/translation/version/database code, the completed route handlers and other sessions were preserved; no dependencies, commits, pushes or deployments were made.

Exact files changed by this worker in this follow-up:

- `src/app/(site)/practice/PracticeClient.tsx`
- `src/lib/practice/settingsNavigation.ts` (new)
- `src/lib/practice/settingsNavigation.test.ts` (new)
- `scripts/verify-practice-routes.cjs`
- `docs/practice-layout-routing/routes-report.md`
