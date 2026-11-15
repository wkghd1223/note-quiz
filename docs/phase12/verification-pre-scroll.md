# Phase 1/2 verification before scrolling-score extension — 2026-11-14

This is a verified checkpoint, not acceptance of the newly requested scrolling-score/repeat behavior. The user subsequently approved applying that extension to `/challenge` only. No commit, push, deployment or DB change was made.

## Source and runtime

- HEAD `c88a75ba052136c1d613e18542524b1b4a656532`, all implementation uncommitted; preserve route moves and untracked files.
- Current shell Node24.18.0/npm11.16.0; initial baseline Node20.20.2/npm10.8.2. Framework versions unchanged; alphaTab/plugin pinned1.9.0.
- Final pre-extension build4 `u9UKK7txXiCWoYpclGja3`; isolated source `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/note-quiz-phase12-build4-kxslpko5`. Manifest `/tmp/note-quiz-phase12-build4-manifest.json`. Production sources match; the hook test later gained cleanup assertions, which passed independently.
- Original3001 process28754 remains untouched. Task3013 terminal `term_beb960d4-6f1a-42ed-b181-42757d7f31f5` restored to build4 after rollback checks.

## Completed checks

| Command / evidence | Result and boundary |
| --- | --- |
| `npm test` | 33 files /427 tests PASS; final worker rerun after cleanup assertions also427 PASS |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS; existing modal.tsx:74 `isPage` and useComponentSize.tsx:23 `handleResize` warnings only |
| `npm run build` | Build4 PASS,261 static/generated routes |
| `node scripts/verify-phase1-equivalence.cjs` + original UI_BASELINE | Build4:16 cases,160 answers,96 captures, `differences.json=[]` |
| unchanged `node scripts/verify-practice-ui.cjs` | Build1:16 passes + mobile live house creative not observed; later renderer failure/rotation fixes separately tested on build4 |
| `node scripts/verify-locales.cjs` | Build1:35 initial HTML routes +8 interactions,252 sitemap URLs; build4 recovery verifies all7 entry-link locales |
| `node scripts/verify-challenge-ui.cjs` | Build4:40 PASS +24 measured results,0 page errors,0 leaderboardPOSTs |
| `node scripts/verify-challenge-recovery.cjs` | Build4:30 PASS,0 FAIL,0 leaderboardPOSTs; exact commands in recovery summary |
| Independent production `/tmp/note-quiz-build4-independent/verify.cjs` and `rotation.cjs` |7 groups + rotation PASS; actual wrapper engraving/fallback/font recovery/100 updates/20 resource cycles |
| `/tmp/note-quiz-phase12-flags.cjs`, FLAG_MODE=challenge-off |43 checks PASS:8 URL variants of challenge/map/play404,home/practice links absent,sitemap20,practice stillalphaTab andstart/finish |
| same, FLAG_MODE=legacy |3 groups PASS:challenge stillenabled,sitemap252,bothStaff/MusicNotation uselegacy andstart/finish |
| `/tmp/note-quiz-legacy-signal.cjs` | Real Chromium fake-WAV through legacy getUserMedia/analyser: measured tone/silence canvas and track cleanup PASS. C4 pitch recognition did NOT occur; see limitations |
| `git diff --check` | PASS before extension |

Browser commands use `PLAYWRIGHT_MODULE=/Users/pumpkin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`, `BROWSER_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, `UI_BASE_URL=http://localhost:3013`, and individual `UI_ARTIFACT_DIR` paths below. Production API writes are intercepted in automated fixtures; no real leaderboard scores submitted.

## G1: P1-N/E/V/R

- P1-N01–N08: original geometry tests plus pure 4clef×15key×7letter×octave matrix;83 dev-render fixtures; production controlled actual Staff/MusicNotation verified B#/Cb/E#/Fb written positions, natural cancellation and explicit courtesy glyphs. Low Eb3/Gb3/Bb3 has3 actual ledger rectangles; increased engine staff-line color to `#64748b`. Enlarged GUI inspection confirms readability.
- P1-E01–E06: seeded note/ear/interval/chord result/review/restart/history/schema2 payload semantics exactly match baseline. Existing suite covers timed cancellation, share/daily/UTC/history, stale responses, storage/audio failures, redirects and six-language settings. Chinese/static localized routing checked separately. This does not prove all real microphone/solfege/hardware combinations.
- P1-V01: original card/control geometry, order and overflow compare unchanged at360/390/768/1440. Synthetic ad wrappers pass. Desktop live house creative observed; paid creatives and full physical-mobile coverage unavailable.
- P1-R01/R02:100 updates at4ms spacing finish on expectedC0/MIDI12, worker count returns to baseline. Build4 font/worker resources render. Failed font/module/worker requests show explicit Challenge recovery; existing wrappers fall back. Retry requests a fresh Bravura URL. Actual Amplify deployment not performed.

## G2: all24 official stages

DOM keyboard events use the real AudioContext clock; no score injection. All stages clear and unlock sequentially, persisted record checked. These are synthetic inputs, not human or acoustic accuracy measurements. Exact event timings are in `challenge-4/report.json`.

