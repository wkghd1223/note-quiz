# Phase 1/2 baseline — 2026-11-14

This is a fresh observation of the pre-migration application, not a restatement of `docs/learning-verification.md`. The master plan is a proposed specification; its unchecked requirements are not claimed as completed here. No application, package, SQL, deployment, or existing UI-verification script was changed for this capture.

## Source and environment

| Item                         | Observed value                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Initial branch / commit      | `master` / `c88a75ba052136c1d613e18542524b1b4a656532`                                                                 |
| Initial worktree             | `git status --short`: empty                                                                                           |
| Runtime                      | Node `v20.20.2`, npm `10.8.2`                                                                                         |
| Installed framework          | Next `15.1.7`, React / React DOM `19.0.0`, Zustand `5.0.3`                                                            |
| Installed verification tools | TypeScript `5.7.3`, Vitest `3.2.7`, ESLint `9.21.0`, Tailwind `3.4.17`                                                |
| Browser                      | Google Chrome `157.0.8103.51`, headless Playwright `1.62.1`                                                           |
| Playwright module            | `/Users/pumpkin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`                |
| Browser executable           | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`                                                        |
| Lockfile SHA-256             | `84eafcfe71145d44ca9f3ec1f8157dca8bb1e1667b64357bf15a756ee4d30721`                                                    |
| Existing server              | PID `39858`, port `3001`, cwd this repository; left running and not controlled                                        |
| Baseline server              | `npm run start -- --port 3011`, `http://localhost:3011`, separate process, after successful baseline production build |

Existing installed dependencies were reused (`npm ls --depth=0` succeeded). `npm ci` was not run: it would replace the installed environment and was unnecessary for recording the current baseline. RTK was not installed; native commands were used.

Instructions read: repository `AGENTS.md`, practice skill, `.codex/config.toml` (`max_threads=4`, `max_depth=1`), master-plan baseline, P1-N/E/V/R and expanded equivalence sections. Capture completed before application edits were released to the implementation owners.

## Pre-change gates actually executed

| Command                                                                         | Result                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `npm test`                                                                      | PASS: 17 files, 189 tests                              |
| `npx tsc --noEmit`                                                              | PASS, exit 0                                           |
| `npm run lint`                                                                  | PASS, exit 0; two existing warnings below              |
| `npm run build`                                                                 | PASS, exit 0; 14 static pages generated; same warnings |
| `node scripts/verify-practice-ui.cjs` with external runtime / port 3011         | Exit 0: 16 passed, 1 `not_observed`                    |
| `node scripts/verify-phase1-equivalence.cjs`                                    | PASS: 16 fixed-input cases, 96 screenshots             |
| Same equivalence runner with `UI_BASELINE` pointing to first successful capture | PASS: 16 cases, `differences.json` exactly `[]`        |
| `node --check scripts/verify-phase1-equivalence.cjs`                            | PASS                                                   |
| `git diff --check`                                                              | PASS                                                   |

Existing lint warnings: missing effect dependencies `isPage` in `src/components/ui/modal.tsx:74` and `handleResize` in `src/hooks/useComponentSize.tsx:23`. The configured `next lint` command works in this installed Next 15 environment; no lint configuration failure was observed.

## Active surface inventory

`src/app/practice/PracticeClient.tsx` selects `NotePracticeMode`, `EarPracticeMode`, and `TheoryPracticeMode` (interval/chord), with independent game, ear-training and theory stores. Note and note-review notation use `src/components/game/Staff.tsx`; theory notation uses `src/components/practice/MusicNotation.tsx`. Browser persistence includes `note-quiz-game-store` and `note-quiz-learning-v1`; history stores configuration, result/category totals, timing and practice/review/daily kind. No storage schema was changed.

Direct local production HTTP requests observed all three redirects:

| Legacy URL      | Status | Location                     |
| --------------- | ------ | ---------------------------- |
| `/game`         | 307    | `/practice?mode=note`        |
| `/ear-training` | 307    | `/practice?mode=ear`         |
| `/leaderboard`  | 307    | `/practice?leaderboard=open` |

The existing UI suite exercised home links, four ten-question/result/review/restart flows at 390×844 and 1440×900, dialogs/focus/retry/responsive settings, synthetic ad geometry, theory audio/visual variants, stale score response handling, timed ear boundary/mode cancellation, seeded daily reproduction/completion/replay deduplication, shared settings/copy recovery, daily UTC rollover, unavailable storage, unsupported audio recovery, six-language small-screen settings and German desktop layout.

## Artifact manifest and safety

All artifact paths are local and outside the repository:

- `/tmp/note-quiz-phase12-baseline/legacy/report.json`: full existing suite report and sibling screenshots.
- `/tmp/note-quiz-phase12-baseline/semantic-fixed/equivalence.json`: canonical successful pre-change semantic baseline; 16 cases and 96 sibling screenshots.
- `/tmp/note-quiz-phase12-baseline/self-check/equivalence.json` and `differences.json`: independent repeat on the same baseline production build; no differences.
- `/tmp/note-quiz-phase12-baseline/semantic/equivalence.json`: preserved **failed harness attempt**, not a product failure. Its loop mistook final score `0/10` for active progress and subsequently timed out finding a nonexistent answer button. The runner was corrected before the canonical capture; failed evidence was not overwritten.

