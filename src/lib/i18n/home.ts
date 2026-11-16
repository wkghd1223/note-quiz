import { russianBasicHome, russianHome } from "./home-ru";
import { georgianBasicHome, georgianHome } from "./home-ka";
import { esperantoBasicHome, esperantoHome } from "./home-eo";
import { portugueseBasicHome, portugueseHome } from "./home-pt";
import type { TrainingMode } from "@/lib/practice/types";

export interface HomeCopy {
  title: string;
  introduction: string;
  access: string;
  basicHint: string;
  modeDescriptions: Record<TrainingMode, string>;
  melodyDescription: string;
  melodyFeatures: string;
  melodyAction: string;
  howTitle: string;
  steps: readonly { title: string; description: string }[];
  faqTitle: string;
  faq: readonly { question: string; answer: string }[];
  metaTitle: string;
  metaDescription: string;
}

export type BasicHomeCopy = Pick<
  HomeCopy,
  "introduction" | "steps" | "faq" | "metaTitle" | "metaDescription"
>;

const en: HomeCopy = {
  title: "Read, hear and play the notes",
  introduction: "Choose a short exercise or follow an eight-bar melody.",
  access: "Free · No account needed",
  basicHint: "One question at a time",
  modeDescriptions: {
    note: "Name the note on the staff",
    ear: "Identify the note you hear",
    interval: "Recognize the distance between notes",
    chord: "Recognize chords and progressions",
  },
  melodyDescription:
    "Follow a new eight-bar score and play one note at a time into your microphone.",
  melodyFeatures: "Piano example · Metronome · Adjustable tempo",
  melodyAction: "Practice a melody",
  howTitle: "Find your way to practice",
  steps: [
    {
      title: "Choose an exercise",
      description:
        "Use basic practice for individual questions, or melody practice to play notes in rhythm.",
    },
    {
      title: "Set your range",
      description:
        "Choose the difficulty and material in Settings. Melody practice also lets you set tempo and meter.",
    },
    {
      title: "Listen, answer and try again",
      description:
        "Check your answers and repeat with the same settings. For melodies, listen to the piano example first.",
    },
  ],
  faqTitle: "Before you start",
  faq: [
    {
      question: "Do I need an account?",
      answer: "No. You can use Note Quiz for free without signing up.",
    },
    {
      question: "Do I need a microphone?",
      answer:
        "Basic practice lets you answer with the on-screen keys or choices. Melody practice uses a microphone and accepts one note at a time.",
    },
    {
      question: "How are melodies made?",
      answer:
        "Each new eight-bar melody uses your selected key, pitch range, meter and note lengths. Listen to an example or turn on the metronome before practicing.",
    },
    {
      question: "Is microphone audio stored?",
      answer:
        "Microphone audio is analyzed in your browser. It is not recorded or uploaded. Allow microphone access when your browser asks.",
    },
  ],
  metaTitle: "Note Quiz | Sight-reading, ear training and melody practice",
  metaDescription:
    "Practice notes, intervals and chords, or play an eight-bar melody through your microphone. Free, with piano examples and a metronome. No account needed.",
};

