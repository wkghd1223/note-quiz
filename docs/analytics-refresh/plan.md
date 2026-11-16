# GA refresh — 2026-11-16

Status: implementation and local acceptance complete. Independent QA found and verified the early-event route-context correction; the final runner passes all3cases on desktop1440×900 and mobile390×844. Full71files/1223tests, TypeScript, lint and isolated production build pass. The receiving coordinator verified source hashes and existing acceptance evidence, finalized documentation and stopped only the QA3027server after the user transferred both sessions. Live Google ingestion, GA Admin settings and deployment remain unverified/unchanged. See verification.md for evidence and provenance. Initial implementation dispatch: ctx_6fc762aafc9b.
Run: `run_917b0e85cedf`.

The user asked whether GA was updated alongside the recent UI/routing changes, then explicitly requested “GA재정비까지 작업해”. This is new authorized analytics work; the previous UI project stays with its receiving coordinator.

## Current findings

- Existing production Google tag configuration disables the initial automatic page view, but the separate pathname tracker drops a view if gtag is not ready; no readiness retry exists.
- window.location.search already includes `?`, while the tracker prepends another `?`, creating malformed page_path values. Settings/share/leaderboard query values are currently sent wholesale in page_location.
- Basic practice has existing practice_* entry/start/completion/review/restart funnel events plus older note/ear compatibility events. Current helper tests8/8 pass. Do not silently remove or sum the old compatibility family as the main funnel.
- Melody has no analytics instrumentation. Preview and failed microphone initialization must not be mistaken for a practice start.
- Official Google documentation says send_page_view:false does not disable Enhanced Measurement history-triggered views. We cannot claim property-wide duplication is eliminated without checking that separate GA setting. No GA account settings, custom dimensions or production collection have been accessed or changed.

## Accepted scope

1. Keep the existing measurement ID/environment configuration and production-only behavior. Make initialization/event queuing reliable when the tag loads late, without new storage/user identifiers or a dependency. No polling loops or indefinite event listeners/timers.
2. Count one application-owned page_view per committed pathname navigation, including locale/mode changes, back/forward and redirect destinations. Do not count settings/result/history query-only changes as new pages. Avoid StrictMode/remount/readiness duplicate events. Keep correct page title/location/referrer context.
3. Use clean route paths and sanitized explicit URL metadata; do not send arbitrary app query/hash values or raw notes/session IDs. Preserve standard campaign attribution through a bounded, explicit standard-campaign allowlist rather than forwarding arbitrary search strings. Do not add identifiers. Document the chosen campaign/referrer contract and GA account-setting dependency.
4. Preserve existing basic-practice event names/payload semantics and their legacy compatibility family. No game/store/audio/timer/scoring changes, no per-answer analytics and no frequent frame/pitch events.
5. Observe melody from a dedicated analytics-only hook with one minimal component call site. Track entry, actual practice start, successful completion and interrupted practice; use aggregate fields only. Actual playing/result proves start; permission/count-in preparation failure alone does not. Pause/resume must not create a second start, preview must be separate, failed initialization must not fabricate a completion, reset/retry/new exercise and unmount must not duplicate end events. Local attempt/exercise keys may be used in memory for deduplication and must never be emitted. Partial interruptions must not invent partial scores/counts.
6. Reuse the practice_* funnel where appropriate for melody (`training_mode=melody`, user-configured/custom difficulty, explicitly documented exercise session type); a meaningful preview-start event may be added. Final totals/passes/elapsed must match existing aggregate result/clock data; no raw answer arrays, note names, frequencies, recordings, exercise seeds or IDs.
7. Document the event contract, report interpretation and custom-dimension setup, manual/enhanced-history setting, and production DebugView verification steps. Clearly separate tested application calls from unverified live GA reception/admin configuration.

## Ownership and concurrent work

Other coordinator is the confirmed thread `01a18a6b-b4ca-7d03-aa5b-ba404cb00811`, handle `term_f780478e-2947-4e8b-9dc4-bc74da7c2351`.

Agreement `msg_c2529b570fea`: UI/microphone/notation follow-up is frozen; no other active writers or planned MelodyPractice/useChallengeSession changes. This GA worker may add a new observing hook and its single import/call in MelodyPractice, preserving all existing dirty code and behavior. Do not edit useChallengeSession/store/audio/scoring or the old UI project. Share final exact diff/check evidence back with the other coordinator.

Allowed implementation files: src/lib/analytics.ts and tests; src/components/analytics/*; new narrow analytics helpers/config/tests; new melody analytics hook/tests; the agreed minimal MelodyPractice import/call; docs/learning-metrics.md and docs/analytics-refresh/implementation.md; a dedicated GA browser regression script if needed. No UI copy/style changes, no RootDocument/layout edits without a demonstrated need and coordination.

Protect user3001 (last reported PID71259; re-inventory instead of assuming), user tabs, root.next and node_modules. Other coordinator reports3013/3014 already stopped. Do not reuse or restart old servers based on stale handoff details. Verification builds must use a separate captured source/build directory and a verified free port in an owned Orca terminal; no install/commit/push/deploy/DB action.

## Execution and verification

- One bounded Orca Codex implementation worker, selected model gpt-6.1-sol per current user instructions. It owns the allowed files and runs focused analytics/observer tests with existing dependencies and --no-cache; no root build/server or new dependencies.
- After integration, independent read-only QA creates a source-hashed isolated snapshot, runs relevant/full tests, TypeScript, lint and production build, then exercises the real built client with delayed/stubbed gtag script and all external collection intercepted. Assert initial view once, proper navigation/referrer/back-forward, no query-only duplication or malformed paths, no data leaks, basic funnel compatibility, melody preview/failure/start/pause/resume/completion/abort/restart deduplication.
- Browser evidence must distinguish mocked tag transport/synthetic microphone from real Google ingestion or physical hardware. No production GA events should be emitted during tests. Record failures honestly and route fixes back to implementation.
- Final report lists changes, commands/results and outstanding property configuration/production reception limits. Application implementation success is not a claim that GA Admin or deployment was changed.

## Primary references

- https://developers.google.com/analytics/devguides/collection/ga4/views
- https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications
- https://developers.google.com/analytics/devguides/collection/ga4/reference/config
