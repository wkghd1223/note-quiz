# P-UI implementation report — 2026-11-15

Current task: `task_701103ce59c7`, dispatch `ctx_b7899d2a211f`.
Earlier approved work: `task_7ba2abbdfaf9` and `task_49220d4af694`.
Current coordinator: `term_f780478e-2947-4e8b-9dc4-bc74da7c2351` (full handoff recorded in `handoff.md`).

Status: application source frozen for combined QA. Focused checks below passed; final production integration acceptance belongs to the coordinator's fresh immutable snapshot. No server was started/restarted, package installed, build run in root, commit/push/deployment/database operation performed by this worker.

## Final behavior

- Note, Ear and Theory (interval/chord/progression) retain a staff/clef frame from idle through start, judgment, next and finish. Note idle reflects configured clef/key; random settings use neutral treble/C without generating a question. Audio questions send **empty notes** into score conversion/rendering until reveal, with generic translated labels and no hidden answer glyphs/pitches. Progression retains four cells. Last accepted question supplies final notation; an unanswered early finish remains blank.
- The fixed notation/input frames and bounded explanations keep answer controls in place. Finished piano/theory controls remain disabled; microphone input unmounts for its existing cleanup, while a measured local minimum height preserves its footprint. Help remains available in Theory before and after answering.
- The compact prompt band hosts the shared nonmodal polite feedback. `PracticeFeedback` re-exports the coordinator-owned `PracticeAnswerToast`; the toast owns only presentation and CSS enter/exit motion, never progression time. Its node key changes for consecutive identical judgments. It remains pointer-transparent and does not move focus. The prompt text stays mounted; its visual opacity changes during visible judgment. Paused sessions supply no visible judgment; resume uses the unchanged store feedback and remaining transition time. Reset/exit/finish suppress stale overlays.
- `PracticeController` and `StablePracticeActions` reserve the largest intrinsic footprint of their actual translated state labels at the current width. Inactive layers are invisible, inert and aria-hidden. This fixes the mobile Note idle44 → active56px wrap shift without clipping labels or imposing one oversized height on every language. Real game capabilities/callbacks remain mode-owned; no shared game engine/state machine was introduced.
- `PracticeMetrics` provides common presentation. High-frequency clock subscriptions live in small status leaves; mode roots/GameControl select consumed values/actions with `useShallow`. Memoized notation/theory answer components use existing stable question references. The verification records notation DOM mutations, not unmeasured React render counts. Store timer intervals, scoring, audio authority and privacy behavior remain unchanged.
- `PracticeShell` places actions/metrics in a practice-local sticky dock at the scroll owner's top. It uses the existing ad-safe workspace, without a floating bottom control layer. Optional `settingsIntro?: ReactNode` and `headerActions?: ReactNode` are forwarded by all basic modes. Settings intro renders before existing settings; the independent history worker mounts its trigger in the title row without another vertical row.
- Results use the same minimizable `PracticeResultSurface` dialog at **all widths**. Its hook tracks only visibility per finished session; result data and actions stay with the caller. The finished action footprint contains a persistent View results control. Minimize/Escape returns focus there, restore reopens the same result, and restart/new session clears the dialog. Dialog focus trapping and existing modal scroll preservation remain available; no scroll correction or scroll lock was added to hide ordinary stage layout movement. `LearningResult`/`NoteSessionResult` preserve their old defaults for other callers, while basic modes opt out of their old `scrollIntoView`/heading-focus effect because the surface owns focus.
- All basic primary start controls use existing `t.startGame`; approved direct instructions use the same label. The current shared checkout supports eight locales (en/ko/ja/es/de/fr/zh/pt); Portuguese work from the other owner is preserved. No current seven-language-only assumptions remain in the layout matrix.

## Native engraving and placeholder sizing

