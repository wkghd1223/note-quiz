# Final candidate verification — 2026-11-15

## Candidate and scope

Application source is frozen in `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/note-quiz-melody-build-o8qlu3f1`, BUILD_ID `koqrhtg_aIDg2uiFDMszQ`. `/tmp/note-quiz-melody-build-manifest.json` records296 source/config files; all still match the shared working tree after final implementation. Current candidate is served through the existing task3013 terminal. No new production dependency, score/API/DB change, commit, push or deployment is part of this presentation follow-up. Concurrent locale/route work and user3001 are preserved.

The user approved shared presentation only: individual games retain their state, handlers, clocks, scoring and explanations. Controls/metrics stay at the top of the practice scroll area; results and existing basic history open in dialogs on both mobile and desktop. History is in the existing title row and is disabled during active unpaused gameplay. No melody history schema was introduced.

The native alphaTab renderer now receives actual measured frame dimensions, removing double downscaling. Frame heights are unchanged. Mobile390 staff height increased from31.02 to46.88px in note mode and29.56 to60.39px in chord mode. Detailed eight-case before/after output: `/tmp/note-quiz-staff-before/report.json` and `/tmp/note-quiz-staff-after/report.json`. `ui-report.md` records20 additional supported-width clef/key/ledger/native ink cases and the unsupported narrow alto/Cb cross-product limitation.

Common answer toast has explicit correct/incorrect text and icon, gentle4px fade/translate and reduced-motion handling. It is nonmodal and pointer-neutral; basic modes use the reserved prompt band, melody the footer outside the music viewport. Chord answer/correct/composition text and other per-mode details remain separate. Existing answer transitions retain their authoritative timing.

## Completed checks

- Focused basic UI/state/schema:6files121tests; home/SEO:2files58tests; history:46focusedtests. See owner reports for exact commands and boundaries.
- Independent frozen-candidate full unit suite:60files1009tests passed. The build-copy helper omitted Vitest config; QA preserved that initial failure and used an external copy of the existing config with alias/setup paths alone redirected to candidate source. Provenance in `/tmp/note-quiz-practice-qa2-tt8o9sar`.
- Strict TypeScript and configured lint passed; only existing hook warnings in `components/ui/modal.tsx` and `hooks/useComponentSize.tsx` remain. Production build passed in the isolated copy; root.next was not rebuilt.
- Home:24 combinations of8locales and320×740/390×844/1440×900, plus no-JavaScript checks, passed. `/tmp/note-quiz-home-final-qa/report.json`.
- Melody:390/1440 preview/piano/clock/cue cleanup, fake-WAV input and final/provisional feedback, result/retry/resize, ad fixtures/reduced motion passed. The compact-controls obsolete selector failure was corrected and its8locale scoped rerun passed. Reports `/tmp/note-quiz-melody-final-qa/report.json` and `/tmp/note-quiz-melody-final-controls/report.json` retain both outcomes.
- Independent extra basic geometry:48 combinations of8locales×320/390/1440×normal/reduced motion passed, including toast/no music overlap/no clipping/sticky position/fixed frame. `/tmp/note-quiz-practice-qa2-tt8o9sar/extra-basic/report.json`.
- Independent final source review found no actionable defects. `/tmp/note-quiz-final-presentation-review.md`;9reviewed files match the snapshot.
- Final diff whitespace and verifier syntax/format checks passed. Full route/layout/legacy UI browser gates remain pending the independent QA completion; do not treat this checkpoint as their pass.

## Native browser interaction on current candidate

Owned Orca tab `d17a1704-d29f-4ca6-b816-f2ffbed064db` was operated at measured390×844 and1440×900. Keyboard/click evidence includes:

- Chord start, correct answers, preserved own/correct/composition details, finish, result Escape/refocus, desktop reopen/minimize.
- History Enter open, Tab, mobile-to-desktop resize, Escape and focus restored to the history trigger; dialog name/role/aria-modal present.
- Note start, incorrect keyboard answer and detailed feedback, pause, mobile Settings open then desktop resize, restored body/workspace scrolling and cleared settings query, finish.
- Ear start, keyboard answer/feedback, finish and result dialog. The answer audio path was exercised, not subjectively evaluated.
- Current home first-screen actions at both sizes, desktop leaderboard link opening the named dialog, Escape and restored scrolling.

Current screenshots under `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/orca-browser-screenshots/`:

