# Practice layout and routing — 2026-11-15

Status: full ownership handoff delivered to Codex session `01a18a6b-b4ca-7d03-aa5b-ba404cb00811` (accepted input receipt recorded in [handoff.md](handoff.md)); old coordinator stops. Live P-UI glyph correction, remaining presentation decisions and final independent QA remain under the receiving coordinator. This feature/run is not complete.
Run: `run_1f32a2a34e27`.

## Accepted behavior

- All four basic practice modes use one nonmodal, absolutely positioned correct/incorrect overlay. Feedback must not change question, notation or answer-control geometry, steal focus or block input targets.
- Mount a stable notation surface with staff/clef before answer reveal. Audio questions reveal notes in that same surface; hide unrevealed answers from accessible labels too. Reserve the full progression grid, not only a single staff.
- Additional user correction: basic practice idle screens also show the appropriate empty staff/clef (and full progression grid where applicable), before starting. Reuse active surface geometry where practical without generating/revealing a question or initializing audio/microphone automatically.
- Additional user correction: ending a game must also retain that notation frame at the same position/size. Preserve the last question's staff when available, otherwise a neutral settings-based empty staff. Place result/review content after the stable frame without losing existing results/restart/focus behavior; remove transient feedback on finish. Verify notation bounds and scroll position around early stop, last-answer finish, and restart at desktop/mobile. Avoid forced scroll or document overflow locks to conceal the issue.
- Additional user correction: unify primary start actions with Melody Practice's “연습 시작” wording. Use one shared translated display source for all four basic modes and melody; keep all seven language dictionaries and instructions consistent. Existing internal action/key identifiers may remain unchanged. Translation-field ownership and any melody call-site change are coordinated with the other session.
- Keep detailed answer/explanation space stable across question → feedback → next question. Preserve existing feedback timing, duplicate-answer protection, pause/resume and result behavior.
- Narrow high-frequency state subscriptions and isolate stable notation/input rendering from the clock, without changing scoring, generation, session clocks or audio semantics. Do not claim measured performance without evidence.
- Split basic practice into `/practice/note`, `/practice/ear`, `/practice/interval`, `/practice/chord`, and all seven locale-prefixed equivalents. Use persistent nested layouts and mode-specific implementations; no parallel/intercepted routes are required.
- Existing `/practice?mode=...` links retain supported settings/share/daily/overlay intent. Direct entry, refresh, back/forward and language switching work. Mode navigation uses history; same-mode setting/overlay changes do not terminate a session. Leaving a mode retains existing audio/microphone cleanup.
- Explicit user steering: bare `/practice` redirects to `/practice/note`; locale base paths such as `/ko/practice` redirect to their corresponding `note` leaf. An explicit legacy mode query still selects its matching leaf and preserves supported query intent.
- SEO steering: retain all legacy practice entry URLs and their query intent; use permanent HTTP308 redirects for the new practice-index migration. Preserve descriptions/social metadata and language alternates on final canonical leaf URLs. Keep sitemap functionality and unrelated URLs, with the canonical destination pages listed. The user's abbreviated `st` is interpreted as sitemap; existing state/share restoration also remains covered. Do not claim that rankings or index transfer have been externally verified.
- Preserve anonymity, leaderboard/API contracts, all unrelated working-tree changes and existing melody navigation/SEO/redirect behavior.

## Cross-session agreement

Other coordinator: `run_a2cccdceaf00`, exact handle `term_f780478e-2947-4e8b-9dc4-bc74da7c2351`.
Agreement received in `msg_eb1847b77757`.

- Other session owns `src/features/melody/`, `src/features/challenge/`, `src/components/notation/AlphaTabNotationView.tsx`, all `src/lib/notation/`, and melody verification scripts.
- This run may edit basic practice components/routes, Staff/MusicNotation wrappers, header/footer/locale/SEO/sitemap/next.config and existing basic-practice verification. Preserve the other session's uncommitted content in those files.
- Do not change root `.next` or `node_modules`, restart user3001 (PID28754), or touch melody3013. Use an isolated temporary source/build directory and a separate verified free port (e.g.3014) for browser verification. Coordinate again if shared scope changes.
- No commits, push, deployment, package installation or database changes.

## Tasks

### P-UI — Stable feedback, notation and update boundaries

