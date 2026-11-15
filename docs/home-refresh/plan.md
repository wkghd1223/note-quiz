# Home refresh and coordinated practice follow-up

## User scope and ownership

The user requested updating the main page for the current features, natural Korean copy using `im-not-ai`, and mobile usability. Existing purple branding, anonymous use and shared header/footer remain. Root owns HomeClient, the two home page route files, typed `src/lib/i18n/home.ts`, and home-specific tests/verification. The translation worker fills ja/es/de/fr/zh only; root authors and lightly edits Korean/English. The lightweight im-not-ai reference is used, without the full humanize pipeline or any authorship/detector claim.

Separate approved ongoing work is coordinated with run_1f32a2a34e27: basic-practice compact layout, preset/difficulty moved into Settings, share/daily promotional UI removal, shared action/result presentation. That run owns basic components and shared UI. Root's independent melody worker owns smaller native time spacing and provisional live-pitch expression; final scoring, audio clocks and session ownership stay independent. Root integrates the resulting props into MelodyPractice only after interfaces are ready. These are still required, independently tracked tasks; a home build does not prove their completion.

## Home design and factual boundary

- Purpose: choose basic practice or an eight-bar melody immediately. Basic note/ear/interval/chord links go directly to their canonical child routes. Melody uses `/melody`.
- Compact mobile intro and two purposeful panels; four basic choices in a two-column grid, with a separate melody action. Keep focus indicators and touch targets of at least 44px.
- Remove obsolete daily entry, bass preset shortcut (now chosen in Settings), repeated ten-question start badges and large stale illustrative screenshot. Preserve access to the country leaderboard.
- Replace repetitive feature/about card groups with three short usage steps and four practical FAQ entries. Actual facts: free/no signup; monophonic microphone melody input; randomized eight bars; piano example, metronome, tempo/meter/range/length settings; microphone PCM is not recorded/uploaded. Avoid claims of perfect device support or guaranteed learning outcomes.
- Reuse existing header/footer, purple surfaces, radii and restrained interaction motion. No new dependencies, ad suppression/overlay tricks, legal document edits, fabricated imagery or user metrics.
- Add a typed seven-language home copy module to avoid racing shared translation edits. Home routes pass the existing SEO helper their updated title/description; shared route canonicalization is untouched.

## Verification

Run related metadata/locale tests, TypeScript, lint and a production build in the existing isolated workflow. Test home at 390×844 and 1440×900, with smaller width/long translations as needed: all five practice destinations, leaderboard, FAQ keyboard controls, language changes, focus, overflow and the single common footer with legal links. Inspect before/after screenshots and final focused diff. Report actual ads versus blocked/synthetic environments and physical-device limits separately. Reuse task3013; never touch the user's development server or coordinator3014.

Before screenshot: `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/orca-browser-screenshots/4ccd3159-5cc0-47d9-ba51-722234ea7b63-screenshot.png`.

## Integration checkpoint — 2026-11-15

Current repository supports eight locales including concurrent Brazilian Portuguese work; preserve that source and validate the actual supported list. Home enabled layout/copy/metadata is implemented. Preliminary build `xdDj62BbxKo8u0EyIsN4x` passed24locale/viewport home cases, no-JS SSR and navigation/FAQ/footer checks, with native390/1440 before/after comparison and observed Grow bottom ad. Full59files/979tests and TypeScript passed. A read-only review found disabled-melody copy/metadata mismatch; the home worker owns a bounded fix and regression checks. A shared-dialog ref lint warning is owned by the other coordinator's UI worker. Next: capture the finished source, recheck changed behavior and record the final build boundary; run the independent compact-practice comparison once their final3014 is ready.
