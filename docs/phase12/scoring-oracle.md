# Stage Challenge scoring oracle (version 1)

## Scope and limitations

This is the reproducible **pure-domain and state** contract for Phase 2, not a
claim that acoustic instrument recognition or real-device audio timing is verified.
The challenge domain, stores, content and storage key are separate from `/practice`,
existing quiz scores, history and all leaderboard requests. No network writes are
performed by these modules. Raw events and pitch samples are transient; persisted
records contain only score/stars/attempt count, profile, input and completion date.

Thresholds are initial versioned tuning values, not measured product accuracy.
Official initial content contains 4 worlds × 6 stages, C4–G4, treble, C instruments,
4/4 and fixed authored BPM. Stage content is deterministic, including complete rests.
`stages.test.ts` freezes every pitch/duration sequence and validates coverage,
measure duration and acyclic prerequisites. Stage title/objective fields contain
translation keys; translation availability is an integration-level check.

## Mandatory gates and deterministic scoring

- Every world, including World 1, requires pitch **AND** duration for a note pass.
- Worlds 3–4 additionally require onset. Repeated-note lessons require a distinct
  new attack; one sustained event cannot be reused for two targets.
- Required rests are scored in W3-S6 and W4-S3/S5/S6. W3-S1's trailing rest is
  present in the timeline but deliberately unscored, matching the introductory lesson.
- Global minimum-cost monotone alignment permits missing targets and extra input;
  it never reuses an event ID. Candidate windows are capped at the smaller of
  450 ms and 45% of note duration. Pitch and onset both affect assignment cost.
- Pitch uses concert MIDI including octave. Written Db4 and C#4 can share sounding
  MIDI; written spelling is unchanged. Profile transposition is a separate pure
  conversion. Untested transposing profiles are not officially enabled.
- When pitch samples exist, **all** samples form the denominator; null/low-confidence
  frames do not become free valid pitch. In-range samples require target-relative
  cents within the configured tolerance and sufficient confidence. Without samples,
  the aggregate MIDI/cents and valid-pitch ratio are used.
- Easy: ±60 cents, 65% valid ratio, duration relative error ≤30%. Normal: ±45 cents,
  75% valid ratio, duration error ≤22%, onset ≤120 ms (also capped at 30% of duration).
  General event/attack confidence threshold is 0.6. Required rest overlap >120 ms
  is a violation; overlapping observed intervals are unioned, not double-counted.
- Dimension scores are pitch ratio ×100, max(0,1−duration relative error) ×100,
  and max(0,1−absolute onset error/(4×onset tolerance)) ×100.
  Weights pitch/onset/duration = 50/30/20 are normalized over measured dimensions.
  A high weighted score does not change a failed note gate. No unsupported duration
  profile receives automatic duration credit.
- Clear requires ≥80% passed notes and score ≥70; 2 stars ≥85%/85, 3 stars ≥95%/95.
  Any required rest violation or unscorable target prevents official stars.
  Nonfinite/invalid input invalidates official scoring rather than producing success.
- Identical event/target/profile/offset inputs return identical result JSON. No dates,
  random IDs or wall clock are read during scoring.

## S01–S16 executable oracle

| Case | Input                                      | Required observation                             | Evidence                                        |
| ---- | ------------------------------------------ | ------------------------------------------------ | ----------------------------------------------- |
| S01  | C4 261.63 Hz, exact 2 beats                | Pitch and duration pass                          | `domain/scoring.test.ts`                        |
| S02  | C#4 for C4                                 | Pitch fail; no compensated clear                 | same                                            |
| S03  | C5 for C4                                  | Octave failure                                   | same                                            |
| S04  | Sounding C#4 for written Db4               | Pitch pass, spelling retained                    | same                                            |
| S05  | Half a beat for a 2-beat note              | Too short, duration failure                      | same                                            |
| S06  | 3 beats for a 2-beat note                  | Too long, duration failure                       | same                                            |
| S07  | Correct note/length, 200 ms late           | Normal onset failure                             | same                                            |
| S08  | Correct note/length, 80 ms late            | Normal note pass                                 | same                                            |
| S09  | One long C4 for C4–C4                      | Second attack missing; no reuse                  | same                                            |
| S10  | C4 then D4 on time                         | Two distinct passes                              | same                                            |
| S11  | Valid note during required rest            | Rest violation blocks stars                      | same                                            |
| S12  | Noise/low confidence                       | Unscorable, never note pass                      | same                                            |
| S13  | Confident doubled harmonic                 | Octave failure                                   | same                                            |
| S14  | Short dropout in a single normalized event | Duration remains continuous; null frames counted | same (signal hysteresis belongs to audio tests) |
| S15  | Pause/restart with stale callbacks         | Old segment/attempt events rejected              | `store/challengeStore.test.ts`                  |
| S16  | Repeated identical inputs                  | Byte-identical result JSON                       | `domain/scoring.test.ts`                        |

