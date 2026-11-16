import { navigationTranslations } from "./navigation";
import type { LearningTranslations } from "./learning";
import type { Translations } from "./translations";

export const portugueseLearning = {
  noteDescription:
    "Identifique as notas na pauta. Escolha a clave, a tonalidade e a extensão para praticar leitura musical sem criar uma conta.",
  earDescription:
    "Ouça uma nota e responda com o teclado na tela ou o nome da nota. Escolha a extensão e treine o ouvido sem criar uma conta.",
  intervalDescription:
    "Compare duas notas pelo som ou pela pauta. Comece com mais aguda, igual ou mais grave e pratique intervalos sem criar uma conta.",
  chordDescription:
    "Reconheça acordes pelo som ou pela pauta. Pratique acordes maiores e menores, inversões e progressões sem criar uma conta.",
  chooseMode: "Tipo de exercício",
  note: "Leitura musical",
  ear: "Percepção de notas",
  interval: "Intervalos",
  intervalTask: "Nomes dos intervalos",
  chord: "Acordes",
  sessionType: "Tipo de sessão",
  ten: "10 questões · Recomendado",
  free: "Prática livre",
  timed: "Com tempo limite",
  progress: "Progresso",
  review: "Revisar erros",
  restart: "Praticar novamente com as mesmas configurações",
  changePractice: "Alterar o exercício ou a dificuldade",
  noMistakes: "Nenhum erro para revisar. Experimente o próximo nível.",
  noAnswers: "Você ainda não respondeu. Comece uma sessão curta.",
  reviewNotice:
    "A revisão é uma prática separada e não soma pontos para o país.",
  leaderboardNotice:
    "Na leitura musical, responda pelo menos 10 questões para contribuir com pontos para o país. Outros exercícios e revisões não enviam pontuações.",
  dailyNotice:
    "A prática diária fica salva neste navegador e não soma pontos para o país.",
  audioError:
    "Não foi possível reproduzir o áudio. Confira as configurações de som e tente novamente ou pratique com a partitura.",
  retryAudio: "Tentar reproduzir o áudio",
  next: "Próxima questão",
  finish: "Encerrar",
  answer: "Resposta correta",
  yourAnswer: "Sua resposta",
  returnPractice: "Voltar à prática normal",
  preset: "Predefinição",
  treblePreset: "Clave de sol · 10 notas",
  bassPreset: "Clave de fá · 10 notas",
  directionPreset: "Mais agudo ou mais grave · 10 questões",
  intervalPreset: "Intervalos básicos · 10 questões",
  chordPreset: "Maior ou menor · 10 questões",
  difficulty: "Dificuldade",
  beginner: "Iniciante",
  basic: "Básico",
  advanced: "Avançado",
  custom: "Personalizado",
  listening: "Ouvir e identificar",
  reading: "Ler e identificar",
  task: "Conteúdo",
  direction: "Direção da altura",
  quality: "Tipo de acorde",
  inversion: "Inversão",
  progression: "Progressão harmônica",
  playDirection: "Ordem de reprodução",
  ascending: "Ascendente",
  descending: "Descendente",
  simultaneous: "Simultâneo",
  arpeggio: "Arpejo",
  example: "Exemplo",
  play: "Ouvir novamente",
  playingAudio: "Reproduzindo",
  selectAnswer: "Escolha uma resposta",
  components: "Notas do acorde",
  tonic:
    "Referência tonal: ouça primeiro o acorde de tônica e identifique a progressão.",
  semitones: "semitons",
  inversionHelp:
    "Você ouvirá a fundamental de referência e depois o acorde. Identifique a inversão pela nota mais grave.",
  directionHelp:
    "A segunda nota é mais aguda, igual ou mais grave que a primeira?",
  intervalAudioHelp:
    "Identifique a distância entre as notas. Na prática auditiva, o trítono tem uma única resposta, independentemente da grafia musical.",
  intervalHelp:
    "Ao ler um intervalo, considere os nomes das notas e a distância em semitons.",
  chordHelp:
    "Identifique o tipo de acorde ou a posição do baixo, não o nome da fundamental.",
  higher: "Mais agudo",
  lower: "Mais grave",
  same: "Igual",
  root: "Estado fundamental",
  first: "1ª inversão",
  second: "2ª inversão",
  third: "3ª inversão",
  interval_P1: "Uníssono justo",
  interval_m2: "2ª menor",
  interval_M2: "2ª maior",
  interval_m3: "3ª menor",
  interval_M3: "3ª maior",
  interval_P4: "4ª justa",
  interval_TT: "Trítono",
  interval_A4: "4ª aumentada",
  interval_d5: "5ª diminuta",
  interval_P5: "5ª justa",
  interval_m6: "6ª menor",
  interval_M6: "6ª maior",
  interval_m7: "7ª menor",
  interval_M7: "7ª maior",
  interval_P8: "8ª justa",
  quality_major: "Maior",
  quality_minor: "Menor",
  quality_diminished: "Diminuto",
  quality_augmented: "Aumentado",
  quality_maj7: "Maior com 7ª maior",
  quality_dom7: "7ª da dominante",
  quality_min7: "Menor com 7ª menor",
  quality_halfDim7: "Meio-diminuto",
  quality_dim7: "7ª diminuta",
  activeDaily: "Prática diária em andamento",
  daily: "10 questões de hoje",
  dailyDate:
    "Atualizado diariamente às 00:00 UTC. O mesmo dia, tipo e nível têm as mesmas questões.",
  dailyDone: "Concluído neste navegador",
  dailyStart: "Iniciar prática de hoje",
  normalPractice: "Prática normal",
  history: "Histórico recente e próximos exercícios",
  localOnly:
    "Salvo apenas neste navegador, sem sincronização entre dispositivos. São mantidas até 60 sessões dos últimos 30 dias e 30 dias de conclusões diárias. Respostas individuais e áudio não são armazenados.",
  noHistory: "Conclua uma sessão para ver seu histórico recente.",
  insufficient:
    "Ainda há poucas respostas para identificar o que precisa de mais prática.",
  practiceType: "Praticar este tipo",
  clearHistory: "Limpar histórico de aprendizagem",
  historyCleared: "Histórico de aprendizagem apagado.",
  storageUnavailable:
    "O armazenamento do navegador não está disponível. Você pode praticar, mas o progresso não será salvo.",
  complete: "Concluído",
  stopped: "Encerrado antes do fim",
  share: "Copiar link do exercício",
  copied:
    "Link copiado. Apenas as configurações do exercício são compartilhadas.",
  copyFailed: "Não foi possível copiar. Selecione e copie o link abaixo.",
  sharedSettings:
    "As configurações do link têm prioridade. O exercício e o som não começam automaticamente.",
  invalidSettings:
    "Algumas configurações do link eram inválidas e foram substituídas por valores padrão seguros.",
  expandSettings: "Configurações avançadas",
  entryDescription:
    "Comece com 10 questões, revise seus erros e escolha o próximo exercício.",
} satisfies LearningTranslations;