Owner: Orca Codex worker; selected model `gpt-6.1-sol` per current user instructions.
Scope: NotePracticeMode, EarPracticeMode, TheoryPracticeMode, PracticeShell, MusicNotation and Staff wrappers; new local feedback/notation helpers; dedicated layout browser verification script. Keep existing public mode props unchanged for the routing worker.
Dependencies: none.
Acceptance: accepted geometry/feedback/answer-secrecy behavior in four modes, audio/visual and progression, desktop/mobile; preserved store timing and cleanup; focused checks and evidence in `ui-report.md`.
Do not edit PracticeClient/routes, ModeSwitcher, AppShell, i18n/SEO/navigation, stores/domain/audio, shared renderer or shared notation model.

### P-ROUTES — Persistent shell and mode-specific routes

Owner: separate Orca Codex worker; selected model `gpt-6.1-sol` per current user instructions.
Scope: existing PracticeClient and practice route trees; necessary new controller/layout/entry helpers; AppShell/ModeSwitcher if needed; header/footer/locale/SEO/sitemap/config links and route-related tests.
Dependencies: none; consumes unchanged public mode props.
Acceptance: actual mode-specific imports and persistent shell; four paths and seven locales; preserved old settings/share/daily/overlay links; safe mode cleanup/back-forward; focused checks and evidence in `routes-report.md`.
Do not edit the UI worker's modes/PracticeShell/Staff/MusicNotation, stores/domain/audio, translations, melody/challenge, shared renderer or notation model. Reuse existing translated labels.

Approved integration adjustment: P-ROUTES owns a new pure `src/lib/practice/theoryLabel.ts` helper and the `LearningHistory.tsx` helper import, removing its runtime dependency on TheoryPracticeMode. P-UI owns the corresponding TheoryPracticeMode helper import/re-export; neither worker edits the other's file.

Follow-up implementation: UI task `task_49220d4af694` / dispatch `ctx_6a18634771de` owns idle staff surfaces and shared start labels. Other-session agreement `msg_49c003371543` permits changes to the `startGame` / `startGameInstruction` fields in `translations.ts` and `zh.ts`; this run also updates the basic ear start call site and affected test expectations. The melody owner changes its primary start button from `m.start` to `t.startGame`. Seven common values match the existing melody translations. No scoring/session/audio behavior changes are included.

Approved finished-frame integration: P-UI may add an optional `preserveScroll=false` result option in `LearningResult.tsx` and `NoteSessionResult.tsx`. Basic practice passes true to retain accessible heading focus with `preventScroll` while skipping the existing unconditional `scrollIntoView`; other consumers retain their default behavior. This removes a concrete automatic-scroll cause reported in `msg_e611abe95d33` without scroll locks or manual position restoration.

Other-session handoff `msg_78592e8bfbed`: melody/challenge/audio/shared-notation implementation is now finished and no longer being edited there. Its final snapshot is `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/note-quiz-melody-build-clckh5_q`, manifest `/tmp/note-quiz-melody-build-manifest.json`, build `7OWEHpWdNEY8pEOQ7u3WL` on3013. That session reports 790tests/type/lint/build and melody browser checks passing, including the common start-label call site. These are separate evidence and do not verify our pending idle/finished-frame work. Do not restart or alter its retained3013 server.

Later steering in that session (`msg_e0b96d24ab68`) resumes edits only in MelodyPractice and challenge preview audio for piano preview timbre and mobile control typography/layout. It retains3013 and leaves this run's basic practice/common styles/3014 untouched. The earlier melody snapshot is therefore an earlier version; our final QA manifest must identify the actually captured source and distinguish this new concurrent work.

### P-QA — Integrated independent verification

Owner: coordinator assigns read-only Orca verifier after both implementation tasks settle.
Dependencies: P-UI, P-ROUTES.
The queued QA task `task_6b04428a819e` is also held until the additional idle/start-label/finished-frame task and melody call-site alignment finish. Route SEO follow-up `task_91387c731894` is implemented with 67 focused tests passing. Type correction `task_d031bf588182` is implemented with 22 focused tests plus a zero-diagnostic scoped strict semantic TypeScript check; complete route evidence remains in `routes-report.md`. Melody primary start now uses the common translated source (other-session report `msg_34368d721d17`).

QA gate update: all those dependencies now settled. UI follow-up `task_49220d4af694` reports implementation complete, 98 focused tests passing, and the seven-language idle/finish/restart geometry and scroll regressions added to its browser verifier. Those browser checks have not yet run. Independent P-QA may now capture an isolated source snapshot and run the integrated gates; other-session melody preview work remains a separately versioned concurrent scope.
Checks: focused tests, full unit suite, TypeScript, configured lint, isolated production build; browser mobile390×844/desktop1440×900 answer/correct/incorrect/next geometry, keyboard/focus, direct/legacy/locale/history/settings links and audio cleanup. Measure render/update evidence where practical. Report unavailable checks and pre-existing configuration failures separately. Confirm source/build boundary because the other session is concurrently editing unrelated modules.

