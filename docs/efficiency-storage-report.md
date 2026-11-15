# Settings subscription and storage write efficiency

Baseline: `2940490` (`feat: unify practice UI and add scrolling melody practice`). This work implements the two approved findings from `/tmp/note-quiz-efficiency-audit.md`. Application and test sources are frozen for the coordinator's integrated verification; this worker made no commit, started/stopped no server, and did not modify MelodyPractice or its scoring helpers.

## Changes

`NoteSettingsPanel` now uses the existing Zustand `useShallow` pattern to select only settings and its three action functions. The two instances mounted by `SettingsSurface` no longer subscribe to the 50ms clock fields. Settings, reset actions and language updates retain their existing ownership and behavior.

Both note and ear persist configurations now use the small shared `safeLocalStorage` adapter. Before writing, it reads the current stored string and skips a write only if the bytes already match. It keeps no cache and introduces no delay. A read failure still permits a write attempt; failed get/set/remove operations retain the existing nonthrowing behavior. A subsequent call can retry after failure, removal, clearing or external overwrite.

The persisted keys, version, JSON serialization, partialize and merge functions are unchanged. Existing `questionLimit: null` and JSON's `Infinity → null` behavior remain unchanged. Scoring, session clocks, timing boundaries and mode-specific state engines are untouched. JSON serialization and one synchronous storage read still occur on each persistence attempt; this change removes redundant writes rather than all persistence work. The adapter does not add cross-tab synchronization or transactions.

## Measured before and after

A Node diagnostic imported the real stores, used a memory localStorage, and invoked each real `updateTimer` action 20 times with 50ms increments. The baseline run loaded the two store modules directly from commit `2940490`; the after run loaded current sources.

| Store | Timer calls | Store notifications before / after | Actual storage writes before / after | Final elapsed before / after |
|---|---:|---:|---:|---:|
| Note | 20 | 20 / 20 | 20 / 0 | 1,000 / 1,000 ms |
| Ear | 20 | 20 / 20 | 20 / 0 | 1,000 / 1,000 ms |

Each baseline wrote one identical payload repeatedly: 6,780 bytes total for note and 5,980 for ear. This measures calls and string bytes, not browser storage latency.

A separate headless Chromium fixture bundled the actual React, Zustand, NoteSettingsPanel, SettingsSurface and translation hook, with the Next pathname context supplied. It mounted the real desktop and closed-dialog panel instances and measured their subtrees with React Profiler. Each tick was explicitly flushed, independently of browser timer throttling. The before run substituted only the NoteSettingsPanel source from `2940490`; all other fixture modules were identical to the after run.

| Observation | Baseline panel | Updated panel |
|---|---:|---:|
| Commits across both panels for 20 clock updates | 40 | 0 |
| Elapsed after updates | 1,000 ms | 1,000 ms |
| Commits after changing clef | 2 | 2 |
| Bass selections rendered | 2 | 2 |
| Commits after changing language to Korean | 2 | 2 |
| Korean clef labels rendered | yes | yes |

This is an actual component/store render diagnostic, not a mocked-selector assertion. It is an isolated fixture, not a full `/practice` route or visual-layout verification. No existing app server or browser session was attached. Initial fixture attempts failed because Playwright's default cached browser revision was absent and then because the standalone fixture omitted Next's pathname context; using an already installed Chromium and the actual context resolved those harness failures. No browser package was installed.

## Regression tests and checks

Added 13 tests: five adapter cases and four real-store cases per mode. They cover duplicate suppression, independent keys, changed values, external overwrite, remove/clear, failed reads with successful writes, failed writes/removals followed by recovery, unavailable localStorage, live timer progression, immediate settings and end-of-session stats writes, settings/stat resets where supported, clearStorage, rehydrate, legacy timed settings, nested defaults, missing stats, explicit null question limits and existing Infinity JSON behavior. Existing blocked-storage and lifecycle tests also remain in the focused run.

Commands completed successfully:

- `npx vitest run src/lib/storage/safeLocalStorage.test.ts src/store/gameStore.test.ts src/store/earTrainingStore.test.ts` — 3 files, 35 tests passed.
- `npx tsc --noEmit` — no diagnostics.
- `npx eslint src/components/practice/NoteSettingsPanel.tsx src/lib/storage/safeLocalStorage.ts src/lib/storage/safeLocalStorage.test.ts src/store/gameStore.ts src/store/earTrainingStore.ts src/store/gameStore.test.ts src/store/earTrainingStore.test.ts` — no diagnostics.
- `DIAGNOSTIC_BASELINE=1 node /tmp/note-quiz-efficiency-diagnostic.cjs` and `node /tmp/note-quiz-efficiency-diagnostic.cjs` — before/after store write counts above.
- `node /tmp/note-quiz-settings-render.cjs` — actual React comparison above passed.
- `git diff --check` — passed.

Local evidence artifacts:

- `/tmp/note-quiz-efficiency-diagnostic.cjs`
- `/tmp/note-quiz-efficiency-before.json`
- `/tmp/note-quiz-efficiency-after.json`
- `/tmp/note-quiz-settings-render.cjs`
- `/tmp/note-quiz-settings-render.json`

Full unit suite, production build and the second commit are owned by the coordinator after this source freeze; this report does not claim their completion. Human screenreader, subjective audio, physical input and mobile/desktop visual-layout checks were not performed for this behavior-preserving change.

## Owned files

- `src/components/practice/NoteSettingsPanel.tsx`
- `src/lib/storage/safeLocalStorage.ts`
- `src/lib/storage/safeLocalStorage.test.ts`
- `src/store/gameStore.ts`
- `src/store/gameStore.test.ts`
- `src/store/earTrainingStore.ts`
- `src/store/earTrainingStore.test.ts`
- `docs/efficiency-storage-report.md`
