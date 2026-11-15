# Phase 1 + 2 implementation checkpoint

Source specification: `/Users/pumpkin/Downloads/NOTE_QUIZ_PHASE_1_2_MASTER_PLAN.md` (2026-11-13). This is the active implementation plan; the older root `plan.md` documents the completed short-session expansion.

## Scope and contracts

- Phase 1: alphaTab replaces both active notation surfaces. Existing page geometry, four practice modes, question/answer semantics, persisted statistics, and leaderboard version 2 remain unchanged. Rendered glyphs may differ.
- Phase 2: isolated `/challenge`, four worlds and 24 fixed stages, pitch AND duration gates, onset/rest/rearticulation where required. Touch fallback and sustained monophonic microphone input; no claim of reliable duration scoring for decaying piano/guitar microphone input.
- Additional requested work: Simplified Chinese (`zh`), explicit language-prefixed routes with localized metadata/sitemap while preserving old URLs, and a live microphone signal display without changing legacy recognition's 220ms gate.
- No uploads, arbitrary BPM/transposition, Free Practice Studio, backend/DB writes, deployment, commits, or push.

## Execution / ownership

1. M0 baseline — Sol verification helper, `docs/phase-1-2-baseline.md`, `scripts/verify-phase1-equivalence.cjs`. Baseline HEAD `c88a75ba052136c1d613e18542524b1b4a656532`, initially clean. Node 20.20.2/npm 10.8.2.
2. M1/M2 notation — Sol helper: notation adapters/view, Staff/MusicNotation, pinned alphaTab dependencies and webpack configuration only. Do not touch old practice layout or scoring.
3. M3 domain — Sol helper: challenge domain/data/store and deterministic test oracles only.
4. M4/M5 integration — root: independent sample-clock microphone analysis, touch input, mobile challenge flow and translations; language/SEO can be delegated once a slot frees.
5. M6 — independent review, before/after practice equivalence, challenge browser fixtures, Terra Computer Use when connected, exact verification report and rollback.

At most four active agents, no nested delegation; disjoint edits. Models explicitly selected as authorized in the goal.

## Decisions

- Use Next 15 webpack for both development and production; no framework major upgrade.
- Audio analysis stays separate from the legacy microphone hook. Worklet sample timestamps are authoritative; React/RAF only display the clock.
- Pausing rewinds the incomplete current target and discards its partial input before a new count-in, retaining completed earlier notes. Backgrounding never silently continues scoring.
- Official records are separated by stage, profile, input, and scoring version. Rehearsal never unlocks. Any official supported-input clear may unlock the next stage for accessibility; scores are not compared across profiles.
- Chinese defaults to Simplified Chinese, URL `/zh`. Existing unprefixed paths retain their behavior.
- New challenge surface keeps the purple system, compact controls (48px touch targets), notation-first hierarchy, text alongside status colors, and explicit permission/storage/error recovery.

## Verified implementation milestones

- [x] G0: originalHEAD baseline189tests, semantic fixtures and API-write interception captured before edits.
- [x] M1/M2: alphaTab1.9.0 POC/assets/adapters and both active practice renderers, fallback and ledger contrast.
- [x] G1 automated compatibility: final shared-renderer build5,16cases/160answers/96captures, differences0; written glyphs and renderer recovery checked independently.
- [x] M3: fixed24stage content, pure mandatory scoring gates and local isolated progress; S01–S16 oracle.
- [x] M4: separate sample-clock pipeline, null/dropout denominator fix, onset/offset/repeated-note PCM and browser fake-WAV evidence; no real acoustic accuracy claim.
- [x] M5: purple actions, explicit permission/storage/notation recovery, touch input and seven-language UI.
- [x] Locale:7static locale paths/metadata/sitemap, Chinese, old URLs preserved, feature-flagged home/practice entry links.
- [x] Existing24Challenge stages:40checksPASS plus24measured3-star results,0pageerrors/leaderboardPOSTs onbuild5.
- [x] Scroll UI broad matrix:build7 recovery30PASS,21scrollchecksPASS plus1repeat fixture rerunPASS after waiting for the correct native glyph; all7locale360px keys≥44px.
- [x] RealOrcaGUI:360/390/tablet1024/desktop1440 across checkpoint builds; finalbuild7mobile score/key/timing/pause visibility and before/after screenshots. NativeTerra unavailable, physical devices not verified.
- [x] Integration commands:finalbuild8 full514tests,tsc,productionbuildPASS; build7npm lint and final touched-fileESLintPASS, only2existingwarnings.
- [x] Final focused build8 application6/6PASS; independent keyboard closure4browser/4unitPASS, no unresolved scoped defect.
- [x] Final G2/G3 available-environment evidence audit, A–F report and handoff; tracked/untracked diff reviewed,228production-file manifest matches final build.

Current software evidence and exact source/build boundaries are in `verification.md`.
The older build4 checkpoint is preserved in `verification-pre-scroll.md`.
**모바일 최종 실기기 검증 미완료**; physical iOS/Android, real instruments/listening,
screen readers and paid Journey creatives remain explicit release risks, not PASS.

## Approved scrolling-score extension — 2026-11-14

User confirmed full application to `/challenge` only after a reference screenshot: one horizontal score, fixed vertical judgment bar, green correct/red incorrect notes, smooth return for repeat/DC/DS. `/practice` single-question semantics remain unchanged. Pre-extension evidence is now in `verification-pre-scroll.md` (427tests/build4/all24/recovery30/rollback43+3 passed). The current milestone checklist above supersedes the earlier continuation work log; available-environment acceptance is recorded in `verification.md`; physical/acoustic limits remain explicit.

- Root: ScoreViewport/ChallengeStage, scroll projection, seven-language copy, UI/browser integration, report.
- Domain worker: optional bar-navigation schema, finite expanded playback occurrences and unscored rewind transitions, timeline/preview/store integration, tests. Do not change24 authored note arrays or scoring thresholds.
- Notation worker: optional horizontal layout, native alphaTab note colors, repeat/navigation marks, stable event/measure anchors; preserve default legacy wrapper output and fallback/retry.
- Verify repeated notes are independent occurrences, no input consumed while rewinding, current/last-pass colors reset correctly, reduced motion skips animation, all existing24 stages still work, old practice semantic differences0.