## Completion evidence

Workers record exact changed files, commands/results, criterion evidence and limitations in their assigned reports. Coordinator reconciles integration, obtains independent review, and appends final verification here. Existing before/after geometry baselines intentionally change for this approved redesign; old semantic/scoring/session contracts remain regression gates.

## First independent QA and corrections

Read-only QA report: `/tmp/note-quiz-practice-qa-evyhg6om/review.md`; input manifest SHA256 `cb51b5476d513e61732d01ac1a98930d5c95d9f3a8391cf5e7fb0057d62bd601` (322files), build `HsiE7osVoETwnlOC77tRv`, retained snapshot server3014. Full55files/876tests, semantic TypeScript, lint (two existing hook warnings), build, 70seven-language idle cases and substantial semantic route/feedback checks passed. Acceptance did not pass: unknown legacy mode streamed HTTP200, note390 action row44→56px shifted notation12px, and paused judgment remained visible. Progression finish scroll+80px needs fixture/browser-anchor/product diagnosis. Original scripts also need settings URL settling and outdated invalid-mode/audio-settling harness expectations corrected without relaxing acceptance.

- Route correction `task_fa6e7699e806` implemented with150focusedtests and scoped strict semantic diagnostics0: legacy index GET Route Handlers return native404 or308 outside layout streaming; settings verifier waits for the URL. Latest network/build verification remains pending.
- UI correction `task_701103ce59c7` / `ctx_b7899d2a211f`: stable action footprint, paused overlay display, progression finish-scroll diagnosis, meaningful verifier synchronization; also owns the settingsIntro forwarding described next. May edit GameControl for the demonstrated action-row issue. No changes to timers/formula/audio or shared renderer.

## Coordinated user request from the other session

Other coordinator forwarded the user's additional practice screenshot correction in `msg_a54fd94de7c8` / `msg_002976d5640a` / `msg_df7b3b91d788`, and this run accepted ownership. Move presets/difficulty and theory session length/time into existing SettingsSurface. Remove the top link-copy and today's-ten-question UI; retain legacy share/daily URL semantics, valid warnings/history status and a normal-practice exit for legacy daily sessions. Keep settings open through same-mode preset/difficulty changes, including quick sequential changes. No scoring/privacy changes.

Routing/controller worker owns PracticeClient, route helpers/tests and route verifier; UI worker owns optional `settingsIntro?: React.ReactNode` on all mode/shell props, forwarding and rendering before existing settings. Writes remain disjoint. Reuse existing translations. The old shared-copy UI test is replaced with actual settings/URL-restoration checks while existing direct-link compatibility remains tested. After both corrections settle, capture a new source manifest and run independent QA again; prior build evidence does not verify these changes.

Settings follow-up `task_5a7cb013e18e` is now implemented: 192focusedtests/scopedstrictsemanticdiagnostics0; exact changes and supported rapid URL updates are in `routes-report.md`.

## Approved common controllers/results and melody compact feedback

The user explicitly approved extending the existing shared settings approach to common Controllers and result presentation across all four basic modes and melody. They also explicitly named concurrent Codex session `01a18a6b-b4ca-7d03-aa5b-ba404cb00811`. The known other coordinator confirmed its exact `CODEX_THREAD_ID` in `msg_115da6047fa2`; its Orca handle remains `term_f780478e-2947-4e8b-9dc4-bc74da7c2351`, Run `run_a2cccdceaf00`. This run's thread is `01a13d09-f5c5-70b2-b0f3-5fb45f6b8147`. Orca history search is disabled and was not bypassed.

User clarification: “게임 양상이 많이 다른데 같은 Controller를 쓰는 게 좋나? UI만 맞추는 거 아니었어?” Sharing is strictly presentation: button appearance/spacing/height/focus styles, stable layout, metrics and result-popup framing. Do not create a common game controller, state machine, lifecycle, timer, input/audio/scoring engine or identical action set. Each game retains its own actual capabilities and handlers. `PracticeController` is only a markup renderer of caller-provided actions; a clearer ControlBar/ActionBar name may be adopted through coordinated API updates, without expanding scope.