const ko: HomeCopy = {
  title: "음표를 읽고, 듣고, 연주해 보세요",
  introduction: "한 문제씩 익히거나, 8마디 멜로디를 따라 연주해 보세요.",
  access: "무료 · 회원가입 없음",
  basicHint: "한 문제씩 차근차근",
  modeDescriptions: {
    note: "악보에 표시된 음 맞히기",
    ear: "듣고 어떤 음인지 맞히기",
    interval: "두 음 사이의 간격 익히기",
    chord: "화음과 코드 진행 익히기",
  },
  melodyDescription:
    "새로운 8마디 악보를 따라 연주하세요. 마이크로 한 번에 한 음씩 입력합니다.",
  melodyFeatures: "피아노 예시 · 메트로놈 · 빠르기 조절",
  melodyAction: "멜로디 연습하기",
  howTitle: "이렇게 연습해 보세요",
  steps: [
    {
      title: "연습 고르기",
      description:
        "한 음씩 익히려면 기초 연습을, 리듬에 맞춰 이어 연주하려면 멜로디 연습을 고르세요.",
    },
    {
      title: "범위 맞추기",
      description:
        "설정에서 난이도와 연습할 범위를 고르세요. 멜로디는 빠르기와 박자도 조절할 수 있습니다.",
    },
    {
      title: "듣고, 풀고, 다시 연습하기",
      description:
        "답을 확인하고 같은 설정으로 다시 연습해 보세요. 멜로디는 피아노 예시를 듣고 시작할 수 있습니다.",
    },
  ],
  faqTitle: "시작하기 전에",
  faq: [
    {
      question: "회원가입이 필요한가요?",
      answer: "가입이나 결제 없이 바로 연습할 수 있습니다.",
    },
    {
      question: "마이크가 꼭 필요한가요?",
      answer:
        "기초 연습은 화면의 건반이나 보기로 답할 수 있습니다. 멜로디 연습은 마이크가 필요하며, 한 번에 한 음씩 입력합니다.",
    },
    {
      question: "멜로디는 어떻게 만들어지나요?",
      answer:
        "선택한 조표·음역·박자·음표 길이로 8마디를 새로 만듭니다. 예시를 먼저 듣거나 메트로놈을 켜고 연습해 보세요.",
    },
    {
      question: "마이크 소리는 저장되나요?",
      answer:
        "마이크 소리는 브라우저에서 분석하며 녹음하거나 업로드하지 않습니다. 브라우저가 권한을 물으면 마이크 사용을 허용해 주세요.",
    },
  ],
  metaTitle: "Note Quiz | 음표 읽기·소리 맞히기·멜로디 연습",
  metaDescription:
    "음표, 음정, 화음을 익히고 마이크로 8마디 멜로디를 연습하세요. 피아노 예시와 메트로놈을 제공하며, 가입 없이 무료로 이용할 수 있습니다.",
};

const ja: HomeCopy = {
  title: "音符を読んで、聴いて、演奏しよう",
  introduction:
    "一問ずつ練習することも、8小節のメロディーを続けて演奏することもできます。",
  access: "無料 · 登録不要",
  basicHint: "一問ずつ練習",
  modeDescriptions: {
    note: "楽譜に表示された音を答える",
    ear: "聴こえた音を答える",
    interval: "2つの音の間隔を見分ける",
    chord: "和音やコード進行を見分ける",
  },
  melodyDescription:
    "新しく作られた8小節の楽譜に沿って演奏しましょう。マイクで一度に1音ずつ入力します。",
  melodyFeatures: "ピアノのお手本 · メトロノーム · テンポ調整",
  melodyAction: "メロディーを練習",
  howTitle: "練習の進め方",
  steps: [
    {
      title: "練習を選ぶ",
      description:
        "一問ずつ取り組むなら基礎練習、リズムに合わせて続けて演奏するならメロディー練習を選びましょう。",
    },
    {
      title: "練習範囲を決める",
      description:
        "設定で難易度や練習内容を選べます。メロディー練習ではテンポや拍子も調整できます。",
    },
    {
      title: "聴いて、答えて、繰り返す",
      description:
        "答えを確認したら、同じ設定でもう一度練習してみましょう。メロディーは先にピアノのお手本を聴くことができます。",
    },
  ],
  faqTitle: "始める前に",
  faq: [
    {
      question: "アカウントは必要ですか？",
      answer: "いいえ。会員登録なしで無料で利用できます。",
    },
    {
      question: "マイクは必要ですか？",
      answer:
        "基礎練習は画面の鍵盤や選択肢で回答できます。メロディー練習にはマイクが必要で、一度に1音ずつ入力します。",
    },
    {
      question: "メロディーはどのように作られますか？",
      answer:
        "選んだ調・音域・拍子・音符の長さに合わせて、8小節のメロディーを毎回ランダムに生成します。お手本を聴いたり、必要に応じてメトロノームを使ったりして練習できます。",
    },
    {
      question: "マイクの音は保存されますか？",
      answer:
        "マイクの音はブラウザー内で解析され、録音もアップロードもされません。ブラウザーに許可を求められたら、マイクの使用を許可してください。",
    },
  ],
  metaTitle: "Note Quiz | 読譜・聴音・メロディー練習",
  metaDescription:
    "音符・音程・和音を学び、マイクを使って8小節のメロディーを練習。ピアノのお手本とメトロノーム付き。登録不要で無料で利用できます。",
};

