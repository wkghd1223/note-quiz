# Melody practice — approved product direction, 2026-11-14

The user's latest request supersedes the fixed-stage Challenge product. Preserve the existing uncommitted Phase1/2 renderer, audio and locale work; do not reset or commit/push/deploy it.

## User decisions

- Display name: 멜로디 연습 / Melody Practice. Canonical route `/melody`, with seven localized equivalents; old `/challenge` and stage/world links redirect here.
- Generate a fresh eight-bar,4/4 melody from user-selected clef, key, lower/upper pitch and allowed note durations. No levels, unlocks, stage stars or fixed content map in the public flow.
- Voice microphone input only now. No touch or letter-key answers and no touch fallback on permission errors. Pause/retry/settings controls remain keyboard accessible. Piano/rhythm-keyboard answers are future work.
- Rests and suitable base tempo are automatic. No repeat/DC/DS marks in generated melodies. Imported-score repeats are future upload-mode behavior; this task does not implement uploads.
- Reuse the real shared site header, settings primitives and purple design.
- Fix first-note entry: one authoritative audio clock, full four-beat count-in, visual approach to the line, first note onset at zero.

## Ownership / implementation

- Domain worker: reusable exercise definition, seeded eight-bar generator/settings validation, voice pitch support bounds, explicit runtime exercise support in existing session store; focused tests. No scoring-threshold/API/DB changes.
- Timing worker: session hook audio/count-in/elapsed lifecycle and cursor pre-roll; tests for first onset and resume. Coordinate the common exercise contract with domain worker. No route/UI/copy edits.
- Root: `/melody` routes and old redirects/SEO/sitemap, common header, random-exercise UI and settings persistence, seven-language copy, notation spelling/duration mapping, browser validation and final review.
- At most two helpers initially; Orca CLI, no nested delegation. Only task3013 may be restarted after PID/cwd checks; user3001 is preserved.

## Verification

- Seeded generator: exactly8complete bars, allowed durations and pitches, written key/spelling including B#/Cb, no repeat metadata, first note on beat0, safe settings restoration.
- Session: no premature playing state; first visual crossing and scoring start agree; microphone permission/error/pause/background/retry cleanups; keyboard/touch cannot answer.
- Routes:7locale pages, oldChallenge links redirect, no public map/unlock/stage controls, updated sitemap and metadata.
- Related tests first, full unit suite for session/domain changes, TypeScript, lint and production build. Preserve `/practice` semantic baseline.
- Actual localhost390×844 and1440×900 UI plus automated synthetic microphone timing; distinguish mocks, real browser APIs, actualGUI and unavailable real acoustic/device/paid-ad checks.

Implementation is authorized by the current explicit change request and route/name answer. Routine choices above do not require another approval. New architecture/scope choices beyond these need clarification.

## Additional user steering — overflow, choice controls, motion

- Inspect mobile lower-edge clipping with Journey adhesion present; preserve all controls through scrolling and avoid nested-scroll traps. Never hide/cover advertising.
- Use native radio-button segments for short mutually exclusive choices, retaining selects for long key/pitch lists. Preserve four practice-mode behavior and keyboard access.
- Add restrained shared easing and state/selection/dialog micro motion; no decorative continuous movement, input latency or changes to score timing. Honor prefers-reduced-motion.
- Validate mobile/desktop, long translations, keyboard selection, end-of-content reachability and dialogs under measured/synthetic ad geometry; distinguish actual loaded ads from fixtures.

## Completed checkpoint

Implementation and independent review fixes are complete. Final source build `1UxlPIodL7IgGx4EQbaQn` is served on existing task3013; user3001 is untouched.43files/583unit tests, TypeScript, lint (two existing warnings), production build, practice7browser groups and melody6browser groups passed. ActualOrca mobile/desktop observations and before/after evidence are recorded. Final review preserved scoring/API/DB/legal source. See [verification.md](verification.md) for exact artifacts, resolved test-harness failures and unverified actual-ad/acoustic/device limits. No commit/push/deploy was performed.

## New user correction — 2026-11-14 17:57 (active, supersedes completed checkpoint)

The user reports actual line/note timing mismatch and rejects manual horizontal scrolling, singer-specific copy, and the local Back to practice button. Current task is not complete despite the earlier test report; do not treat the old synthetic pass as proof of visual synchronization.