- UI worker owns small reusable controller/status and result-presentation primitives plus basic-mode integration. Preserve per-mode capability, store, timer, audio and scoring ownership. Use the existing settings/dialog patterns and purple visual system; no new dependency or framework change.
- On mobile, results open in the shared overlay without adding a new results block to the notation flow. They can be minimized and restored through the existing finished-controller action area. Preserve focus, Escape, readable scrolling, resize behavior and ad-safe space. Desktop uses the same result content inline. Existing scores/review/retry/next actions remain game-specific content/actions inside shared presentation.
- Compact basic mobile UI: prompt and absolute judgment share a stable top band; remove the separate reserved feedback band and compress blank heading/explanation space. Metrics become one row and controls use a compact inline top bar with44pxminimum touch targets. A practice-local sticky bar is an option only if needed; do not place controller bars over bottom ads/keyboard. Keep stage/notation/input position stable across phases and long translations/ledger/key cases readable.
- Melody owner implements uniformly narrower timed bars and compact native glyph spacing, preserving time-proportional anchors, constant scrolling speed, cue/output-clock synchronization and notehead readability. Validate native final-triplet/barline containment, keyGb, clefs, scale1/2 and full-bar notes. Sixteenth-note rendering fixtures may be tested without implicitly enabling unsupported new generated/input durations.
- Melody live pitch feedback is a presentation layer using existing valid/voiced/confident capture data and current targets: stable matching/mismatching pitch is provisionally green/red; unreliable/no signal is neutral. Final duration/onset/pitch scoring remains authoritative and unchanged. Provisional indicators must be distinguishable from final scored results; stale frames, pause/count-in/preview and target changes must clear correctly.
- Mobile melody new/retry actions use two columns with readable long translated labels and44pxminimum targets. Shared generic labels such as minimize/view-results are added to the translation contract and all seven dictionaries together by the common-UI owner.
- Common UI API/file ownership is communicated to the melody owner before its call-site integration. Existing in-progress UI corrections and settingsIntro support continue; tests must target the final approved presentation rather than obsolete mobile inline-result expectations.

All new scope still requires focused checks, independent fresh-snapshot QA, actual desktop/mobile interactions and explicit source/build boundaries. The first876-test/build pass is a baseline, not verification of these additions.

Confirmed cross-run allocation: the named other session owns HomeClient, a separate home-only seven-language copy module, home SEO branch and home verification for its separate user request. Common `translations.ts`/`zh.ts` UI fields remain with this run's UI worker; the other session preserves shared header/footer and practice/melody SEO branches. That coordinator starts an Orca Sol worker on melody compact native spacing/live-pitch presentation and related tests, then integrates MelodyPractice with this run's common controller/result primitives after the typed API is published. Its clock/audio/store/scoring/generator remain independent. Both coordinators exchange source/build boundaries and keep3013/3014 separate.

### Shared API handoff

Draft files and interface were published by P-UI in `msg_8bd77b7ed6cd` and sent to the named session:

- `PracticeController({state,states})`, states map to arrays of exported `PracticeAction {id,label,onClick,tone?,disabled?,icon?,buttonRef?}`. `StablePracticeActions` reserves the maximum translated state footprint; inactive groups remain invisible/inert and must not take focus or duplicate active refs.
- `PracticeMetrics({items,detail?})`, with label/value/icon items and compact mobile metrics.
- `PracticeResultSurface({mobile,open,onOpenChange,returnFocusRef?,children})`; `usePracticeResultSurface(finished,sessionKey)` manages only responsive presentation/open state. Callers retain result data and game actions. The finished controller's restore action reuses its reserved footprint. Common labels are `t.practiceUi.minimizeResults` and `viewResults` in all seven dictionaries. P-UI also owns optional `PracticeDialog.returnFocusRef`, preserving prior callers' defaults.

Other-session melody task is `task_355cc85f3ee2`, dispatch `ctx_c35470ebde92`, terminal `term_9345e114-7c2f-4f25-a073-378fb9780318` (reported in `msg_79fbef707893`). That worker owns ScoreViewport/score-scroll as needed/time-spacing/native regressions and new pure live feedback helpers/tests; the named coordinator owns MelodyPractice integration. Home follow-up will leave shared `seo.ts` untouched and pass existing metadata copy arguments from its own home routes.

API implementation update (`msg_07d38460226d`): basic modes now consume all three actual shared presentation components. Controller has no state hooks and retains caller handlers/capabilities; inactive groups do not assign button refs. `LearningResult` and `NoteSessionResult` expose optional `focusOnMount=true`; Surface-managed results pass false. A child result heading may use `data-result-heading` for mobile duplicate-title hiding while accessible labelling remains. These integration details were sent to the named melody owner. Full final verification is still pending.