const es: HomeCopy = {
  title: "Lee, escucha y toca las notas",
  introduction:
    "Practica con ejercicios breves o toca una melodía de ocho compases.",
  access: "Gratis · Sin registro",
  basicHint: "Una pregunta a la vez",
  modeDescriptions: {
    note: "Nombra la nota del pentagrama",
    ear: "Identifica la nota que escuchas",
    interval: "Reconoce la distancia entre dos notas",
    chord: "Reconoce acordes y progresiones",
  },
  melodyDescription:
    "Sigue una nueva partitura de ocho compases y toca una nota a la vez usando el micrófono.",
  melodyFeatures: "Ejemplo al piano · Metrónomo · Tempo ajustable",
  melodyAction: "Practicar una melodía",
  howTitle: "Cómo practicar",
  steps: [
    {
      title: "Elige un ejercicio",
      description:
        "Elige la práctica básica para responder preguntas individuales o las melodías para tocar siguiendo el ritmo.",
    },
    {
      title: "Ajusta la práctica",
      description:
        "Elige la dificultad y el contenido en Ajustes. En las melodías también puedes ajustar el tempo y el compás.",
    },
    {
      title: "Escucha, responde y repite",
      description:
        "Comprueba tus respuestas y vuelve a practicar con los mismos ajustes. Para las melodías, puedes escuchar primero el ejemplo al piano.",
    },
  ],
  faqTitle: "Antes de empezar",
  faq: [
    {
      question: "¿Necesito una cuenta?",
      answer: "No. Puedes usar Note Quiz gratis y sin registrarte.",
    },
    {
      question: "¿Necesito un micrófono?",
      answer:
        "En la práctica básica puedes responder con las teclas en pantalla o las opciones de respuesta. Para practicar melodías necesitas un micrófono, que capta una nota a la vez.",
    },
    {
      question: "¿Cómo se crean las melodías?",
      answer:
        "Cada nueva melodía de ocho compases se genera aleatoriamente con la tonalidad, el registro, el compás y las duraciones de las notas que elijas. Puedes escuchar un ejemplo o activar el metrónomo para practicar.",
    },
    {
      question: "¿Se guarda el audio del micrófono?",
      answer:
        "El audio del micrófono se analiza en tu navegador. No se graba ni se sube a ningún servidor. Cuando el navegador lo solicite, permite el acceso al micrófono.",
    },
  ],
  metaTitle: "Note Quiz | Lectura musical, entrenamiento auditivo y melodías",
  metaDescription:
    "Practica notas, intervalos y acordes, o toca una melodía de ocho compases con el micrófono. Gratis, con ejemplos al piano y metrónomo. Sin registro.",
};

