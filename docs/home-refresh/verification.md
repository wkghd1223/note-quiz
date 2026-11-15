# Home refresh — verification record

## Source and preliminary production checkpoint

The working tree contains other authorized route, practice, locale and notation work. This change owns the home surface/copy/metadata plus the separately approved Melody presentation integration. It does not claim the entire tree as its diff, and performs no commit, push or deployment. Another session committed the Chinese/Portuguese locale work while this verification ran; that commit is preserved.

Preliminary production snapshot: `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/note-quiz-melody-build-fckdh4tn`, build `xdDj62BbxKo8u0EyIsN4x`, served on the existing task3013 terminal. User3001 and other-coordinator3014 were untouched. This checkpoint predates the final feature-disabled home copy and shared-dialog focus cleanup; final evidence is appended below when ready.

- Related metadata tests: 2 files / 48 tests passed before integration.
- Integrated unit suite: `npm test`, 59 files / 979 tests passed.
- `npx tsc --noEmit --incremental false`: passed.
- `npm run lint`: passed with two pre-existing hook warnings and one new shared-dialog ref warning; the shared owner was notified and is correcting that warning.
- `npm run build` in an isolated source copy: passed.
- `git diff --check`: passed.

## Browser evidence

`scripts/verify-home-ui.cjs`: all 24 combinations of eight locales and 390×844, 1440×900, 320×740 passed. Tested every basic mode link, melody link, leaderboard opening/Escape, language navigation, canonical metadata, FAQ Enter toggles, one footer/four legal links, 44px controls, horizontal overflow and text clipping. Unprefixed, Korean and Portuguese home content also rendered with JavaScript disabled. No page errors. External requests were blocked; this is not real-ad evidence. Artifact report: `/tmp/note-quiz-home-qa/report.json`.

Native Orca page `38b47a18-0ac6-4666-ade6-a9fbde7bf114` was inspected and operated at measured 390×844 and 1440×900. Verified home→melody keyboard activation, desktop home→leaderboard click/Escape, melody Settings open→desktop resize (dialog removed, body overflow restored), and preview start/stop with changing score transform. A real Grow bottom-ad variant was visible. The five home choices and Korean melody CTA remained above it on mobile. No ad script, stacking order or advertising control was altered.

Before home screenshot: `4ccd3159-5cc0-47d9-ba51-722234ea7b63-screenshot.png`; after mobile: `43c485ac-792a-445b-9f64-021ffcab90ef-screenshot.png`; after desktop: `a9225b65-97dd-490f-ada0-53549e0d2378-screenshot.png` (all under `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/orca-browser-screenshots/`). The before screenshot showed only three of four large mode cards above the ad and no melody entry. The after screenshot includes all four basic choices, melody entry and leaderboard without changing the purple brand.

## Review

An independent read-only home review found a feature-flag mismatch: with melody disabled, the card disappeared but copy/SEO still promoted it. A scoped follow-up fixes that supported configuration. No additional reproducible defect was found in the enabled home. Korean copy used the light `im-not-ai` workflow and actual implementation facts; no detector or authorship claim is made.

## Limits

Only the observed bottom-ad creative was checked live. Desktop side ads, every Journey format, physical phones, screen readers and acoustic microphone/device/Bluetooth latency were not established. Automated microphone evidence uses a generated WAV through real browser capture/AudioWorklet APIs, not a human/instrument in a room.

## Final home and source checkpoint — 2026-11-15

Final candidate: `koqrhtg_aIDg2uiFDMszQ`, directory `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/note-quiz-melody-build-o8qlu3f1`. Its296-file application manifest still matches the working tree after UI freeze. Home/SEO focused tests now pass58tests across2files, including feature-disabled copy and metadata. The independent QA reports60files/1009fulltests, strict TypeScript and lint passing with only the two old warnings; production build passed. The helper omitted Vitest configuration, so the independent suite used a provenance-recorded external copy of the repository config with only alias/setup paths redirected to frozen source. This supersedes preliminary gate counts above without relabelling their earlier evidence.

The final `verify-home-ui.cjs` report `/tmp/note-quiz-home-final-qa/report.json` again passes all24 locale/viewport combinations and no-JavaScript checks. This verifies enabled/disabled copy fixes on current source, not only the preliminary screen. No application errors. External network blocking remains an explicit limitation.

Current native Orca page `d17a1704-d29f-4ca6-b816-f2ffbed064db` on3013 was inspected at actual390×844 and1440×900. The current home exposes all four basic actions plus melody in the first mobile view. Native desktop click on the leaderboard entry opens the named modal at `/ko/practice/note?leaderboard=open`; Escape closes it and restores normal scrolling. Current screenshots: `5a87522f-86da-4e8e-a8f3-a215af7cfa89-screenshot.png` (390) and `c1fa860c-dd9a-4add-a2e7-24f73f22989f-screenshot.png` (1440), in the Orca screenshot directory noted above. No advertising creative was visible in these final captures; the earlier live Grow observation is recorded separately and is not an all-formats claim.

Independent presentation review of the integrated current shared UI and melody glue found no actionable defect (`/tmp/note-quiz-final-presentation-review.md`). Full practice route/layout acceptance is recorded separately in `docs/practice-layout-routing/verification-final.md` when all pending browser gates settle.