export const portugueseTranslations = {
  navigation: navigationTranslations.pt,
  learning: portugueseLearning,
  gameTitle: "Note Quiz",
  gameNavTitle: "Leitura musical",
  brandDescription: "Domine a leitura da pauta musical",
  startGame: "Iniciar prática",
  pauseGame: "Pausar",
  resumeGame: "Continuar",
  endGame: "Encerrar prática",
  resetGame: "Reiniciar",
  settings: "Configurações",
  practiceUi: {
    minimizeResults: "Minimizar resultados",
    viewResults: "Ver resultados",
  },
  siteFooter: {
    about: "Sobre",
    contact: "Contato",
    privacy: "Política de privacidade",
    terms: "Termos de uso",
    rights: "Todos os direitos reservados.",
  },
  gameStates: {
    idle: "Pronto",
    playing: "Em andamento",
    paused: "Em pausa",
    finished: "Encerrado",
  },
  clefs: {
    treble: "Clave de sol",
    bass: "Clave de fá",
    alto: "Clave de dó na 3ª linha",
    tenor: "Clave de dó na 4ª linha",
    random: "Aleatória",
  },
  keySignatures: { major: "{key} maior", random: "Aleatória" },
  answerModes: {
    piano: "Teclado de piano",
    solfege: "Solfejo",
    microphone: "Microfone",
  },
  microphone: {
    title: "Entrada pelo microfone",
    signal: "Sinal do microfone",
    signalQuiet: "Aguardando som",
    signalActive: "Som detectado",
    description:
      "Mantenha o botão pressionado e toque uma nota. Solte ou mova o foco para responder. Também funciona com Espaço ou Enter.",
    startListening: "Segure para detectar",
    stopListening: "Solte para responder",
    listening: "Captando áudio",
    ready: "Pronto",
    detectedNote: "Nota detectada",
    submitDetectedNote: "Enviar nota detectada",
    noNoteDetected: "Nenhuma nota estável detectada ainda",
    permissionDenied: "O acesso ao microfone foi negado.",
    unsupported: "Este navegador não oferece suporte à entrada pelo microfone.",
    quietRoomHint:
      "Para melhores resultados, sustente uma única nota em um ambiente silencioso.",
  },
  difficulties: {
    easy: "Fácil",
    medium: "Médio",
    hard: "Difícil",
    expert: "Especialista",
  },
  settingsLabels: {
    clef: "Clave",
    keySignature: "Armadura de clave",
    octaveRange: "Faixa de oitavas",
    octaveMin: "Mínima",
    octaveMax: "Máxima",
    answerMode: "Modo de resposta",
    language: "Idioma",
    enableSound: "Ativar som",
    timeLimit: "Tempo limite (segundos)",
    timeLimitEnable: "Ativar tempo limite",
    resetToDefault: "Restaurar padrões",
    cancel: "Cancelar",
    apply: "Aplicar",
    random: "Aleatório",
    staffRange: "Extensão da pauta",
    ledgerLinesAbove: "Linhas suplementares superiores",
    ledgerLinesBelow: "Linhas suplementares inferiores",
    ledgerLinesInstruction:
      "Mais linhas suplementares ampliam a extensão das notas geradas.",
    accidentals: "Acidentes",
    accidentalProbability: "Probabilidade de acidentes",
    resetAllStats: "Zerar todas as estatísticas",
  },
  scoreboard: {
    title: "Pontuação",
    correct: "Acertos",
    total: "Total",
    accuracy: "Taxa de acerto",
    gameResult: "Resultado da prática",
    finalScore: "Pontuação final",
    finalAccuracy: "Taxa de acerto final",
    totalTime: "Tempo total",
    averageTime: "Tempo médio",
    overallStats: "Estatísticas gerais",
    gamesPlayed: "Sessões realizadas",
    overallAccuracy: "Taxa de acerto geral",
    bestAccuracy: "Melhor taxa de acerto",
    bestTime: "Melhor tempo",
    recentAnswers: "Respostas recentes",
    achievements: "Conquistas",
    sessionPoints: "Pontos da sessão",
    submission: {
      submitting: "Adicionando pontos ao total diário do seu país...",
      accepted: "Pontos adicionados ao total diário do seu país.",
      duplicate: "Esta sessão já foi contabilizada.",
      ineligible: "Responda pelo menos 10 questões para contribuir com pontos.",
      failed:
        "Seu resultado foi salvo localmente, mas não foi possível enviar os pontos.",
    },
  },
  timer: {
    elapsed: "Tempo decorrido",
    remaining: "Tempo restante",
    timeLimit: "tempo limite",
  },
  achievements: {
    perfect: "🏆 Perfeito!",
    excellent: "⭐ Excelente",
    good: "👍 Muito bem",
    endurance: "💪 Persistência",
    fast: "⚡ Rapidez",
  },
  piano: {
    instruction: "Toque em uma tecla para escolher a nota",
    selectedNote: "Nota selecionada",
  },
  solfege: {
    title: "Resposta por solfejo",
    instruction: "Toque no nome da nota para selecioná-la",
    selectedNote: "Nota selecionada",
    notes: {
      C: "Dó",
      "C#": "Dó♯",
      D: "Ré",
      "D#": "Ré♯",
      E: "Mi",
      F: "Fá",
      "F#": "Fá♯",
      G: "Sol",
      "G#": "Sol♯",
      A: "Lá",
      "A#": "Lá♯",
      B: "Si",
    },
  },
  messages: {
    whichNoteShown: "Qual é a nota mostrada?",
    correct: "Correto!",
    incorrect: "Incorreto",
    timeUp: "O tempo acabou!",
    gameComplete: "Prática concluída!",
    newRecord: "Novo recorde!",
    correctAnswer: "Resposta correta",
    yourAnswer: "Sua resposta",
    playSound: "🔊 Reproduzir som",
    startGameInstruction:
      "Ajuste as configurações e toque em “Iniciar prática”.",
    gameCompleteInstruction:
      "Prática concluída! Confira seu resultado no painel de pontuação.",
  },
  units: { seconds: "s", games: "sessões", questions: "questões" },
  ui: {
    close: "Fechar",
    retry: "Tentar novamente",
    welcome: "Boas-vindas ao Note Quiz!",
    description: "Aprenda a reconhecer notas pela leitura e pela audição!",
    features: {
      customSettings: "Configurações personalizáveis",
      realTimeFeedback: "Retorno imediato",
    },
    currentQuestionTime: "Tempo da questão atual",
    accidentalDescription:
      "Com os acidentes ativados, notas individuais podem receber ♯, ♭ ou ♮ além da armadura de clave.",
    ledgerLinesDescription:
      "Mais linhas suplementares ampliam a extensão das notas geradas.",
  },
  home: {
    hero: {
      title: "Note Quiz",
      description: "Aprenda a reconhecer notas pela leitura e pela audição!",
      sightReadingDescription: "Leia a nota na pauta e escolha seu nome.",
      cta: "Iniciar prática",
      previewTitle: "Veja como é a prática",
      previewSubtitle: "Leia, responda e pratique novamente",
    },
    features: {
      title: "Principais recursos",
      soundPlayback: {
        title: "Reprodução de áudio",
        description: "Ouça a altura exata de cada nota enquanto aprende.",
      },
      variousClefs: {
        title: "Várias claves",
        description: "Pratique as claves de sol, fá e dó na 3ª e na 4ª linha.",
      },
      instantFeedback: {
        title: "Retorno imediato",
        description:
          "Confira suas respostas na hora e aprenda com cada tentativa.",
      },
      multiLanguage: {
        title: "Vários idiomas",
        description: "Disponível em 8 idiomas, incluindo português do Brasil.",
      },
    },
    howToUse: {
      title: "Como usar",
      step1: {
        title: "Iniciar prática",
        description:
          "Toque em “Iniciar prática” para começar a aprender as notas.",
      },
      step2: {
        title: "Identifique a nota",
        description: "Veja a nota na pauta e ouça seu som.",
      },
      step3: {
        title: "Responda",
        description:
          "Use o teclado de piano ou os botões de solfejo para responder.",
      },
      step4: {
        title: "Continue aprendendo",
        description: "Resolva mais questões para melhorar sua leitura musical.",
      },
    },
    faq: {
      title: "Perguntas frequentes",
      q1: {
        question: "O que é o Note Quiz?",
        answer:
          "O Note Quiz é uma ferramenta interativa para melhorar a leitura de notas em partituras. Ele combina notação musical e áudio para ajudar você a reconhecer as notas.",
      },
      q2: {
        question: "Quais claves estão disponíveis?",
        answer:
          "Você pode praticar separadamente as claves de sol, fá, dó na 3ª linha (alto) e dó na 4ª linha (tenor).",
      },
      q3: {
        question: "Posso praticar armaduras de clave?",
        answer:
          "Sim. Você pode escolher uma armadura de clave nas configurações ou praticar com armaduras aleatórias.",
      },
      q4: {
        question: "Quais idiomas estão disponíveis?",
        answer:
          "São 8 idiomas: inglês, coreano, japonês, espanhol, alemão, francês, chinês simplificado e português do Brasil. Nas páginas sem prefixo de idioma, a seleção segue as configurações do navegador. Você também pode trocar o idioma manualmente.",
      },
      q5: {
        question: "Preciso pagar para usar?",
        answer:
          "Não. O Note Quiz é gratuito e pode ser usado sem cadastro ou pagamento.",
      },
      q6: {
        question: "Posso usar no celular?",
        answer:
          "Sim. O Note Quiz se adapta às telas de celulares, tablets e computadores.",
      },
    },
    about: {
      title: "Sobre o Note Quiz",
      description1:
        "O Note Quiz é uma plataforma interativa para quem estuda música e quer reconhecer notas em partituras com mais facilidade.",
      description2:
        "Se você está aprendendo gaita, piano ou canto e tem dificuldade com a leitura musical, pode praticar aqui de forma divertida.",
      description3:
        "A combinação de partitura, áudio e retorno imediato ajuda no aprendizado. Com várias claves, armaduras e acidentes, os exercícios atendem a diferentes níveis.",
      description4:
        "Pratique leitura musical com o Note Quiz e aproveite o prazer de aprender música.",
    },
    cta: {
      title: "Comece agora",
      description:
        "Melhore sua leitura musical e torne o aprendizado mais divertido.",
      button: "Iniciar prática",
    },
    footer: {
      copyright: "© 2024 Note Quiz. Todos os direitos reservados.",
      tagline: "Prática interativa de reconhecimento de notas musicais",
    },
  },
  leaderboard: {
    navTitle: "Classificação",
    eyebrow: "Classificação mundial",
    title: "Classificação de países de hoje",
    description:
      "Os pontos da prática normal de leitura musical são agrupados por país e classificados pelo total do dia atual em UTC.",
    accumulationPeriod: "Período de pontuação",
    scoresResetDaily: "Os pontos são zerados diariamente.",
    yourCountry: "Seu país",
    detectingCountry: "Identificando o país",
    countryCode: "Código do país",
    privacyNote:
      "O país é identificado no servidor apenas para agrupar a classificação. Endereços IP brutos não são armazenados. Comprovantes anônimos de sessões são mantidos por 7 dias e totais diários por 90 dias.",
    countryRankings: "Classificação por país",
    loading: "Carregando classificação...",
    empty:
      "Ainda não há pontos na classificação. Conclua uma sessão para contribuir.",
    error: "Não foi possível carregar a classificação.",
    columns: {
      rank: "Posição",
      country: "País",
      code: "Código",
      totalScore: "Pontos do país",
      submissions: "Envios",
      averageAccuracy: "Taxa de acerto média",
      updated: "Atualização",
    },
  },
  earTraining: {
    title: "Treino auditivo",
    subtitle: "Prática de ouvido absoluto",
    description: "Ouça uma nota e identifique-a o mais rápido possível.",
    settings: "Configurações",
    replay: "Ouvir a nota novamente",
    start: "Começar sessão",
    restart: "Recomeçar",
    stop: "Encerrar sessão",
    listenPrompt: "Ouça a nota e escolha a resposta correta.",
    currentTarget: "Faixa de notas atual",
    session: { practice: "Prática livre", timed: "Com tempo limite" },
    noteSet: {
      title: "Conjunto de notas",
      natural: "Naturais",
      chromatic: "Cromáticas",
    },
    inputMode: {
      title: "Modo de resposta",
      piano: "Piano",
      solfege: "Solfejo",
    },
    result: {
      title: "Resultado da sessão",
      replayCount: "Repetições do áudio",
      averageTime: "Tempo médio",
      bestAccuracy: "Melhor taxa de acerto",
      sessionsPlayed: "Sessões realizadas",
    },
  },
} satisfies Translations;