const de: HomeCopy = {
  title: "Noten lesen, hören und spielen",
  introduction:
    "Wähle eine kurze Übung oder spiele eine Melodie mit acht Takten.",
  access: "Kostenlos · Ohne Anmeldung",
  basicHint: "Eine Frage nach der anderen",
  modeDescriptions: {
    note: "Benenne die Note im Notensystem",
    ear: "Erkenne den Ton, den du hörst",
    interval: "Erkenne den Abstand zwischen zwei Tönen",
    chord: "Erkenne Akkorde und Akkordfolgen",
  },
  melodyDescription:
    "Spiele eine neue Melodie mit acht Takten nach Noten. Über das Mikrofon wird jeweils ein einzelner Ton erfasst.",
  melodyFeatures: "Klavierbeispiel · Metronom · Tempo einstellbar",
  melodyAction: "Melodie üben",
  howTitle: "So kannst du üben",
  steps: [
    {
      title: "Übung wählen",
      description:
        "In den Grundübungen beantwortest du einzelne Fragen. Bei den Melodieübungen spielst du mehrere Töne im Rhythmus nacheinander.",
    },
    {
      title: "Übung anpassen",
      description:
        "Wähle Schwierigkeit und Übungsinhalt in den Einstellungen. Bei Melodien kannst du auch Tempo und Taktart einstellen.",
    },
    {
      title: "Hören, antworten und wiederholen",
      description:
        "Prüfe deine Antworten und übe mit denselben Einstellungen weiter. Bei Melodien kannst du dir zuerst das Klavierbeispiel anhören.",
    },
  ],
  faqTitle: "Bevor du beginnst",
  faq: [
    {
      question: "Brauche ich ein Konto?",
      answer: "Nein. Du kannst Note Quiz kostenlos und ohne Anmeldung nutzen.",
    },
    {
      question: "Brauche ich ein Mikrofon?",
      answer:
        "Bei den Grundübungen antwortest du über die Tasten auf dem Bildschirm oder die Antwortmöglichkeiten. Für Melodieübungen brauchst du ein Mikrofon. Dabei wird jeweils ein einzelner Ton erfasst.",
    },
    {
      question: "Wie entstehen die Melodien?",
      answer:
        "Jede neue Melodie mit acht Takten wird zufällig aus der gewählten Tonart, dem Tonumfang, der Taktart und den Notenwerten erzeugt. Du kannst dir ein Beispiel anhören oder zum Üben das Metronom einschalten.",
    },
    {
      question: "Wird das Mikrofon-Audio gespeichert?",
      answer:
        "Das Mikrofon-Audio wird direkt in deinem Browser analysiert. Es wird weder aufgenommen noch hochgeladen. Erlaube den Mikrofonzugriff, wenn dein Browser danach fragt.",
    },
  ],
  metaTitle: "Note Quiz | Notenlesen, Gehörbildung und Melodieübungen",
  metaDescription:
    "Übe Noten, Intervalle und Akkorde oder spiele eine Melodie mit acht Takten über dein Mikrofon. Kostenlos, mit Klavierbeispielen und Metronom. Ohne Anmeldung.",
};

