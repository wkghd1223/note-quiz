---
name: note-quiz-leaderboard
description: Implement or review Note Quiz anonymous scoring and country leaderboard changes involving score formulas, session eligibility, payload validation, `/api/leaderboard`, Supabase tables or RPCs, duplicate prevention, retention, ranking displays, privacy disclosures, or related analytics. Use whenever a change affects how practice results become country points.
---

# Note Quiz Leaderboard

## Trace The Contract End To End

Read `AGENTS.md`, then inspect the complete path before editing:

1. Result creation and provisional display in `src/components/practice/` and `src/store/gameStore.ts`.
2. Client submission in `src/services/leaderboard.ts`.
3. Shared payload and response types in `src/types/leaderboard.ts`.
4. Pure calculation and validation in `src/lib/leaderboard/validation.ts`.
5. Country detection and persistence in `src/lib/leaderboard/`.
6. API handling in `src/app/api/leaderboard/`.
7. Tables, policies, retention, and RPCs in `supabase/leaderboard.sql`.
8. Ranking UI, translations, analytics, and privacy policy.

## Preserve Trust And Privacy

- Treat server-calculated points as authoritative. Client calculations are provisional display values only.
- Accept only a versioned, allow-listed payload and reject inconsistent totals, invalid time, unsupported modes, invalid session IDs, and configured limits.
- Detect country from trusted request infrastructure, not request body data.
- Keep duplicate prevention atomic in the database. Concurrent requests for one session must increment aggregates at most once.
- Store no raw IP, user ID, device fingerprint, or answer-level history.
- Keep anonymous receipt retention bounded and disclose the purpose in the privacy policy.
- Separate incompatible score units by versioned storage. Preserve old tables for rollback unless deletion is explicitly requested.
- Keep database changes idempotent where practical. Do not report SQL as deployed when it was only edited locally.
- Keep ranking labels explicit about their unit, such as session points or country points.

## Keep Changes Synchronized

When the contract changes, update every affected layer in the same change:

- payload and response TypeScript types
- pure validation and point calculations
- client submission and result handling
- API tests for accepted, duplicate, ineligible, malformed, and unavailable persistence outcomes
- Supabase table, RPC, grants, policies, indexes, and cleanup behavior
- leaderboard reads and displays
- all six translations
- analytics outcome events
- privacy text when collected or retained data changes

## Verify

1. Add or update deterministic unit tests for formula boundaries, eligibility, payload limits, and rounding.
2. Run focused validation, API route, persistence adapter, timer, and store tests.
3. Run `npm test`, `npx tsc --noEmit`, and `npm run build` for contract changes.
4. Inspect the SQL transaction path for concurrent duplicate safety and verify cleanup intervals against the documented retention periods.
5. Manually exercise eligible, ineligible, duplicate, and failed submissions in the result UI when possible.
6. Confirm ranking labels and submission messages in all six languages at desktop and mobile widths.

Report local verification separately from database deployment or production verification.