`Staff stable` and `MusicNotation` pass the measured inner CSS width/height as the shared alphaTab component's width, height **and** viewBox. This removes the old second fit through620×260 /360-or420×380 legacy viewBoxes while retaining fixed outer frames. `StableNotationSurface` waits for a positive ResizeObserver measurement before mounting the native renderer, covers each unfinished score revision, and uncovers only when that revision reports ready. It cleans up observers. Concealed native empty staffs may replace the loading staff once ready; they contain no answer events.

The primary renderer remains unchanged pinned alphaTab1.9. `PracticeStaffFallback` is used only for the blank/loading surface, renderer error or explicitly selected legacy renderer. Existing legacy components themselves use fixed coordinate canvases, so nesting them in the shortened frames would reproduce the second scaling problem. The local fallback uses one physical-coordinate fit, existing note-position/ledger helpers, configured clef/key and existing glyph assets; its bounds include stems/extreme ledgers. Non-stable Staff callers retain their existing renderer/fallback path. No shared renderer, notation adapter/library, melody/challenge engine, audio or store file was edited.

Coordinator-reported **actual production** evidence (`/tmp/note-quiz-staff-after/report.json`, candidate build `koqrhtg_aIDg2uiFDMszQ`):

| CSS viewport | Mode     | Native staff height before → after |
| ------------ | -------- | ---------------------------------- |
| 390×844      | Note     | 31.02 →46.88px                     |
| 390×844      | Ear      | 34.46 →46.88px                     |
| 390×844      | Interval | 29.56 →55.60px                     |
| 390×844      | Chord    | 29.56 →60.39px                     |
| 1440×900     | Note     | 50.95 →72.00px                     |
| 1440×900     | Ear      | 49.23 →66.98px                     |
| 1440×900     | Theory   | 41.68 →71.35/72.00px               |

Mobile frames remain112px for note/ear/compact progression and156px for ordinary theory. These production measurements were run by the coordinator, not this worker. A separate isolated native fixture observed wider notehead ink as well as staff growth, and checks supported-width clefs/keys/extreme ledgers/interval/chord/progression; its scope and limitations are below.

## QA diagnosis and regression changes

1. **Action row +12px:** English Pause/End Game wrapped inside101.48px buttons. A shell `min-h-11` did not reserve that larger active state. The shared intrinsic state layers now include idle/playing/paused/finished/restore labels before start, so every state has the same footprint at its current locale/width.
2. **Judgment after Pause:** authoritative feedback intentionally survives pause. Only the rendered message is suppressed while paused; no store timeout/timestamp/scoring change. The regression spends200ms of850ms feedback, pauses5000ms, resumes, then verifies649ms does not advance and the last1ms does.
3. **Progression finish scroll +80px:** read-only probes against the retained old3014 snapshot separated scroll anchoring from click scrolling and renderer settlement. At bottom, workspace1176→1256 while frame document coordinates stayed fixed and `scrollIntoView` count stayed0. Conditional80px answer details were inserted **before** the existing help paragraph, so the browser anchored to that displaced paragraph. Diagnostic help-first ordering retained1176→1176; Theory now keeps help first. No `overflow-anchor:none`, scroll locking or forced restoration was used as that fix. Evidence: `/tmp/note-quiz-ui-repair-701103/progression-probe.json` and `help-order-probe.json`.
4. **Native audio vs virtual clock:**30×500ms virtual advances completed in814ms real time while native AudioContext was still0 and answers disabled; real waiting released them after2362ms/currentTime1.248. `settleAudio` now flushes the start turn, waits on actual enabled controls with real polling, and records native context state/time on failure. Audio code is unchanged. Evidence: `audio-probe.json` in the same temporary directory.
5. **Settings race:** the layout verifier observes `settings=open`, then each exact selected URL query commit, then removal of the settings query before the next action. It does not assume a clicked select has already settled route state.
6. **Renderer readiness:** loading SVGs now themselves have `data-notation-fallback`; the verifier must not treat any matching descendant as completion. It observes the actual renderer layer **and** `placeholder.hidden`, uses real settlement time, and fails with observations if the current engraving never uncovers. This script-only final correction was sent to the coordinator after app source freeze.
7. The independent QA found the history trigger also declares `aria-haspopup="dialog"`; the idle Settings selector is now scoped under `data-practice-control-dock`. Other Settings selectors already use the exact translated button name. This is a selector correction, with the same Settings query/geometry assertions retained.
8. Existing UI verifier now expects approved404 for unknown `mode=bad`; valid note routes with malformed settings still exercise safe normalization. Removed share/daily entry controls are asserted absent while direct URL/session/daily persistence checks remain. History reads/reset now open the real history panel, verify close focus, and restore a previously open result dialog; assertions were not dropped to accommodate hidden panel content.

