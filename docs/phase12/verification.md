# Phase 1/2 verification — 2026-11-14

Implementation and available-environment verification are complete, including the approved Challenge scrolling/repeat extension. G0 baseline, G1 automated practice compatibility, G2 stage/browser behavior and G3 unit/types/lint/build/diff/rollback checks have evidence below. Physical/acoustic/paid-ad release coverage remains explicitly unverified; this is not a deployment approval. No commit, push, deployment or DB change was made.

## A. Changed surfaces and compatibility

| Surface | Change and preserved contract |
| --- | --- |
| `Staff`, `MusicNotation`, `src/components/notation/`, `src/lib/notation/` | Native alphaTab1.9.0 engraving replaces both active drawing implementations; existing outer geometry, generation/answers and fallback remain. Plugin/assets use webpack; no framework upgrade. |
| `src/features/challenge/` | Separate four-world/24-stage local game, mandatory pitch AND duration plus stage-specific onset/rest/attack gates, touch/microphone capabilities, lifecycle and local progress. |
| Challenge score viewport/navigation | One horizontal score, fixed play line, native green/red note styles, finite repeat/DC/DS performed visits with one unscored beat for backward returns; reduced-motion projection. Existing24 pitch/duration patterns and scoring thresholds unchanged. |
| Challenge input/UI | Tailwind feature scan restores purple actions; small-screen keys, keyboard pause/release, start visibility, renderer retry, storage/permission recovery and formatted rehearsal BPM. |
| `src/app/(site)/`, `src/app/[locale]/`, locale/SEO utilities | Approved internal route move preserves unprefixed URLs/static rendering; seven locales including Simplified Chinese, localized canonical/alternates/sitemap and feature-flagged entry links. |
| Legacy microphone hook/display | Spectrum uses measured PCM/frequency data; existing detector and220ms recognition gate remain. No raw recording/upload added. |

Protected tracked modules (`src/app/api`, leaderboard services/domain, existing game/ear stores, pitchDetection, Supabase, and `scripts/verify-practice-ui.cjs`) have no diff. Old app-path deletions are paired with untracked route-group moves; they must be committed together if later authorized. Legal English content has not been rewritten. The reference before-extension evidence is preserved in [verification-pre-scroll.md](verification-pre-scroll.md).

## B. G1 — practice equivalence and notation

- Original baseline: HEAD `c88a75ba052136c1d613e18542524b1b4a656532`;189 tests, clean starting snapshot. Current implementation remains uncommitted.
- Latest shared-renderer build5 comparison: **16 cases /160 answers /96 captures, differences0** at360/390/768/1440 for note/ear/interval/chord. Results, review/restart, history, configuration and schemaVersion2 payloads match. Actual engraving is intentionally excluded from semantic text/geometry comparison and checked independently.
- Existing practice browser runner remains unchanged:16 passing cases on the first isolated build; mobile live creative not observed there. Later production renderer recovery, rotation and resource behavior are covered independently. It is not described as a final-build rerun.
- P1-N01–N08: pure4clef×15key×7letter×octave/model checks,83 development renders, production controlled real wrappers for B#/Cb/E#/Fb, natural/courtesy accidentals, intervals/chords/progressions. Low Eb3/Gb3/Bb3 has3 actual ledger rectangles; engine staff color`#64748b` improves contrast. Enlarged Orca GUI evidence retained.
- P1-E01–E06: seeded semantic equality plus original tests for share/daily/UTC/history/redirects/storage/audio failures. Localized static HTML checks cover35routes +8interactions and252sitemapURLs; recovery verifies seven home/practice Challenge entry paths.
- P1-V/R: no compared layout/order/overflow differences.100 fast renderer updates finish on the latest note; workers return to baseline. Font/module/worker abort, explicit Challenge retry and legacy wrapper fallback verified on build4; newer recovery verifies horizontal renderer paths separately.
- **G1 automated compatibility evidence passes.** Physical-browser/acoustic/paid-ad coverage remains unverified; this is not a deployment approval.

## C. G2 — stage scoring and scrolling score

`scoring-oracle.md` documents executable S01–S16, mandatory gates and navigation rules. Matching never reuses an input; high total scores cannot erase required failures. Quiet dropouts are included in valid-pitch ratio. Local records are isolated by stage/profile/input/scoring version; rehearsal never unlocks or posts country scores.

Build5 `scripts/verify-challenge-ui.cjs`: **40 PASS checks +24 measured stage results** (64 report entries),0 page errors and0 leaderboard POSTs. All24 clear/unlock sequentially and persist3 stars using timed DOM keyboard input and the real AudioContext clock, with no score injection. These are synthetic browser performances, not human/acoustic accuracy measurements.

