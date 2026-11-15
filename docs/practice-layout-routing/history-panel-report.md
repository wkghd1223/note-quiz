# Practice history panel — implementation and source freeze

Task: `task_a11606339c9d`; dispatch: `ctx_d1602fce328b`. Primary coordinator is now `term_f780478e-2947-4e8b-9dc4-bc74da7c2351`; prior task reports/accounting remain unchanged in routes-report.md.

## Implemented

- Removed the inline LearningHistory block from PracticeClient. The history contents mount only inside a button-open PracticeDialog, for both mobile and desktop.
- Reused the existing title row via the UI worker's optional `headerActions` slot. The native 44×44 history-icon button adds no independent top row or card, has a translated accessible label/title, visible keyboard focus, and `aria-haspopup`/expanded state. Existing copy is reused for all eight locales.
- PracticeHistoryPanel subscribes only to current-mode lifecycle booleans. It blocks opening while the selected mode is playing; unrelated stores do not disable it. Idle, finished and paused note practice remain available. Opening/closing makes no timer, audio, microphone, generation, scoring or store-state calls. An externally started playing session also closes an open history panel.
- Reused PracticeDialog's close button, Escape/backdrop behavior, focus trapping, scroll lock and explicit trigger focus return without editing the shared Dialog or global styles.
- Selecting a weak-area practice option first closes the panel. The queued existing `choose` callback runs in a later passive setup after dialog cleanup/focus restoration, keeping the original mode/config/navigation behavior. Clearing history uses the existing reset/write callback and displays its existing status notice inside the panel.
- LearningHistory changed only its outer presentation: it no longer creates an inline card/duplicate heading and instead uses a labeled content section. Table rows, next-practice calculation, callbacks, storage/retention limits, daily state and data model remain unchanged. No Melody history was added.

## Verification actually run

```sh
node_modules/.bin/vitest run src/components/practice/PracticeHistoryPanel.test.tsx src/lib/practice/history.test.ts --no-cache
npm test -- --no-cache
node_modules/.bin/eslint 'src/app/(site)/practice/PracticeClient.tsx' src/components/practice/LearningHistory.tsx src/components/practice/PracticeHistoryPanel.tsx src/components/practice/PracticeHistoryPanel.test.tsx scripts/verify-practice-routes.cjs --no-cache
node --check scripts/verify-practice-routes.cjs
git diff --check
```

Results:

- Focused: **2 files / 46 tests passed**, including 20 UI-gating/closed-flow/translation checks and 26 unchanged history-model tests.
- Full existing suite: **60 files / 1,009 tests passed**. The malformed-soundfont test logged its expected AlphaTab error and passed.
- Scoped ESLint, route-verifier syntax and whitespace checks: passed.
- Actual scoped TypeScript CLI: `node_modules/.bin/tsc --project /tmp/note-quiz-history-type-3hukawra/tsconfig.json --noEmit --incremental false` — exit 0. The temporary config extends the repository config, roots the controller/History/Panel/new test plus global music and next-env declarations, resolves their real dependencies, and excludes root `.next`; it writes no emitted source or build info. This is scoped checking, not a claim of a full generated-route build.

The history-only verifier addition uses an isolated browser-storage fixture and checks mobile390/desktop1440: no inline table, 44px target, Enter/Space opening, close/Escape/backdrop dismissal, focus restoration, unchanged URL/history on open/close, original practice selection, reset notice/storage behavior, playing guards for four modes and paused-note access. Existing routing/SEO/settings assertions were retained. It was syntax checked; this worker did not run a browser/server or build. Fresh integrated snapshot/build/browser QA remains with the coordinator, including the live UI worker's headerActions/sticky/result changes.

## Ownership and limitations

Changed exactly the five source/test/verifier files below and this report. PracticeShell, mode files, GameControl, shared Dialog, header/footer, global styles, translations, stores, history model, route handlers and Melody files were not edited by this worker. Concurrent edits were preserved. No server, root `.next`, node_modules, dependency, database, commit, push or deployment operation occurred.

All checks above ran against the shared live checkout while independent UI work continued. The following freeze identifies this worker's final source bytes; integration must build a fresh snapshot containing the corresponding peer API changes.

Frozen at UTC: `2026-11-15T06:49:29.850546+00:00`.

| File | SHA-256 |
| --- | --- |
| `src/app/(site)/practice/PracticeClient.tsx` | `8276ac7b8ded46fd7acb277d44c91e32f4a7863a2578298ae386246e58003b92` |
| `src/components/practice/LearningHistory.tsx` | `d31a2d277e8bd218b8b5fbbfa0793d978a59e5a659aed7ddb219b6a35dd94fd0` |
| `src/components/practice/PracticeHistoryPanel.tsx` | `1804e5f5e94e7ccf355d983743d50310b0e360027e6ba29cc126f1c2e29c1eb0` |
| `src/components/practice/PracticeHistoryPanel.test.tsx` | `29edffa4ca30d8f9e315895a2cf4747acfc74ec0630748b8058e7555a78c7733` |
| `scripts/verify-practice-routes.cjs` | `bb2172aa767591988c77c08fbae3d0423cb04de995ac576aec62b14aaf39150a` |

Report file: `docs/practice-layout-routing/history-panel-report.md`.