| Stage | Score | Stars |
| --- | --- | --- |
| w1-s1 | 99.77 | 3 |
| w1-s2 | 99.47 | 3 |
| w1-s3 | 98.93 | 3 |
| w1-s4 | 99.37 | 3 |
| w1-s5 | 98.67 | 3 |
| w1-s6 | 99.41 | 3 |
| w2-s1 | 99.43 | 3 |
| w2-s2 | 98.67 | 3 |
| w2-s3 | 98.91 | 3 |
| w2-s4 | 99.61 | 3 |
| w2-s5 | 98.93 | 3 |
| w2-s6 | 99.21 | 3 |
| w3-s1 | 96.43 | 3 |
| w3-s2 | 96.54 | 3 |
| w3-s3 | 96.64 | 3 |
| w3-s4 | 98.09 | 3 |
| w3-s5 | 96.54 | 3 |
| w3-s6 | 96.73 | 3 |
| w4-s1 | 96.43 | 3 |
| w4-s2 | 96.35 | 3 |
| w4-s3 | 97.1 | 3 |
| w4-s4 | 96.42 | 3 |
| w4-s5 | 97.19 | 3 |
| w4-s6 | 96.28 | 3 |

Pure S01–S16 oracle is in `scoring-oracle.md`. Pitch AND duration gates remain mandatory; W3/W4 onset/rest/rearticulation are independently tested. Important fixed defects: quiet dropout frames now count against valid-pitch ratio; repeated20ms tone/50ms silence yields28.75% rather than100%. Mobile second-measure readiness no longer deadlocks. Space respects focused buttons. Rotation pauses and rewinds through the existing lifecycle.

Recovery30 includes real Chromium permission denial; mocked unavailable/busy/pending devices; storage blocked/corrupt with memory fallback; rehearsal isolation; both orientation events; actual font/module/worker abort and retry; synthetic ads;7 localized entry paths; mobile multimeasure readiness; reduced motion and200% text;3 real Chromium fake-WAV captures. Correct99.54/3stars, wrong28.57/0, short75.37/0; each778 Workletframes with ended track and closed AudioContext.

## UI/audio evidence and limitations

- Native Terra Computer Use host unavailable in this continuation (`Sky Computer Use native pipe startup failed`/browser host connection failure). Earlier Terra observations found CSS and ledger concerns; they are not final-build passes.
- Orca embedded GUI successfully exercised map/stage, focused Enter/Space pause/resume, retry/result/input configuration, unsupported piano-mic→touch, German360, mobile390, tablet1024, desktop1440, leaderboard resize/Escape/focus/scroll restoration. Screenshots and exact observations in `/tmp/note-quiz-phase12-final/orca/`. Desktop actual CSS dimensions were checked because host zoom is75%; navigation resets viewport. Orca mobile coordinate click occasionally mistargeted; keyboard activation used and limitation recorded.
- Live Grow house creative observed during Orca mobile/tablet checks; selected controls visible above it. This is not a guarantee for paid Journey creatives. Scripts are not hidden, and no controls are layered above advertisements.
-20 touch count-in restart/client-route cycles closed all40 AudioContexts and terminated all39 created workers. This is resource accounting, not heap profiling or20 complete acoustic performances.
- Physical Android/iOS, Safari/Firefox, real instrument/voice microphone, listening/latency, VoiceOver/TalkBack and paid ads not verified. **모바일 최종 실기기 검증 미완료.** No acoustic accuracy/SLO claim.
- Legacy spectrum follows measured PCM. Its existing detector did not stabilize C4 on the diagnostic pure-tone WAV; `pitchDetection.ts` is byte-identical toHEAD and the220ms gate is unchanged. The spectrum test is not a pitch-recognition pass. That legacy algorithm was deliberately not replaced in this compatibility work.
- Failed evidence retained: first mobile multimeasure run; initial Worker-constructor fixture was ineffective because alphaTab falls back; failed font retry/rotation led to fixes; independent initial rotation verifier had only a button-label typo; flag runner initially used “Finish” for note instead of “End Game”; legacy signal initial/C4 diagnostic failures are not reported as passes.

## Artifacts / rollback

Artifacts: `/tmp/note-quiz-phase12-final/{semantic-4,legacy,locales,challenge-4,recovery-2,flags-challenge-off,flags-legacy,legacy-signal,orca}/`; independent `/tmp/note-quiz-build4-independent/`; baseline `/tmp/note-quiz-phase12-baseline/semantic-fixed/`. Temporary artifacts are local and not committed.

Set `NEXT_PUBLIC_CHALLENGE_ENABLED=false` before `npm run build` to disable only Challenge (verified build`UVPv_wirtZO9VMTTN18Ud`, source before final font/rotation fix; flag/route code identical). Set `NEXT_PUBLIC_NOTATION_RENDERER=legacy` before build to restore both practice renderers (verified build`rtiUHjRkNQxX2N7pBd76A`, production source matchingbuild4). These are build-time flags; merely changing runtime environment is insufficient. Rebuild/release is not performed externally.

Phase3 uploads, arbitrary BPM/transposition, Free Practice Studio, login/backend and production DB changes remain excluded. New user-approved scrolling/repeat extension is tracked in implementation-plan.md and must be verified separately before completion.