Authorized plan: independently measure rendered notehead crossings against the audio timeline and fix demonstrated timing errors, remove manual horizontal scrolling entirely, expose measured microphone activity, use instrument-neutral microphone wording, add shared header navigation (home/basic practice/melody) and validate IA/SEO/sitemap. Expand settings with BPM40–180 (explicit quarter-note BPM), meters2/4,3/4,4/4,6/8, dotted note variants and grouped eighth-note triplets; retain8bars and automatic rests. Sixteenth notes may be included alongside current lengths if representable and tested. No uploads/repeats/input keyboard/scoring formula/API/DB changes or new dependencies. Existing3001 must remain untouched; task3013 is currently build1UxlPIodL7IgGx4EQbaQn.

Ownership: timing worker owns cursor/clock/renderer-coordinate investigation, hook/audio measured signal and count-in; rhythm worker owns settings/generator/domain meter helpers/notation model adapter with tests; root owns Melody UI/settings view/ScoreViewport component/navigation/translations/integration and computer-use verification. Renderer-coordinate and rhythm-adapter files are disjoint; coordinate interfaces before touching shared boundaries. Actual DOM notehead position, not merely a computed translateX value from the same algorithm, is the required visual timing oracle.

## Correction implementation checkpoint — 2026-11-14 18:35

The earlier voice-only4/4/automatic-tempo description above is historical. Current public input is instrument-neutral monophonic microphone; the user chooses quarter-noteBPM,2/4,3/4,4/4,6/8, base note values, dotted variants and eighth-triplet groups. Generated8bars/rests remain automatic. Capture fixtures at44.1/48/96kHz support a conservative500ms shortest enabled note interval, so maxBPM is120forquarters,60foreighths,40fortriplets (up to180forlonger notes); sixteenths are not exposed. This is fixture evidence, not acoustic certification.

Confirmed fixes: essential score motion no longer snaps under reduced-motion; current-note/measure boundary uses epsilon; color-only alphaTab updates reuse native viewport without hiding the engraving; scrollbar removed in every phase; signal uses existing capture stream; count-in is one meter-aware bar (6/8has2dotted-quarter clicks). Common navigation and7locale neutral copy/SEO are integrated. Active mobile player scrolls once to keep controls/music/signal together. Independent review found a notation-failure resume hole; root fixed it and the browser regression fails before/passes after.

Final candidate source matches isolated build q0Xcj_xi4Hy5YUTj-j9p2 on existing3013; user3001PID28754 unchanged. Full46files/649tests,TypeScript,lint(twoexistingwarnings),build pass. Final native-clock Chromium6/8+dots+triplets measurement:1200RAFframes,median16.6ms,max24.5ms,10realglyphcrossings,error-0.35..6.54ms,10judgmentcolorchanges,0hiddenframes. NativeOrca coarse80ms cadence cannot establish that precision; physical acoustic and all paid-ad variants remain unverified. Final report is verification-rhythm.md.

## Active user correction — 2026-11-15

User reports ambiguous pitch detection, perceived sync mismatch and nonuniform line/score speed; asks preview to use the same moving score and adds independent per-beat metronome and measure-start bell toggles. Tested input is voice. Current task supersedes earlier completion for these issues.

Plan: validate signal versus pitch/event detection with vocal-like knownPCM; fix demonstrated analysis/calibration errors; nativealphaTab equal musical bar widths plus time-proportional event anchors (not only uniform cursor on unequally spaced notes); preview elapsed from actualaudio clock and no microphone/scoring; scheduledmeter-aware independentmetronome/bell, sourcecleanup; visiblemeasuredpitch feedback,7localecopy/settingsmigration. Preservepractice/scoring/API/DB/anonymity/no newdependencies. Defaultcueoptionsoff retainexistingchoice; count-instillonebar.

Ownership: notationworker ownsrenderer/model/viewport/cursor geometry, audioworker ownspitch/capture/detector/sessionaudio cueAPI, root ownshookpreview/metronome scheduling/settings/UI/copy/integration. Existinguser3001andtask3013 mustbe inventoried before anyrestart; no additionalserver. Relatedtestsfirst/fullunit/type/lint/build, realglyphuniformvelocity/onsetoracle, preview-start/stop/reset andmiclifecycle,390x844/1440x900nativeUI. Realphysicalvoice/acousticinputlimitsreported separately.

### 2026-11-15 implementation checkpoint