| Stage | Score | Stars |
| --- | --- | --- |
| w1-s1 | 99.77 | 3 |
| w1-s2 | 99.35 | 3 |
| w1-s3 | 99.09 | 3 |
| w1-s4 | 99.41 | 3 |
| w1-s5 | 98.63 | 3 |
| w1-s6 | 99.54 | 3 |
| w2-s1 | 99.66 | 3 |
| w2-s2 | 98.67 | 3 |
| w2-s3 | 98.86 | 3 |
| w2-s4 | 99.65 | 3 |
| w2-s5 | 98.87 | 3 |
| w2-s6 | 99.17 | 3 |
| w3-s1 | 96.32 | 3 |
| w3-s2 | 96.77 | 3 |
| w3-s3 | 96.74 | 3 |
| w3-s4 | 97.82 | 3 |
| w3-s5 | 96.65 | 3 |
| w3-s6 | 97.4 | 3 |
| w4-s1 | 96.68 | 3 |
| w4-s2 | 96.28 | 3 |
| w4-s3 | 95.65 | 3 |
| w4-s4 | 96.75 | 3 |
| w4-s5 | 96.8 | 3 |
| w4-s6 | 96.42 | 3 |

Latest browser matrix status:

- Build6 recovery30/30 PASS;13scroll checks passed, including native engraving movement/colors, repeat/DC alFine/DS alFine/DS alCoda, independent visit results and Enter/Space release through a rewind. Seven locale checks correctly exposed42.4px keys at360px with an internal scrollbar.
- Build7 includes the narrower key gaps and activation-only score visibility fix:30recoveryPASS and21of22scrollPASS initially. The remaining repeat fixture read an empty render during remount; it now waits for the exact native repeat glyph and passed its isolated rerun. All22 behaviors have passing evidence. Build8 adds parent-cancellation key ownership cleanup; all6 focused application checks passed, including both Enter/Space gap release and cancellation/missing-keyup/first-fresh-press cases. Broad matrix and recovery remain explicitly build7 evidence.
- Existing24 stages currently contain no repeat/DC/DS marks. Conditional navigation is tested with isolated in-memory stage fixtures in the production route; no fixture route, upload feature or extra stage ships.
- One unscored beat is inserted only on backward/same-bar returns. Gap attacks are rejected; holds begun earlier retain their actual release timestamp. Repeated notes get distinct performed IDs, upcoming pass colors reset, and results show pass-specific judgments. Forward Coda skips immediately. Unsupported nested/alternate-ending/ambiguous or unbounded plans reject explicitly.

## D. UI/audio evidence and boundaries

- Root Orca GUI:390×844 long-score preview, ArrowRight native horizontal scroll (0→40px), fixed play line, red native result notes, focused Space pause/resume, resize to actual1440×900, Korean rehearsal and59.5BPM. Earlier360German/tablet1024/practice modal/leaderboard interactions remain recorded. Build5 screenshots exposed the long-decimal BPM; build6 exposed retained lower-page scroll on start. Build7GUI verifies scorey24–224, seven50.56×64keys aty532.5,72.3BPMandpause/restart visible simultaneously after lower-page activation, with no manual post-start scrolling.
- Native Terra Computer Use was unavailable (`Sky Computer Use native pipe startup failed`/host connection failure). Orca embedded GUI is identified separately and does not stand in for physical-device testing.
- Live Grow house creative was observed again on build6 mobile; sampled input controls were above it. Paid Journey creatives and all placements were not verified. Scripts were not hidden and no ad z-index override was introduced.
- Real Chromium fake-WAV capture passes through getUserMedia/AudioWorklet for correct, wrong and too-short tones; permission denial and track/context cleanup checked. Synthesized PCM, mocked device failures, actual browser APIs and real acoustic input are distinct evidence levels.
-20 touch restart/client-route cycles closed40 AudioContexts and terminated39 workers on build4. This is resource accounting, not heap profiling or20 acoustic performances.
- Legacy live-spectrum diagnostic follows measured tone/silence and cleans up tracks. Its existing detector did **not** stabilize C4 on the pure-tone WAV; pitchDetection is byte-identical toHEAD and220ms gate unchanged. The visualization pass is not a recognition pass.
- **모바일 최종 실기기 검증 미완료.** Android/iOS hardware, Safari/Firefox, real voice/instruments, audible playback/latency, VoiceOver/TalkBack and paid creatives remain unverified. No measured acoustic accuracy/SLO claim is made.