Concurrent locale update: current source now supports Brazilian Portuguese (`pt`) as an eighth locale, including its explicit dictionary/common-result labels, navigation, metadata and legacy redirect handling. Preserve that other-work result; final UI/schema/browser checks must cover the actual current supported locales. Earlier seven-language/70-idle evidence remains historical and must not be relabelled. Other-session intermediate integration reports979tests/59files and TypeScript passing; a new PracticeDialog return-focus cleanup lint warning was routed to the UI owner for a safe fix and focus/resize regression coverage before final build.

P-UI intermediate source checkpoint `msg_1abb2c878fec`: application edits complete,121focusedtests/typecheck and an isolated8locale actual-component/Tailwind fixture pass; the new Dialog warning is fixed by capturing the stable mounted return element. Immutable3014 diagnosis attributes the progression scroll+80 to prepending theory explanations and audio verifier settling to real WebAudio versus virtual clock; help-first ordering and strict settling now address these. Final production integration remains pending.

Before source freeze, the named session forwarded a user glyph-legibility correction (`msg_8c683cefe1cb` / `msg_93042c89baaf`): old Staff620×260 and MusicNotation360/420×380 viewBoxes cause a second downscale after native fitting inside compact fixed-height frames. P-UI owns the minimal correction in Staff/MusicNotation/StableNotationSurface: measure actual frame CSS width/height and pass matching native viewport dimensions, keeping frame geometry and readable placeholder/fallback/ledger/key cases. Do not alter melody horizontal renderer/model/clock. Measure actual glyph-size improvement and preserve cleanup/state stability before freezing the final source; no optional polishing is requested.

## Full coordinator handoff and latest approved presentation — 2026-11-15

The user explicitly transferred the entire task to Codex `01a18a6b-b4ca-7d03-aa5b-ba404cb00811` / Orca `term_f780478e-2947-4e8b-9dc4-bc74da7c2351`. Root read handoff.md and used the normal `run-use` procedure for `run_1f32a2a34e27`, preserving both Runs and their task history. A first cross-run follow-up was fenced before mutation; it was correctly reissued after binding the transferred Run. The original coordinator has stopped.

User has now explicitly selected sticky controls within the practice scroll area and button-open result/history panels on both mobile and desktop. This supersedes mobile-only result dialogs. UI worker ctx_b7899d2a211f owns basic sticky actions/metrics, all-width ResultSurface, glyph enlargement and thin PracticeFeedback wrapper. A follow-up history worker ctx_d1602fce328b owns PracticeClient/LearningHistory/new HistoryPanel only; no history schema or melody persistence is added. Root owns Melody call-site adaptation and a new shared PracticeAnswerToast/CSS module.

New toast requirements: share appearance/motion only, keep each game's detailed explanations and callbacks. Existing chord answer/correct/composition text remains. Toast must not cover staff or inputs: basic games reuse their reserved prompt band; melody uses its score footer, outside the actual music viewport. Correctness text/icon/colors remain explicit; 4px translate/fade motion is disabled under prefers-reduced-motion. Caller controls visibility; no answer progression/scoring timer is introduced. Melody's provisional pitch color remains separate from completed-note judgment toast. Count-in/paused status also uses that fixed footer to avoid shifting the music at entry.

Latest remaining gates: finish native glyph correction including blank/fallback; check8locale toast/action sizing; update stale SSR input-slicing assertions for all-width dialogs without weakening frozen-input behavior; fresh production snapshot, full relevant checks and independent integrated route/layout/answer/result/history/ads/sticky verification. Old3014 and intermediate3013 are not final evidence for these additions.

## User correction: preserve empty-measure breathing room

The user rejected the final blank/early-finished staff shrinking to clef-only width. This is now an acceptance defect, not an optional polish. The enlarged glyph scale remains desired; measure width must be independent and sufficient inside the fixed frame. Current native Page layout uses automatic content weights; empty bars have zero content weight and collapse to fixed clef/barline overhead even with lastSystemFillThreshold0.

Existing UI worker was reopened as task_4c9ed0fcd4d4 / ctx_e3485a61a7ec with ownership of basic notation wrappers and an optional native fitted-layout correction/tests if necessary. No melody horizontal/time-spacing, audio/scoring or frame-height change. Prefer native alphaTab layout settings over glyph distortion or invented notes/rests.

Root added true-native before/after diagnostics `/tmp/note-quiz-staff-width.cjs`: waits for hidden placeholder and actual renderer completion, then measures idle, active and unanswered-finished in all4modes at320/390/1440. Baseline `/tmp/note-quiz-staff-width-before/report.json` confirms mobile blank bars far narrower than active bars and desktop blank93px versus684px active. This catches a gap in the earlier glyph-only measurement, which sampled idle before native completion. Final updated source/build and scoped QA are required; prior broader route/state/history gates remain evidence for unchanged behavior.
