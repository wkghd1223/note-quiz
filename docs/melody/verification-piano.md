# Piano preview and compact controls — 2026-11-15

## Result

- Melody examples now use the bundled SONiVOX sampled piano (GM program 0), rendered through alphaTab 1.9's public offline exporter. No new dependency, live alphaTab player, AudioContext or playback clock was introduced. The existing asset-copy plugin retains the soundfont license alongside the unchanged asset.
- Samples load only when an example is requested. Playback zero is chosen after preparation completes; piano notes and optional beat sounds use the existing session's absolute AudioContext times. Release is bounded inside the existing 95% articulation gap. Successful font bytes are cached; prepared PCM belongs to the session and is cleared on stop/disposal.
- Loading can be cancelled. A failed download shows an example-specific error and retries playback without requesting microphone access. New loading/error copy covers all seven locales.
- Mobile Start and Play example buttons share one row. Player buttons, including Settings, use 14px text and a minimum 44px touch height. The purple primary/secondary hierarchy remains. Native before/after screenshots show the score beginning about 68px higher on the same 390×844 surface.

## Validation

- Narrow tests first: existing hook/microphone baseline 26 passed; updated hook 21 passed; worker audio suite 81 passed. Final workspace `npm test`: **55 files / 876 tests passed**.
- `npx tsc --noEmit`, `npm run lint`, and isolated `npm run build` passed. Lint retains only the existing `modal.tsx` and `useComponentSize.tsx` dependency warnings. `git diff --check` and browser script syntax checks passed.
- Independent read-only Orca review found no actionable defect and ran 44 focused tests successfully.
- Final build **qC9WxSrESgquB5HnElNLI**, source snapshot `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/note-quiz-melody-build-zfepsi80`. All eight owned application/test files match its manifest. The existing task server at 3013 was reused; user development server and the concurrent practice run's server were not manipulated.
- Chromium at 390×844 and 1440×900 verified 29 stereo piano notes and 32 optional beat/bell cues on the same origin time, moving native score geometry, zero preview microphone requests, and clean disposal. All PCM was finite, nonzero and below clipping. Piano output was separately checked at C3/C4/C5/C6 and 44.1/48/96 kHz using the installed exporter.
- Delayed loading cancellation and failed download → retry both passed. Seven locale layouts at both widths retained side-by-side controls, 14px labels, at least 44px height and no clipped button text.
- Synthetic WAV capture/answer/result/retry also passed as a regression check after preview integration. Browser cases recorded no runtime errors or score POSTs.
- The initial preview test assumed the Stop button meant playback had already begun. Stop is now intentionally available during loading. That test failed before observing the playhead; it was corrected to await visible playback, then both viewport cases passed. No application change was made in response to that harness race.

## Direct interaction and limits

Operated Orca's existing melody tab at measured 390×844 and 1440×900: keyboard-triggered preview/stop, mouse-triggered desktop preview, transition from preview to microphone practice and End, Settings open/Escape, and viewport resizing. Escape restored Settings focus and left body scrolling available. Real Grow bottom advertising was visible during the mobile and desktop checks; the changed controls remained reachable and unobscured. The tab was left idle.

This verifies sampled piano PCM and browser playback behavior, not a subjective listening comparison on physical phones, speakers or Bluetooth equipment. No new physical-device latency or desktop side-ad campaign test was performed. The concurrent basic-practice UI work is separately owned and not claimed complete by this report.

## Evidence

- `/tmp/note-quiz-piano-final-tests.log`, `/tmp/note-quiz-piano-final-tsc.log`, `/tmp/note-quiz-piano-final-lint.log`, `/tmp/note-quiz-melody-build.log`
- `/tmp/note-quiz-piano-preview-ui/report.json` (final preview cases), `/tmp/note-quiz-piano-ui/report.json` (loading/error and 14 locale/viewport cases; includes superseded initial preview failures)
- `/tmp/note-quiz-piano-voice-ui/report.json`
- `/tmp/note-quiz-melody-piano-implementation-report.json`, `/tmp/note-quiz-piano-final-focused.diff`, `/tmp/note-quiz-melody-build-manifest.json`
- Native screenshots under `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/orca-browser-screenshots/`: `5f1d432f-0a25-4c32-90a9-9827be5f54f1-screenshot.png` (before), `80cb0491-4db7-4456-8ee3-718f7d9e089a-screenshot.png` (after), `09c3c5b9-e59a-48a4-b6d5-190ff728ee83-screenshot.png` (desktop preview).

No commit, push or deployment was performed.
