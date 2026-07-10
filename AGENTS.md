# Note Quiz Working Agreement

## Project Context

- Note Quiz is a Next.js 15 App Router application built with React 19, TypeScript, Tailwind CSS, Zustand, Vitest, and the Web Audio API.
- The primary product surface is `/practice`. Legacy `/game`, `/ear-training`, and `/leaderboard` routes redirect into that surface through `next.config.ts`.
- Sight-reading and ear-training share UI infrastructure but have separate state and domain behavior. Do not assume a change for one mode applies to the other.
- The app supports English, Korean, Japanese, Spanish, German, and French.

## Ownership Map

- Routes and API handlers: `src/app/`
- Current practice experience: `src/components/practice/`
- Legacy game and ear-training components: `src/components/game/` and `src/components/ear-training/`
- Client state: `src/store/`
- Music generation, validation, and audio: `src/lib/music/`
- Translation schema and strings: `src/lib/i18n/translations.ts`
- Leaderboard validation and persistence: `src/lib/leaderboard/`, `src/services/leaderboard.ts`, and `src/types/leaderboard.ts`
- Analytics events: `src/lib/analytics.ts`
- Database schema and RPCs: `supabase/leaderboard.sql`

## Implementation Rules

- Trace the active `/practice` path before modifying a legacy component. Change redirected legacy surfaces only when the request requires it.
- Keep browser-only APIs, including audio, microphone, storage, and analytics, in client code. Preserve user-gesture requirements for audio and microphone initialization.
- When adding or changing user-facing copy, update the translation type and all six language entries in the same change.
- Keep scoring rules in shared pure functions. The server is authoritative for leaderboard points; never trust client-calculated points or client-supplied country data.
- Preserve anonymous play. Do not add user identifiers, raw IP storage, fingerprinting, or long-lived session tracking without explicit approval and a privacy review.
- Treat `supabase/leaderboard.sql` as a migration artifact. Make SQL changes idempotent where practical and never claim they are deployed unless deployment was actually performed.
- Add analytics only for meaningful product events. Do not send note answers, session IDs, or other unnecessarily granular data.
- Follow existing TypeScript, Zustand, Tailwind, and component patterns. Avoid new production dependencies unless the user approves them.
- Preserve unrelated working-tree changes. Do not commit, push, or modify deployment state unless explicitly requested.

## Validation

- Start with the narrowest relevant Vitest file: `npx vitest run <path>`.
- Run the full unit suite with `npm test` when shared state, scoring, timers, API contracts, or leaderboard behavior changes.
- Run `npx tsc --noEmit` for TypeScript changes.
- Run `npm run lint` when the repository's configured lint command is available; report configuration failures separately from code failures.
- Run `npm run build` for route, server/client boundary, configuration, or production behavior changes.
- For visible UI changes, verify `/practice` at desktop and mobile widths and exercise the changed interaction, not just initial rendering.
- Inspect the final diff and report commands run, results, skipped checks, and residual risk.

## Repository Skills And Agents

- Use `$note-quiz-practice` for changes to the practice UI, session lifecycle, audio interactions, or translations.
- Use `$note-quiz-leaderboard` for scoring, anonymous submissions, API validation, Supabase RPCs, retention, and ranking displays.
- Delegate bounded planning, review, or verification work to the project agents in `.codex/agents/` when it reduces risk or keeps independent checks separate.