const fr: HomeCopy = {
  title: "Lisez, écoutez et jouez les notes",
  introduction:
    "Choisissez un exercice court ou jouez une mélodie de huit mesures.",
  access: "Gratuit · Sans inscription",
  basicHint: "Une question à la fois",
  modeDescriptions: {
    note: "Nommez la note sur la portée",
    ear: "Identifiez la note entendue",
    interval: "Reconnaissez la distance entre deux notes",
    chord: "Reconnaissez les accords et leurs enchaînements",
  },
  melodyDescription:
    "Suivez une nouvelle partition de huit mesures et jouez une seule note à la fois devant votre microphone.",
  melodyFeatures: "Exemple au piano · Métronome · Tempo réglable",
  melodyAction: "Jouer une mélodie",
  howTitle: "Comment vous entraîner",
  steps: [
    {
      title: "Choisissez un exercice",
      description:
        "Les exercices de base proposent des questions individuelles. Les mélodies vous permettent d'enchaîner les notes en rythme.",
    },
    {
      title: "Adaptez l'exercice",
      description:
        "Choisissez la difficulté et le contenu dans les réglages. Pour les mélodies, vous pouvez aussi régler le tempo et la mesure.",
    },
    {
      title: "Écoutez, répondez et recommencez",
      description:
        "Vérifiez vos réponses et recommencez avec les mêmes réglages. Pour les mélodies, vous pouvez d'abord écouter l'exemple au piano.",
    },
  ],
  faqTitle: "Avant de commencer",
  faq: [
    {
      question: "Faut-il créer un compte ?",
      answer: "Non. Note Quiz est gratuit et ne nécessite aucune inscription.",
    },
    {
      question: "Faut-il un microphone ?",
      answer:
        "Pour les exercices de base, vous répondez avec les touches à l'écran ou les choix proposés. Les mélodies nécessitent un microphone et se jouent une seule note à la fois.",
    },
    {
      question: "Comment les mélodies sont-elles créées ?",
      answer:
        "Chaque nouvelle mélodie de huit mesures est générée aléatoirement selon la tonalité, la tessiture, la mesure et les durées de notes choisies. Vous pouvez écouter un exemple ou activer le métronome pour vous entraîner.",
    },
    {
      question: "Le son du microphone est-il conservé ?",
      answer:
        "Le son du microphone est analysé dans votre navigateur. Il n'est ni enregistré ni envoyé sur un serveur. Autorisez l'accès au microphone lorsque votre navigateur vous le demande.",
    },
  ],
  metaTitle: "Note Quiz | Lecture de notes, formation de l'oreille et mélodies",
  metaDescription:
    "Travaillez les notes, les intervalles et les accords, ou jouez une mélodie de huit mesures au microphone. Gratuit, avec exemples au piano et métronome. Sans inscription.",
};

const zh: HomeCopy = {
  title: "识谱、听音，动手演奏",
  introduction: "可以从一道道小练习开始，也可以跟着乐谱演奏八小节旋律。",
  access: "免费 · 无需注册",
  basicHint: "一次练一题",
  modeDescriptions: {
    note: "认出五线谱上的音符",
    ear: "辨认听到的音",
    interval: "辨认两个音之间的距离",
    chord: "辨认和弦与和弦进行",
  },
  melodyDescription: "跟着新生成的八小节乐谱演奏，通过麦克风一次输入一个音。",
  melodyFeatures: "钢琴示范 · 节拍器 · 速度可调",
  melodyAction: "练习旋律",
  howTitle: "这样开始练习",
  steps: [
    {
      title: "选择练习",
      description:
        "想逐题练习，可以选择基础练习；想按节奏连续演奏，可以选择旋律练习。",
    },
    {
      title: "调整练习范围",
      description: "在设置中选择难度和练习内容。旋律练习还可以调整速度和拍号。",
    },
    {
      title: "听一听，答一答，再练一次",
      description:
        "查看答案后，可以沿用相同设置再次练习。练习旋律时，可以先听钢琴示范。",
    },
  ],
  faqTitle: "开始前了解一下",
  faq: [
    {
      question: "需要注册账号吗？",
      answer: "不需要。无需注册，即可免费使用 Note Quiz。",
    },
    {
      question: "一定需要麦克风吗？",
      answer:
        "基础练习可以通过屏幕上的琴键或选项作答。旋律练习需要麦克风，一次只能输入一个音。",
    },
    {
      question: "旋律是怎样生成的？",
      answer:
        "系统会根据所选的调性、音域、拍号和音符时值，每次随机生成八小节旋律。可以先听示范，也可以按需开启节拍器辅助练习。",
    },
    {
      question: "麦克风声音会被保存吗？",
      answer:
        "麦克风声音仅在浏览器本地分析，不会录音或上传。浏览器询问权限时，请允许使用麦克风。",
    },
  ],
  metaTitle: "Note Quiz | 识谱、听音与旋律练习",
  metaDescription:
    "练习音符、音程与和弦，或通过麦克风演奏八小节旋律。提供钢琴示范和节拍器，无需注册，免费使用。",
};

