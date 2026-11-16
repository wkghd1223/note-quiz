# Efficiency cleanup after baseline commit

Baseline: `2940490` (approved UI, routes, alphaTab and melody presentation). The user requested this commit before a separate efficiency cleanup and second commit. No push or deployment is requested.

## Confirmed scope

- NoteSettingsPanel subscribed to the entire note store despite using only settings/actions. Both mounted settings surfaces could react to50ms timer updates. Narrow its subscription without changing modal mounting or game timers.
- Note and ear persist middleware wrote the same settings/stats payload on every timer update. An actual-store diagnostic recorded20identical setItem calls over1second in each store. Share the existing fault-tolerant storage boundary and skip equal persisted strings while preserving immediate writes, recovery, cross-tab overwrite behavior and the existing schema.
- Melody liveResult called scoreAttempt from a memo depending on elapsed/heldDuration. The expensive matching/evaluation inputs do not depend on either value. Separate stable-input scoring from cheap clock-dependent judgment visibility and index target ends/latest onset once per input change.

Scoring formulas, matching, clocks, history schema, API/DB, translations and independent game behavior remain unchanged. Existing shared controllers/metrics/toasts/results already cover common presentation; another wrapper would add adapters without removing a meaningful duplicated responsibility.

## Completed narrow verification

Melody:3files62tests pass, including8new visibility regressions for target-end/grace/held/later-onset/late-input/invalid-onset/reset boundaries. `scripts/verify-melody-efficiency.cjs` uses real React and the real scorer in an isolated temporary bundle, adding a call counter only to that fixture.60separate clock updates produce0additional score evaluations; held changes also do not rescore. New input, target/profile changes and restart recompute as required. This is function-call evidence, not a whole-app FPS/latency benchmark. `/tmp/note-quiz-melody-efficiency-browser.log` records the pass.

## Completed combined verification

Storage implementation and before/after evidence are in [efficiency-storage-report.md](efficiency-storage-report.md). Actual note/ear20timer updates now make0additional identical writes (previously20), while elapsed remains1,000ms. The isolated actual React two-panel fixture records timer commits40→0; settings and language changes each still update both panels.

- `npm test -- --no-cache`:62files /1,036tests passed.
- `npx tsc --noEmit --incremental false`:passed.
- `npm run lint`:passed; only the two pre-existing hook dependency warnings in ui/modal and useComponentSize remain.
- `npm run build`:passed in the isolated303-file source copy `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/note-quiz-efficiency-build-l6kpchhc`. BUILD_ID `im6f9pTyP_qhEZ_PV1T39`. All manifest hashes match root. Only the existing owned3013server was replaced; user3001 remained untouched.
- Existing `verify-practice-ui.cjs`, filtered to the affected flows:5groups passed, covering390×844 and1440×900 home/four-mode10-question→review→restart, settings/dialog accessibility and resize/retry, plus blocked-storage practice. `/tmp/note-quiz-efficiency-practice-qa/report.json`. Advertisement scripts remained enabled; their external console warnings are retained in the log and are not app JavaScript failures or claims about all live creatives.
- Existing `verify-melody-ui.cjs` fake-WAV case passed on the final build: real browser microphone pipeline with synthetic audio, provisional/final feedback, minimize/reopen/resize, horizontal touch/keyboard/wheel result review, retry offset reset and resource cleanup. `/tmp/note-quiz-efficiency-melody-qa/report.json`.
- Native Orca on the same final build:390settings opened by keyboard, bass clef and G major selected, Escape restored the page; reload and measured1440×900 desktop showed both choices and persisted values. A subsequent bare-route navigation retained the bass setting. Earlier first-commit native checks also covered start/end, enlarged stable staff and result focus restoration. Final desktop screenshot `87e3df76-58db-4cc1-a87e-73b16251bedb-screenshot.png` showed one real Grow bottom creative with the practice viewport ending above it; this does not establish coverage for other Journey creatives or side ads.
- Independent review task3d28b87ee7e2: no actionable findings;43focused tests and final diff check passed. `/tmp/note-quiz-efficiency-independent-review.md` records reviewed source hashes. `git diff --check` passed at the commit boundary.

