# Practice microphone hold — worker report

Task `task_dda05d9f43ad`, dispatch `ctx_81a32dc6e45b`, run `run_1f32a2a34e27`.

## Scope

- Read `AGENTS.md` and `note-quiz-practice`; traced active practice callers before writing. Only active Note practice currently mounts `MicrophoneInput`; Ear practice supports piano/solfege. Coordinator explicitly excluded adding Ear microphone support, its types or stores.
- Owned application edits are limited to `src/components/game/MicrophoneInput.tsx` and `src/hooks/useMicrophonePitch.tsx`, plus focused new tests and this requested report. No renderer/Staff/MusicNotation, translation, SEO, script, continuous melody pipeline or scoring/store edits were made by this worker. Existing unrelated working-tree edits remain intact.
- Before writing, sent root the exact existing copy keys `microphone.description`, `microphone.startListening`, `microphone.stopListening`. Root supplied hold/release/focus/Space/Enter copy in all8locales; no new translation keys were required. `submitDetectedNote` remains in the shared translation contract for compatibility, but is no longer displayed here.

## Interaction and lifetime

- Primary pointer/touch down focuses the same microphone button, captures that pointer and begins a fresh capture. Matching pointer up immediately stops/releases the capture and submits the current stable detected note exactly once. There is no separate submit button. Touch action and selection are disabled only on the hold button; releasing outside the button is handled by pointer capture.
- Space or Enter key down starts capture; auto-repeat and other keys do not start additional captures. Matching key up stops/submits once and consumes the synthesized keyboard click. Escape cancels. A screen-reader/programmatic click with no pointer/key gesture starts capture; a second activation of the same button finishes/submits it. Ordinary pointer click following release does not start another capture.
- Button blur stops capture immediately and defers a valid note commit by one event-loop turn. This permits window blur/background visibility loss to cancel the pending commit. Pointer cancel, lost capture, Escape, disabled, unmount, hidden document/window loss and `captureKey` changes all cancel without submitting. Duplicate release/blur events, mismatched pointer/key releases and no-note releases do not submit.
- Optional `captureKey?: string` identifies the current question/session. A change cancels capture and clears detected state; release and pending blur also compare the latest key before committing, so a stale answer cannot cross that boundary. Root wired current Note practice to `captureKey={currentQuestion?.id}`; existing callers can keep omitting the optional prop. Parent callbacks/disabled/key values are read from their latest render rather than an earlier capture closure.
- Hook `stopListening()` now returns the latest stable `Note | null` once and clears it while stopping tracks, disconnecting nodes, closing context, canceling RAF and resetting candidate/signal state. A fresh `startListening()` clears any previous note before permission can resolve. Late permission grants are stopped; late old failures cannot cancel a newer request; RAF callbacks also verify their capture generation.
- The existing220ms stability threshold and analyser smoothing remain unchanged. At coordinator request, basic analysis now uses4096samples at88.2/96kHz and2048below that rate so the lower pitch range retains a usable window. Root separately owns the low-amplitude pitch detector repair/shared estimator extraction; it is not implemented or claimed by this worker. Coordinator review found `getPitchKey()` intentionally ignores octave for scoring; the hook now composes an octave-inclusive local candidate/commit key so stable A3→A4 within one hold releases A4. Shared scoring/note matching was not modified.

## Stable presentation

- Ready/listening status, hold/release button labels and no-note/quiet-room hints each reserve the natural wrapped size of both states in the same grid cell. The inactive copy stays in layout with `visibility:hidden` and `aria-hidden`; it is not truncated or duplicated to assistive technology. Status is a polite atomic live region; the same button exposes its pressed state.
- Removed the optional submitted-note sidebox, since the practice toast already owns answer detail and that box narrowed/wrapped the detection/hint column after submission. The optional `selectedNote` prop is still accepted for caller compatibility. Detected note remains visible while capturing and resets when capture stops; answer detail remains in the existing mode toast/history.
- No fixed text clipping or extra inactive submit control is used. Static8locale tests verify the single button, paired grid labels and absent duplicate submitted-answer copy; actual rendered heights remain root native-browser QA responsibility.

## Verification

Final focused command:

```sh
npx vitest run src/components/game/MicrophoneInput.test.tsx src/hooks/useMicrophonePitch.test.tsx src/lib/music/microphoneSignal.test.ts src/components/practice/PracticePreview.test.tsx src/store/gameStore.test.ts
```

**5files/200tests passed**, including40new microphone tests (26component and14hook). Regressions cover pointer capture/release, keyboard/repeat/synthesized click, screen-reader click fallback, no-note/stale prior note, single submission, blur commit/background cancellation, capture-key/disabled/unmount cancellation, permission grant/rejection races, old RAF callbacks, full capture cleanup, latest stable octave change, sample-rate analysis windows and8locale layout markup.

- `npx tsc --noEmit --incremental false`: passed on final source.
- Focused `npx eslint` for the2application files and2new tests: passed, no warnings.
- `npm run lint`: passed; only the2existing hook warnings in `src/components/ui/modal.tsx` and `src/hooks/useComponentSize.tsx` remain.
- `git diff --check`: passed. Pre-change owned files are preserved in `/tmp/note-quiz-microphone-hold-before/` for focused comparison.
- Hook tests use synthetic frequencies and mocked browser/audio resources; component tests use a persistent node hook harness with the actual JSX handlers/effects. They do not establish physical microphone accuracy, actual browser focus ordering, pointer delivery or pixel geometry.
- No full production build, server start/stop/restart, browser/user-tab use, commit/push or deployment was performed. Root owns full integrated unit/build gates and actual getUserMedia/Analyser synthetic-oscillator pointer/Space/Enter/blur/8locale height checks. Physical voice/instrument, OS permission UI and cross-browser/device behavior remain outside this worker's verified evidence.

## Source freeze

Final4source/test files are frozen in `/tmp/note-quiz-microphone-hold-sourcefreeze.sha256`; from the repository root run `shasum -a 256 -c /tmp/note-quiz-microphone-hold-sourcefreeze.sha256`. This report, root translation/caller changes and unrelated worker files are excluded. Root may intentionally amend the snapshot after native integration; the manifest identifies this worker handoff.