- Audio worker confirmed and fixed voiced calibration contamination, dominant-harmonic octave errors, RMS/pitch-window timestamp conflation, and onset loss on short unstable attacks. Beat/bell cues use tracked inharmonic buffers; dry and voice-mixed PCM tests pass at 44.1/48/96 kHz. Physical acoustic leakage remains unverified.
- Root implemented independent persisted metronome/bar-bell options in all 7 locales, preview RAF/cleanup without capture, and separate signal/pitch feedback (note, Hz, cents).
- Native public `spacingRatio`/`displayWidth` alone cannot provide exact time spacing: full-bar centering and prefix widths remain. The pinned alphaTab 1.9 adapter decorates only opted-in horizontal score layouts before native glyph/beam/bounds rendering. Page `/practice` retains its worker path; generated eight-bar melody uses the same-thread native renderer. No SVG redraw, dummy notes, library upgrade or dependency was added. This internal adapter must be revalidated on any alphaTab upgrade.
- Independent review caught final-triplet/barline overlap. Fixed with 12-unit inset and 96 units per quarter; 104 independent native cases verified containment, positive containers and exact temporal anchors. Initial adapter registration now precedes API construction, proven necessary by real-browser checks.
- Browser evidence exposed 27–33 ms render/output-clock lead. A bounded output-timestamp projection now drives visual/count-in/preview progression; scheduled cues and raw captured event timestamps remain in AudioContext coordinates. Unsupported/stale timestamps fall back without a guessed hardware offset.
- Fixed rail reservation avoids reporting Ready and then remounting due to measured content width. Preview scrolls the player into view once, like practice.
- Another authorized Orca run owns practice route separation and shared navigation/SEO. Its edits are preserved. This run owns melody/challenge/audio/notation only and task server 3013; no user development server is modified.
- Validation in progress: final source build, native output-clock glyph crossing/velocity, mobile/desktop preview and cue controls, real capture pipeline with synthetic WAV, renderer recovery and independent clock review. Earlier build/test reports are checkpoints, not final proof for the latest clock change. No commit/push/deploy requested for this correction.

### 2026-11-15 completed correction

The pitch, output-clock synchronization, preview motion, independent metronome/bar-bell options and equal native measure spacing are complete. Final task3013 build is `7OWEHpWdNEY8pEOQ7u3WL`; no user development server was modified. Full unit suite: 52 files / 790 tests passed. Final TypeScript, lint (two existing warnings) and production build passed. Seven browser groups, an explicit C4 frequency run, final-build preview/cleanup smoke and ordinary practice notation smoke passed. Native Orca interaction covered measured 390×844 and 1440×900, including an actual bottom-ad variant. Independent geometry and clock reviews have no remaining reproducible finding. See [verification-clock.md](verification-clock.md) for before/after timing evidence, source/build boundaries and unverified physical/acoustic/side-ad conditions. The concurrent practice route/UI run remains independently owned. No commit, push or deployment was performed.

### Follow-up — piano preview and compact mobile controls

The user requests a piano timbre instead of the electronic preview tone, and side-by-side mobile Start/Preview controls with smaller button text including Settings. Inspect existing audio/dependencies before choosing the smallest implementation; preserve the established output clock, absolute note scheduling and cleanup. Scope is melody preview audio and the player controls, with no scoring/microphone/cue-tone changes. Keep 44-pixel minimum touch height, existing translations and primary/secondary hierarchy. Verify focused audio lifecycle tests, TypeScript/lint/build, preview/stop at 390×844 and 1440×900, long translated labels and settings focus. Orca audio worker investigates reuse; root owns UI and integration. Existing user server is preserved; task3013 is reused.

Completed: bundled sampled piano via public alphaTab offline export, original session-clock scheduling, cancellable loading/error retry in seven locales, and compact two-column 14px/44px controls. Independent review found no actionable defect. Full 55-file/876-test suite, TypeScript, lint (two existing warnings), build and targeted browser cases passed. Final build `qC9WxSrESgquB5HnElNLI` is on task3013. See [verification-piano.md](verification-piano.md) for direct mobile/desktop interaction, corrected loading-state test assumption, screenshots and physical-device listening limits. No commit/push/deployment.

### Coordinated common presentation and provisional pitch follow-up

The separately approved common-control/result presentation is now integrated into MelodyPractice without sharing its session state, callback ownership, clock or scoring. The eight-locale integration includes provisional pitch-only guidance, mobile result minimize/reopen and horizontal next/retry. Native timed quarter width is92 with8-unit onset inset; tested smaller candidates collided with glyph/bar boundaries, so no larger reduction was forced. Focused104tests, full979tests, TypeScript, preliminary production build and targeted browser fake-WAV/preview/result interactions passed; an independent read-only integration review found no reproducible regression. Final shared-dialog follow-up and source-boundary verification remain tracked in `verification-presentation.md`.