Additional tests cover missed first notes, overlapping assignment windows, duplicate
event IDs, insufficient frame ratio, invalid numeric values/thresholds, unclosed
events, World 1 duration, unsupported profiles, input offset, early first attack,
60/80/120 BPM, 44.1/48/96 kHz sample clocks, invalid sample rates and fixed rehearsal
scales. PCM buffer/dropout detection itself is a separate audio-pipeline concern.

## Lifecycle integration contract

`startAttempt` returns a monotonic attempt token. `beginPlaying(token,start)` accepts
one scheduled AudioContext start; `addEvent(token,segmentToken,event)` rejects stale
attempt/segment callbacks. Event timestamps map from the active audio segment to a
canonical score timeline; `elapsedSec` is the segment base, and `getElapsed(now)`
derives current position from the same supplied audio clock. No wall clock is read.

For early-first-note feedback, observed onset may precede the scheduled segment
start by up to 500 ms. UI/audio must start collection before the scheduled first
target if it wants this feedback; events are not silently clamped to zero.

**Pause resumes from the current note/rest**, not its middle. Pause rewinds to the
current target start and discards overlapping/current-and-later input while retaining
completed prior notes (with latency offset accounted for). Resume requires a new
count-in, increments the segment token and maps the new segment to the rewind point.
This avoids treating interrupted sustained notes as short failures. UI must explain
this policy and stop physical audio resources when pausing; the store cannot stop
browser tracks. `finish(token, audioNow)` rejects completion before score end +200 ms
and is idempotent after the first result. Always pass `audioNow` in the UI; omitted
time is intended for controlled callers already enforcing the completion window.

### Repeats and score directions

Optional `StageDefinition.barNavigation` contains zero-based written bar indices,
repeat start/end/count and direction marks. Existing 24 authored note/rest sequences
and scoring thresholds remain unchanged and currently contain no navigation marks.
The browser verifier supplies isolated in-memory marked scores to exercise this
conditional behavior; these are not shipped stages or a new upload feature.

`buildPlaybackPlan` expands written bars into finite performed visits;
`buildPlaybackTimeline` derives targets and transitions from those visits. A repeated
event receives a unique performed ID plus `sourceEventId`, `sourceBarIndex`, `visit`
and `occurrenceIndex`. Matching cannot reuse one input for multiple visits. Scores
without navigation preserve their original IDs and timeline exactly.

- A repeat count is total passes (default two, supported range two to eight).
- D.C. returns to the beginning; D.S. returns to Segno. Each instruction executes
  once. Ordinary repeat barlines are ignored after the D.C./D.S. return.
- Fine stops only after an `alFine` return; To Coda jumps only after `alCoda` arms it.
- A backward or same-bar jump inserts one unscored beat for the visible return.
  Forward Coda jumps have no backward animation or added gap.
- Inputs whose corrected onset falls in a return interval are excluded. A hold
  started before the gap keeps its real release time, so an overlong hold still
  fails duration rather than gaining a free clipped pass. Touch keys reject new
  attacks in the interval but keep physical key-release handling active.
- Pausing during the return resumes from its start after count-in; stale segment
  input remains rejected. Preview uses the same expanded order and timing.
- Missing/ambiguous targets, nested/overlapping repeats, alternate endings,
  cross-bar events and plans above 256 performed bars are rejected rather than
  guessed or looped indefinitely.

Regression evidence: `domain/playback-order.test.ts`,
`store/challengeStore.navigation.test.ts`, `components/score-scroll.test.ts`,
`components/TouchKeyboard.test.ts`, and the real-browser navigation fixtures in
`scripts/verify-challenge-scroll.cjs`. See `verification.md` for executed results.

Rehearsal supports only 70/85/100% scales and cannot persist official results.
Official attempts force scale 100%, even if a rehearsal scale is accidentally passed.

## Local records, unlock and storage safety

Records are isolated by **stage × instrument profile × input method × scoring
version**. Selecting another profile never merges best records. Accessibility
policy: a clear in **any supported official profile** unlocks the common next stage,
independent of the newly selected profile. Rehearsal, unsupported and unscorable
attempts cannot unlock. Best score and best stars are independent monotonic maxima.

`readProgress` returns data plus `unavailable`, `corrupt`, or `version` diagnostics.
It allows an in-memory session even when storage fails. `saveProgress` rechecks the
stored document and refuses to overwrite unreadable/incompatible data, including
after an earlier read returned fallback defaults. Only an explicit user reset may
pass `allowOverwrite=true`. No automatic corrupt-data deletion is performed.
Stage reset is independent of existing practice statistics.

## Verification command

```sh
npx vitest run src/features/challenge/domain/scoring.test.ts src/features/challenge/data/stages.test.ts src/features/challenge/store/challengeStore.test.ts src/features/challenge/store/progress.test.ts
```

Actual results and broader integration checks are recorded in the implementation
handoff. These tests do not substitute for microphone, mobile hardware, browser
permissions, acoustic latency, listening or real-device visual verification.