## E. Commands, runtime and independent review

| Command | Executed result |
| --- | --- |
| Focused new notation/navigation/scroll/input tests | PASS; final focused34tests include external Enter/Space release without truncating duration |
| `npm test` |39files /514tests PASS on final build8 source |
| `npx tsc --noEmit` |PASS on final build8 source |
| `npm run lint` |PASS on final build8 source; two pre-existing hook-dependency warnings only (`modal.tsx`, `useComponentSize.tsx`) |
| `npm run build` |Build8 `fJ-nubpuDBCCoYLw5-l1-` PASS;261 generated routes |
| `node scripts/verify-phase1-equivalence.cjs` |Build5:16cases, differences0 |
| `node scripts/verify-challenge-ui.cjs` |Build5:40checksPASS+24measured3-star results |
| `node scripts/verify-challenge-recovery.cjs` |Build7:30PASS |
| `node scripts/verify-challenge-scroll.cjs` |Build7:21PASS + repeat-case rerunPASS; build8 focused6/6PASS;24unique scroll behaviors across versioned evidence |
| Independent UI review |Two reproduced P2s: disabled-key keyup loss and stale ownership after parent cancellation/external keyup. Fixed with capture-window release and heldMidi-null cleanup;4focused tests. Independent closure:4actualReact/component Chromium cases and4unit casesPASS; no unresolved scoped defect, source hash matched. |
| `git diff --check` |PASS for tracked diff and105untracked text files; protected paths and legal text inspected, source audit retained |

Build8 `fJ-nubpuDBCCoYLw5-l1-` is running on task3013 from `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/note-quiz-phase12-scroll-build8-gr0zkcft`. Source manifest228files matched before launch, Ready238ms and HTTP200 observed. Build5→6 production delta was only TouchKeyboard release handling and ChallengeStage BPM display, plus its regression test; all24 stage/scoring/practice/renderer inputs were unchanged. Build6→7 adds activation-only score scrolling and small-screen key gaps; build7→8 only changes TouchKeyboard cancellation ownership and its regression tests. This boundary explains which earlier evidence remains applicable.

Original user3001 PID28754 remains untouched. Task terminal`term_beb960d4-6f1a-42ed-b181-42757d7f31f5` only is restarted after PID/cwd verification. Current shell Node24.18.0/npm11.16.0; baselineNode20.20.2/npm10.8.2; no repository runtime pin changed.

Browser command environment: `PLAYWRIGHT_MODULE=/Users/pumpkin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`, `BROWSER_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, `UI_BASE_URL=http://localhost:3013`; each script uses its own `UI_ARTIFACT_DIR`. Automated API writes are intercepted; no production country score was submitted.

Artifacts: `/tmp/note-quiz-scroll-final/{semantic-5,challenge-5,orca}/`, build/source manifests and logs under`/tmp/note-quiz-scroll-*`; earlier `/tmp/note-quiz-phase12-final/` and `/tmp/note-quiz-build4-independent/`. Broad matrix paths: `scroll/build7/report.json`, `scroll/build7-repeat-ready/report.json`, `recovery/build7/report.json` under `/tmp/note-quiz-scroll-final/`; focused closure: `scroll/build8-scoped/report.json`. Exact commands and aggregate versioned results: `worker-verification-commands.txt` and `worker-verification-summary.json` in the same directory. Independent keyboard closure: `/tmp/note-quiz-scroll-keyboard-closure.json`. Source audit: `/tmp/note-quiz-scroll-final/source-audit.json`; final asserted completion audit: `/tmp/note-quiz-scroll-final/completion-audit.json`. These temporary local artifacts are not committed.

## F. Rollback and deferred scope

- Set `NEXT_PUBLIC_CHALLENGE_ENABLED=false` **before build** to disable Challenge routes/links/sitemap independently. Build4-era rollback smoke:43checksPASS including8URLvariants and continued practice start/finish.
- Set `NEXT_PUBLIC_NOTATION_RENDERER=legacy` **before build** to restore both preserved practice renderers. Smoke:3groupsPASS with Challenge still enabled. Merely changing runtime environment does not replace compiled flags. Flag/route code has not changed since those smoke builds; there has been no external release.
- Phase3 upload, arbitrary transpose/BPM and Free Practice Studio remain intentionally absent. No auth/backend/DB/schema migration or paid integration was added.
- No unresolved implementation/review finding remains in the agreed scope. Physical/acoustic/paid-ad limits remain explicit release risks; software completion does not assert those environments passed.
