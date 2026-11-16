import type { NavigationTranslations } from "./navigation";
import type { LearningTranslations } from "./learning";
import type { Translations } from "./translations";

export const esperantoNavigation: NavigationTranslations = {
  label: "Ĉefa navigado",
  home: "Hejmo",
  practice: "Bazaj ekzercoj",
  melody: "Melodiaj ekzercoj",
};

export const esperantoLearning: LearningTranslations = {
  chooseMode: "Elektu ekzercon",
  note: "Notlegado",
  ear: "Rekoni notojn aŭde",
  interval: "Intervaloj",
  intervalTask: "Nomoj de intervaloj",
  chord: "Akordoj",
  noteDescription:
    "Rekonu notojn sur la notliniaro. Elektu klefon, tonalon kaj amplekson, kaj ekzercu notlegadon sen konto.",
  earDescription:
    "Aŭskultu unu tonon kaj identigu la noton per la ekranaj klavoj aŭ notnomoj. Elektu la tonamplekson kaj ekzercu vian aŭdon sen konto.",
  intervalDescription:
    "Komparu du notojn aŭde aŭ sur la notliniaro. Komencu per pli alta, pli malalta aŭ samalta, poste ekzercu la rekonon de intervaloj sen konto.",
  chordDescription:
    "Rekonu akordojn aŭde aŭ sur la notliniaro. Ekzercu maĵorajn kaj minorajn akordojn, inversiojn kaj akordajn sinsekvojn sen konto.",
  sessionType: "Ekzercmaniero",
  ten: "10 demandoj · Rekomendita",
  free: "Libera ekzercado",
  timed: "Ekzercado kun tempolimo",
  progress: "Progreso",
  review: "Ripeti erarojn",
  restart: "Rekomenci kun la samaj agordoj",
  changePractice: "Ŝanĝi ekzercon aŭ malfacilecon",
  noMistakes: "Neniuj eraroj por ripeti. Provu la sekvan nivelon.",
  noAnswers: "Ankoraŭ neniuj respondoj. Komencu alian mallongan ekzercon.",
  reviewNotice:
    "Ripetado de eraroj estas aparta ekzerco kaj ne aldonas poentojn al la landa sumo.",
  leaderboardNotice:
    "Respondu almenaŭ 10 demandojn en notlegado por aldoni poentojn al la landa sumo. Aliaj ekzercoj kaj ripetado de eraroj ne sendas rezultojn al la ranglisto.",
  dailyNotice:
    "La ĉiutaga ekzerco konserviĝas en ĉi tiu retumilo kaj ne aldonas poentojn al la landa sumo.",
  audioError:
    "Ne eblis aktivigi la sonon. Kontrolu la sonagordojn kaj reprovu, aŭ elektu ekzercon per notskribo.",
  retryAudio: "Reprovi la sonon",
  next: "Sekva demando",
  finish: "Fini",
  answer: "Ĝusta respondo",
  yourAnswer: "Via respondo",
  returnPractice: "Reiri al ordinara ekzercado",
  preset: "Antaŭagordoj",
  treblePreset: "G-klefo · 10 notoj",
  bassPreset: "F-klefo · 10 notoj",
  directionPreset: "Pli alta aŭ pli malalta · 10 demandoj",
  intervalPreset: "Bazaj intervaloj · 10 demandoj",
  chordPreset: "Maĵora aŭ minora · 10 demandoj",
  difficulty: "Malfacileco",
  beginner: "Komencanta",
  basic: "Baza",
  advanced: "Altnivela",
  custom: "Propraj agordoj",
  listening: "Rekoni aŭde",
  reading: "Rekoni laŭ notskribo",
  task: "Celo de la ekzerco",
  direction: "Direkto de tonalto",
  quality: "Tipo de akordo",
  inversion: "Inversio",
  progression: "Akorda sinsekvo",
  playDirection: "Ordo de sonigo",
  ascending: "Suprenira",
  descending: "Malsuprenira",
  simultaneous: "Samtempe",
  arpeggio: "Unu tono post alia",
  example: "Aŭskulti ekzemplon",
  play: "Aŭskulti / ripeti",
  playingAudio: "Sonigado…",
  selectAnswer: "Elektu la ĝustan respondon.",
  components: "Notoj de la akordo",
  tonic: "Tonala kunteksto: unue sonas la toniko, poste la akorda sinsekvo.",
  semitones: "duontonoj",
  inversionHelp:
    "Unue sonas la baza tono kiel referenco, poste la akordo. Rekonu la inversion laŭ la plej malalta tono.",
  directionHelp:
    "Ĉu la dua tono estas pli alta, pli malalta aŭ samalta kiel la unua?",
  intervalAudioHelp:
    "Rekonu la distancon inter du tonoj. La tritono havas unu respondon sendepende de la notskribo.",
  intervalHelp:
    "Legante intervalojn, konsideru kaj la notnomojn kaj la distancon laŭ tonalto.",
  chordHelp:
    "Rekonu la tipon de akordo aŭ la pozicion de ĝia plej malalta tono, ne la nomon de la baza tono.",
  higher: "Pli alta",
  lower: "Pli malalta",
  same: "Samalta",
  root: "Baza pozicio",
  first: "Unua inversio",
  second: "Dua inversio",
  third: "Tria inversio",
  interval_P1: "Pura unuto",
  interval_m2: "Minora duto",
  interval_M2: "Maĵora duto",
  interval_m3: "Minora trito",
  interval_M3: "Maĵora trito",
  interval_P4: "Pura kvarto",
  interval_TT: "Tritono",
  interval_A4: "Pligrandigita kvarto",
  interval_d5: "Malpligrandigita kvinto",
  interval_P5: "Pura kvinto",
  interval_m6: "Minora sesto",
  interval_M6: "Maĵora sesto",
  interval_m7: "Minora septo",
  interval_M7: "Maĵora septo",
  interval_P8: "Pura okto",
  quality_major: "Maĵora triado",
  quality_minor: "Minora triado",
  quality_diminished: "Malpligrandigita triado",
  quality_augmented: "Pligrandigita triado",
  quality_maj7: "Maĵora septakordo",
  quality_dom7: "Dominanta septakordo",
  quality_min7: "Minora septakordo",
  quality_halfDim7: "Duonmalpligrandigita septakordo",
  quality_dim7: "Malpligrandigita septakordo",
  activeDaily: "Aktiva ĉiutaga ekzerco",
  daily: "10 demandoj por hodiaŭ",
  dailyDate:
    "Renoviĝas je 00:00 UTC. Por la sama reĝimo kaj nivelo, la hodiaŭaj demandoj estas la samaj.",
  dailyDone: "Finita en ĉi tiu retumilo",
  dailyStart: "Komenci la hodiaŭan ekzercon",
  normalPractice: "Ordinara ekzercado",
  history: "Lastaj ekzercoj kaj sekvaj paŝoj",
  localOnly:
    "Konserviĝas nur en ĉi tiu retumilo, sen sinkronigo. Ĝis 60 ekzercoj dum 30 tagoj kaj la plenumoj de ĉiutagaj ekzercoj dum 30 tagoj. Apartaj respondoj kaj sonregistraĵoj ne konserviĝas.",
  noHistory: "Finu ekzercon por vidi lastajn rezultojn.",
  insufficient: "Ankoraŭ tro malmultaj respondoj por sugesti, kion ripeti.",
  practiceType: "Ripeti ĉi tiun specon de ekzerco",
  clearHistory: "Forviŝi la ekzercohistorion",
  historyCleared: "La ekzercohistorio estas forviŝita.",
  storageUnavailable:
    "La retumila konservejo ne disponeblas. Vi povas ekzerci, sed via progreso ne konserviĝos.",
  complete: "Finita",
  stopped: "Finita antaŭtempe",
  share: "Kopii ligilon al la ekzerco",
  copied: "Ligilo kopiita. Ĝi transdonas nur la agordojn.",
  copyFailed: "Ne eblis kopii. Elektu kaj kopiu la suban ligilon.",
  sharedSettings:
    "La agordoj el la ligilo havas prioritaton. Nek la ekzerco nek la sono komenciĝas aŭtomate.",
  invalidSettings:
    "Kelkaj agordoj en la ligilo estis nevalidaj kaj anstataŭiĝis per sekuraj defaŭltaj valoroj.",
  expandSettings: "Pliaj agordoj",
  entryDescription:
    "Komencu per 10 demandoj, ripetu la erarojn kaj elektu la sekvan ekzercon.",
};

