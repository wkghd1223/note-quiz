/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node verification. */
/**
 * Run with node scripts/verify-score-editor.cjs. BROWSER_PATH can point to
 * Chrome/Chromium. Exercises the app's actual MusicXML DOM, editor commands,
 * engraving layout and practice timeline without a development server.
 */
const { buildSync } = require("esbuild");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

function verify({
  edits,
  keyEdit,
  moves,
  parseScoreXml,
  editScore,
  prepareScore,
  layoutBar,
  layoutScoreLine,
}) {
  const checked = [];
  function check(label, condition) {
    if (!condition) throw new Error(label);
    checked.push(label);
  }
  function note(step, duration = 1, type = "quarter", extra = "", marks = "") {
    return `<note>${extra}<pitch><step>${step}</step><octave>4</octave></pitch><duration>${duration}</duration>${marks}<voice>1</voice><type>${type}</type></note>`;
  }
  function rest(duration, type) {
    return `<note><rest/><duration>${duration}</duration><voice>1</voice><type>${type}</type></note>`;
  }
  function score(measures, beats = 4, pickup = false) {
    const attr = `<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>${beats}</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;
    const bars = measures
      .map(
        (body, i) =>
          `<measure number="${i + 1}"${pickup && i === 0 ? ' implicit="yes"' : ""}>${i === 0 ? attr : ""}${body}</measure>`,
      )
      .join("");
    return parseScoreXml(
      `<score-partwise version="4.0"><part-list><score-part id="P"><part-name>Piano</part-name></score-part></part-list><part id="P">${bars}</part></score-partwise>`,
    );
  }
  const bar = (s) => s.lanes[0].bars[0];
  const event = (s, i) => bar(s).events[i];
  const timeline = (s, semitones = 0) =>
    prepareScore(s, s.lanes[0].id, {
      fromBar: 0,
      toBar: s.lanes[0].bars.length - 1,
      semitones,
      speed: 1,
      repeats: true,
    });
  const range = (s, i, j) => edits.repeatEdit(s, i, j, 3, false);
  const midi = (e) => e.heads.map((h) => h.midi).join(",");
  const relocate = (song, fromBar, fromEvent, toBar, toEvent) => {
    const lane = song.lanes[0];
    return editScore(
      song,
      moves.moveNoteEdit(
        lane,
        lane.bars[fromBar].events[fromEvent],
        lane.bars[toBar].events[toEvent],
      ),
    );
  };
  const sequence = (song, i) =>
    song.lanes[0].bars[i].events
      .map((e) => [e.start, e.duration, midi(e)])
      .join("|");
  {
    const key = (fifths, mode = "major") =>
      `<attributes><key><fifths>${fifths}</fifths><mode>${mode}</mode></key></attributes>`;
    const chordName =
      "<harmony><root><root-step>C</root-step></root><kind>major</kind><bass><bass-step>G</bass-step></bass></harmony>";
    const firstVoice =
      note("C") + chordName + note("F") + note("A", 1, "quarter", "<chord/>");
    const backupTwo = "<backup><duration>2</duration></backup>";
    const secondVoice = (note("C") + note("G")).replaceAll(
      "<voice>1",
      "<voice>2",
    );
    const lowerStaff = (note("D") + note("E")).replaceAll(
      "</note>",
      "<staff>2</staff></note>",
    );
    const partBars = [
      "<attributes><divisions>1</divisions><staves>2</staves><transpose><chromatic>-2</chromatic></transpose></attributes>" +
        key(0) +
        firstVoice +
        backupTwo +
        secondVoice +
        backupTwo +
        lowerStaff,
      note("C") + key(0) + note("D"),
    ];
    for (const kind of ["partwise", "timewise"]) {
      const wrapped =
        kind === "partwise"
          ? '<part id="P">' +
            partBars
              .map((text, i) => `<measure number="${i + 1}">${text}</measure>`)
              .join("") +
            "</part>"
          : partBars
              .map(
                (text, i) =>
                  `<measure number="${i + 1}"><part id="P">${text}</part></measure>`,
              )
              .join("");
      const base = parseScoreXml(
        `<score-${kind}><part-list><score-part id="P"><part-name>Piano</part-name></score-part></part-list>${wrapped}</score-${kind}>`,
      );
      const lane = base.lanes[1],
        first = lane.bars[0],
        selection = first.events[1];
      const toD = { fifths: 2, mode: "major" };
      const changed = editScore(
        base,
        keyEdit(base, lane, first, toD, true, selection),
      );
      const upper = changed.lanes[0],
        otherVoice = changed.lanes[1],
        lower = changed.lanes[2];
      check(
        kind +
          " key at a beat moves both voices, chord heads and harmony until the next explicit key",
        upper.bars[0].fifths === 0 &&
          upper.bars[0].events.map((e) => e.fifths).join() === "0,2" &&
          upper.bars[0].events
            .flatMap((e) => e.heads.map((h) => h.midi))
            .join() === "58,65,69" &&
          otherVoice.bars[0].events
            .flatMap((e) => e.heads.map((h) => h.midi))
            .join() === "58,67" &&
          lower.bars[0].events
            .flatMap((e) => e.heads.map((h) => h.midi))
            .join() === "60,62" &&
          lower.bars.every((b) => b.fifths === 0) &&
          upper.bars[1].events
            .map((e) => [e.fifths, e.heads[0].midi].join("/"))
            .join() === "2/60,0/60" &&
          changed.document.querySelector("root-step").textContent === "D" &&
          changed.document.querySelector("bass-step").textContent === "A",
      );
      const signatureOnly = editScore(
        base,
        keyEdit(base, lane, first, toD, false),
      );
      check(
        kind +
          " signature only and undo preserve pitches, the other staff and original",
        signatureOnly.lanes[0].bars[0].fifths === 2 &&
          signatureOnly.lanes[2].bars[0].fifths === 0 &&
          timeline(signatureOnly)
            .notes.map((n) => n.midi)
            .join() ===
            timeline(base)
              .notes.map((n) => n.midi)
              .join() &&
          first.fifths === 0 &&
          selection.fifths === 0,
      );
      const clef = editScore(
        changed,
        edits.clefEdit(
          otherVoice.bars[0],
          otherVoice,
          { sign: "F", line: 4 },
          otherVoice.bars[0].events[1],
        ),
      );
      check(
        kind +
          " clef at a beat updates both voices of one staff, preserving sound",
        clef.lanes[0].bars[0].events.map((e) => e.clef.sign).join() === "G,F" &&
          clef.lanes[1].bars[0].events.map((e) => e.clef.sign).join() ===
            "G,F" &&
          clef.lanes[2].bars[0].events.every((e) => e.clef.sign === "G") &&
          timeline(clef)
            .notes.map((n) => n.midi)
            .join() ===
            timeline(changed)
              .notes.map((n) => n.midi)
              .join(),
      );
    }
    const tiedHead = (type) =>
      note(
        "C",
        1,
        "quarter",
        "",
        type.map((t) => `<tie type="${t}"/>`).join(""),
      );
    const chain = score(
      [
        tiedHead(["start"]),
        tiedHead(["stop", "start"]),
        tiedHead(["stop", "start"]),
        key(1) + tiedHead(["stop"]),
      ],
      1,
    );
    const chainLane = chain.lanes[0];
    const modulated = editScore(
      chain,
      keyEdit(
        chain,
        chainLane,
        chainLane.bars[1],
        { fifths: 2, mode: "major" },
        true,
      ),
    );
    check(
      "ties across a modulation boundary reattack, internal ties keep their duration",
      timeline(modulated)
        .notes.map((n) => n.midi)
        .join() === "60,62,60" &&
        modulated.document.querySelectorAll("tie").length === 2 &&
        chain.document.querySelectorAll("tie").length === 6,
    );
    const enharmonic = score([
      key(6) + note("F").replace("<octave>", "<alter>1</alter><octave>"),
    ]);
    const enhLane = enharmonic.lanes[0];
    const flats = editScore(
      enharmonic,
      keyEdit(
        enharmonic,
        enhLane,
        enhLane.bars[0],
        { fifths: -6, mode: "major" },
        true,
      ),
    );
    check(
      "enharmonic F-sharp major to G-flat major respells and keeps sounding pitch",
      event(flats, 0).heads[0].step === "G" &&
        event(flats, 0).heads[0].alter === -1 &&
        midi(event(flats, 0)) === "66",
    );
    const respellChain = score(
      [key(6) + tiedHead(["start"]), tiedHead(["stop"])],
      1,
    );
    const respellLane = respellChain.lanes[0];
    const held = editScore(
      respellChain,
      keyEdit(
        respellChain,
        respellLane,
        respellLane.bars[1],
        { fifths: -6, mode: "major" },
        true,
      ),
    );
    check(
      "an enharmonic signature across a tie keeps a single attack",
      timeline(held).notes.length === 1 &&
        held.document.querySelectorAll("tie").length === 2,
    );
  }
  const sourceChord = score([
    note("C", 2, "half") +
      note("E", 1, "quarter", "<chord/>") +
      note("D", 2, "half"),
    "<attributes><divisions>2</divisions></attributes>" +
      note("G", 4, "half") +
      note("A", 4, "half"),
  ]);
  const switched = relocate(sourceChord, 0, 0, 1, 0);
  check(
    "drop onto an occupied bar at a different divisions value with the whole chord and its original note releases",
    sequence(switched, 0) === "0,2,67|2,2,62" &&
      sequence(switched, 1) === "0,2,60,64|2,2,69" &&
      switched.lanes[0].bars[1].events[0].heads[1].duration === 1 &&
      sequence(sourceChord, 0) === "0,2,60,64|2,2,62",
  );
  const longerRest = relocate(
    score([
      note("C") + note("D", 3, "half"),
      rest(2, "half") + note("G", 2, "half"),
    ]),
    0,
    0,
    1,
    0,
  );
  check(
    "drop on a longer rest in the next bar leaves both surrounding passages in time",
    sequence(longerRest, 0) === "0,1,|1,3,62" &&
      sequence(longerRest, 1) === "0,1,60|1,1,|2,2,67",
  );
  const occupied = relocate(
    score([note("C") + note("D") + note("E", 2, "half")]),
    0,
    0,
    0,
    2,
  );
  const longSilence = relocate(
    score([note("C"), rest(200000, "maxima")]),
    0,
    0,
    1,
    0,
  );
  check(
    "keep a long imported rest compact after moving a note into it",
    sequence(longSilence, 1) === "0,1,60|1,199999,",
  );
  check(
    "exchange unequal occupied notes in a filled measure without changing their durations",
    sequence(occupied, 0) === "0,2,64|2,1,62|3,1,60",
  );
  const balanced = relocate(
    score([
      note("C") + rest(2, "half") + note("D"),
      note("E", 2, "half") + note("F", 2, "half"),
    ]),
    0,
    0,
    1,
    0,
  );
  check(
    "absorb and restore adjacent rest time when unequal notes cross a barline",
    sequence(balanced, 0) === "0,2,64|2,1,|3,1,62" &&
      sequence(balanced, 1) === "0,1,60|1,1,|2,2,65",
  );
  const tied = score([
    note("C", 1, "quarter", "", "<tie type='start'/>") +
      note("C", 1, "quarter", "", "<tie type='stop'/>") +
      note("D", 2, "half"),
  ]);
  check(
    "preserve a tied note when a drop would break its connection",
    !moves.canDropNote(event(tied, 0), event(tied, 2)),
  );
  const tripletBase = score([note("C") + note("D") + note("E")]);
  const movedTripletGroup = editScore(
    tripletBase,
    edits.groupTupletEdit(bar(tripletBase), bar(tripletBase).events, 3, 2),
  );
  const swappedTuplets = relocate(movedTripletGroup, 0, 0, 0, 2);
  check(
    "exchange pitches inside a tuplet while keeping its bracket endpoints in order",
    midi(event(swappedTuplets, 0)) === "64" &&
      midi(event(swappedTuplets, 2)) === "60" &&
      event(swappedTuplets, 0)
        .source.querySelector("tuplet")
        ?.getAttribute("type") === "start" &&
      event(swappedTuplets, 2)
        .source.querySelector("tuplet")
        ?.getAttribute("type") === "stop",
  );
  let s = score([note("C") + note("D") + note("E") + rest(1, "quarter")]);

  s = editScore(s, edits.addHeadEdit(event(s, 0), event(s, 0).heads[0]));
  check("add a chord tone", midi(event(s, 0)) === "60,64");
  s = editScore(
    s,
    edits.pitchEdit(event(s, 0), event(s, 0).heads[1], {
      step: "F",
      octave: 4,
      alter: 0,
    }),
  );
  check("move one chord tone", midi(event(s, 0)) === "60,65");
  check(
    "automatic pitches follow the key",
    event(s, 0).heads.every((h) => !h.source.querySelector("accidental")),
  );
  s = editScore(
    s,
    edits.pitchEdit(
      event(s, 0),
      event(s, 0).heads[1],
      { step: "F", octave: 4, alter: 0 },
      true,
    ),
  );
  check(
    "retain explicitly requested natural",
    event(s, 0).heads[1].source.querySelector("accidental").textContent ===
      "natural",
  );
  s = editScore(s, edits.restEdit(event(s, 0), event(s, 0).heads[0]));
  check("promote the remaining chord tone", midi(event(s, 0)) === "65");
  s = editScore(s, edits.restEdit(event(s, 0)));
  check(
    "last head becomes a rest",
    !event(s, 0).heads.length && event(s, 1).start === 1,
  );
  s = relocate(s, 0, 2, 0, 0);
  check(
    "move into a rest without shifting its neighbors",
    midi(event(s, 0)) === "64" && !event(s, 2).heads.length,
  );
  s = editScore(s, edits.durationEdit(bar(s), event(s, 0), "eighth", 0));
  check(
    "shortening an event restores spare time as a rest",
    event(s, 1).duration === 0.5 &&
      !event(s, 1).heads.length &&
      event(s, 2).start === 1,
  );
  s = editScore(s, edits.durationEdit(bar(s), event(s, 0), "quarter", 0));
  check(
    "lengthening a note absorbs the adjacent rest",
    event(s, 1).start === 1 && midi(event(s, 1)) === "62",
  );

  for (const [a, n, length] of [
    [3, 2, 1],
    [4, 3, 3],
    [5, 4, 1],
    [7, 4, 1],
  ]) {
    s = score([rest(length, length === 3 ? "half" : "quarter")]);
    s = editScore(s, edits.divideTupletEdit(event(s, 0), a, n));
    const es = bar(s).events;
    check(
      `divide ${a}:${n} while preserving total duration`,
      es.length === a &&
        Math.abs(es.reduce((total, e) => total + e.duration, 0) - length) <
          1e-9 &&
        es[0].tuplet.actual === a,
    );
  }
  s = score([["C", "D", "E", "F"].map((x) => note(x)).join("")]);
  s = editScore(s, edits.groupTupletEdit(bar(s), bar(s).events, 4, 3));
  check(
    "group four selected notes into three quarters",
    bar(s).events.length === 5 && event(s, 4).start === 3,
  );
  s = editScore(s, edits.ungroupEdit(s.lanes[0], event(s, 1)));
  check(
    "ungroup and reclaim available time",
    bar(s).events.length === 4 && event(s, 3).start === 3,
  );
  const dotted = score([
    note("C", 3, "half").replace("</type>", "</type><dot/>") +
      rest(1, "quarter"),
  ]);
  const duplet = editScore(
    dotted,
    edits.divideTupletEdit(event(dotted, 0), 2, 3),
  );
  const across = editScore(
    duplet,
    edits.meterEdit(duplet, duplet.lanes[0], bar(duplet), {
      beats: 3,
      beatType: 8,
    }),
  );
  for (const selectedBar of [0, 1]) {
    const lane = across.lanes[0];
    const resolved = editScore(
      across,
      edits.ungroupEdit(lane, lane.bars[selectedBar].events[0]),
    );
    check(
      `ungroup the entire duplet from bar ${selectedBar + 1} after a meter change`,
      !resolved.document.querySelector("tuplet, time-modification") &&
        resolved.lanes[0].bars.map((b) => b.duration).join(",") ===
          "1.5,1.5,1" &&
        resolved.lanes[0].bars
          .slice(0, 2)
          .every(
            (b) =>
              b.events.length === 2 &&
              b.events[0].duration === 1 &&
              b.events[1].start === 1 &&
              b.events[1].duration === 0.5 &&
              !b.events[1].heads.length,
          ) &&
        across.document.querySelectorAll("tuplet").length === 2,
    );
  }
  const nested = editScore(across, (copy) => {
    for (const marker of across.document.querySelectorAll("tuplet")) {
      const inner = copy(marker).cloneNode(true);
      inner.setAttribute("number", "2");
      copy(marker).after(inner);
    }
  });
  let refusedNested = false;
  try {
    editScore(nested, edits.ungroupEdit(nested.lanes[0], event(nested, 0)));
  } catch (error) {
    refusedNested = error.message === "editConflict";
  }
  check(
    "refuse an ambiguous nested edit without dropping any bracket or timing",
    refusedNested &&
      nested.document.querySelectorAll("tuplet").length === 4 &&
      nested.document.querySelectorAll("time-modification").length === 2,
  );
  s = editScore(s, edits.clefEdit(bar(s), s.lanes[0], { sign: "F", line: 4 }));
  check(
    "edit clef without changing concert pitch",
    bar(s).clef.sign === "F" && midi(event(s, 0)) === "60",
  );
  s = editScore(
    s,
    edits.meterEdit(s, s.lanes[0], bar(s), { beats: 3, beatType: 4 }),
  );
  check(
    "rebar preserves every note",
    s.lanes[0].bars.length === 2 &&
      midi(s.lanes[0].bars[1].events[0]) === "65" &&
      bar(s).meter.beats === 3,
  );
  s = editScore(s, edits.repeatEdit(s, 0, 1, 2, false));
  check(
    "play the written repeat",
    timeline(s).targets.filter((t) => t.midis.includes(60)).length === 2,
  );

  s = score([
    note("C", 2, "half") +
      note("E", 1, "quarter", "<chord/>") +
      note("D", 2, "half"),
  ]);
  s = editScore(s, edits.restEdit(event(s, 0), event(s, 0).heads[0]));
  check(
    "retain the gap after promoting a shorter chord tone",
    midi(event(s, 0)) === "64" &&
      event(s, 1).duration === 1 &&
      !event(s, 1).heads.length &&
      event(s, 2).start === 2,
  );
  s = score(
    [
      note("C") +
        note("E", 1, "quarter", "<chord/>") +
        note("G", 1, "quarter", "<chord/>"),
    ],
    1,
  );
  const layout = layoutBar(
    bar(s),
    0,
    layoutScoreLine(s.lanes[0], 0, 350).bars[0],
  );
  check(
    "a single triad has finite SVG bounds",
    Number.isFinite(layout.width) &&
      Number.isFinite(layout.height) &&
      layout.events[0].heads.every(
        (h) => Number.isFinite(h.x) && Number.isFinite(h.y),
      ),
  );
  s = score([
    note("C", 1, "quarter", "", "<tie type='start'/>") +
      note("C", 1, "quarter", "", "<tie type='stop'/><tie type='start'/>"),
    note("C", 1, "quarter", "", "<tie type='stop'/>"),
  ]);
  const tiedLine = layoutScoreLine(s.lanes[0], 0, 350);
  check(
    "draw ties inside a bar and on both sides of a barline",
    s.lanes[0].bars.every(
      (b, i) => layoutBar(b, 0, tiedLine.bars[i]).ties.length === (i ? 1 : 2),
    ),
  );
  s = editScore(
    s,
    edits.pitchEdit(event(s, 1), event(s, 1).heads[0], {
      step: "D",
      octave: 4,
      alter: 0,
    }),
  );
  check(
    "dragging a tied pitch changes the complete chain",
    s.lanes[0].bars.every((b) => b.events.every((e) => midi(e) === "62")),
  );
  s = score([
    note("C") +
      "<barline location='right'><repeat direction='forward'/></barline>",
    note("D"),
    "<barline location='left'><repeat direction='backward'/></barline>" +
      note("E"),
  ]);
  s = editScore(s, range(s, 1, 1));
  check(
    "adjust repeats encoded on neighboring barlines",
    timeline(s)
      .visits.map((v) => v.barIndex)
      .join(",") === "0,1,1,1,2" &&
      s.document.querySelectorAll("repeat").length === 2,
  );
  s = editScore(s, edits.repeatEdit(s, 1, 1, 3, true));
  check(
    "remove both neighboring repeat signs",
    s.document.querySelectorAll("repeat").length === 0 &&
      timeline(s)
        .visits.map((v) => v.barIndex)
        .join(",") === "0,1,2",
  );
  s = score(
    [
      '<direction><sound tempo="90"/></direction>' + note("G"),
      ["C", "D", "E", "F"].map((x) => note(x)).join(""),
    ],
    4,
    true,
  );
  s = editScore(
    s,
    edits.meterEdit(s, s.lanes[0], bar(s), { beats: 3, beatType: 4 }),
  );
  check(
    "changing time keeps the upbeat and opening tempo",
    s.lanes[0].bars.map((b) => b.duration).join(",") === "1,3,1" &&
      s.document.querySelector("sound")?.getAttribute("tempo") === "90",
  );
  const single = score([note("C") + note("D") + note("E") + note("F")]);
  const spacious = layoutBar(
    bar(single),
    0,
    layoutScoreLine(single.lanes[0], 0, 800).bars[0],
  );
  check(
    "notes use the available staff width",
    spacious.width === 800 && spacious.events.at(-1).x > 700,
  );
  const chord = note("C") + note("E", 1, "quarter", "<chord/>");
  const original = score([chord, chord], 1);
  const link = edits.tieAction(original.lanes[0], 0, 0, 1);
  check(
    "offer a tie on the matching chord tone in the next bar",
    link && !link.linked,
  );
  s = editScore(original, link.change);
  const played = timeline(s).notes;
  check(
    "the tied tone has one attack and its chord neighbor still has two",
    played.filter((n) => n.midi === 64).length === 1 &&
      played.filter((n) => n.midi === 60).length === 2 &&
      s.document.querySelectorAll("tie").length === 2 &&
      s.document.querySelectorAll("tied").length === 2 &&
      original.document.querySelectorAll("tie,tied").length === 0,
  );
  const unlink = edits.tieAction(s.lanes[0], 0, 0, 1);
  check("offer removal at the start of the connection", unlink?.linked);
  s = editScore(s, unlink.change);
  check(
    "removing a tie restores the second attack",
    timeline(s).notes.filter((n) => n.midi === 64).length === 2 &&
      !s.document.querySelector("tied,tie"),
  );
  s = score([note("C").repeat(4)]);
  for (const i of [0, 2, 1])
    s = editScore(s, edits.tieAction(s.lanes[0], 0, i, 0).change);
  check(
    "link the two middle heads of existing ties",
    timeline(s).notes.length === 1,
  );
  s = editScore(s, edits.tieAction(s.lanes[0], 0, 1, 0).change);
  check(
    "breaking the middle tie preserves the entering and leaving connections",
    timeline(s).notes.length === 2 &&
      edits.tieAction(s.lanes[0], 0, 0, 0).linked &&
      edits.tieAction(s.lanes[0], 0, 2, 0).linked,
  );
  s = score([note("C") + rest(1, "quarter") + note("C")]);
  const gap = score([note("C"), note("C")]);
  check(
    "never offer a tie across a rest or unwritten silence",
    !edits.tieAction(s.lanes[0], 0, 0, 0) &&
      !edits.tieAction(gap.lanes[0], 0, 0, 0),
  );
  // Compare absolute attacks and releases, including repeat visits, for every
  // staff/voice. Different printed note counts are expected after adding ties.
  function performance(value) {
    return JSON.stringify(
      value.lanes.map((lane) => {
        const play = prepareScore(value, lane.id, {
          fromBar: 0,
          toBar: lane.bars.length - 1,
          semitones: 0,
          speed: 1,
          repeats: true,
        });
        return play.notes.map((n) => [
          n.midi,
          Math.round(n.startSec * 1e6),
          Math.round(n.endSec * 1e6),
        ]);
      }),
    );
  }
  const changeMeter = (value, beats, type = 4) =>
    editScore(
      value,
      edits.meterEdit(value, value.lanes[0], bar(value), {
        beats,
        beatType: type,
      }),
    );
  {
    const song = score([
      '<direction><sound tempo="60"/></direction>' +
        note("C", 4, "whole") +
        note("E", 4, "whole", "<chord/>") +
        note("G", 4, "whole", "<chord/>"),
      rest(1, "quarter") +
        note("D") +
        note("F", 2, "half") +
        note("A", 2, "half", "<chord/>"),
    ]);
    const chord = event(song, 0);
    song.practiceHeads = new Set([chord.heads[1].source]);
    song.sourceExcerpt = { image: new Blob(), page: 2 };
    const plan = timeline(song, 2);
    const targets = plan.targets.map(({ startSec, endSec, midis }) => [
      startSec,
      endSec,
      midis,
    ]);
    check(
      "transpose the selected chord tone, standalone note and full chord and keep the intervening rest",
      JSON.stringify(targets) ===
        JSON.stringify([
          [0, 4, [66]],
          [4, 5, []],
          [5, 6, [64]],
          [6, 8, [67, 71]],
        ]) &&
        plan.notes.map((n) => n.midi).join() === "66,64,67,71" &&
        midi(chord) === "60,64,67",
    );
    const edited = editScore(
      song,
      edits.pitchEdit(chord, chord.heads[1], {
        step: "F",
        octave: 4,
        alter: 0,
      }),
    );
    check(
      "keep the selected tone and source image through a pitch edit and preserve the undo revision",
      edited.sourceExcerpt === song.sourceExcerpt &&
        midi(event(edited, 0)) === "60,65,67" &&
        timeline(edited).targets[0].midis.join() === "65" &&
        timeline(song).targets[0].midis.join() === "64",
    );
    const split = changeMeter(song, 2);
    check(
      "keep the selected chord tone across both tied halves after changing the meter",
      performance(split) === performance(song) &&
        timeline(split).targets[0].midis.join() === "64" &&
        timeline(split).targets[0].endSec === 4,
    );
  }
  const attributes =
    "<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>";
  const ids =
    '<score-part id="P"><part-name>Piano</part-name></score-part><score-part id="Q"><part-name>Violin</part-name></score-part>';
  const backward =
    '<barline location="right"><repeat direction="backward" times="2"/></barline>';
  const secondVoice = note("A", 16, "whole")
    .replace("<voice>1</voice>", "<voice>2</voice>")
    .replace(
      "</note>",
      "<staff>2</staff><lyric><text>together</text></lyric></note>",
    );
  const pianoOne =
    attributes +
    '<barline location="left"><repeat direction="forward"/></barline><direction><sound tempo="100"/></direction>' +
    note("C", 8, "half") +
    note("E", 4, "quarter", "<chord/>") +
    note("F", 8, "half") +
    "<backup><duration>16</duration></backup>" +
    secondVoice;
  const pianoTwo =
    "<attributes><divisions>8</divisions><key><fifths>1</fifths></key></attributes><direction><direction-type><dynamics><f/></dynamics></direction-type></direction>" +
    note("D", 32, "whole") +
    "<backup><duration>32</duration></backup>" +
    note("B", 32, "whole")
      .replace("<voice>1</voice>", "<voice>2</voice>")
      .replace("</note>", "<staff>2</staff></note>") +
    backward;
  const violinOne = attributes + note("F", 16, "whole");
  const violinTwo = note("G", 16, "whole") + backward;
  for (const mode of ["partwise", "timewise"]) {
    const measures =
      mode === "partwise"
        ? `<part id="P"><measure number="1">${pianoOne}</measure><measure number="2">${pianoTwo}</measure></part><part id="Q"><measure number="1">${violinOne}</measure><measure number="2">${violinTwo}</measure></part>`
        : `<measure number="1"><part id="P">${pianoOne}</part><part id="Q">${violinOne}</part></measure><measure number="2"><part id="P">${pianoTwo}</part><part id="Q">${violinTwo}</part></measure>`;
    const initial = parseScoreXml(
      `<score-${mode}><part-list>${ids}</part-list>${measures}</score-${mode}>`,
    );
    const xml = new XMLSerializer().serializeToString(initial.document);
    const changed = changeMeter(initial, 3);
    check(
      `rebar ${mode} with multiple staves, parts, voices, unequal chord heads and repeats`,
      changed.lanes.length === 3 &&
        changed.lanes.every(
          (l) => l.bars.map((b) => b.duration).join(",") === "3,1,3,1",
        ) &&
        performance(changed) === performance(initial),
    );
    check(
      `preserve ${mode} notation and the undo snapshot`,
      changed.document.querySelectorAll("lyric").length === 1 &&
        changed.document.querySelectorAll("repeat").length === 3 &&
        changed.document.querySelectorAll("dynamics").length === 1 &&
        Array.from(changed.document.querySelectorAll("key")).some(
          (k) => k.textContent === "1",
        ) &&
        new XMLSerializer().serializeToString(initial.document) === xml,
    );
  }
  const four = score([
    note("C") + note("D") + note("E") + note("F"),
    note("G") + note("A") + note("B") + note("C"),
  ]);
  const three = changeMeter(four, 3);
  check(
    "carry later attacks across original barlines",
    three.lanes[0].bars.map((b) => b.duration).join(",") === "3,3,2" &&
      midi(three.lanes[0].bars[1].events[0]) === "65" &&
      performance(three) === performance(four),
  );
  const restored = changeMeter(three, 4);
  check(
    "growing the meter recombines the trailing partial bar",
    restored.lanes[0].bars.map((b) => b.duration).join(",") === "4,4" &&
      performance(restored) === performance(four),
  );
  const eighths = score([
    rest(2, "half") + rest(1, "quarter") + rest(1, "quarter"),
  ]);
  let tuplets = editScore(
    eighths,
    edits.divideTupletEdit(event(eighths, 0), 5, 4),
  );
  const tuple = bar(tuplets).events[3];
  tuplets = editScore(
    tuplets,
    edits.pitchEdit(tuple, undefined, { step: "E", octave: 4, alter: 0 }),
  );
  const cut = changeMeter(tuplets, 3, 8);
  check(
    "split a quintuplet passage at the exact new barline",
    performance(cut) === performance(tuplets) &&
      cut.document.querySelectorAll("tuplet[type=start]").length === 1 &&
      cut.document.querySelectorAll("tuplet[type=stop]").length === 1,
  );
  const boundary = score([
    note("D", 4, "whole"),
    "<attributes><time><beats>2</beats><beat-type>4</beat-type></time></attributes>" +
      note("E", 2, "half"),
  ]);
  const kept = changeMeter(boundary, 3);
  check(
    "restore the following meter and divisions",
    kept.lanes[0].bars.map((b) => b.meter.beats).join(",") === "3,3,2" &&
      performance(kept) === performance(boundary),
  );
  const tempoScore = score([
    '<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>60</per-minute></metronome></direction-type><sound tempo="120"><offset>3</offset></sound></direction>' +
      note("D").repeat(4),
  ]);
  const movedTempo = changeMeter(tempoScore, 2);
  check(
    "an offset sound still overrides its printed tempo across the new barline",
    performance(tempoScore) === performance(movedTempo),
  );
  const uneven = parseScoreXml(
    `<score-partwise><part-list>${ids}</part-list><part id="P"><measure number="1">${attributes}${note("C", 16, "whole")}</measure><measure number="2">${note("D", 16, "whole")}</measure></part><part id="Q"><measure number="1">${attributes}${note("E", 16, "whole")}</measure></part></score-partwise>`,
  );
  const unevenChanged = changeMeter(uneven, 3);
  check(
    "keep the original endpoint of a shorter part",
    unevenChanged.lanes[1].bars.map((b) => b.duration).join(",") === "3,1" &&
      performance(unevenChanged) === performance(uneven),
  );
  const decimals = score([
    note("C", 0.125, "32nd") +
      note("D", 0.875, "eighth").replace("</type>", "</type><dot/><dot/>") +
      note("E", 3, "half").replace("</type>", "</type><dot/>"),
  ]);
  const decimalMeter = changeMeter(decimals, 3);
  check(
    "rebar decimal MusicXML durations without changing their beat positions",
    decimalMeter.lanes[0].bars[0].events[1].start === 0.125 &&
      performance(decimalMeter) === performance(decimals),
  );
  const offsetOnly = score([
    '<direction><direction-type><words>Andante</words></direction-type><sound tempo="90"><offset>2.875</offset></sound></direction>' +
      note("E", 4, "whole"),
  ]);
  check(
    "include a decimal sound offset even when all note durations are integral",
    performance(changeMeter(offsetOnly, 2)) === performance(offsetOnly),
  );
  const decimalDivisions = score([
    "<attributes><divisions>2.5</divisions></attributes>" +
      note("C", 0.3125, "32nd") +
      note("D", 2.1875, "eighth").replace("</type>", "</type><dot/><dot/>") +
      '<sound tempo="90"><offset>-0.3125</offset></sound>' +
      note("E", 7.5, "half").replace("</type>", "</type><dot/>"),
  ]);
  check(
    "preserve a fractional tick in fractional divisions and a negative tempo offset",
    performance(changeMeter(decimalDivisions, 3)) ===
      performance(decimalDivisions),
  );
  return checked;
}

const builtIn = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  process.env.PROGRAMFILES &&
    path.join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
].filter(Boolean);
const executable =
  process.env.BROWSER_PATH ||
  builtIn.find((candidate) => fs.existsSync(candidate));
if (!executable) throw new Error("Set BROWSER_PATH to a Chromium executable.");
const output = fs.mkdtempSync(
  path.join(os.tmpdir(), "note-quiz-score-editor-"),
);
try {
  const entry = `
    import * as edits from './src/features/score-import/score-edits';
    import {keyEdit} from './src/features/score-import/signature-edit';
    import * as moves from './src/features/score-import/move-note';
    import {parseScoreXml} from './src/features/score-import/model';
    import {editScore} from './src/features/score-import/edit-history';
    import {prepareScore} from './src/features/score-import/timeline';
    import {layoutBar,layoutScoreLine} from './src/features/score-import/editor-layout';
    try {
      const checks = (${verify.toString()})({edits,keyEdit,moves,parseScoreXml,editScore,prepareScore,layoutBar,layoutScoreLine});
      document.body.textContent = JSON.stringify({checks});
    } catch(error) { document.body.textContent = JSON.stringify({error:error.stack}); }
  `;
  const root = path.join(__dirname, "..");
  buildSync({
    stdin: { contents: entry, resolveDir: root },
    outfile: path.join(output, "check.js"),
    bundle: true,
    platform: "browser",
    logLevel: "silent",
  });
  const page = path.join(output, "index.html");
  fs.writeFileSync(page, '<body><script src="check.js"></script></body>');
  const browser = spawnSync(
    executable,
    [
      "--headless",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--user-data-dir=" + path.join(output, "profile"),
      "--dump-dom",
      pathToFileURL(page).href,
    ],
    { encoding: "utf8", timeout: 30000 },
  );
  if (browser.error) throw browser.error;
  if (browser.status !== 0) throw new Error(browser.stderr);
  const body = browser.stdout.match(/<body>([\s\S]*?)<\/body>/)?.[1];
  if (!body) throw new Error("Browser returned no test results");
  const result = JSON.parse(body);
  if (result.error) throw new Error(result.error);
  console.log(result.checks.map((name) => "PASS " + name).join("\n"));
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
