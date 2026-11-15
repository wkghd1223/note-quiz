# Melody correction verification — 2026-11-14

This report supersedes the earlier completed checkpoint for the user's17:57 timing/settings/IA correction. Existing uncommitted work was preserved. No commit, push, deployment or database operation was performed.

## Result and scope

- `/melody`: random8bars, monophonic microphone input, alphaTab native staff/note/rest engraving. No public stage map or generated repeat/DC/DS directions.
- User settings: clef/key/range, quarter-note BPM,2/4,3/4,4/4,6/8, whole/half/quarter/eighth notes, dotted variants and complete eighth-triplet groups. Rests remain automatic. All7current locales updated together.
- Capture-derived guard: at least500ms per enabled note interval. Quarter120BPM/eighth60BPM/triplet40BPM caps; longer palettes up to180BPM. No16th UI. Invalid combinations produce guidance and do not silently change tempo. Synthetic fixtures at44.1/48/96kHz are evidence for this conservative limit, not certification for every instrument/articulation.
- One meter-aware count-in bar;6/8 uses2dotted-quarter clicks while settings explicitly use quarter BPM.
- No manual horizontal scroll. Essential clock-driven movement stays continuous under reduced-motion. Current note/measure boundary uses the same numerical tolerance as scrolling.
- Fixed color-judgment blanking: alphaTab1.9.0 native `reuseViewport` retains the completed score while colors update; changed music/layout still has bounded loading/error handling. No replacement hand-drawn glyphs.
- Real PCM/spectrum display branches from the existing capture stream; no extra microphone request, storage or upload. Start/pause/end/permission failure clear signal and stop capture.
- Mobile start brings the entire player into view once, including controls, score, current/detected note and signal. Shared Home/Basic practice/Melody header navigation, localized canonical/alternates/sitemap, no local Back to practice link or singer-specific instruction.
- Independent review found enabled Resume after engraving failure. Added a readiness guard; real browser regression fails on the earlier build and passes after the correction.

## Final source and checks

Final isolated production build: `q0Xcj_xi4Hy5YUTj-j9p2`, served on existing task port3013. All245copied source/config/public hashes match the workspace. Existing user port3001 remainsPID28754; no additional server was introduced.

- `npm test`:46files,649tests passed.
- `npx tsc --noEmit`:passed.
- `npm run lint`:passed with existing hook dependency warnings in `src/components/ui/modal.tsx` and `src/hooks/useComponentSize.tsx`.
- `npm run build`:passed from an isolated source copy; avoids disturbing user3001's build output.
- `git diff --check`:passed. Root reviewed changed UI/navigation/copy and integration files; workers independently reviewed timing/rhythm and root UI. Scoring formulas, API contracts, database and legal document content were outside this correction.

## Browser evidence

`node scripts/verify-melody-ui.cjs` with existing Playwright/Chrome and an existing localhost server:

- Mobile390×844 and desktop1440×900 settings, native radio keyboard behavior, local persistence, legacy redirects, canonical routes, shared navigation, no manual score scrolling.
- All four meters, dotted notes, grouped triplets, excessive-tempo rejection, pulse counts/spacing, visible controls plus signal, end/capture cleanup.
- Synthetic WAV through real getUserMedia/AudioWorklet/YIN: full answer/result flow, green/red feedback, repeat/new melody, pause/resume/end, permission refusal/retry,7locale SEO, synthetic bottom/side ad geometry.
- Renderer fault injected through its error callback: pauses, blocks Resume while absent, re-engraves, then resumes. No injected score/results.

Artifacts:
- `/tmp/note-quiz-melody-final2/report.json`:7groups passed on `f6l74KxdurFqHsVHz5Mby`, before only the final resume-readiness guard.
- `/tmp/note-quiz-melody-recovery-before/report.json`:expected regression failure before guard.
- `/tmp/note-quiz-melody-recovery-final/report.json`:guard/recovery group passed on final build.
- `/tmp/note-quiz-practice-rhythm-final/report.json`:5groups passed—mobile/desktop home and all4ten-question practice flows→review→restart, dialogs/retry/resizing, timed-ear boundary/cancellation. Practice logic was not changed by the final melody-only guard.

### Timing evidence, not just rail-transform assertions

`TIMING_TRANSPORT=playwright TIMING_SECONDS=20 node scripts/verify-melody-timing.cjs` ran the final build at1440×900 with6/8,40quarterBPM,Dmajor,eighth/quarter/half,dots,triplets. The oracle tracks actual engraved SVG notehead DOM centers and the fixed line at real rail DOM commits, using native AudioContext.currentTime. Input is a synthesized stream through the actual worklet, not a physical microphone.

`/tmp/note-quiz-melody-final-timing.json`:
-1200RAFframes,1195commits;median16.6ms,max24.5ms.
-10actual notehead crossings, interpolated error−0.35..6.54ms. The report retains bracketing frame uncertainty; interpolation is not a claim of sub-frame physical accuracy.
-10judgment color changes;0hidden-glyph frames,0renderer-hidden spans.
-Max anchor error0.0053CSSpx; max anchor shift on color change0.00016CSSpx.
-Native output presentation leads/lags the render clock by27–33ms in this environment; no guessed universal input offset was introduced.

Earlier nativeOrca measurements found correct spatial anchors but80ms active frame cadence; they are insufficient for fine temporal verification and are not reported as a precision pass. Physical microphone/speaker latency and acoustic synchronization remain unverified. The user-reported whole-note perceived mismatch was not fully reproduced; the fixes target demonstrated frame hiding, reduced-motion stepping and boundary-label defects.

### Actual computer use and ads

Orca native UI was operated at measured390×844 and1440×900: common navigation, settings radio arrow selection, BPM/dots/triplets application, start, count-in, pause/resume/end, Escape focus return and resizing. Mobile active-player screenshot shows controls, score, current/detected note and signal together. Screenshots were inspected, not only generated.

ActualGrow bottom house-ad observed at390×844 on the integrated candidate: viewport844, reserved workspace738, settings dialog bottom664, Apply bottom648; hit-test reached Apply. Actual ad scripts were not hidden and no controls were layered above ads. Some later runs did not load a creative. Desktop-side and varied paid creatives were exercised only through geometry fixtures; do not generalize the observed house-ad to all Journey placements.

Before/after actual GUI artifacts under `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/orca-browser-screenshots/`:
- Before latest correction:`bf731ada-4852-417c-811c-36b68002c6f5-screenshot.png`.
- Mobile idle with actualGrow:`b189c1f4-7caf-4fda-881f-e82b1e5b30d2-screenshot.png`.
- Settings with actualGrow:`8fb9e769-9ec3-47c8-9595-865c3c0bd4b8-screenshot.png`.
- Desktop meter/tuplet/shared navigation:`baabff41-1d9b-471e-a016-f26621565f34-screenshot.png`.
- Final mobile player:`279baafd-923c-48ab-ab23-859dfd4e5f79-screenshot.png`.

No physical mobile device, acoustic instrument correctness, every paid creative or production deployment was verified.