- `21d69436-df3c-4e29-a640-a3feaf117a73-screenshot.png`:390 note/native enlarged notation.
- `abb7921b-ac96-45ce-80b1-d689f1c5953e-screenshot.png`:390 ear.
- `2dd2a139-2b1b-4a87-9706-e84cb22f51a7-screenshot.png`:1440 history panel.
- `863165b5-66a5-48cd-900d-76e6e7dc1403-screenshot.png`:1440 result panel.
- `5a87522f-86da-4e8e-a8f3-a215af7cfa89-screenshot.png` and `c1fa860c-dd9a-4add-a2e7-24f73f22989f-screenshot.png`:390/1440 current home.

Native command settling can outlast the850/900ms feedback lifetime, so native accessibility changes verify immediate text while automated captures/geometry establish visible toast bounds; screenshots after settling are not claimed to capture the transient toast.

## Harness corrections and limits

All failed runs remain in the QA artifacts. The corrections address actual approved UI contracts or browser behavior, without changing application source: distinguish Settings from the new history dialog trigger; wait for uncovered real engraving rather than placeholder marker; request-test empty native404 responses; isolate history push/replace checks from Chromium50-entry cap; restore English after deliberate locale switching; select Preset/Difficulty/Session by actual accessible role/name; accept canonical home leaves; require idle keyboard disabled rather than absent; open history panel to inspect storage warnings. Existing scoring/privacy/session/URL assertions remain.

Automated leaderboard/ad/audio/clock/random/storage fixtures are labelled, not external writes. Earlier native home captures showed one real Grow bottom creative; final captures show no live creative. Desktop side creatives and all Journey variants, physical phones, human screen readers, acoustic voice/instrument and Bluetooth latency are not verified. Advertising scripts/creatives are not hidden or covered with control z-index changes.


## Independent broad QA completed, before minimum-bar correction

Task_4b4146bb2839 completed successfully against the same frozen candidate. Exact report: `/tmp/note-quiz-practice-qa2-tt8o9sar/review.md`. Final actual routes verifier passed36leaves/45redirects/9native unknown404 and12interaction groups. Final actual layout verifier passed124cases(80idle+44feedback); the equivalent wider en/de/ko feedback run passed146cases. Legacy UI regression passed15groups across preserved scoped runs;2real-ad groups remain not observed. Extra motion/sticky/width48cases and narrow results/history16cases passed. These supersede the earlier pending status for those gates.

The user subsequently rejected the collapsed empty-measure width. This is a distinct visual defect outside the earlier minimum-length assertions. A new basic-fitted native layout correction is in progress and will receive a fresh source/build and focused320/390/1440 check. Do not interpret the broad unchanged-behavior gates as acceptance of that too-short empty staff.


## Minimum-bar correction: fresh production verification

Fresh isolated298-file snapshot `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/note-quiz-staff-width-build-qvscp6d4`, BUILD_ID `MilD86pkOyTtriYSNuDoa`, includes the final native initialization RAF and result-review scrolling. All source/config hashes match root (`/tmp/note-quiz-staff-width-build-manifest.json`). It replaces only the owned3013 server; user3001 is untouched.

Production native-worker checks pass12combinations of320/390/1440 × note/ear/interval/chord, each idle→active→unanswered finish. `/tmp/note-quiz-staff-width-after/report.json` records no hidden answer, no horizontal page overflow and unchanged frame dimensions. At390 the note bar is239.63px in a299px frame, with46.88px staff height retained. Desktop empty bars reach560px. Before comparison `/tmp/note-quiz-staff-width-before/report.json` retained the collapsed60px mobile empty bar. The native/fallback27+27 supported fixtures and123focused tests are in `/tmp/note-quiz-empty-bar-4c9/report.md`.

The full unit run passed60files1015tests; final RAF lifecycle tests then passed11tests. Strict types and the production build passed. `npm run lint` passed with only the same two existing hook warnings. Native Orca operated start→finish→Escape on390, resized to measured1440×900, and verified return focus and unlocked scrolling. Screenshots `bcb63627-5e5e-4e7b-a806-d22cc622c887-screenshot.png`, `90d3a4bc-53fb-45dc-807c-e30e3f61470c-screenshot.png`, and `7d295462-7ab9-458f-b884-1e27594c5dd9-screenshot.png` are in the Orca screenshot directory. New captures had no live ad creative; prior ad limitations still apply.

The later user request authorizes a baseline commit, then a separate measured efficiency cleanup and second commit. This supersedes earlier no-commit instructions for this work; push/deployment is not included.
