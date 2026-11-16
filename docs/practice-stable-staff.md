# Basic practice staff geometry — 2026-11-15

## Scope and cause

This follow-up applies only to `AlphaTabNotationView`'s existing `fittedBasic`
single-bar page layout. Horizontal melody time spacing, score generation,
scoring, audio and hidden-answer selection stay in their owning code.

Previously, the post-render fit divided the viewport height by the complete
native score height. Ledger notes change that height and its padding, so the
same five staff lines changed scale and vertical position. The resulting width
calculation then called `resizeRender`, adding a second engraving before ready.

## Native alphaTab 1.9 evidence

The installed `@coderline/alphatab` is pinned to `1.9.0`. Its public
`boundsLookup.findMasterBarByIndex(0).lineAlignedBounds` describes the staff
line region, excluding note/stem/clef overflow. The implementation is in
`StaffSystem.buildBoundingsLookup` in `dist/alphaTab.core.mjs`: it computes
`lineTop` and `lineHeight` separately from visual/real content bounds.

With the existing display scale 2 and padding `[12,16,12,16]`, the empty treble
fixture has total height 172, line bounds `{x:12,y:44,w:264,h:72}` at native
width 288. Its staff center is 80, six pixels above the full-height center 86.
The regression test renders this reference through alphaTab's actual SVG
renderer rather than mocking the geometry.

The basic view keeps the reference `scale = min(1, viewportHeight / 172)` and
staff center `viewportHeight / 2 - 6 * scale`. It translates the native
`lineAlignedBounds` to that fixed center. Complete content height is never used
to fit a basic staff. The first-to-fifth line span is consequently 65.3023px
in the 156px mobile viewport and 72px in the 220px desktop viewport, across
all four clefs and ledger extremes.

The initial host width is derived from `min(wrapperWidth * .8, 560) / scale + 24`.
This is set before constructing the API because `AlphaTabApi.render()` assigns
the renderer width from its container width. Directly setting `renderer.width`
before calling `renderScore()` would be overwritten. The post-render width
refit is removed; readiness follows the first completed, current engraving.

## Overflow and loading

`StableNotationSurface` keeps its existing 156/220px inner viewport (112/160px
for compact progression panels). Configured possible ranges determine fixed
outside margins; neither the current note nor answer visibility participates.
`basicStaffReserve` allocates only the amount that exceeds the existing empty
space around the staff. Beyond the last configured ledger line, 26 native
pixels cover both native head/accidental ink and the pre-existing courtesy
accidental's centered 48px line box plus the native 1.17px head/line offset.

At 156px, zero/one ledger lines need no extra margin, two above need 17px,
and five above/below need 66/55px. At 220px, two lines need no margin and five
above/below need 48/36px. The staff's inner anchor/scale remain unchanged.
Note mode forwards its session staff range. Ear mode derives its full possible
C-minimum to B-maximum range from configured octaves without using a hidden
answer. Theory uses task bounds from its C3..G4 root pool: five lower lines;
upper bounds are one for intervals, zero for quality, three for inversion and
two for compact progressions. Call-site forwarding belongs to the toast worker.

The renderer SVG, foreignObject and inner wrapper allow vertical overflow.
The surface clips the horizontal axis while allowing vertical overflow into
the reserved margins, containing the native minimum-width score horizontally.
The loading cover spans those margins and remains opaque until the current
native score is ready. The gray pulse/bar is removed; loading is plain white
with the existing `aria-busy` contract.

## Verification and remaining integration

The native regression matrix covers empty scores, five lower ledger lines,
five upper ledger lines and a chord spanning both extremes for treble, bass,
alto and tenor, using mobile-width and desktop-width frames. It compares all
five emitted SVG staff rectangles, physical span/centering, native quarter
note glyphs and native note-head bounds. A separate key/accidental matrix
exercises the fixed scale/anchor through seven-sharp and seven-flat keys.

Lifecycle tests cover first-frame gating, one-render completion, ledger score
revisions, missing native bounds, queued colors, horizontal/time-spacing/multi-
bar exclusions, timeout and font retry. Existing revision-based loading and
caller-side omission of concealed notes are retained.

Known boundary: at a 320px page width (229px available wrapper), alphaTab's
native minimum clef/key/accidental width can exceed the requested 80% rail.
It emits a minimum-width compression warning for seven accidentals. The view
preserves native engraving scale/vertical anchor and native minimum width;
this exception is approved by the coordinator and covered by the native test.
Tight native header spacing at this boundary remains a limitation, independent
of ledger height stability. Root's final browser matrix must verify horizontal
containment and adjacent toast/input separation in the integrated UI.

Worker checks completed:

- Initial renderer baseline: 11 tests passed before changes.
- `npx vitest run src/components/notation/AlphaTabNotationView.test.ts src/lib/notation/basic-staff.test.ts src/lib/notation/horizontal.test.ts`: 44 tests passed before reserve helpers were added; horizontal exclusions remain covered.
- `npx vitest run src/lib/notation/basic-staff.test.ts src/components/notation/AlphaTabNotationView.test.ts src/components/practice/PracticePreview.test.tsx`: 158 tests passed with reserve helpers and plain loading.
- Final focused native, lifecycle, preview and horizontal suite: 187 tests passed after caller forwarding; the final courtesy-span clearance check is included in the same native matrix.
- `npx tsc --noEmit --incremental false`: passed.
- `npx next lint --file ...` for the seven worker-owned TypeScript files: passed without warnings.
- Final owned-file diff whitespace check: passed.

The coordinator owns the full suite, production build and integrated browser
verification at desktop/mobile widths. This worker did not start/stop a server,
run a build, attach a user tab, use a microphone, commit or deploy.

## Independent review correction — native surface clipping

Independent review reproduced a clipped high-ledger note in treble/Cb at
320px. Its note head extends from x=234.85 to 254.12, inside the outer frame
ending at x=267, while alphaTab's `.at-surface` ends at x=242.12 and retains
inline `overflow:hidden`. Its 226px native canvas is narrower than its native
staff/ink. Evidence: `/tmp/note-quiz-ledger-independent/ledger-320-treble-Cb-high.png`,
`cb-high-ancestors.json` and `cb-high-dom.json` in that directory.

The installed `BrowserUiFacade.createCanvasElement()` sets that clipping
inline. After a current basic engraving completes, the view now sets only its
own `.at-surface` overflow to visible, before revealing the score or notifying
readiness. The outer practice surface retains horizontal containment and the
configured vertical reserve. This changes neither native width/scale nor
horizontal, time-spaced, multi-bar or ordinary non-basic page renderers.

The lifecycle regression reproduced the failure before the fix. It now
checks the Cb minimum-width case, readiness ordering, a native surface reset
on the next score, unchanged width/scale and no resize render. Existing layout
exclusion tests explicitly retain native `overflow:hidden` outside basic fit.

Validation: 47 tests passed across the renderer lifecycle, native basic-staff
and horizontal engraving suites; strict TypeScript and the two-file Next lint
passed. Independent reviewer `ctx_90ed0c29d1fb` owns the browser spot recheck
after this worker freezes the correction; that recheck is not claimed here.