const homeTranslations: Record<Language, HomeCopy> = {
  pt: portugueseHome,
  ru: russianHome,
  ka: georgianHome,
  eo: esperantoHome,
  en,
  ko,
  ja,
  es,
  de,
  fr,
  zh,
};

const basicHomeTranslations: Record<Language, BasicHomeCopy> = {
  en: {
    introduction:
      "Practice reading notes and recognizing pitches, intervals and chords, one question at a time.",
    steps: [
      {
        ...en.steps[0],
        description: "Choose note, ear, interval or chord practice.",
      },
      {
        ...en.steps[1],
        description: "Choose the difficulty and material in Settings.",
      },
      {
        ...en.steps[2],
        description: "Check your answers and repeat with the same settings.",
      },
    ],
    faq: [
      en.faq[0],
      {
        ...en.faq[1],
        answer: "No. You can answer with the on-screen keys or answer choices.",
      },
      en.faq[3],
    ],
    metaTitle: "Note Quiz | Sight-reading and ear training",
    metaDescription:
      "Practice notes, intervals and chords with reading and listening exercises. Answer with on-screen keys or choices. Free, with no account needed.",
  },
  ko: {
    introduction: "음표, 음정, 화음을 한 문제씩 익혀 보세요.",
    steps: [
      {
        ...ko.steps[0],
        description:
          "음표 읽기, 소리 맞히기, 두 음 비교, 화음 맞히기 중에서 고르세요.",
      },
      {
        ...ko.steps[1],
        description: "설정에서 난이도와 연습할 범위를 고르세요.",
      },
      {
        ...ko.steps[2],
        description: "답을 확인하고 같은 설정으로 다시 연습해 보세요.",
      },
    ],
    faq: [
      ko.faq[0],
      {
        ...ko.faq[1],
        answer: "아니요. 화면의 건반이나 보기로 답할 수 있습니다.",
      },
      ko.faq[3],
    ],
    metaTitle: "Note Quiz | 음표 읽기·소리 맞히기·두 음 비교·화음 맞히기",
    metaDescription:
      "음표, 음정, 화음을 읽고 듣는 연습을 해 보세요. 화면의 건반이나 보기로 답할 수 있으며, 가입 없이 무료로 이용할 수 있습니다.",
  },
  ja: {
    introduction:
      "音符を読んだり、音や音程、和音を聴き分けたりして、一問ずつ練習できます。",
    steps: [
      {
        ...ja.steps[0],
        description: "読譜、聴音、音程、和音から練習したい内容を選びましょう。",
      },
      { ...ja.steps[1], description: "設定で難易度や練習内容を選べます。" },
      {
        ...ja.steps[2],
        description: "答えを確認したら、同じ設定でもう一度練習してみましょう。",
      },
    ],
    faq: [
      ja.faq[0],
      { ...ja.faq[1], answer: "いいえ。画面の鍵盤や選択肢で回答できます。" },
      ja.faq[3],
    ],
    metaTitle: "Note Quiz | 読譜・聴音・音程・和音の練習",
    metaDescription:
      "音符・音程・和音を、楽譜を読んだり音を聴いたりして練習できます。画面の鍵盤や選択肢で回答。登録不要で無料で利用できます。",
  },
  es: {
    introduction:
      "Practica notas, intervalos y acordes con ejercicios de lectura y audición, una pregunta a la vez.",
    steps: [
      {
        ...es.steps[0],
        description:
          "Elige lectura de notas, entrenamiento auditivo, intervalos o acordes.",
      },
      {
        ...es.steps[1],
        description: "Elige la dificultad y el contenido en Ajustes.",
      },
      {
        ...es.steps[2],
        description:
          "Comprueba tus respuestas y vuelve a practicar con los mismos ajustes.",
      },
    ],
    faq: [
      es.faq[0],
      {
        ...es.faq[1],
        answer:
          "No. Puedes responder con las teclas en pantalla o las opciones de respuesta.",
      },
      es.faq[3],
    ],
    metaTitle: "Note Quiz | Lectura musical y entrenamiento auditivo",
    metaDescription:
      "Practica notas, intervalos y acordes con ejercicios de lectura y audición. Responde con las teclas en pantalla o las opciones de respuesta. Gratis y sin registro.",
  },
  de: {
    introduction:
      "Übe Noten, Intervalle und Akkorde mit Fragen zum Lesen und Hören.",
    steps: [
      {
        ...de.steps[0],
        description: "Wähle Notenlesen, Gehörbildung, Intervalle oder Akkorde.",
      },
      {
        ...de.steps[1],
        description:
          "Wähle Schwierigkeit und Übungsinhalt in den Einstellungen.",
      },
      {
        ...de.steps[2],
        description:
          "Prüfe deine Antworten und übe mit denselben Einstellungen weiter.",
      },
    ],
    faq: [
      de.faq[0],
      {
        ...de.faq[1],
        answer:
          "Nein. Du kannst über die Tasten auf dem Bildschirm oder die Antwortmöglichkeiten antworten.",
      },
      de.faq[3],
    ],
    metaTitle: "Note Quiz | Notenlesen und Gehörbildung",
    metaDescription:
      "Übe Noten, Intervalle und Akkorde mit Fragen zum Lesen und Hören. Antworte über die Tasten auf dem Bildschirm oder die Antwortmöglichkeiten. Kostenlos und ohne Anmeldung.",
  },
  fr: {
    introduction:
      "Entraînez-vous à lire les notes et à reconnaître les sons, les intervalles et les accords, une question à la fois.",
    steps: [
      {
        ...fr.steps[0],
        description:
          "Choisissez la lecture de notes, la reconnaissance des notes à l'oreille, les intervalles ou les accords.",
      },
      {
        ...fr.steps[1],
        description:
          "Choisissez la difficulté et le contenu dans les réglages.",
      },
      {
        ...fr.steps[2],
        description:
          "Vérifiez vos réponses et recommencez avec les mêmes réglages.",
      },
    ],
    faq: [
      fr.faq[0],
      {
        ...fr.faq[1],
        answer:
          "Non. Vous pouvez répondre avec les touches à l'écran ou les choix proposés.",
      },
      fr.faq[3],
    ],
    metaTitle: "Note Quiz | Lecture de notes et formation de l'oreille",
    metaDescription:
      "Travaillez les notes, les intervalles et les accords avec des exercices de lecture et d'écoute. Répondez avec les touches à l'écran ou les choix proposés. Gratuit, sans inscription.",
  },
  zh: {
    introduction: "从识谱到辨认单音、音程与和弦，一次练一题。",
    steps: [
      { ...zh.steps[0], description: "选择识谱、单音听辨、音程或和弦练习。" },
      { ...zh.steps[1], description: "在设置中选择难度和练习内容。" },
      { ...zh.steps[2], description: "查看答案后，可以沿用相同设置再次练习。" },
    ],
    faq: [
      zh.faq[0],
      { ...zh.faq[1], answer: "不需要。可以通过屏幕上的琴键或选项作答。" },
      zh.faq[3],
    ],
    metaTitle: "Note Quiz | 识谱、听音、音程与和弦练习",
    metaDescription:
      "通过看谱和听音练习音符、音程与和弦，使用屏幕上的琴键或选项作答。无需注册，免费使用。",
  },
  pt: portugueseBasicHome,
  ru: russianBasicHome,
  ka: georgianBasicHome,
  eo: esperantoBasicHome,
};

export function homeCopy(language: Language, melodyEnabled = true): HomeCopy {
  const copy = homeTranslations[language];
  return melodyEnabled ? copy : { ...copy, ...basicHomeTranslations[language] };
}
