# Phase 1 notation migration

## Decision and scope

- `@coderline/alphatab` and `@coderline/alphatab-webpack` are pinned to **1.9.0**. The repository remains on Next.js 15.1.7 and React 19.
- Development uses `next dev` (webpack), matching `next build`. The official webpack plugin copies generated assets to ignored `public/alphatab/`; the renderer requests `/alphatab/font/Bravura.woff2`.
- `Staff` (current question and review) and `MusicNotation` (interval, chord, progression groups) delegate drawing only. Existing generation, validation, scoring, store, URLs, storage, audio and microphone are not part of this change.
- Existing sizing SVG attributes/classes and wrapper structure are retained. alphaTab's SVG surface lives inside an SVG `foreignObject`, with a fitted, centered HTML host. This preserves the original outer SVG geometry and theory accessibility labels. Staff had no image role/label before the migration and retains that contract.
- `player.enablePlayer`, cursor and user interaction are disabled; no SoundFont request or replacement audio is enabled. The plugin copies its standard SoundFont assets, but rendering never fetches them.

Primary documentation checked on 2026-11-14:

- [Official React / Next.js integration](https://www.alphatab.net/docs/getting-started/installation-react)
- [Official webpack plugin and assetOutputDir](https://www.alphatab.net/docs/getting-started/installation-webpack)
- [Official web project setup](https://www.alphatab.net/docs/getting-started/installation-web-projects)
- Installed 1.9.0 TypeScript declarations and source are authoritative for enum/model details. alphaTab is MPL-2.0; generated font assets include Bravura's SIL Open Font License notices. No dependency sources are modified.

## Written music contract

`src/lib/notation/score.ts` exports `NotationScore`, `NotationEvent`, `WrittenNote`, and `NotationRenderResult`.

- `WrittenNote` keeps the written letter/octave, alteration, explicit accidental and sounding MIDI value separate.
- `legacyToScore` receives **already key-adjusted** `displayNote` as `note` and original `Question.note` as `originalNote`. It never reapplies the key signature. `null` means inherited/unspecified, not an explicit natural. The legacy natural is visible only when it cancels the key signature.
- `theoryToScore` explicitly chooses sequential beats or notes in the same beat; progression groups continue to use their existing 2-column parent grid.
- `toAlphaTabScore` constructs typed `Score/Track/Staff/Bar/Voice/Beat/Note` models, not alphaTex. Scientific C4 maps to alphaTab's pitched-note octave 5 (MIDI 60). Forced accidental modes preserve enharmonic spelling, including B#/Cb/E#/Fb across octaves.
- alphaTab 1.9's forced modes are spelling hints, not courtesy-glyph commands. A narrowly scoped HTML accidental overlay at the engine's note-head bounds retains the legacy explicitly supplied #/b when the key signature already has the same alteration. The engine supplies all other engraving, including natural cancellation.

For Stage Challenge, events optionally specify zero-based `barIndex` (default 0); a note-free event is a rest. Duration is a denominator (`4` quarter, `8` eighth), with optional dots. `timeSignature` and `showTimeSignature` are independent. Each event ID survives into `onRender({ events, width, height })`; event bounds use SVG viewBox coordinates, including a custom viewBox's y origin. Clients scale these bounds to CSS coordinates for overlays. This renderer does not judge pitch, duration, onset or progression.

## Lifecycle and rollback

- Client-only lazy import, one API/worker per mounted view; async completion after unmount is ignored. Cleanup disconnects the observer, clears its debounce timer, calls `api.destroy()`, and clears the host.
- A serialized render queue and revision token discard stale completions and render the latest requested score. Previous frames remain hidden while a new score is pending.
- The observer watches the **outer SVG width**, not the engine's changing intrinsic height; observing the latter caused a POC render loop and was corrected before acceptance. Resize rerenders are debounced through the same serialized queue.
- `lastSystemFillThreshold: 0` stretches a sparse one-bar exercise across the existing staff width; the default otherwise left most of the old score region blank.
- Runtime rendering errors select the preserved legacy component for that mounted wrapper. A deliberate deployment rollback uses **`NEXT_PUBLIC_NOTATION_RENDERER=legacy` at build time**, followed by a normal rebuild/release. The default is alphaTab. Preserved originals are under `src/components/notation/legacy/`.

## Evidence and gates

Focused checks actually completed:

- Unmodified `src/components/game/Staff.test.ts`: 3 passing existing geometry tests.
- `src/lib/notation/notation.test.ts`: pure/model checks for 4 clefs × 15 keys × 7 letters × 5 octaves, explicit accidentals vs null, 100 seeded questions, cross-octave enharmonics, ordered intervals, simultaneous seventh chords/inversions, separate progression groups and Stage bar/rest mapping. The seed snapshot captures the unchanged legacy generator's question semantics, not alphaTab markup.
- `npx tsc --noEmit` and scoped ESLint passed after adapter/wrapper integration.
- Development browser POC on Chrome at 390×844: **83 fixture renders**, SVG clef/key glyph presence and event bounds, 100 rapid updates, Strict Mode mount, worker count stability and unmount cleanup. Worker and Bravura requests returned 200; zero page errors. Captured `/tmp/note-quiz-notation-verified/report.json` and four clef screenshots. This is browser automation, not physical-device or audible-output validation.

Reproduce the dev-only focused harness with an already running webpack development server:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
BROWSER_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
UI_BASE_URL=http://localhost:3012 \
UI_ARTIFACT_DIR=/tmp/note-quiz-notation-verified \
node scripts/verify-notation.cjs
```

The harness mounts controlled props using Next development module names, without shipping a test route. It blocks external requests and never submits scores. Production verification must instead use the unchanged practice UI runner, semantic baseline comparison and actual asset responses.

**M1 technical GO alone is not G1 completion.** Integrated production/build/asset, practice equivalence, language, recovery and Orca GUI evidence is now recorded in `verification.md`, with source/build boundaries. Safari/Firefox, real mobile hardware, audible playback and deployed Amplify paths have not been verified.

## Approved Challenge horizontal score extension

`AlphaTabNotationView` now accepts optional `layout="horizontal"` and `eventColors`.
The default remains the existing page layout; neither practice wrapper opts into
horizontal scrolling. Horizontal mode uses alphaTab's native `LayoutMode.Horizontal`,
fits height without shrinking the entire score to the viewport, and exposes
`contentWidth`, measure bounds and event `anchorX` from the engine's `onNotesX`.
Challenge moves that single rail relative to a fixed play line using its existing
AudioContext clock. Preview/results allow keyboard and touch horizontal scrolling.

Colors apply to native notehead/accidental/effect and beat stem/flag/beam/rest styles
through the existing serialized renderer queue. They do not add an imitation note
overlay or recreate the API on each animation frame. Repeat barlines and D.C./D.S.,
Segno, Coda, Fine and To Coda marks are authored through optional `NotationScore.bars`
metadata and engraved by alphaTab. Playback interpretation belongs to the Challenge
domain, not to alphaTab's disabled player.

`scoreCursorPosition` interpolates between real note anchors; backward navigation
uses the domain's one-beat unscored return interval. Reduced motion snaps to the
destination and note anchors while retaining the same input/scoring clock.
Each return clears the upcoming pass's visual judgments, while results retain
independent performed occurrences. See `scoring-oracle.md` and `verification.md` for
the contract and the separately recorded unit/browser/GUI evidence.
