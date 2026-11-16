import type { BasicHomeCopy, HomeCopy } from "./home";

export const esperantoHome: HomeCopy = {
  title: "Legu, aŭskultu kaj ludu la notojn",
  introduction: "Elektu mallongan ekzercon aŭ sekvu ok-taktan melodion.",
  access: "Senpaga · Sen konto",
  basicHint: "Unu demando samtempe",
  modeDescriptions: {
    note: "Nomu la noton sur la notliniaro",
    ear: "Identigu la noton, kiun vi aŭdas",
    interval: "Rekonu la distancon inter notoj",
    chord: "Rekonu akordojn kaj akordajn sinsekvojn",
  },
  melodyDescription:
    "Sekvu novan ok-taktan partituron kaj ludu po unu noto en vian mikrofonon.",
  melodyFeatures: "Piana ekzemplo · Metronomo · Agordebla tempo",
  melodyAction: "Ekzerci melodion",
  howTitle: "Elektu vian ekzercmanieron",
  steps: [
    {
      title: "Elektu ekzercon",
      description:
        "En bazaj ekzercoj respondu apartajn demandojn; en melodiaj ekzercoj ludu notojn laŭ ritmo.",
    },
    {
      title: "Agordu la amplekson",
      description:
        "Elektu la malfacilecon kaj enhavon en la agordoj. Por melodioj vi ankaŭ povas agordi la tempon kaj taktospecon.",
    },
    {
      title: "Aŭskultu, respondu kaj reprovu",
      description:
        "Kontrolu viajn respondojn kaj ripetu kun la samaj agordoj. Antaŭ melodia ekzerco, vi povas aŭskulti pianan ekzemplon.",
    },
  ],
  faqTitle: "Antaŭ ol komenci",
  faq: [
    {
      question: "Ĉu mi bezonas konton?",
      answer: "Ne. Vi povas uzi Note Quiz senpage kaj sen registriĝo.",
    },
    {
      question: "Ĉu mi bezonas mikrofonon?",
      answer:
        "En bazaj ekzercoj vi povas respondi per la ekranaj klavoj aŭ la respondelektoj. Melodiaj ekzercoj uzas mikrofonon kaj akceptas nur unu noton samtempe.",
    },
    {
      question: "Kiel kreiĝas la melodioj?",
      answer:
        "Ĉiu nova ok-takta melodio uzas la elektitajn tonalon, tonamplekson, taktospecon kaj notdaŭrojn. Aŭskultu ekzemplon aŭ ŝaltu la metronomon antaŭ ol ekzerci.",
    },
    {
      question: "Ĉu la mikrofona sono konserviĝas?",
      answer:
        "La mikrofona sono analiziĝas loke en via retumilo. Ĝi ne estas registrata nek alŝutata. Permesu aliron al la mikrofono, kiam la retumilo petas ĝin.",
    },
  ],
  metaTitle: "Note Quiz | Notlegado, aŭda trejnado kaj melodiaj ekzercoj",
  metaDescription:
    "Ekzercu notojn, intervalojn kaj akordojn, aŭ ludu ok-taktan melodion per via mikrofono. Senpage, kun pianaj ekzemploj kaj metronomo. Sen konto.",
};

export const esperantoBasicHome: BasicHomeCopy = {
  introduction:
    "Ekzercu notlegadon kaj rekonu notojn, intervalojn kaj akordojn aŭde, po unu demando.",
  steps: [
    {
      title: "Elektu ekzercon",
      description:
        "Elektu notlegadon, rekonon de notoj aŭde, intervalojn aŭ akordojn.",
    },
    {
      title: "Agordu la amplekson",
      description: "Elektu la malfacilecon kaj enhavon en la agordoj.",
    },
    {
      title: "Aŭskultu, respondu kaj reprovu",
      description: "Kontrolu viajn respondojn kaj ripetu kun la samaj agordoj.",
    },
  ],
  faq: [
    {
      question: "Ĉu mi bezonas konton?",
      answer: "Ne. Vi povas uzi Note Quiz senpage kaj sen registriĝo.",
    },
    {
      question: "Ĉu mi bezonas mikrofonon?",
      answer:
        "Ne. Vi povas respondi per la ekranaj klavoj aŭ la respondelektoj.",
    },
    {
      question: "Ĉu la mikrofona sono konserviĝas?",
      answer:
        "La mikrofona sono analiziĝas loke en via retumilo. Ĝi ne estas registrata nek alŝutata. Permesu aliron al la mikrofono, kiam la retumilo petas ĝin.",
    },
  ],
  metaTitle: "Note Quiz | Notlegado kaj aŭda trejnado",
  metaDescription:
    "Ekzercu notojn, intervalojn kaj akordojn laŭ notskribo kaj aŭde. Respondu per la ekranaj klavoj aŭ la respondelektoj. Senpage kaj sen registriĝo.",
};
