# Melody pitch, playback clock and beat sounds — 2026-11-15

This report supersedes earlier completion notes for the user's pitch/sync/preview/metronome/equal-bar-width correction. Score formulas, leaderboard/API/DB contracts and anonymous use were not changed.

## Result

- Voice-like harmonic input no longer contaminates the count-in noise floor or routinely locks to a dominant second harmonic. RMS onset/offset and the older pitch-analysis window now carry separate timestamps. Short unstable attacks retain their physical onset; vibrato is not fragmented at every rounded semitone boundary.
- Live UI distinguishes microphone energy from measured pitch and displays note, Hz and cents. The real browser capture/worklet pipeline showed **261.6 Hz · 0 cents** for the known C4 WAV fixture.
- Preview uses the same score rail and an audio-driven animation loop. It never requests the microphone or submits answers. Stop, blur, restart and transition into practice dispose playback resources.
- Two independent persisted options: metronome on each beat and a bell at each measure start. Both apply to preview and practice. The bell replaces the simultaneous ordinary beat; 6/8 uses two dotted-quarter pulses. Count-in remains one bar. New labels and migration defaults cover all seven actual locales.
- Native alphaTab engraving is retained. The melody-only adapter positions native beat containers at equal distance per quarter before native beams, glyphs and bounds are rendered. Musical bar bodies have equal widths; the initial clef/key/meter remains an untimed prefix. Full-bar notes stay at their timed onset. The final triplet stays before its barline.
- Visual progression follows the browser's output timestamp when available, rather than assuming AudioContext render time is already audible. Capture timestamps and scheduled sound origins retain their original coordinates. Unsupported/startup/stale output timestamps use the render clock; no guessed device-specific offset is stored.
- The primary start button now uses shared `t.startGame`, coordinated with the independent practice UI run.

## Verification

- Relevant audio, hook, cue, clock, notation and settings tests were run before the full suite. Latest completed full suite: **52 files / 790 tests passed**. Narrow regression tests cover output-clock onset, preview cleanup, count-in/resume, setting migration and native notehead/barline containment.
- Final `npx tsc --noEmit` passed after the common-label integration. The concurrent practice run fixed its two redirect-test typing errors before this final recheck.
- Lint passes with only the two existing hook-dependency warnings in `modal.tsx` and `useComponentSize.tsx`.
- Production build passes in an isolated source copy. Existing task port 3013 is reused; no user development server is started, stopped or rebuilt.
- Independent Orca reviews: audio fixtures; 104 native scale-one/two geometry cases; preview/cue lifecycle; and a separate 30 ms output-delay pause/resume/finish probe. The review found a last-triplet containment defect, which was fixed and rechecked. No remaining reproducible finding was reported.
- Seven browser groups passed on build `aRsPQ5Tozv5W8MG-AvQjl`: all four meters and rhythm controls; preview/independent cue toggles at 390×844 and 1440×900; synthetic-WAV answer/result/retry; notation-error pause/recovery; seven locale routes/SEO; ad-reservation/dialog/reduced-motion cases. No browser runtime errors or score POSTs occurred.
- A separate C4 browser run also passed the explicit displayed-frequency assertion and complete answer/result/retry lifecycle.
- Final copy-only integration build: `7OWEHpWdNEY8pEOQ7u3WL`, source snapshot `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/note-quiz-melody-build-clckh5_q`. Preview, both beat sounds and cleanup passed again at 390×844 and 1440×900, with zero microphone requests, runtime errors or score POSTs.
- Ordinary `/en/practice/note` also started and rendered visible native alphaTab noteheads at both viewports, with no browser runtime errors. This confirms the notation regression boundary; the other run's subsequent practice UI work is validated separately by its owner.

## Native timing evidence

The timing script reads actual native SVG notehead rectangles and observes committed rail movement. It does not override currentTime, move glyphs or inject scored events. Input is a synthesized MediaStream processed by the real worklet and YIN detector.

Before the output-clock correction, 13 crossings on build `bVFarki2ueQn8M8h5jIQl` were 26.10–30.60 ms early relative to the reported output clock. After the correction, a 20-second 6/8 dotted/triplet run with both cues enabled recorded:

- 10 actual notehead crossings, output-clock errors **+1.12 to +3.88 ms**.
- Frame interval median 16.6 ms, maximum 23.9 ms; these are sampled browser observations, not an acoustic latency guarantee.
- Maximum/minimum rail speed ratio **1.000116** (about 0.012% variation).
- 10 judgment color changes, zero hidden-glyph frames, zero hidden renderer spans.
- Maximum native notehead/anchor discrepancy 0.006 CSS pixels.

The one-thread eight-bar renderer did not create a measured long frame in this run. It uses alphaTab 1.9 internal layout hooks because the public proportional-spacing settings still center full-bar notes and allocate variable prefix space. The adapter is isolated, guarded and pinned; revalidate it before upgrading alphaTab. Ordinary page `/practice` notation retains its existing worker path.

## Direct browser interaction and limits

Orca native browser was operated at measured 390×844 and 1440×900: preview, microphone permission/start, complete session, retry, pause, desktop resize, resume, end, setting toggles/apply and Escape. Escape restored Settings focus and released body locking; the retained closed dialog had `display:none` and zero bounds. A real Grow bottom advertisement was visible during mobile preview/settings and desktop resume; the settings Apply button and active score controls remained above it. Screenshots were inspected, including comparison with the earlier native layout and the user's reported screen.

No physical-phone test, controlled real-voice/instrument pitch reference, Bluetooth/audio-loopback measurement, room-reverberation test or actual desktop side-ad campaign was performed. PCM and virtual microphone evidence does not establish those conditions. Headphone guidance is shown with the cue options. Orca's embedded browser has previously shown coarse animation cadence, so numerical timing claims come from the explicitly identified Chromium trace.

## Artifacts

- `/tmp/note-quiz-melody-final-tests.log`, `/tmp/note-quiz-melody-final-lint.log`, `/tmp/note-quiz-melody-build.log`
- `/tmp/note-quiz-melody-final-native-timing.json` and `/tmp/note-quiz-melody-clock-native-timing.json` (after/before output-clock traces)
- `/tmp/note-quiz-melody-final-ui/report.json`, `/tmp/note-quiz-melody-final-pitch-ui/report.json`
- `/tmp/note-quiz-melody-final-copy-smoke/report.json`, `/tmp/note-quiz-practice-render-smoke.log`
- `/tmp/note-quiz-melody-voice-analysis-report.json`, `/tmp/note-quiz-melody-clock-review.json`, `/tmp/note-quiz-melody-clock-review-recheck.json`, `/tmp/note-quiz-melody-presentation-clock-review.json`
- `/tmp/note-quiz-melody-final-focused.diff`, `/tmp/note-quiz-melody-build-manifest.json`
- Native screenshots: `47adaf0c-33b0-4e7c-8229-23d68b56a7e7-screenshot.png` (mobile preview), `1e99921f-edd0-42e1-b4fc-6970641721c5-screenshot.png` (desktop resume), `5c9e71c6-e091-43b4-9a66-3fd43109346c-screenshot.png` (mobile cue options with actual bottom ad), under `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/orca-browser-screenshots/`.

No commit, push or deployment was performed for this correction.