export const esperantoTranslations: Translations = {
  navigation: esperantoNavigation,
  learning: esperantoLearning,
  gameTitle: "Note Quiz",
  gameNavTitle: "Notlegado",
  brandDescription: "Lernu legi la notliniaron",
  startGame: "Komenci ekzercadon",
  pauseGame: "Paŭzigi",
  resumeGame: "Daŭrigi",
  endGame: "Fini ekzercadon",
  resetGame: "Rekomenci",
  settings: "Agordoj",
  practiceUi: {
    minimizeResults: "Faldi la rezultojn",
    viewResults: "Montri la rezultojn",
  },
  siteFooter: {
    about: "Pri ni",
    contact: "Kontakto",
    privacy: "Privateca politiko",
    terms: "Uzkondiĉoj",
    rights: "Ĉiuj rajtoj rezervitaj.",
  },
  gameStates: {
    idle: "Preta",
    playing: "Ekzercado",
    paused: "Paŭzigita",
    finished: "Finita",
  },
  clefs: {
    treble: "G-klefo",
    bass: "F-klefo",
    alto: "C-klefo sur la tria linio",
    tenor: "Tenora C-klefo",
    random: "Hazarda",
  },
  keySignatures: { major: "{key} maĵora", random: "Hazarda" },
  answerModes: {
    piano: "Pianaj klavoj",
    solfege: "Solfeĝo",
    microphone: "Mikrofono",
  },
  microphone: {
    title: "Enigo per mikrofono",
    signal: "Mikrofona signalo",
    signalQuiet: "Atendante sonon",
    signalActive: "Sono detektita",
    description:
      "Tenu la butonon premita kaj ludu unu noton. Malpremu ĝin aŭ movu la fokuson aliloken por sendi la respondon. Vi ankaŭ povas teni la spacoklavon aŭ Enter premita.",
    startListening: "Tenu premita por detekti",
    stopListening: "Malpremu por respondi",
    listening: "Aŭskultado",
    ready: "Preta",
    detectedNote: "Detektita noto",
    submitDetectedNote: "Sendi la detektitan noton",
    noNoteDetected: "Ankoraŭ neniu stabila noto detektita",
    permissionDenied: "Aliro al la mikrofono estis rifuzita.",
    unsupported: "Ĉi tiu retumilo ne subtenas enigon per mikrofono.",
    quietRoomHint: "Plej taŭgas kvieta ĉambro kaj unu daŭre tenata tono.",
  },
  difficulties: {
    easy: "Facila",
    medium: "Meza",
    hard: "Malfacila",
    expert: "Sperta",
  },
  settingsLabels: {
    clef: "Klefo",
    keySignature: "Tonalsignoj",
    octaveRange: "Oktavamplekso",
    octaveMin: "Minimumo",
    octaveMax: "Maksimumo",
    answerMode: "Respondmaniero",
    language: "Lingvo",
    enableSound: "Ŝalti sonon",
    timeLimit: "Tempolimo (sekundoj)",
    timeLimitEnable: "Limigi la tempon",
    resetToDefault: "Restarigi defaŭltojn",
    cancel: "Nuligi",
    apply: "Apliki",
    random: "Hazarda",
    staffRange: "Amplekso sur la notliniaro",
    ledgerLinesAbove: "Supraj kromlinioj",
    ledgerLinesBelow: "Malsupraj kromlinioj",
    ledgerLinesInstruction:
      "Pli da kromlinioj plivastigas la amplekson de la generataj notoj.",
    accidentals: "Kromsignoj",
    accidentalProbability: "Probablo de kromsignoj",
    resetAllStats: "Nuligi ĉiujn statistikojn",
  },
  scoreboard: {
    title: "Rezultoj",
    correct: "Ĝustaj",
    total: "Entute",
    accuracy: "Ĝusteco",
    gameResult: "Ekzercorezulto",
    finalScore: "Fina poentaro",
    finalAccuracy: "Fina ĝusteco",
    totalTime: "Tuta tempo",
    averageTime: "Meza tempo",
    overallStats: "Ĝeneralaj statistikoj",
    gamesPlayed: "Ekzercoj faritaj",
    overallAccuracy: "Ĝenerala ĝusteco",
    bestAccuracy: "Plej bona ĝusteco",
    bestTime: "Plej bona tempo",
    recentAnswers: "Lastaj respondoj",
    achievements: "Atingoj",
    sessionPoints: "Poentoj de la ekzerco",
    submission: {
      submitting: "Aldonante poentojn al la hodiaŭa landa sumo…",
      accepted: "Poentoj aldonitaj al la hodiaŭa landa sumo.",
      duplicate: "Ĉi tiu ekzerco jam estas enkalkulita.",
      ineligible: "Respondu almenaŭ 10 demandojn por aldoni poentojn.",
      failed:
        "La rezulto konserviĝis en ĉi tiu retumilo, sed ne eblis sendi la poentojn.",
    },
  },
  timer: {
    elapsed: "Pasinta tempo",
    remaining: "Restanta tempo",
    timeLimit: "tempolimo",
  },
  achievements: {
    perfect: "🏆 Perfekte!",
    excellent: "⭐ Bonege",
    good: "👍 Bone",
    endurance: "💪 Eltenemo",
    fast: "⚡ Rapide",
  },
  piano: {
    instruction: "Premu klavon por elekti noton",
    selectedNote: "Elektita noto",
  },
  solfege: {
    title: "Respondi per solfeĝo",
    instruction: "Premu notnomon por elekti noton",
    selectedNote: "Elektita noto",
    notes: {
      C: "Do",
      "C#": "Do♯",
      D: "Re",
      "D#": "Re♯",
      E: "Mi",
      F: "Fa",
      "F#": "Fa♯",
      G: "Sol",
      "G#": "Sol♯",
      A: "La",
      "A#": "La♯",
      B: "Si",
    },
  },
  messages: {
    whichNoteShown: "Kiu noto estas montrita?",
    correct: "Ĝuste!",
    incorrect: "Malĝuste",
    timeUp: "La tempo finiĝis!",
    gameComplete: "Ekzercado finita!",
    newRecord: "Nova rekordo!",
    correctAnswer: "Ĝusta respondo",
    yourAnswer: "Via respondo",
    playSound: "🔊 Sonigi",
    startGameInstruction: "Elektu la agordojn kaj premu «Komenci ekzercadon».",
    gameCompleteInstruction:
      "Ekzercado finita! Rigardu viajn rezultojn en la rezultpanelo.",
  },
  units: { seconds: "s", games: "ekzercoj", questions: "demandoj" },
  ui: {
    close: "Fermi",
    retry: "Reprovi",
    welcome: "Bonvenon al Note Quiz!",
    description: "Lernu rekoni notojn laŭ notskribo kaj aŭde!",
    features: {
      customSettings: "Agordeblaj ekzercoj",
      realTimeFeedback: "Tuja pritakso",
    },
    currentQuestionTime: "Tempo por la nuna demando",
    accidentalDescription:
      "Kiam kromsignoj estas ŝaltitaj, apartaj notoj povas ricevi ♯, ♭ aŭ ♮ sendepende de la tonalsignoj.",
    ledgerLinesDescription:
      "Pli da kromlinioj plivastigas la amplekson de la generataj notoj.",
  },
  home: {
    hero: {
      title: "Note Quiz",
      description: "Lernu rekoni notojn laŭ notskribo kaj aŭde!",
      sightReadingDescription:
        "Legu la noton sur la notliniaro kaj elektu ĝian nomon.",
      cta: "Komenci ekzercadon",
      previewTitle: "Antaŭrigardo de la ekzerco",
      previewSubtitle: "Legu, respondu kaj ripetu",
    },
    features: {
      title: "Ĉefaj ebloj",
      soundPlayback: {
        title: "Sonigo de notoj",
        description: "Aŭskultu la precizan tonalton de ĉiu noto dum lernado.",
      },
      variousClefs: {
        title: "Diversaj klefoj",
        description:
          "G-klefo, F-klefo kaj C-klefoj sur la tria kaj kvara linioj.",
      },
      instantFeedback: {
        title: "Tuja pritakso",
        description: "Tuj kontrolu viajn respondojn kaj lernu per ĉiu provo.",
      },
      multiLanguage: {
        title: "Pluraj lingvoj",
        description: "Disponebla en 11 lingvoj, inkluzive de Esperanto.",
      },
    },
    howToUse: {
      title: "Kiel ekzerci",
      step1: {
        title: "Komenci ekzercadon",
        description: "Premu «Komenci ekzercadon» por eklerni la notojn.",
      },
      step2: {
        title: "Rekonu la noton",
        description: "Rigardu la noton sur la notliniaro kaj aŭskultu ĝin.",
      },
      step3: {
        title: "Enigu respondon",
        description: "Respondu per la pianaj klavoj aŭ la notnomaj butonoj.",
      },
      step4: {
        title: "Daŭrigu la lernadon",
        description: "Solvu pliajn taskojn por legi notojn pli memfide.",
      },
    },
    faq: {
      title: "Oftaj demandoj",
      q1: {
        question: "Kio estas Note Quiz?",
        answer:
          "Note Quiz estas interaga ilo por ekzerci notlegadon. Notskribo kaj sono helpas vin pli rapide rekoni notojn.",
      },
      q2: {
        question: "Kiuj klefoj disponeblas?",
        answer:
          "G-klefo, F-klefo kaj C-klefoj sur la tria kaj kvara linioj. Vi povas ekzerci ĉiun aparte.",
      },
      q3: {
        question: "Ĉu mi povas ekzerci tonalsignojn?",
        answer:
          "Jes. Elektu la tonalsignojn en la agordoj aŭ ŝaltu hazardan elekton.",
      },
      q4: {
        question: "Kiuj lingvoj disponeblas?",
        answer:
          "Disponeblas 11 lingvoj: la angla, korea, japana, hispana, germana, franca, simpligita ĉina, brazila portugala, rusa, kartvela kaj Esperanto. Ĉe paĝoj sen lingva prefikso, la lingvo elektiĝas laŭ la retumilaj agordoj. Vi ankaŭ povas ŝanĝi ĝin permane.",
      },
      q5: {
        question: "Ĉu necesas pagi?",
        answer:
          "Ne. Note Quiz estas senpaga kaj uzebla sen registriĝo aŭ pago.",
      },
      q6: {
        question: "Ĉu mi povas ekzerci per telefono?",
        answer:
          "Jes. Note Quiz adaptiĝas al la ekranoj de telefonoj, tabulkomputiloj kaj komputiloj.",
      },
    },
    about: {
      title: "Pri Note Quiz",
      description1:
        "Note Quiz helpas muziklernantojn pli rapide rekoni notojn en partituro.",
      description2:
        "Se vi lernas buŝharmonikon, pianon aŭ kantadon kaj malfacile legas notojn, vi povas ekzerci ĉi tie per ludaj taskoj.",
      description3:
        "Notskribo, preciza sonigo kaj tuja responda kontrolo helpas la lernadon. Diversaj klefoj, tonalsignoj kaj kromsignoj taŭgas por malsamaj niveloj.",
      description4:
        "Plibonigu vian notlegadon per Note Quiz kaj ĝuu la muziklernadon!",
    },
    cta: {
      title: "Komencu nun",
      description: "Legu notojn pli memfide kaj ĝuu muzikon.",
      button: "Komenci ekzercadon",
    },
    footer: {
      copyright: "© 2024 Note Quiz. Ĉiuj rajtoj rezervitaj.",
      tagline: "Interagaj ekzercoj por rekoni notojn",
    },
  },
  leaderboard: {
    navTitle: "Ranglisto",
    eyebrow: "Monda ranglisto",
    title: "Hodiaŭa landa ranglisto",
    description:
      "Poentoj el ordinara notlega ekzercado sumiĝas laŭ landoj. La rangoj baziĝas sur la tuta poentaro de la nuna UTC-tago.",
    accumulationPeriod: "Kalkulperiodo",
    scoresResetDaily: "La poentaro nuliĝas ĉiutage.",
    yourCountry: "Via lando",
    detectingCountry: "Detektante la landon",
    countryCode: "Landokodo",
    privacyNote:
      "La servilo determinas la landon nur por grupigi la rangliston. Originaj IP-adresoj ne konserviĝas. Anonimaj ekzerco-kvitancoj konserviĝas dum 7 tagoj, kaj ĉiutagaj sumoj dum 90 tagoj.",
    countryRankings: "Ranglisto laŭ landoj",
    loading: "Ŝargante la rangliston…",
    empty:
      "Ankoraŭ neniuj poentoj en la ranglisto. Finu ekzercon por aldoni rezulton.",
    error: "Ne eblis ŝargi la rangliston.",
    columns: {
      rank: "Rango",
      country: "Lando",
      code: "Kodo",
      totalScore: "Landa poentaro",
      submissions: "Sendoj",
      averageAccuracy: "Meza ĝusteco",
      updated: "Ĝisdatigita",
    },
  },
  earTraining: {
    title: "Aŭda trejnado",
    subtitle: "Ekzercado de absoluta aŭdo",
    description:
      "Aŭskultu la tonon kaj identigu la noton kiel eble plej rapide.",
    settings: "Agordoj",
    replay: "Reaŭskulti la noton",
    start: "Komenci ekzercon",
    restart: "Rekomenci",
    stop: "Fini ekzercon",
    listenPrompt: "Aŭskultu la tonon kaj elektu la ĝustan respondon.",
    currentTarget: "Nuna amplekso",
    session: { practice: "Libera ekzercado", timed: "Kun tempolimo" },
    noteSet: {
      title: "Notaro",
      natural: "Naturaj notoj",
      chromatic: "Kromata",
    },
    inputMode: {
      title: "Respondmaniero",
      piano: "Piano",
      solfege: "Solfeĝo",
    },
    result: {
      title: "Ekzercorezulto",
      replayCount: "Reaŭskultoj",
      averageTime: "Meza tempo",
      bestAccuracy: "Plej bona ĝusteco",
      sessionsPlayed: "Ekzercoj faritaj",
    },
  },
};