## Exact P-UI file ownership/change ledger

Existing application files modified:

- `src/components/game/GameControl.tsx`
- `src/components/game/Staff.tsx`
- `src/components/practice/NotePracticeMode.tsx`
- `src/components/practice/EarPracticeMode.tsx`
- `src/components/practice/TheoryPracticeMode.tsx`
- `src/components/practice/PracticeShell.tsx`
- `src/components/practice/MusicNotation.tsx`
- `src/components/practice/LearningResult.tsx`
- `src/components/practice/NoteSessionResult.tsx`
- `src/components/practice/PracticeDialog.tsx`

New application files:

- `src/components/practice/PracticeFeedback.tsx`
- `src/components/practice/StableNotationSurface.tsx`
- `src/components/practice/PracticeStaffFallback.tsx`
- `src/components/practice/StablePracticeActions.tsx`
- `src/components/practice/PracticeController.tsx`
- `src/components/practice/PracticeMetrics.tsx`
- `src/components/practice/PracticeResultSurface.tsx`
- `src/components/practice/PracticeAnswerArea.tsx`

Tests, scripts and report:

- `src/components/practice/PracticePreview.test.tsx`
- `src/components/practice/LearningResult.test.tsx`
- `scripts/verify-practice-layout.cjs`
- `scripts/verify-practice-ui.cjs`
- `docs/practice-layout-routing/ui-report.md`

Earlier explicitly coordinated copy scope also changed `src/lib/i18n/translations.ts` (start labels/instructions/direct guide references, practiceUi view/minimize keys and type), `src/lib/i18n/zh.ts` (practiceUi view/minimize keys), `src/lib/i18n/translations.test.ts` (shared label/schema regression), and only three start-label expectations in `scripts/verify-practice-routes.cjs` before that script returned to its route owner. The Chinese start labels themselves already matched and were left unchanged. Later Portuguese and shared-copy changes by other owners are not claimed as this worker's work. `PracticeAnswerToast.tsx/.module.css`, PracticeClient/routes/history panel, global ad layout and melody changes belong to other workers/coordinator. Many owned files were already dirty at dispatch; full HEAD diffs include pre-existing renderer/features and are not an isolated P-UI patch.

## Checks actually run

- `npx vitest run src/components/practice/PracticePreview.test.tsx src/components/practice/LearningResult.test.tsx src/lib/i18n/translations.test.ts src/store/gameStore.test.ts src/store/earTrainingStore.test.ts src/store/theoryStore.test.ts --no-cache` — **6 files /121 tests passed**,15:50:57 KST. Preview69, result effects6, translations18, existing store lifecycle28. SSR preview fixtures mock the measured surface/native renderer and store subscriptions; they verify eight-locale labels, empty score/answer secrecy, neutral random/no preview question/audio generation, four clefs, final accepted/blank notation, disabled inputs, pause remaining transition and help ordering. They do not claim real browser layout or observer execution.
- `npx tsc --noEmit --incremental false` — **passed** after current result API and glyph changes; no build cache write requested.
- Targeted ESLint on the20 owned application/test TSX paths with `--max-warnings 0` — **passed**. The dialog cleanup captures its mounted preferred return-focus element; no lint rule suppression was added.
- `node --check scripts/verify-practice-layout.cjs` and `node --check scripts/verify-practice-ui.cjs` — **passed**. Owned tracked diff whitespace check passed. Prettier applied to the two verifier scripts.
- Isolated **actual shared-component** browser fixture with current all-width result API and project Tailwind CSS: **8/8 locales passed**, using fresh contexts and read-only3013 HTTP asset loads. Equal idle/playing/paused/finished action heights; no clipped labels; inactive layers inert; default Settings close focus; result data retention, Tab trap, minimize/Escape→restore focus; all-width resize; restart cleanup; workspace position retained. Heights44px for en/ko/ja/zh and56px for es/de/fr/pt in this icon-free fixture. Evidence `/tmp/note-quiz-ui-repair-701103/shared-fixture-report.json` and `network-shared-final.json`. Synthetic phase callbacks mean this is **not production game integration**. The first rerun failed because its temporary Tailwind content argument omitted the invisible utility; correcting only that fixture CSS made the complete strict run pass. No product assertion was removed.