Both runners fixture leaderboard GET and score POST requests; production scores were never submitted. The new runner intercepts **every** `/api/leaderboard*` request, fixtures known GET/POST contracts, rejects unexpected mutation methods, blocks service workers and external origins, and aborts any remaining local non-GET/HEAD request. Its isolated browser contexts contain only synthetic practice history. The existing suite retains its original advertising behavior: third-party scripts may execute there, but leaderboard writes remain intercepted.

The legacy suite observed one live Journey/Grow house creative on desktop, with sampled controls not overlapping it. The mobile live house-creative case was `not_observed`, **not passed**. Paid creatives, physical devices/touch, actual audible output and actual microphone hardware were not verified. One third-party Journey script exception (`Cannot read properties of undefined (reading 'Config')`) was recorded in the legacy report warnings; application exceptions were not observed. New fixed-input capture blocks those external scripts.

## Reusable semantic equivalence oracle

`scripts/verify-phase1-equivalence.cjs` runs against an already-running server; it never starts or stops a server or attaches to a user's browser. Every viewport starts with a new context, empty local storage, English locale, reduced motion, RNG seed `1729`, and frozen virtual time based on `2026-11-14T00:00:00Z` (paused one second after the epoch, then explicitly advanced 1000 ms per answer).

Viewports: **360×800, 390×844, 768×1024, 1440×900**. Each exercises note, ear, interval and chord, ten inputs, automatic result, mistake review completion and fresh same-settings restart. Inputs deliberately produce ten wrong answers: note `C#4` in C major, ear `C4` under the deterministic seed, interval `Major third` with focused `P5`, chord `Major` with focused minor. This is an incorrect-answer/review oracle, not an assertion that every scoring branch has been covered.

The JSON records each answer's count, input, full non-drawing feedback text and accessible notation names; six phase snapshots record text, accessible names, enabled/disabled controls, DOM control order and surrounding geometry. It also records persisted history and ordered leaderboard request bodies. Only random session-ID values are normalized **after** their string type is asserted; payload keys, schema version, mode, answer totals and elapsed time remain exact. The baseline note POST is `schemaVersion: 2`, `mode: "note"`, `totalQuestions: 10`, `correctAnswers: 0`, `totalTime: 10000`; review, ear, interval and chord do not post scores.

Drawing pixels, SVG paths/tags and canvas contents are excluded. User-facing notation labels remain included. Main/card/control bounding boxes compare with a 1 px tolerance; text, input/result/history/network contracts compare exactly. Document horizontal overflow is asserted absent in every captured phase. Renderer-specific internals are not used as an equivalence shortcut. This does **not** replace music-semantic fixture checks, visual readability review or synthetic ad-overlap checks.

Reproduce after a build and separately started local server:

```sh
PLAYWRIGHT_MODULE=/Users/pumpkin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright \
BROWSER_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
UI_BASE_URL=http://localhost:3011 \
UI_BASELINE=/tmp/note-quiz-phase12-baseline/semantic-fixed/equivalence.json \
UI_ARTIFACT_DIR=/tmp/note-quiz-phase12-after \
node scripts/verify-phase1-equivalence.cjs
```

Do not regenerate the canonical baseline to make a later regression pass. Inspect `differences.json`; classify any intentional renderer-only difference explicitly. The baseline date is intentionally frozen, including history-retention and daily-label behavior.

## P1 matrix: baseline evidence vs remaining gates

| IDs        | Baseline evidence                                                                                                                  | Not established by this capture                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| P1-N01–N05 | Existing staff/music unit tests pass; note/review screenshots and answer semantics captured                                        | Complete 4-clef × note × 15-key accidental/ledger semantic matrix, manual music review              |
| P1-N06–N08 | Existing theory unit tests and audio/visual task suite pass; seeded interval/chord accessible note names captured                  | Complete direction/simultaneity/inversion/7th/progression drawing correctness after migration       |
| P1-E01     | Four-mode 10-answer/result/review/restart suites pass; fixed wrong-answer baseline repeat matches                                  | All-correct and mixed-answer golden browser sequences beyond existing unit coverage                 |
| P1-E02     | Existing note pause/resume, timed ear boundary/mode cancellation pass                                                              | Full timed/free/pause matrix in every mode and real elapsed-time device behavior                    |
| P1-E03     | Piano input and unsupported-audio browser recovery covered; existing unit tests pass                                               | Full solfege and microphone grant/deny/stop hardware-path matrix                                    |
| P1-E04     | Existing share/daily/UTC/history flows pass; exact persisted practice/review history captured                                      | Full legacy persisted-data fixture migration matrix                                                 |
| P1-E05     | All leaderboard writes fixture-only; schema-v2 payload, note-only eligibility, review suppression and stale response handling pass | Live database behavior (intentionally not exercised)                                                |
| P1-E06     | Three production redirects and existing six-language settings/accessibility suite pass                                             | Screen-reader listening and every translated quiz/result label matrix                               |
| P1-V01     | Four widths × four modes × six phases: no document overflow; controls/card geometry recorded; existing synthetic ad checks pass    | Mobile live house creative, paid-ad overlap and physical devices                                    |
| P1-R01     | Existing stale-transition scenarios pass                                                                                           | 100 rapid transitions / renderer instance and Worker leak checks                                    |
| P1-R02     | Baseline production build/server and four-mode rendering pass                                                                      | Future alphaTab font/Worker/Worklet paths, Amplify-like hosting and post-migration production build |

These remaining checks are release gates, not reasons to reinterpret the successful baseline as full Phase 1 completion. No deployment or final Phase 1/2 acceptance is claimed.
