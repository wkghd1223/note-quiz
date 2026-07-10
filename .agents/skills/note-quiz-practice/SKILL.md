---
name: note-quiz-practice
description: Implement or review Note Quiz practice experience changes involving `/practice`, sight-reading or ear-training sessions, Zustand lifecycle state, timers, music input, audio or microphone behavior, responsive UI, translations, or practice analytics. Use when a task changes what a learner sees or does during a practice session.
---

# Note Quiz Practice

## Establish The Active Path

1. Read `AGENTS.md`.
2. Start from `src/app/practice/PracticeClient.tsx` and trace the selected mode into `src/components/practice/`.
3. Check `next.config.ts` before touching `/game` or `/ear-training`; those routes normally redirect to `/practice`.
4. Locate the owning Zustand store and shared music or timer utilities.
5. Record the session states and transitions affected by the request before editing.

## Preserve Practice Invariants

- Keep sight-reading and ear-training behavior separate unless the request explicitly unifies them.
- Keep browser APIs inside client components or client-called utilities.
- Initialize audio and microphone access from an appropriate user gesture and handle denied or unsupported access without blocking non-audio practice.
- Preserve elapsed time across pause and resume. Derive completion values from the same authoritative timestamp used to end a timed session.
- Reset transient question, feedback, timer, and submission state together when starting a fresh session.
- Keep controls usable with keyboard, pointer, and touch where the existing surface supports them.
- Keep fixed-format practice controls dimensionally stable and verify that translated text does not overlap.
- Update the translation contract and `en`, `ko`, `ja`, `es`, `de`, and `fr` entries for every new user-facing label or message.
- Add analytics at session-level milestones. Avoid sending note-level content, session IDs, or other unnecessary identifiers.

## Implement And Verify

1. Make the smallest change in the active practice components, store, and pure utilities.
2. Add focused tests for timer math, state transitions, calculations, or validation before relying on browser checks.
3. Run the narrowest relevant test file with `npx vitest run <path>`.
4. Run `npm test` and `npx tsc --noEmit` when shared session behavior changes.
5. Run `npm run build` for route or server/client boundary changes.
6. For visible work, verify `/practice?mode=note` or `/practice?mode=ear` at desktop and mobile widths. Exercise start, answer, pause or resume where applicable, finish, and play-again flows.
7. Inspect the final diff for accidental changes to the other mode or redirected legacy surfaces.

Report validation commands, outcomes, skipped manual checks, and remaining browser or device risk.