- Isolated actual **native alphaTab** viewport fixture — **20/20 supported-width cases passed**, no browser errors or native ink outside the fixed frame. Nine cases each at299px and229px (four clefs including alto/C♭ and tenor/G♭, C2/C♯7 extreme ledgers, interval, chord, low progression), plus progression at145.5px and109.5px; all frames112px high. Assertions require native `data-rendered=true`, uncovered placeholder, five measurable staff lines, and each native text glyph's actual Canvas font-ink bounds contained within its frame. Example staff heights46.88px treble,53.76px alto/tenor,27.43/31.75px extreme ledgers and34.76px narrow low progression; normal treble notehead ink13.83×11.72px, narrow progression10.25×8.69px. Evidence `/tmp/note-quiz-ui-repair-701103/notation-fixture-report.json`, source/probe and `notation-network.json`. The final fixture tests only the current wrappers; historical baseline comes from the coordinator's separate before/after production measurement. Shared renderer worker use was disabled **in the temporary in-memory bundle only**, not in any repository file, to isolate geometry. This is not a production worker-lifecycle pass.
- Final Prettier check on20 owned application/test TSX files, both scripts and this report — passed.

## Browser verifier handoff and limitations

Run the two strict repository scripts only against the coordinator's already-running isolated snapshot, with explicit `UI_BASE_URL`, existing `PLAYWRIGHT_MODULE`, `BROWSER_PATH` and a fresh `UI_ARTIFACT_DIR`. Neither script starts/restarts a server or attaches to existing browser tabs. The layout runner defaults to80 idle cases (eight locales×two viewports×note/ear/interval/chord/progression), plus44 English/German feedback cases (two viewports×11 visual/audio tasks). `UI_LAYOUT_IDLE_ONLY=1`, `UI_LAYOUT_IDLE_LOCALES` and `UI_LAYOUT_LOCALES` narrow only the selected matrix.

It compares stage/prompt/notation/explanation/input/button geometry through correct/repeated correct/incorrect/next, checks pre-reveal secrecy, current renderer readiness, clock-only notation mutations, pause/resume, finish/restart/early end, action footprint, all-width result minimize/restore/focus/viewport behavior, no result scrollIntoView, workspace coordinates and mode-exit cleanup. Audio silence, deterministic random, virtual clock, leaderboard/network responses and deliberate test scrolling are labelled fixtures. Native audio time is now synchronized separately from virtual clock. It does not claim real audible output, real ads, physical touch, microphone hardware or React profiler render counts.

The old failed QA snapshot and artifacts were read-only diagnostic evidence, **never a pass**. Likewise, a deliberately crossed145.5px alto/C♭ seven-flat native fixture exposed about3px right ink overflow; this combination cannot occur in current basic modes (Note uses the full-width frame; narrow progression cells use C). Coordinator explicitly excluded widening scope for that unsupported cross product. Actual320px viewport Note is about229px and remains part of fresh QA. Native fixture worker-disabled bundling is an in-memory diagnostic only; it does not validate production worker lifecycle or alter the shared renderer. Final integrated geometry, translated long-copy interaction, ad safety, renderer worker behavior, current history/toast integration and full UI/routes/build gates remain the coordinator's independent QA responsibility. No final integrated pass is claimed here.