No physical-device microphone/instrument, subjective piano sound, Bluetooth latency or every real Journey ad format is claimed as verified. This cleanup preserves the prior scores and audio timing; measured savings concern function calls, React commits and writes, not a whole-app FPS benchmark. JSON serialization and one read per persistence attempt remain. No push/deployment was performed.

## 2026-11-16 follow-up — approved implementation

Baseline `ddd2e17`. The user approved three newly reproduced inefficiencies and requested a slightly smaller melody score so earlier notes remain visible.

- Public ranking GET now reads entries without viewer geolocation; POST country detection and server-authoritative scoring are unchanged. Legacy response metadata is optional.
- Melody pitch freshness/candidate bookkeeping stays on the playback clock in a ref; only visible guidance changes publish React state. Memoized settings keep both responsive surfaces without following the clock.
- Advertisement observation filters unrelated practice animation mutations, caches wrapper membership and observes wrapper size. Ad/ancestor changes, discovery/removal, scroll/viewport events, the one-second fallback and cleanup remain.
- Only the melody time-spaced rail uses 85% horizontal engraving scale and a 176px score area, with more space before the playhead. Engraved bounds use the same transform; basic practice notation keeps its existing geometry.

Final verification:

- `npm test -- --no-cache`: 74 files / 1,244 tests passed on the final application source. Strict `npx tsc --noEmit --incremental false`, `npm run lint` (the same two pre-existing hook warnings) and `git diff --check` passed.
- Isolated `npm run build` passed, BUILD_ID `ZRbq8cTVJiKHJ-F80Ohtw`. Snapshot path/manifest: `/tmp/note-quiz-efficiency-followup-build-path.txt` and `/tmp/note-quiz-efficiency-followup-build-manifest.json`. Existing user server3001/PID71259 was not restarted or stopped. Only the QA-owned3013 snapshot server was started for these checks and stopped afterward.
- Actual production React fixture, 60 separate clock updates: Melody render calls120→60; settings render calls240→0. Sixty unrelated rail transforms caused60→2 ad searches/measurements, with the two remaining calls coming from the retained one-second fallback. These are isolated call counts, not whole-app FPS measurements. Before/after evidence: `/tmp/note-quiz-efficiency-review-20261116/browser-evidence.json` and `browser-after-evidence.json`. The after fixture uses stable mocked session actions matching the actual hook's stable callbacks. Native Orca fixture evaluation timed out; the same generated HTML was successfully measured with the project's existing isolated Chrome tooling.
- Existing `verify-melody-ui.cjs` passed all6selected groups on the final production build: mobile/desktop settings persistence and keyboard selection, preview/native piano/independent cues/cleanup, actual worklet with synthetic32-note WAV through feedback/completion/pause/review/retry, and fixture-ad dialog/footer/reduced-motion reachability. Report: `/tmp/note-quiz-efficiency-followup-ui/report.json`. Input is synthetic; no acoustic hardware or actual advertising creative claim.
- Existing `verify-practice-ui.cjs` passed4selected mobile/desktop groups: all four modes'10-question→review→restart flows plus dialogs, ranking retry and responsive settings. Report: `/tmp/note-quiz-efficiency-followup-practice/report.json`.
- Native390px screenshot and Chrome320/390/1440px preview screenshots were inspected. The rail is176px high, horizontal engraving scale0.85, quarter spacing about156.4px; the playhead leaves more room for elapsed notes. No page overflow was observed in the sampled widths. Geometry/screenshots: `/tmp/note-quiz-efficiency-followup-geometry/`.
- Actual native-clock/worklet/engraved-glyph Chrome diagnostic passed: median frame gap16.6ms, maximum local glyph/anchor difference0.00476px, no hidden glyph frames, measured C4. `/tmp/note-quiz-efficiency-followup-chrome-timing.json`. Both native Orca runs retained correct geometry and measured C4 but returned insufficient temporal resolution (about80ms cadence); those traces are not counted as fine synchronization passes.
- Independent read-only review found no reproducible remaining correctness defect and ran7files/95tests successfully. Physical voice/microphones, cross-browser/mobile hardware and every live creative remain unverified. No commit/push/deploy was performed.
